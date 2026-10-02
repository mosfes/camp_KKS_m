import { NextResponse } from "next/server";

import { requireTeacher } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  buildProjectSummaryDownloadFilename,
  projectDownloadContentDisposition,
} from "@/lib/project-download-filename";
import { createProjectSummaryDocumentPdf } from "@/lib/project-summary-document-pdf";

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
    include: {
      project_document: {
        select: { objectives: true },
      },
      project_summary_document: {
        include: { photos: { orderBy: { sort_order: "asc" } } },
      },
    },
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
  if (!camp.project_summary_document) {
    return NextResponse.json(
      { error: "กรุณาบันทึกเอกสารสรุปก่อนดาวน์โหลด" },
      { status: 404 },
    );
  }

  const bytes = await createProjectSummaryDocumentPdf({
    ...camp.project_summary_document,
    objectives:
      Array.isArray(camp.project_summary_document.objectives) &&
      camp.project_summary_document.objectives.length
        ? camp.project_summary_document.objectives
        : camp.project_document?.objectives || [],
  });
  const filename = buildProjectSummaryDownloadFilename({
    projectName: camp.project_summary_document.project_name,
    extension: "pdf",
  });

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": projectDownloadContentDisposition(filename),
      "Cache-Control": "private, no-store",
    },
  });
}
