export const runtime = "nodejs";
// @ts-nocheck
import { NextResponse } from "next/server";

import { requireStudent } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/auth/student/me
 * ดึงข้อมูลนักเรียนที่กำลัง login อยู่จาก cookie + ข้อมูลห้องเรียนจาก DB
 */
export async function GET() {
  try {
    const { student, error } = await requireStudent();

    if (error || !student) return error;

    const dbStudent = await prisma.students.findUnique({
      where: { students_id: Number(student.students_id) },
      select: {
        students_id: true,
        firstname: true,
        lastname: true,
        nickname: true,
        profile_image_url: true,
        food_allergy: true,
        email: true,
      },
    });

    if (!dbStudent) {
      return NextResponse.json(
        { error: "ไม่พบข้อมูลนักเรียน" },
        { status: 404 },
      );
    }

    // ดึงข้อมูลห้องเรียนเพิ่มเติม
    const classroomInfo = await prisma.classroom_students.findFirst({
      where: { student_students_id: Number(dbStudent.students_id) },
      include: {
        classroom: {
          include: {
            classroom_types: true,
            teacher: true,
            classroom_teacher: {
              include: { teacher: true },
            },
          },
        },
      },
    });

    const classroom = classroomInfo?.classroom ?? null;

    // รวมชื่อครูทุกคน: ครูหลัก + ครูใน classroom_teacher (กรองซ้ำ)
    let homeroomTeachers = null;

    if (classroom) {
      const teacherMap = new Map();

      if (classroom.teacher) {
        const t = classroom.teacher;

        teacherMap.set(
          t.teachers_id,
          `${t.prefix_name || ""}${t.firstname} ${t.lastname}`.trim(),
        );
      }
      for (const ct of classroom.classroom_teacher ?? []) {
        if (ct.teacher) {
          const t = ct.teacher;

          teacherMap.set(
            t.teachers_id,
            `${t.prefix_name || ""}${t.firstname} ${t.lastname}`.trim(),
          );
        }
      }
      homeroomTeachers =
        teacherMap.size > 0 ? Array.from(teacherMap.values()).join(", ") : null;
    }

    return NextResponse.json({
      ...dbStudent,
      classroom: classroom
        ? {
            classroom_id: classroom.classroom_id,
            grade: classroom.grade,
            grade_label: classroom.grade?.replace("Level_", "ม.") ?? null,
            class_name: classroom.classroom_types?.name ?? null,
            homeroom_teacher: homeroomTeachers,
          }
        : null,
    });
  } catch {
    return NextResponse.json({ error: "ไม่ได้เข้าสู่ระบบ" }, { status: 401 });
  }
}
