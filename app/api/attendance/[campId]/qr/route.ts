// @ts-nocheck
import { NextResponse } from "next/server";

import { requireCampTeacher } from "@/lib/attendance-auth";
import { prisma } from "@/lib/db";

function generatePin() {
  return String(Math.floor(100000 + Math.random() * 900000));
}
function generateNonce() {
  return Math.random().toString(36).slice(2, 12);
}
function generateRoundId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
function buildPayload(campId, nonce) {
  return `CAMP_ATTEND:${campId}:${nonce}`;
}

/** ดึง active session ของค่าย (ยังไม่หมดเวลา ยังไม่ปิด) */
async function getActiveSession(campId) {
  const now = new Date();

  return prisma.attendance_session.findFirst({
    where: {
      camp_camp_id: campId,
      is_closed: false,
      expires_at: { gt: now },
    },
    orderBy: { id: "desc" },
  });
}

/** ดึงรอบทั้งหมดของค่าย (เรียงตาม round_number) */
async function getAllRounds(campId) {
  const sessions = await prisma.attendance_session.findMany({
    where: { camp_camp_id: campId },
    orderBy: { round_number: "asc" },
  });

  return sessions.map((s) => ({
    roundId: s.round_id,
    roundNumber: s.round_number,
    description: s.description || `รอบที่ ${s.round_number}`,
    method: s.method,
    createdAt: s.generated_at,
    expiresAt: s.expires_at,
    isClosed: s.is_closed,
    closedAt: s.closed_at,
  }));
}

// GET: session ปัจจุบัน + ประวัติรอบทั้งหมด
export async function GET(request, { params }) {
  const { campId } = await params;
  const cid = parseInt(campId);
  const { error: authError } = await requireCampTeacher(cid);

  if (authError) return authError;

  const session = await getActiveSession(cid);
  const rounds = await getAllRounds(cid);

  if (!session) return NextResponse.json({ active: false, rounds });

  return NextResponse.json({
    active: true,
    campId: cid,
    roundId: session.round_id,
    qrPayload:
      session.method === "QR" ? buildPayload(cid, session.nonce) : null,
    pin: session.method === "QR" ? session.pin : null,
    generatedAt: session.generated_at,
    expiresAt: session.expires_at,
    description: session.description,
    method: session.method,
    rounds,
  });
}

// POST: สร้างรอบเช็คชื่อใหม่
export async function POST(request, { params }) {
  const { campId } = await params;
  const cid = parseInt(campId);
  const { teacher, error: authError } = await requireCampTeacher(cid);

  if (authError) return authError;

  let description = "",
    durationMinutes = 60,
    method = "QR";

  try {
    const body = await request.json();

    description = body.description || "";
    if (body.durationMinutes) durationMinutes = parseInt(body.durationMinutes);
    if (body.method === "NFC") method = "NFC";
  } catch {}

  // ปิดรอบเก่าที่ยังเปิดอยู่
  const now = new Date();

  await prisma.attendance_session.updateMany({
    where: {
      camp_camp_id: cid,
      is_closed: false,
    },
    data: {
      is_closed: true,
      closed_at: now,
    },
  });

  // ปิด attendance_teachers ที่ยังเปิดอยู่
  await prisma.attendance_teachers.updateMany({
    where: { camp_camp_id: cid, is_closed: false },
    data: { is_closed: true, closed_at: now },
  });

  // นับรอบปัจจุบัน
  const roundCount = await prisma.attendance_session.count({
    where: { camp_camp_id: cid },
  });
  const roundNumber = roundCount + 1;

  const roundId = generateRoundId();
  const nonce = generateNonce();
  const pin = generatePin();
  const generatedAt = now;
  const expiresAt = new Date(generatedAt.getTime() + durationMinutes * 60000);
  const roundDescription = description || `รอบที่ ${roundNumber}`;

  await prisma.attendance_session.create({
    data: {
      camp_camp_id: cid,
      round_id: roundId,
      round_number: roundNumber,
      description: roundDescription,
      method,
      nonce,
      pin,
      generated_at: generatedAt,
      expires_at: expiresAt,
      is_closed: false,
    },
  });

  // หรือสร้าง teacher_enrollment ถ้ายังไม่มี
  let teacherEnrollment = await prisma.teacher_enrollment.findFirst({
    where: {
      teacher_teachers_id: teacher.teachers_id,
      camp_camp_id: cid,
    },
  });

  if (!teacherEnrollment) {
    teacherEnrollment = await prisma.teacher_enrollment.create({
      data: {
        teacher_teachers_id: teacher.teachers_id,
        camp_camp_id: cid,
      },
    });
  }

  // สร้าง attendance_teachers record (เพื่อให้ checkin FK ชี้หาได้)
  await prisma.attendance_teachers.create({
    data: {
      camp_camp_id: cid,
      teacher_enrollment_teacher_enrollment_id:
        teacherEnrollment.teacher_enrollment_id,
      description: roundDescription,
      method,
      round_id: roundId,
      round_number: roundNumber,
      expires_at: expiresAt,
      is_closed: false,
    },
  });

  const rounds = await getAllRounds(cid);

  return NextResponse.json({
    active: true,
    campId: cid,
    roundId,
    qrPayload: method === "QR" ? buildPayload(cid, nonce) : null,
    pin: method === "QR" ? pin : null,
    generatedAt,
    expiresAt,
    description: description || `รอบที่ ${roundNumber}`,
    method,
    rounds,
  });
}

// DELETE: ปิดรอบปัจจุบัน
export async function DELETE(request, { params }) {
  const { campId } = await params;
  const cid = parseInt(campId);
  const { error: authError } = await requireCampTeacher(cid);

  if (authError) return authError;

  await prisma.attendance_session.updateMany({
    where: {
      camp_camp_id: cid,
      is_closed: false,
    },
    data: {
      is_closed: true,
      closed_at: new Date(),
    },
  });

  await prisma.attendance_teachers.updateMany({
    where: { camp_camp_id: cid, is_closed: false },
    data: { is_closed: true, closed_at: new Date() },
  });

  const rounds = await getAllRounds(cid);

  return NextResponse.json({
    success: true,
    message: "ปิดรับเช็คชื่อแล้ว",
    rounds,
  });
}
