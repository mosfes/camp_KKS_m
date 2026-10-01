import { NextResponse } from "next/server";

import { requireTeacher } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createProjectDocumentDocx } from "@/lib/project-document-docx";
import {
  buildProjectDownloadFilename,
  projectDownloadContentDisposition,
} from "@/lib/project-download-filename";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { teacher, error } = await requireTeacher();

  if (error) return error;

  const campId = Number((await context.params).id);
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

  const bytes = await createProjectDocumentDocx(camp.project_document);
  const filename = buildProjectDownloadFilename({
    projectCode: camp.project_document.project_code,
    projectName: camp.project_document.project_name,
    fallbackCode: campId,
    extension: "docx",
  });

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": projectDownloadContentDisposition(filename),
      "Cache-Control": "private, no-store",
    },
  });
}
