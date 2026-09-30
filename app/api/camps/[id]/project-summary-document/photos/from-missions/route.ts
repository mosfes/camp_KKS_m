import { NextResponse } from "next/server";

import { requireTeacher } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getCampAccess(campId: number, teacher: any) {
  const camp = await prisma.camp.findFirst({
    where: { camp_id: campId, deletedAt: null },
    select: { created_by_teacher_id: true },
  });

  if (!camp) {
    return {
      error: NextResponse.json({ error: "ไม่พบค่าย" }, { status: 404 }),
    };
  }

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

  return { camp };
}

async function getSummary(campId: number, teacher: any) {
  const access = await getCampAccess(campId, teacher);

  if ("error" in access) return { error: access.error };

  const summary = await prisma.camp_project_summary_document.findUnique({
    where: { camp_camp_id: campId },
  });

  if (!summary) {
    return {
      error: NextResponse.json(
        { error: "กรุณาบันทึกเอกสารสรุปก่อนเลือกรูปจากภารกิจ" },
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

async function getMissionPhotoGroups(campId: number, missionIds?: number[]) {
  const missions = await prisma.mission.findMany({
    where: {
      deletedAt: null,
      station: { camp_camp_id: campId },
      ...(missionIds?.length ? { mission_id: { in: missionIds } } : {}),
    },
    orderBy: [{ station_station_id: "asc" }, { mission_id: "asc" }],
    select: {
      mission_id: true,
      title: true,
      station: { select: { station_id: true, name: true } },
      mission_result: {
        where: { status: "completed" },
        orderBy: { submitted_at: "asc" },
        select: {
          submitted_at: true,
          student_enrollment: {
            select: {
              student: {
                select: {
                  prefix_name: true,
                  firstname: true,
                  lastname: true,
                },
              },
            },
          },
          mission_answer: {
            select: {
              answer_photo: { select: { id: true, img_url: true } },
            },
          },
        },
      },
    },
  });

  return missions
    .map((mission) => {
      const seen = new Set<string>();
      const photos = mission.mission_result.flatMap((result) => {
        const student = result.student_enrollment.student;
        const studentName =
          `${student.prefix_name || ""}${student.firstname} ${student.lastname}`.trim();

        return result.mission_answer.flatMap((answer) =>
          answer.answer_photo
            .filter((photo) => {
              if (!photo.img_url || seen.has(photo.img_url)) return false;
              seen.add(photo.img_url);

              return true;
            })
            .map((photo) => ({
              id: photo.id,
              imageUrl: photo.img_url,
              studentName,
              submittedAt: result.submitted_at,
            })),
        );
      });

      return {
        missionId: mission.mission_id,
        missionTitle: mission.title || `ภารกิจ ${mission.mission_id}`,
        stationId: mission.station.station_id,
        stationName: mission.station.name,
        photoCount: photos.length,
        photos,
      };
    })
    .filter((mission) => mission.photoCount > 0);
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { teacher, error } = await requireTeacher();

  if (error) return error;

  const campId = Number((await context.params).id);

  if (!Number.isInteger(campId) || campId <= 0) {
    return NextResponse.json({ error: "รหัสค่ายไม่ถูกต้อง" }, { status: 400 });
  }

  const access = await getCampAccess(campId, teacher);

  if (access.error) return access.error;

  const missions = await getMissionPhotoGroups(campId);

  return NextResponse.json({ missions });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { teacher, error } = await requireTeacher();

  if (error) return error;

  const campId = Number((await context.params).id);

  if (!Number.isInteger(campId) || campId <= 0) {
    return NextResponse.json({ error: "รหัสค่ายไม่ถูกต้อง" }, { status: 400 });
  }

  const access = await getSummary(campId, teacher);

  if ("error" in access) return access.error;

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
      { error: "กรุณาเลือกอย่างน้อย 1 รูป" },
      { status: 400 },
    );
  }

  const missionGroups = await getMissionPhotoGroups(campId);
  const availablePhotoIds = new Set(
    missionGroups.flatMap((mission) => mission.photos.map((photo) => photo.id)),
  );

  if (photoIds.some((id) => !availablePhotoIds.has(id))) {
    return NextResponse.json(
      { error: "ไม่พบรูปภาพที่เลือกบางรายการในค่ายนี้" },
      { status: 400 },
    );
  }

  const selectedPhotoIds = new Set(photoIds);

  const summaryId = access.summary!.camp_project_summary_document_id;
  const existing = await prisma.camp_project_summary_photo.findMany({
    where: { summary_document_id: summaryId },
    orderBy: { sort_order: "asc" },
    select: { image_url: true, sort_order: true },
  });
  const existingUrls = new Set(existing.map((photo) => photo.image_url));
  const incoming = missionGroups.flatMap((mission) =>
    mission.photos
      .filter((photo) => {
        if (!selectedPhotoIds.has(photo.id)) return false;
        if (existingUrls.has(photo.imageUrl)) return false;
        existingUrls.add(photo.imageUrl);

        return true;
      })
      .map((photo) => ({
        imageUrl: photo.imageUrl,
        caption: `${mission.missionTitle} - ${photo.studentName}`.slice(0, 500),
      })),
  );

  const startOrder = (existing.at(-1)?.sort_order ?? -1) + 1;

  if (incoming.length) {
    await prisma.camp_project_summary_photo.createMany({
      data: incoming.map((photo, index) => ({
        summary_document_id: summaryId,
        image_url: photo.imageUrl,
        caption: photo.caption,
        sort_order: startOrder + index,
      })),
    });
  }

  const photos = await prisma.camp_project_summary_photo.findMany({
    where: { summary_document_id: summaryId },
    orderBy: { sort_order: "asc" },
  });

  return NextResponse.json({
    photos,
    addedCount: incoming.length,
    duplicateCount: photoIds.length - incoming.length,
  });
}
