// @ts-nocheck
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireTeacher } from "@/lib/auth";

const templateSchema = z.object({
  title: z.string().trim().min(1).max(255),
  description: z.string().optional(),
  questions: z
    .array(
      z.object({
        text: z.string().trim().min(1).max(255),
        type: z.enum(["text", "scale", "header", "grid", "checkbox"]),
        scaleMax: z.number().int().positive().optional(),
        options: z.array(z.string()).optional(),
      }),
    )
    .min(1),
});

// GET /api/surveys/templates  — ดึงรายการเทมเพลตของครู
export async function GET(_request) {
  try {
    const { teacher, error: authError } = await requireTeacher();

    if (authError) return authError;

    const templates = await prisma.survey_template.findMany({
      where: { created_by_teacher_id: teacher.teachers_id },
      include: {
        survey_template_question: { orderBy: { question_id: "asc" } },
      },
      orderBy: { created_at: "desc" },
    });

    return NextResponse.json(templates);
  } catch {
    //     console.error("Error fetching survey templates:", error);

    return NextResponse.json(
      { _error: "Failed to fetch templates" },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  const { teacher, error: authError } = await requireTeacher();

  if (authError) return authError;

  const parsed = templateSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (
    !parsed.success ||
    !parsed.data.questions.some((q) => q.type !== "header")
  ) {
    return NextResponse.json(
      { error: "กรุณากรอกชื่อและคำถามให้ครบถ้วน" },
      { status: 400 },
    );
  }

  try {
    const { title, description, questions } = parsed.data;
    const template = await prisma.survey_template.create({
      data: {
        title,
        description,
        created_by_teacher_id: teacher.teachers_id,
        survey_template_question: {
          create: questions.map((q) => ({
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
        survey_template_question: { orderBy: { question_id: "asc" } },
      },
    });

    return NextResponse.json(template, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "ไม่สามารถบันทึกเท็มเพลตได้" },
      { status: 500 },
    );
  }
}

// DELETE /api/surveys/templates?templateId=<id>
export async function DELETE(request) {
  try {
    const { teacher, error: authError } = await requireTeacher();

    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get("templateId");

    if (!templateId) {
      return NextResponse.json(
        { error: "templateId is required" },
        { status: 400 },
      );
    }

    const existing = await prisma.survey_template.findUnique({
      where: { template_id: parseInt(templateId) },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 },
      );
    }

    if (
      existing.created_by_teacher_id !== teacher.teachers_id &&
      teacher.role !== "ADMIN"
    ) {
      return NextResponse.json(
        { error: "Unauthorized to delete this template" },
        { status: 403 },
      );
    }

    await prisma.survey_template.delete({
      where: { template_id: parseInt(templateId) },
    });

    return NextResponse.json({ message: "Template deleted" });
  } catch {
    //     console.error("Error deleting template:", error);

    return NextResponse.json(
      { _error: "Failed to delete template" },
      { status: 500 },
    );
  }
}
