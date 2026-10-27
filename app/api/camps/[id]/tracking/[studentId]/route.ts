import { NextResponse } from "next/server";

import { activeCampStudentWhere } from "@/lib/active-camp-student";
import { requireTeacher } from "@/lib/auth";
import { canViewCampTracking } from "@/lib/camp-tracking-auth";
import { prisma } from "@/lib/db";

type MissionAnswer = {
  questionId: number;
  questionText: string;
  type: "TEXT" | "MCQ" | "PHOTO" | "VIDEO";
  answer: string;
  isCorrect: boolean | null;
};

type RouteContext = {
  params: Promise<{ id: string; studentId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { teacher, error: authError } = await requireTeacher();

  if (authError) return authError;

  const { id, studentId: rawStudentId } = await context.params;
  const campId = Number(id);
  const studentId = Number(rawStudentId);

  if (
    !Number.isInteger(campId) ||
    campId <= 0 ||
    !Number.isInteger(studentId) ||
    studentId <= 0
  ) {
    return NextResponse.json(
      { error: "ข้อมูลค่ายหรือนักเรียนไม่ถูกต้อง" },
      { status: 400 },
    );
  }

  try {
    if (!(await canViewCampTracking(campId, teacher))) {
      return NextResponse.json(
        { error: "ไม่มีสิทธิ์เข้าถึงข้อมูลนักเรียนในค่ายนี้" },
        { status: 403 },
      );
    }

    const [camp, student] = await Promise.all([
      prisma.camp.findFirst({
        where: { camp_id: campId, deletedAt: null },
        select: {
          camp_id: true,
          name: true,
          station: {
            where: { deletedAt: null },
            orderBy: { station_id: "asc" },
            select: {
              station_id: true,
              name: true,
              mission: {
                where: { deletedAt: null },
                orderBy: { mission_id: "asc" },
                select: {
                  mission_id: true,
                  title: true,
                  description: true,
                  type: true,
                },
              },
            },
          },
        },
      }),
      prisma.students.findFirst({
        where: {
          students_id: studentId,
          ...activeCampStudentWhere(campId),
        },
        select: {
          students_id: true,
          prefix_name: true,
          firstname: true,
          lastname: true,
          nickname: true,
          profile_image_url: true,
          student_enrollment: {
            where: { camp_camp_id: campId },
            take: 1,
            select: {
              enrolled_at: true,
              certificate: {
                select: { certificate_id: true },
                take: 1,
              },
              mission_result: {
                where: {
                  status: "completed",
                  mission: {
                    deletedAt: null,
                    station: {
                      camp_camp_id: campId,
                      deletedAt: null,
                    },
                  },
                },
                orderBy: { submitted_at: "desc" },
                select: {
                  mission_mission_id: true,
                  submitted_at: true,
                  method: true,
                  mission_answer: {
                    orderBy: { mission_question_question_id: "asc" },
                    select: {
                      mission_question_question_id: true,
                      mission_question: {
                        select: {
                          question_text: true,
                          question_type: true,
                          choices: {
                            orderBy: { choice_id: "asc" },
                            select: { choice_text: true, is_correct: true },
                          },
                        },
                      },
                      answer_text: { select: { answer_text: true }, take: 1 },
                      answer_mcq: { select: { question_text: true }, take: 1 },
                      answer_photo: { select: { img_url: true }, take: 1 },
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    if (!camp) {
      return NextResponse.json({ error: "ไม่พบค่าย" }, { status: 404 });
    }

    if (!student) {
      return NextResponse.json(
        { error: "ไม่พบนักเรียนในค่ายนี้" },
        { status: 404 },
      );
    }

    const enrollment = student.student_enrollment[0] ?? null;
    const resultByMission = new Map<
      number,
      {
        submittedAt: Date;
        method: "NFC" | "QR" | "Code" | "Aws" | "Photo";
        answers: MissionAnswer[];
      }
    >();

    const missionTypeById = new Map(
      camp.station.flatMap((station) =>
        station.mission.map((mission) => [mission.mission_id, mission.type]),
      ),
    );

    for (const result of enrollment?.mission_result ?? []) {
      if (!resultByMission.has(result.mission_mission_id)) {
        const isVideo =
          missionTypeById.get(result.mission_mission_id) === "VIDEO_SUBMISSION";
        const answers: MissionAnswer[] = [];

        for (const stored of result.mission_answer) {
          const question = stored.mission_question;
          let answer = "";
          let isCorrect: boolean | null = null;

          if (question.question_type === "TEXT") {
            answer = stored.answer_text[0]?.answer_text ?? "";
          } else if (question.question_type === "MCQ") {
            const letter = stored.answer_mcq[0]?.question_text ?? "";
            const choice = question.choices[letter.charCodeAt(0) - 65];

            if (choice) {
              answer = `${letter}. ${choice.choice_text}`;
              isCorrect = choice.is_correct;
            } else {
              answer = letter;
            }
          } else {
            answer = stored.answer_photo[0]?.img_url ?? "";
          }

          if (!answer) continue;

          answers.push({
            questionId: stored.mission_question_question_id,
            questionText: question.question_text,
            type: isVideo ? "VIDEO" : question.question_type,
            answer,
            isCorrect,
          });
        }

        resultByMission.set(result.mission_mission_id, {
          submittedAt: result.submitted_at,
          method: result.method,
          answers,
        });
      }
    }

    const missions = camp.station.flatMap((station) =>
      station.mission.map((mission) => {
        const result = resultByMission.get(mission.mission_id);

        return {
          missionId: mission.mission_id,
          title: mission.title || "ภารกิจไม่มีชื่อ",
          description: mission.description,
          type: mission.type,
          stationId: station.station_id,
          stationName: station.name,
          status: result ? "completed" : "not_started",
          submittedAt: result?.submittedAt ?? null,
          method: result?.method ?? null,
          answers: result?.answers ?? [],
        };
      }),
    );
    const completedMissions = missions.filter(
      (mission) => mission.status === "completed",
    ).length;

    return NextResponse.json(
      {
        camp: { campId: camp.camp_id, name: camp.name },
        student: {
          studentId: student.students_id,
          name: `${student.prefix_name ?? ""}${student.firstname} ${student.lastname}`,
          nickname: student.nickname,
          profileImageUrl: student.profile_image_url,
          initials: `${student.firstname.charAt(0)}${student.lastname.charAt(0)}`,
          isEnrolled: enrollment?.enrolled_at != null,
          hasCertificate: Boolean(enrollment?.certificate.length),
        },
        summary: {
          totalMissions: missions.length,
          completedMissions,
          notStartedMissions: missions.length - completedMissions,
        },
        missions,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "โหลดรายละเอียดภารกิจของนักเรียนไม่สำเร็จ" },
      { status: 500 },
    );
  }
}
