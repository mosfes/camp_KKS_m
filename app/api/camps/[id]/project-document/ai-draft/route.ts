import { NextResponse } from "next/server";

import { requireTeacher } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requestGeminiJson } from "@/lib/gemini-json";
import {
  buildProjectDocumentPrompt,
  projectDocumentAiSchema,
  toProjectDocumentFields,
} from "@/lib/project-document-ai";

export const maxDuration = 90;

/**
 * POST - ให้ AI ร่างเนื้อหาเอกสารข้อเสนอโครงการจากชื่อโครงการ
 * คืนเฉพาะร่างกลับไปให้หน้าแก้ไขเติมลงฟอร์ม ยังไม่บันทึก (หน้าแก้ไขจะ auto-save เอง)
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { teacher, error } = await requireTeacher();

  if (error || !teacher) return error;
  const { id } = await context.params;
  const campId = Number(id);

  if (!Number.isInteger(campId)) {
    return NextResponse.json({ error: "รหัสค่ายไม่ถูกต้อง" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const projectName =
    typeof body?.projectName === "string"
      ? body.projectName.trim().slice(0, 500)
      : "";

  if (!projectName) {
    return NextResponse.json(
      { error: "กรุณากรอกชื่อโครงการ" },
      { status: 400 },
    );
  }

  const camp = await prisma.camp.findFirst({
    where: { camp_id: campId, deletedAt: null },
    select: { created_by_teacher_id: true },
  });

  if (!camp) {
    return NextResponse.json({ error: "ไม่พบค่าย" }, { status: 404 });
  }
  if (
    teacher.role !== "ADMIN" &&
    camp.created_by_teacher_id !== teacher.teachers_id
  ) {
    return NextResponse.json(
      { error: "คุณไม่มีสิทธิ์จัดทำเอกสารของค่ายนี้" },
      { status: 403 },
    );
  }

  const aiResult = await requestGeminiJson(
    buildProjectDocumentPrompt({
      projectName,
      location: typeof body?.location === "string" ? body.location : null,
      durationText:
        typeof body?.durationText === "string" ? body.durationText : null,
    }),
  );

  if ("error" in aiResult) {
    const { status, responseStatus } = aiResult.error;
    const message =
      status === "MISSING_API_KEY"
        ? "ระบบไม่ได้ตั้งค่า GEMINI_API_KEY ไม่สามารถใช้งาน AI ได้"
        : status === "RESOURCE_EXHAUSTED" || responseStatus === 429
          ? "โควตา AI หมดชั่วคราว กรุณาลองใหม่ภายหลัง"
          : "AI ไม่สามารถร่างเอกสารได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง";

    return NextResponse.json({ error: message, code: status }, { status: 502 });
  }

  const draft = projectDocumentAiSchema.parse(aiResult.json);

  if (!draft.rationale && draft.objectives.length === 0) {
    return NextResponse.json(
      { error: "ข้อมูลที่ AI ร่างมาไม่สมบูรณ์ กรุณาลองใหม่อีกครั้ง" },
      { status: 502 },
    );
  }

  const responsible =
    typeof body?.responsible === "string" ? body.responsible.trim() : "";

  return NextResponse.json({
    project_name: projectName,
    ...toProjectDocumentFields(draft, responsible),
  });
}
