import { NextResponse } from "next/server";

import cloudinary, { isCloudinaryConfigured } from "@/config/cloudinary";
import { requireTeacher } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];
const MAX_FILE_SIZE = 20 * 1024 * 1024;

function uploadBuffer(buffer: Buffer, campId: number) {
  return new Promise<{ secure_url: string; public_id: string }>(
    (resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            folder: `camp-summary/${campId}`,
            resource_type: "image",
            timeout: 120000,
            transformation: [
              { width: 2000, height: 2000, crop: "limit" },
              { quality: "auto", fetch_format: "jpg" },
            ],
          },
          (error, result) => {
            if (error || !result) {
              reject(error ?? new Error("No result from Cloudinary"));
              return;
            }
            resolve({
              secure_url: result.secure_url,
              public_id: result.public_id,
            });
          },
        )
        .end(buffer);
    },
  );
}

async function getSummary(campId: number, teacher: any) {
  const camp = await prisma.camp.findFirst({
    where: { camp_id: campId, deletedAt: null },
    select: { created_by_teacher_id: true },
  });
  if (!camp)
    return {
      error: NextResponse.json({ error: "ไม่พบค่าย" }, { status: 404 }),
    };
  if (
    teacher.role !== "ADMIN" &&
    camp.created_by_teacher_id !== teacher.teachers_id
  ) {
    return {
      error: NextResponse.json(
        { error: "คุณไม่มีสิทธิ์จัดการรูปภาพของค่ายนี้" },
        { status: 403 },
      ),
    };
  }
  const summary = await prisma.camp_project_summary_document.findUnique({
    where: { camp_camp_id: campId },
  });
  if (!summary) {
    return {
      error: NextResponse.json(
        { error: "กรุณาบันทึกเอกสารสรุปก่อนเพิ่มรูปภาพ" },
        { status: 404 },
      ),
    };
  }
  if (summary.status === "FINALIZED") {
    return {
      error: NextResponse.json(
        { error: "เอกสารฉบับสมบูรณ์ถูกยืนยันแล้ว กรุณาปลดล็อกก่อนแก้ไขรูปภาพ" },
        { status: 409 },
      ),
    };
  }
  return { summary };
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { teacher, error } = await requireTeacher();
  if (error) return error;
  if (!isCloudinaryConfigured()) {
    return NextResponse.json(
      { error: "ระบบอัปโหลดรูปยังไม่ได้ตั้งค่า Cloudinary" },
      { status: 503 },
    );
  }

  const campId = Number((await context.params).id);
  const access = await getSummary(campId, teacher);
  if (access.error) return access.error;

  const data = await request.formData();
  const file = data.get("file") as File | null;
  const caption = String(data.get("caption") || "")
    .trim()
    .slice(0, 500);
  if (!file)
    return NextResponse.json(
      { error: "กรุณาเลือกไฟล์รูปภาพ" },
      { status: 400 },
    );
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "ขนาดไฟล์ต้องไม่เกิน 20MB" },
      { status: 400 },
    );
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "รองรับเฉพาะไฟล์ JPG, PNG, WEBP, HEIC และ HEIF" },
      { status: 400 },
    );
  }

  try {
    const uploaded = await uploadBuffer(
      Buffer.from(await file.arrayBuffer()),
      campId,
    );
    const latest = await prisma.camp_project_summary_photo.findFirst({
      where: {
        summary_document_id: access.summary!.camp_project_summary_document_id,
      },
      orderBy: { sort_order: "desc" },
      select: { sort_order: true },
    });
    const photo = await prisma.camp_project_summary_photo.create({
      data: {
        summary_document_id: access.summary!.camp_project_summary_document_id,
        image_url: uploaded.secure_url,
        public_id: uploaded.public_id,
        caption: caption || null,
        sort_order: (latest?.sort_order ?? -1) + 1,
      },
    });
    return NextResponse.json(photo, { status: 201 });
  } catch (uploadError: any) {
    console.error("[project-summary-photo] upload failed", uploadError);
    return NextResponse.json(
      { error: "อัปโหลดรูปภาพไม่สำเร็จ" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { teacher, error } = await requireTeacher();
  if (error) return error;
  const campId = Number((await context.params).id);
  const access = await getSummary(campId, teacher);
  if (access.error) return access.error;

  const body = await request.json();
  const order = Array.isArray(body?.order) ? body.order.map(Number) : [];
  if (!order.length)
    return NextResponse.json(
      { error: "ลำดับรูปภาพไม่ถูกต้อง" },
      { status: 400 },
    );

  await prisma.$transaction(
    order.map((photoId: number, index: number) =>
      prisma.camp_project_summary_photo.updateMany({
        where: {
          camp_project_summary_photo_id: photoId,
          summary_document_id: access.summary!.camp_project_summary_document_id,
        },
        data: { sort_order: index },
      }),
    ),
  );
  const photos = await prisma.camp_project_summary_photo.findMany({
    where: {
      summary_document_id: access.summary!.camp_project_summary_document_id,
    },
    orderBy: { sort_order: "asc" },
  });
  return NextResponse.json(photos);
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { teacher, error } = await requireTeacher();
  if (error) return error;

  const campId = Number((await context.params).id);
  const access = await getSummary(campId, teacher);
  if (access.error) return access.error;

  const body = await request.json().catch(() => ({}));
  const photoIds: number[] = Array.from(
    new Set<number>(
      (Array.isArray(body?.photoIds) ? body.photoIds : [])
        .map(Number)
        .filter((id: number) => Number.isInteger(id) && id > 0),
    ),
  );

  if (!photoIds.length) {
    return NextResponse.json(
      { error: "กรุณาเลือกรูปภาพที่ต้องการลบ" },
      { status: 400 },
    );
  }

  const summaryId = access.summary!.camp_project_summary_document_id;
  const selectedPhotos = await prisma.camp_project_summary_photo.findMany({
    where: {
      camp_project_summary_photo_id: { in: photoIds },
      summary_document_id: summaryId,
    },
    select: { camp_project_summary_photo_id: true, public_id: true },
  });

  if (selectedPhotos.length !== photoIds.length) {
    return NextResponse.json(
      { error: "ไม่พบรูปภาพที่เลือกบางรายการในภาคผนวกนี้" },
      { status: 400 },
    );
  }

  const publicIds = selectedPhotos
    .map((photo) => photo.public_id)
    .filter((publicId): publicId is string => Boolean(publicId));

  if (publicIds.length) {
    const results = await Promise.allSettled(
      publicIds.map((publicId) =>
        cloudinary.uploader.destroy(publicId, { resource_type: "image" }),
      ),
    );

    results.forEach((result) => {
      if (result.status === "rejected") {
        console.warn(
          "[project-summary-photo] Cloudinary bulk delete failed",
          result.reason,
        );
      }
    });
  }

  await prisma.camp_project_summary_photo.deleteMany({
    where: {
      camp_project_summary_photo_id: { in: photoIds },
      summary_document_id: summaryId,
    },
  });

  const photos = await prisma.camp_project_summary_photo.findMany({
    where: { summary_document_id: summaryId },
    orderBy: { sort_order: "asc" },
  });

  return NextResponse.json({ photos, deletedCount: selectedPhotos.length });
}
