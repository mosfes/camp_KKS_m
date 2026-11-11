import { NextResponse } from "next/server";

import { requireTeacher } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  getBangkokDateAsUtcMidnight,
  getBangkokDateKey,
} from "@/lib/bangkok-date";
import {
  aiCampSchema,
  buildQuickCreatePrompt,
  planQuickCreateCamp,
  type QuickCreateClassroomOption,
} from "@/lib/camp-quick-create";
import { requestGeminiJson } from "@/lib/gemini-json";
import { toProjectDocumentFields } from "@/lib/project-document-ai";

// การให้ AI ร่างค่ายทั้งชุดใช้เวลานานกว่า request ปกติ
export const maxDuration = 90;

function formatThaiDate(value: Date) {
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  }).format(value);
}

async function loadClassroomOptions(): Promise<QuickCreateClassroomOption[]> {
  // ใช้ห้องเรียนของปีการศึกษาล่าสุดที่มีห้องเรียนอยู่
  const latest = await prisma.classrooms.findFirst({
    where: { deletedAt: null },
    orderBy: { academic_years_years_id: "desc" },
    select: { academic_years_years_id: true },
  });

  if (!latest) return [];

  const classrooms = await prisma.classrooms.findMany({
    where: {
      deletedAt: null,
      academic_years_years_id: latest.academic_years_years_id,
    },
    select: {
      classroom_id: true,
      grade: true,
      classroom_types: { select: { name: true } },
    },
  });

  return classrooms.map((c) => ({
    classroom_id: c.classroom_id,
    grade: Number(String(c.grade).replace("Level_", "")),
    type_name: c.classroom_types.name,
  }));
}

/**
 * POST - สร้างค่ายด่วนจากชื่อโครงการ
 * AI ร่างสถานที่ วันที่ กำหนดการ ฐาน/ภารกิจ แบบสอบถาม และเอกสารโครงการ
 * แล้วบันทึกทั้งหมดใน transaction เดียว
 */
