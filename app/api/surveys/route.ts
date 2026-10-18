// @ts-nocheck
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireTeacher } from "@/lib/auth";
import { activeCampStudentWhere } from "@/lib/active-camp-student";

const surveySchema = z.object({
  campId: z
    .union([z.string(), z.number()])
    .transform((v) => parseInt(v.toString())),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  questions: z
    .array(
      z.object({
        id: z.number().optional(),
        text: z.string(),
        type: z.enum(["text", "scale", "header", "grid", "checkbox"]),
        scaleMax: z.number().optional(),
        options: z.array(z.string()).optional(),
      }),
    )
    .optional(),
  saveAsTemplate: z.boolean().optional(),
  templateTitle: z.string().optional(),
});

// GET /api/surveys?campId=<id>
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const campId = searchParams.get("campId");

    if (!campId) {
      return NextResponse.json(
        { error: "campId is required" },
        { status: 400 },
      );
    }

    const parsedCampId = parseInt(campId);
    const survey = await prisma.survey.findUnique({
      where: { camp_camp_id: parsedCampId },
      include: {
        survey_question: {
          orderBy: { question_id: "asc" },
        },
        _count: {
          select: {
            survey_response: {
              where: {
                student_enrollment: {
                  student: activeCampStudentWhere(parsedCampId),
                },
              },
            },
          },
        },
      },
    });

    return NextResponse.json(survey);
  } catch {
    //     console.error("Error fetching survey:", error);

    return NextResponse.json(
      { _error: "Failed to fetch survey" },
      { status: 500 },
    );
  }
}

// POST /api/surveys — สร้างแบบสอบถามใหม่สำหรับค่าย
export async function POST(request) {
  try {
    const { teacher, error: authError } = await requireTeacher();

    if (authError) return authError;

    const rawBody = await request.json();

    rawBody.teacherId = teacher.teachers_id; // force teacher id
    const body = surveySchema.parse(rawBody);
    const {
      campId,
      title,
      description,
      questions,
      saveAsTemplate,
      templateTitle,
    } = body;

    // ตรวจสอบว่าค่ายนี้มีแบบสอบถามอยู่แล้วหรือไม่ และเช็ค ownership
    const camp = await prisma.camp.findUnique({
      where: { camp_id: campId },
      include: { survey: true },
    });

    if (!camp)
      return NextResponse.json({ error: "Camp not found" }, { status: 404 });

    if (
      camp.created_by_teacher_id !== teacher.teachers_id &&
      teacher.role !== "ADMIN"
    ) {
      return NextResponse.json(
        { error: "Unauthorized to add survey to this camp" },
        { status: 403 },
      );
    }

    if (camp.survey.length > 0) {
      return NextResponse.json(
        { error: "ค่ายนี้มีแบบสอบถามอยู่แล้ว" },
        { status: 409 },
      );
    }

    // สร้างแบบสอบถาม
    const survey = await prisma.survey.create({
      data: {
        title,
        description,
        camp_camp_id: parseInt(campId),
        survey_question: {
          create: (questions || []).map((q) => ({
            question_text: q.text,
            question_type: q.type,
            scale_max: q.type === "scale" ? q.scaleMax || 5 : null,
            options: ["grid", "checkbox"].includes(q.type)
              ? JSON.stringify(q.options || [])
              : null,
          })),
        },
      },
      include: {
        survey_question: true,
      },
    });

    // บันทึกเป็นเทมเพลตถ้าต้องการ
    if (saveAsTemplate) {
      await prisma.survey_template.create({
        data: {
          title: templateTitle || title,
          description,
          created_by_teacher_id: teacher.teachers_id,
          survey_template_question: {
            create: (questions || []).map((q) => ({
              question_text: q.text,
              question_type: q.type,
              scale_max: q.type === "scale" ? q.scaleMax || 5 : null,
              options: ["grid", "checkbox"].includes(q.type)
                ? JSON.stringify(q.options || [])
                : null,
            })),
          },
        },
      });
    }

    return NextResponse.json(survey, { status: 201 });
  } catch {
    //     console.error("Error creating survey:", error);

    return NextResponse.json(
      { _error: "Failed to create survey" },
      { status: 500 },
    );
  }
}

