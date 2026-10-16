export const runtime = "nodejs";

import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireParentSession } from "@/lib/parent-auth";

export async function POST(request: Request) {
  const auth = await requireParentSession();
  if (auth.error) return auth.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }
  const data =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const studentId = Number(data.studentId);
  if (!Number.isSafeInteger(studentId) || studentId <= 0) {
    return NextResponse.json(
      { error: "รหัสนักเรียนไม่ถูกต้อง" },
      { status: 400 },
    );
  }
  const student = await prisma.students.findFirst({
    where: { students_id: studentId, deletedAt: null },
    select: { students_id: true },
  });
  if (!student)
    return NextResponse.json({ error: "ไม่พบนักเรียน" }, { status: 404 });

  if (studentId !== auth.session.primaryStudentId) {
    const link = await prisma.parent_student_links.findUnique({
      where: {
        parents_id_students_id: {
          parents_id: auth.session.parentId,
          students_id: studentId,
        },
      },
      select: { students_id: true },
    });
    if (!link)
      return NextResponse.json(
        { error: "ไม่มีสิทธิ์ดูข้อมูลนักเรียนคนนี้" },
        { status: 403 },
      );
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set("parent_selected_student", String(studentId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
