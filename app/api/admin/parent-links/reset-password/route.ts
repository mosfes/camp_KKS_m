import { randomInt } from "node:crypto";

import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatParentUsername } from "@/lib/parent-username";

// ตัดตัวที่อ่านสับสนง่ายออก (0/O, 1/l/I) เพื่อให้แอดมินส่งต่อรหัสให้ผู้ปกครองได้ถูกต้อง
const PASSWORD_ALPHABET =
  "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
const PASSWORD_LENGTH = 10;

function generatePassword() {
  let password = "";

  for (let index = 0; index < PASSWORD_LENGTH; index++) {
    password += PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)];
  }

  return password;
}

export async function POST(request: Request) {
  const { teacher, error } = await requireAdmin();

  if (error) return error;

  let body: Record<string, unknown>;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }
  const parentId = Number(body.parentId);

  if (!Number.isSafeInteger(parentId) || parentId <= 0) {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }

  const parent = await prisma.parents.findUnique({
    where: { parents_id: parentId },
    select: {
      parents_id: true,
      username_student_id: true,
      account_no: true,
      student: { select: { deletedAt: true } },
    },
  });

  if (!parent || parent.student.deletedAt) {
    return NextResponse.json({ error: "ไม่พบบัญชีผู้ปกครอง" }, { status: 404 });
  }

  const password = generatePassword();
  const bcrypt = await import("bcryptjs");
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.$transaction([
    // เพิ่ม session_version เพื่อให้อุปกรณ์ที่ล็อกอินค้างไว้ต้องเข้าสู่ระบบใหม่
    prisma.parents.update({
      where: { parents_id: parent.parents_id },
      data: {
        password: passwordHash,
        session_version: { increment: 1 },
      },
    }),
    // ลิงก์รีเซ็ตรหัสผ่านทางอีเมลที่ยังไม่ได้ใช้ ไม่ควรใช้ได้อีกหลังแอดมินตั้งรหัสใหม่
    prisma.parent_auth_tokens.updateMany({
      where: {
        parents_id: parent.parents_id,
        type: "PASSWORD_RESET",
        used_at: null,
      },
      data: { used_at: new Date() },
    }),
    prisma.parent_student_link_events.create({
      data: {
        parents_id: parent.parents_id,
        students_id: parent.username_student_id,
        action: "PASSWORD_RESET",
        actor_type: "ADMIN",
        actor_id: teacher.teachers_id,
      },
    }),
  ]);

  return NextResponse.json({
    success: true,
    username: formatParentUsername(
      parent.username_student_id,
      parent.account_no,
    ),
    password,
  });
}