// PUT /api/surveys?campId=<id> — แก้ไขแบบสอบถามเดิม
export async function PUT(request) {
  try {
    const { teacher, error: authError } = await requireTeacher();

    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const rawCampId = searchParams.get("campId");
    const rawBody = await request.json();

    rawBody.campId = rawCampId; // combine for zod

    const body = surveySchema.parse(rawBody);
    const {
      campId: campIdNum,
      title,
      description,
      questions,
      saveAsTemplate,
      templateTitle,
    } = body;

    // เช็คว่ามีอยู่จริงหรือไม่ และเช็ค ownership
    const existing = await prisma.survey.findUnique({
      where: { camp_camp_id: campIdNum },
      include: { survey_question: true, camp: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "ไม่พบแบบสอบถาม" }, { status: 404 });
    }

    if (
      existing.camp.created_by_teacher_id !== teacher.teachers_id &&
      teacher.role !== "ADMIN"
    ) {
      return NextResponse.json(
        { error: "Unauthorized to edit this survey" },
        { status: 403 },
      );
    }

    // อัปเดตข้อมูล survey และ questions แบบรายข้อ (Google Forms style - รักษาคำตอบเดิมไว้)
    const updatedSurvey = await prisma.$transaction(async (tx) => {
      const existingQuestions = await tx.survey_question.findMany({
        where: { survey_survey_id: existing.survey_id },
      });

      const incomingQuestions = questions || [];
      const incomingQuestionIds = incomingQuestions
        .map((q) => q.id)
        .filter((id) => typeof id === "number" && !isNaN(id));

      // 1. ระบุคำถามที่ถูกลบออก (มีใน DB เดิม แต่ไม่มีใน payload ที่ส่งมา)
      const questionsToDelete = existingQuestions.filter(
        (eq) => !incomingQuestionIds.includes(eq.question_id),
      );

      if (questionsToDelete.length > 0) {
        const deleteIds = questionsToDelete.map((q) => q.question_id);

        // ลบข้อมูลที่ผูกกับคำถามที่ถูกลบเท่านั้น
        await tx.survey_answer.deleteMany({
          where: { question_id: { in: deleteIds } },
        });
        await tx.survey_question.deleteMany({
          where: { question_id: { in: deleteIds } },
        });
      }

      // 2. อัปเดตคำถามเดิม หรือ สร้างคำถามใหม่
      for (const q of incomingQuestions) {
        const isExisting =
          q.id && existingQuestions.some((eq) => eq.question_id === q.id);
        const scaleMaxVal = q.type === "scale" ? q.scaleMax || 5 : null;
        const optionsVal = ["grid", "checkbox"].includes(q.type)
          ? JSON.stringify(q.options || [])
          : null;

        if (isExisting) {
          // อัปเดตคำถามเดิม (คำตอบเดิมของนักเรียนใน survey_answer ยังอยู่ครบ)
          await tx.survey_question.update({
            where: { question_id: q.id },
            data: {
              question_text: q.text,
              question_type: q.type,
              scale_max: scaleMaxVal,
              options: optionsVal,
            },
          });
        } else {
          // สร้างคำถามใหม่
          await tx.survey_question.create({
            data: {
              survey_survey_id: existing.survey_id,
              question_text: q.text,
              question_type: q.type,
              scale_max: scaleMaxVal,
              options: optionsVal,
            },
          });
        }
      }

      // 3. อัปเดตข้อมูลหลักของแบบสอบถาม
      return tx.survey.update({
        where: { camp_camp_id: campIdNum },
        data: {
          title,
          description,
        },
        include: {
          survey_question: {
            orderBy: { question_id: "asc" },
          },
        },
      });
    });

    // บันทึกเป็นเทมเพลตถ้าต้องการ
    if (saveAsTemplate) {
      await prisma.survey_template.create({
        data: {
          title: templateTitle || title,
          description,
          created_by_teacher_id: teacher.teachers_id,
          survey_template_question: {
            create: (questions || []).map((q) => ({
              question_text: q.text,
              question_type: q.type,
              scale_max: q.type === "scale" ? q.scaleMax || 5 : null,
              options: ["grid", "checkbox"].includes(q.type)
                ? JSON.stringify(q.options || [])
                : null,
            })),
          },
        },
      });
    }

    return NextResponse.json(updatedSurvey, { status: 200 });
  } catch {
    //     console.error("Error updating survey:", error);

    return NextResponse.json(
      { _error: "Failed to update survey" },
      { status: 500 },
    );
  }
}

// DELETE /api/surveys?campId=<id>
export async function DELETE(request) {
  try {
    const { teacher, error: authError } = await requireTeacher();

    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const campId = searchParams.get("campId");

    if (!campId) {
      return NextResponse.json(
        { error: "campId is required" },
        { status: 400 },
      );
    }

    const existing = await prisma.survey.findUnique({
      where: { camp_camp_id: parseInt(campId) },
      include: { camp: true },
    });

    if (!existing)
      return NextResponse.json({ error: "Survey not found" }, { status: 404 });

    if (
      existing.camp.created_by_teacher_id !== teacher.teachers_id &&
      teacher.role !== "ADMIN"
    ) {
      return NextResponse.json(
        { error: "Unauthorized to delete this survey" },
        { status: 403 },
      );
    }

    await prisma.survey.delete({
      where: { camp_camp_id: parseInt(campId) },
    });

    return NextResponse.json({ message: "Survey deleted" });
  } catch {
    //     console.error("Error deleting survey:", error);

    return NextResponse.json(
      { _error: "Failed to delete survey" },
      { status: 500 },
    );
  }
}

// PATCH /api/surveys?campId=<id> — ปรับแต่งสถานะ เช่น เปิด/ปิดรับคำตอบ
export async function PATCH(request) {
  try {
    const { teacher, error: authError } = await requireTeacher();

    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const campId = searchParams.get("campId");

    if (!campId) {
      return NextResponse.json(
        { error: "campId is required" },
        { status: 400 },
      );
    }

    const cId = parseInt(campId);
    const existing = await prisma.survey.findUnique({
      where: { camp_camp_id: cId },
      include: { camp: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Survey not found" }, { status: 404 });
    }

    if (
      existing.camp.created_by_teacher_id !== teacher.teachers_id &&
      teacher.role !== "ADMIN"
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const dataToUpdate = {};

    if (typeof body.isAcceptingResponses === "boolean") {
      dataToUpdate.is_accepting_responses = body.isAcceptingResponses;
    }

    const updated = await prisma.survey.update({
      where: { camp_camp_id: cId },
      data: dataToUpdate,
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Failed to update survey" },
      { status: 500 },
    );
  }
}
