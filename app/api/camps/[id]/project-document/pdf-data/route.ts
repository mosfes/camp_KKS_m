import { NextResponse } from "next/server";

import { requireTeacher } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildProjectDownloadFilename } from "@/lib/project-download-filename";

export const runtime = "nodejs";

/** ส่งข้อมูลเอกสารให้เบราว์เซอร์สร้าง PDF เอง (ไม่สร้าง PDF บนเซิร์ฟเวอร์) */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { teacher, error } = await requireTeacher();

  if (error) return error;
  const { id } = await context.params;
  const campId = Number(id);

  const camp = await prisma.camp.findFirst({
    where: { camp_id: campId, deletedAt: null },
    include: { project_document: true },
  });

  if (!camp) return NextResponse.json({ error: "ไม่พบค่าย" }, { status: 404 });
  if (
    teacher.role !== "ADMIN" &&
    camp.created_by_teacher_id !== teacher.teachers_id
  ) {
    return NextResponse.json(
      { error: "คุณไม่มีสิทธิ์ดาวน์โหลดเอกสารนี้" },
      { status: 403 },
    );
  }
  if (!camp.project_document) {
    return NextResponse.json(
      { error: "กรุณาบันทึกเอกสารก่อนดาวน์โหลด" },
      { status: 404 },
    );
  }

  const filename = buildProjectDownloadFilename({
    projectCode: camp.project_document.project_code,
    projectName: camp.project_document.project_name,
    fallbackCode: campId,
    extension: "pdf",
  });

  return NextResponse.json(
    { document: camp.project_document, fileName: filename },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
