import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import type { ParentSession } from "@/lib/parent-auth";

export async function canParentViewStudent(
  session: ParentSession,
  studentId: number,
) {
  if (!Number.isSafeInteger(studentId) || studentId <= 0) return false;
  if (studentId === session.primaryStudentId) return true;

  const link = await prisma.parent_student_links.findUnique({
    where: {
      parents_id_students_id: {
        parents_id: session.parentId,
        students_id: studentId,
      },
    },
    select: { student: { select: { deletedAt: true } } },
  });

  return link?.student.deletedAt === null;
}

export async function resolveParentStudent(
  request: Request,
  session: ParentSession,
) {
  const rawId = new URL(request.url).searchParams.get("studentId");
  if (rawId === null) return { studentId: session.studentId, error: null };

  const studentId = Number(rawId);
  if (!Number.isSafeInteger(studentId) || studentId <= 0) {
    return {
      studentId: null,
      error: NextResponse.json(
        { error: "รหัสนักเรียนไม่ถูกต้อง" },
        { status: 400 },
      ),
    };
  }

  if (!(await canParentViewStudent(session, studentId))) {
    return {
      studentId: null,
      error: NextResponse.json(
        { error: "ไม่มีสิทธิ์ดูข้อมูลนักเรียนคนนี้" },
        { status: 403 },
      ),
    };
  }

  return { studentId, error: null };
}
