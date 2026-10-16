export const runtime = "nodejs";

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/db";
import { requireParentSession } from "@/lib/parent-auth";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET() {
  const auth = await requireParentSession();
  if (auth.error) return auth.error;

  const { parentId, primaryStudentId } = auth.session;
  const links = await prisma.parent_student_links.findMany({
    where: { parents_id: parentId },
    select: { students_id: true },
  });
  const students = await prisma.students.findMany({
    where: {
      students_id: {
        in: [primaryStudentId, ...links.map((link) => link.students_id)],
      },
      deletedAt: null,
    },
    select: {
      students_id: true,
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

  return NextResponse.json({ students });
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
  const studentId = Number(data.studentId);
  const password = typeof data.password === "string" ? data.password : "";
  if (
    !Number.isSafeInteger(studentId) ||
    studentId <= 0 ||
    !password ||
    password.length > 128
  ) {
    return NextResponse.json(
      { error: "กรุณากรอกรหัสนักเรียนและรหัสผ่านให้ถูกต้อง" },
      { status: 400 },
    );
  }

  const target = await prisma.parents.findFirst({
    where: { username_student_id: studentId, student: { deletedAt: null } },
    select: { password: true },
  });
  const valid = target && (await bcrypt.compare(password, target.password));
  if (!valid) {
    return NextResponse.json(
      { error: "รหัสนักเรียนหรือรหัสผ่านไม่ถูกต้อง" },
      { status: 401 },
    );
  }
  if (await bcrypt.compare(`kks${studentId}`, target.password)) {
    return NextResponse.json(
      {
        error:
          "กรุณาเข้าสู่บัญชีผู้ปกครองของนักเรียนคนนี้และเปลี่ยนรหัสผ่านเริ่มต้นก่อน",
      },
      { status: 400 },
    );
  }

  if (studentId !== auth.session.primaryStudentId) {
    await prisma.parent_student_links.upsert({
      where: {
        parents_id_students_id: {
          parents_id: auth.session.parentId,
          students_id: studentId,
        },
      },
      update: {},
      create: { parents_id: auth.session.parentId, students_id: studentId },
    });
  }
  return NextResponse.json({ success: true });
}