export async function POST(request: Request) {
  const { teacher, error } = await requireTeacher();

  if (error || !teacher) return error;

  const body = await request.json().catch(() => null);
  const projectName =
    typeof body?.name === "string" ? body.name.trim().slice(0, 255) : "";

  if (!projectName) {
    return NextResponse.json(
      { error: "กรุณากรอกชื่อโครงการ" },
      { status: 400 },
    );
  }

  const classrooms = await loadClassroomOptions();

  if (classrooms.length === 0) {
    return NextResponse.json(
      { error: "ยังไม่มีห้องเรียนในระบบ กรุณาเพิ่มห้องเรียนก่อนสร้างค่าย" },
      { status: 400 },
    );
  }

  const todayKey = getBangkokDateKey();
  const aiResult = await requestGeminiJson(
    buildQuickCreatePrompt({ projectName, todayKey, classrooms }),
  );

  if ("error" in aiResult) {
    const { status, responseStatus } = aiResult.error;
    const message =
      status === "MISSING_API_KEY"
        ? "ระบบไม่ได้ตั้งค่า GEMINI_API_KEY ไม่สามารถใช้งาน AI ได้"
        : status === "RESOURCE_EXHAUSTED" || responseStatus === 429
          ? "โควตา AI หมดชั่วคราว กรุณาลองใหม่ภายหลัง"
          : "AI ไม่สามารถร่างข้อมูลค่ายได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง";

    return NextResponse.json({ error: message, code: status }, { status: 502 });
  }

  const parsed = aiCampSchema.safeParse(aiResult.json);

  if (!parsed.success) {
    console.warn("[camps/quick-create] AI output rejected", parsed.error);

    return NextResponse.json(
      { error: "ข้อมูลที่ AI ร่างมาไม่สมบูรณ์ กรุณาลองใหม่อีกครั้ง" },
      { status: 502 },
    );
  }

  const ai = parsed.data;
  const plan = planQuickCreateCamp(ai, todayKey, classrooms);

  const owner = await prisma.teachers.findUnique({
    where: { teachers_id: teacher.teachers_id },
    select: { prefix_name: true, firstname: true, lastname: true },
  });
  const ownerName = owner
    ? `${owner.prefix_name || ""}${owner.firstname} ${owner.lastname}`.trim()
    : "";

  const startDate = new Date(plan.campStartDate);
  const endDate = new Date(plan.campEndDate);
  const documentFields = toProjectDocumentFields(ai.document, ownerName);

  try {
    const camp = await prisma.$transaction(
      async (tx) => {
        const created = await tx.camp.create({
          data: {
            name: projectName,
            location: ai.location || "โรงเรียน",
            description: ai.description,
            start_date: startDate,
            end_date: endDate,
            start_regis_date: new Date(plan.registrationStartDate),
            end_regis_date: new Date(plan.registrationEndDate),
            has_shirt: false,
            start_shirt_date: getBangkokDateAsUtcMidnight(),
            end_shirt_date: getBangkokDateAsUtcMidnight(),
            status: "OPEN",
            img_camp_url: "",
            img_shirt_url: "",
            created_by_teacher_id: teacher.teachers_id,
            camp_daily_schedule: {
              create: plan.dailySchedule.map((day) => ({
                day: day.day,
                time_slots: { create: day.timeSlots },
              })),
            },
          },
        });

        await tx.camp_classroom.createMany({
          data: plan.classroomIds.map((classroomId) => ({
            camp_camp_id: created.camp_id,
            classroom_classroom_id: classroomId,
          })),
        });

        const classroomTeachers = await tx.classroom_teacher.findMany({
          where: { classroom_classroom_id: { in: plan.classroomIds } },
          select: { teacher_teachers_id: true },
        });
        const teacherIds = Array.from(
          new Set(classroomTeachers.map((ct) => ct.teacher_teachers_id)),
        );

        if (teacherIds.length > 0) {
          await tx.teacher_enrollment.createMany({
            data: teacherIds.map((tid) => ({
              teacher_teachers_id: tid,
              camp_camp_id: created.camp_id,
            })),
            skipDuplicates: true,
          });
        }

        for (const station of plan.stations) {
          await tx.station.create({
            data: {
              name: station.name,
              description: station.description,
              camp_camp_id: created.camp_id,
              mission: {
                create: station.missions.map((mission) => ({
                  title: mission.title,
                  description: mission.description,
                  type: mission.type,
                  mission_question: {
                    create: mission.questions.map((question) => ({
                      question_text: question.text,
                      question_type:
                        mission.type === "MULTIPLE_CHOICE_QUIZ"
                          ? "MCQ"
                          : mission.type === "PHOTO_SUBMISSION"
                            ? "PHOTO"
                            : "TEXT",
                      choices: {
                        create: question.choices.map((choice) => ({
                          choice_text: choice.text,
                          is_correct: choice.is_correct,
                        })),
                      },
                    })),
                  },
                })),
              },
            },
          });
        }

        if (plan.survey.questions.length > 0) {
          await tx.survey.create({
            data: {
              title: plan.survey.title,
              description: plan.survey.description || null,
              camp_camp_id: created.camp_id,
              survey_question: {
                create: plan.survey.questions.map((q) => ({
                  question_text: q.text,
                  question_type: q.type,
                  scale_max: q.type === "scale" ? 5 : null,
                })),
              },
            },
          });
        }

        await tx.camp_project_document.create({
          data: {
            camp_camp_id: created.camp_id,
            fiscal_year: startDate.getFullYear() + 543,
            project_name: projectName,
            activity_name: projectName,
            ...documentFields,
            rationale: documentFields.rationale || ai.description || null,
            responsible_people: ownerName || null,
            duration_text: `ระหว่างวันที่ ${formatThaiDate(startDate)} ถึง ${formatThaiDate(endDate)}`,
            location_text: ai.location || "โรงเรียน",
            signatories: [],
            status: "DRAFT",
          },
        });

        return created;
      },
      { timeout: 30_000 },
    );

    return NextResponse.json(
      {
        message: "สร้างค่ายสำเร็จ",
        camp,
        summary: {
          classrooms: plan.classroomIds.length,
          scheduleDays: plan.dailySchedule.length,
          stations: plan.stations.length,
          missions: plan.stations.reduce((n, s) => n + s.missions.length, 0),
          surveyQuestions: plan.survey.questions.length,
          budgetTotal: documentFields.budget_total,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("[camps/quick-create] Failed to save camp", err);

    return NextResponse.json(
      { error: "บันทึกค่ายไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" },
      { status: 500 },
    );
  }
}
