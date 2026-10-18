export const runtime = "nodejs";

import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireParentSession } from "@/lib/parent-auth";
import {
  expireParentLinkRequests,
  PARENT_LINK_REQUEST_TTL_MS,
} from "@/lib/parent-link-requests";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET() {
  const auth = await requireParentSession();

  if (auth.error) return auth.error;

  await expireParentLinkRequests();
  const { parentId, primaryStudentId } = auth.session;
  const [links, requests] = await Promise.all([
    prisma.parent_student_links.findMany({
      where: { parents_id: parentId },
      select: { students_id: true },
    }),
    prisma.parent_student_link_requests.findMany({
      where: { parents_id: parentId, status: { not: "APPROVED" } },
      select: {
        students_id: true,
        status: true,
        requested_at: true,
        expires_at: true,
      },
      orderBy: { requested_at: "desc" },
      take: 20,
    }),
  ]);
  const students = await prisma.students.findMany({
    where: {
      students_id: {
        in: [primaryStudentId, ...links.map((link) => link.students_id)],
      },
      deletedAt: null,
    },
    select: {
      students_id: true,
      public_id: true,
      prefix_name: true,
      firstname: true,
      lastname: true,
      nickname: true,
      profile_image_url: true,
      classroom_students: {
        orderBy: { classroom: { academic_years_years_id: "desc" } },
        take: 1,
        select: {
          classroom: {
            select: {
              grade: true,
              classroom_types: { select: { name: true } },
            },
          },
        },
      },
    },
    orderBy: { students_id: "asc" },
  });

  return NextResponse.json(
    { students, requests },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(request: Request) {
  const auth = await requireParentSession();

  if (auth.error) return auth.error;

  const limit = checkRateLimit("parent-link-student", auth.session.parentId, {
    windowMs: 15 * 60 * 1000,
    max: 8,
  });

  if (!limit.allowed) {
    return NextResponse.json(
      { error: "ลองเชื่อมบัญชีหลายครั้งเกินไป กรุณารอสักครู่" },
      { status: 429 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }
  const data =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const rawStudentId =
    typeof data.studentId === "string" ? data.studentId.trim() : "";
  const studentId = Number(rawStudentId);

  if (!/^[1-9]\d*$/.test(rawStudentId) || !Number.isSafeInteger(studentId)) {
    return NextResponse.json(
      { error: "กรุณากรอกรหัสนักเรียนให้ถูกต้อง" },
      { status: 400 },
    );
  }

  if (studentId === auth.session.primaryStudentId) {
    return NextResponse.json(
      { error: "นักเรียนคนนี้อยู่ในบัญชีของคุณแล้ว" },
      { status: 409 },
    );
  }

  const parent = await prisma.parents.findUnique({
    where: { parents_id: auth.session.parentId },
    select: { firstname: true, lastname: true, tel: true },
  });

  if (
    !parent ||
    !parent.firstname.trim() ||
    !parent.lastname.trim() ||
    parent.firstname.trim() === "รอระบุ" ||
    parent.lastname.trim() === "รอระบุ" ||
    !/^\d{10}$/.test(parent.tel) ||
    parent.tel === "0000000000"
  ) {
    return NextResponse.json(
      { error: "กรุณากรอกชื่อและเบอร์โทรในโปรไฟล์ผู้ปกครองก่อนส่งคำขอ" },
      { status: 409 },
    );
  }

  const student = await prisma.students.findFirst({
    where: { students_id: studentId, deletedAt: null },
    select: { students_id: true },
  });

  if (!student) {
    return NextResponse.json(
      { error: "ไม่สามารถส่งคำขอได้ กรุณาตรวจสอบรหัสนักเรียน" },
      { status: 404 },
    );
  }

  const existingLink = await prisma.parent_student_links.findUnique({
    where: {
      parents_id_students_id: {
        parents_id: auth.session.parentId,
        students_id: studentId,
      },
    },
    select: { students_id: true },
  });

  if (existingLink) {
    return NextResponse.json(
      { error: "นักเรียนคนนี้อยู่ในบัญชีของคุณแล้ว" },
      { status: 409 },
    );
  }

  await expireParentLinkRequests();
  const existingRequest = await prisma.parent_student_link_requests.findUnique({
    where: {
      parents_id_students_id: {
        parents_id: auth.session.parentId,
        students_id: studentId,
      },
    },
    select: { status: true, responded_at: true },
  });

  if (existingRequest?.status === "PENDING") {
    return NextResponse.json({ success: true, status: "PENDING" });
  }
  if (
    (existingRequest?.status === "REJECTED" ||
      existingRequest?.status === "REVOKED") &&
    existingRequest.responded_at &&
    existingRequest.responded_at.getTime() > Date.now() - 24 * 60 * 60 * 1000
  ) {
    return NextResponse.json(
      {
        error:
          "เพิ่งมีการปฏิเสธหรือเพิกถอนสิทธิ์ กรุณารอ 24 ชั่วโมงก่อนส่งคำขอใหม่",
      },
      { status: 429 },
    );
  }

  const pendingCount = await prisma.parent_student_link_requests.count({
    where: { parents_id: auth.session.parentId, status: "PENDING" },
  });

  if (pendingCount >= 10) {
    return NextResponse.json(
      { error: "มีคำขอที่รอยืนยันมากเกินไป กรุณารอให้ดำเนินการก่อน" },
      { status: 429 },
    );
  }

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.parent_student_link_requests.upsert({
      where: {
        parents_id_students_id: {
          parents_id: auth.session.parentId,
          students_id: studentId,
        },
      },
      update: {
        status: "PENDING",
        requested_at: now,
        expires_at: new Date(now.getTime() + PARENT_LINK_REQUEST_TTL_MS),
        responded_at: null,
      },
      create: {
        parents_id: auth.session.parentId,
        students_id: studentId,
        expires_at: new Date(now.getTime() + PARENT_LINK_REQUEST_TTL_MS),
      },
    });
    await tx.parent_student_link_events.create({
      data: {
        parents_id: auth.session.parentId,
        students_id: studentId,
        action: "REQUESTED",
        actor_type: "PARENT",
        actor_id: auth.session.parentId,
      },
    });
  });

  return NextResponse.json({ success: true, status: "PENDING" });
}
