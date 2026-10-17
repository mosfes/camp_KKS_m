export const runtime = "nodejs";

import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireParentSession } from "@/lib/parent-auth";
import { resolveParentStudent } from "@/lib/parent-student-access";

/**
 * GET /api/parent/student
 * Read-only profile for the student belonging to the current parent.
 */
export async function GET(request: Request) {
  const auth = await requireParentSession();
  if (auth.error) return auth.error;
  const { studentId, error } = await resolveParentStudent(request, auth.session);
  if (error) return error;

  try {
    const student = await prisma.students.findFirst({
      where: { students_id: studentId, deletedAt: null },
      select: {
        students_id: true,
        prefix_name: true,
        firstname: true,
        lastname: true,
        nickname: true,
        profile_image_url: true,
        birthday: true,
        food_allergy: true,
        chronic_disease: true,
        remark: true,
        tel: true,
        email: true,
        classroom_students: {
          where: { classroom: { deletedAt: null } },
          orderBy: {
            classroom: { academic_years_years_id: "desc" },
          },
          take: 1,
          select: {
            classroom: {
              select: {
                classroom_id: true,
                grade: true,
                academic_years_years_id: true,
                classroom_types: { select: { name: true } },
                teacher: {
                  select: {
                    prefix_name: true,
                    firstname: true,
                    lastname: true,
                    tel: true,
                    email: true,
                  },
                },
                classroom_teacher: {
                  select: {
                    teacher: {
                      select: {
                        prefix_name: true,
                        firstname: true,
                        lastname: true,
                        tel: true,
                        email: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!student) {
      return NextResponse.json(
        { error: "ไม่พบข้อมูลนักเรียน" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { student },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "ไม่สามารถโหลดข้อมูลนักเรียนได้" },
      { status: 500 },
    );
  }
}
