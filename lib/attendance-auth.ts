import { NextResponse } from "next/server";

import { requireTeacher } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function requireCampTeacher(campId: number) {
  if (!Number.isInteger(campId) || campId <= 0) {
    return {
      teacher: null,
      error: NextResponse.json(
        { error: "รหัสค่ายไม่ถูกต้อง" },
        { status: 400 },
      ),
    };
  }

  const { teacher, error } = await requireTeacher();

  if (error || !teacher) return { teacher: null, error };

  const isAdmin = String(teacher.role).toUpperCase() === "ADMIN";
  const camp = await prisma.camp.findFirst({
    where: {
      camp_id: campId,
      deletedAt: null,
      ...(isAdmin
        ? {}
        : {
            OR: [
              { created_by_teacher_id: Number(teacher.teachers_id) },
              {
                teacher_enrollment: {
                  some: { teacher_teachers_id: Number(teacher.teachers_id) },
                },
              },
              {
                camp_classroom: {
                  some: {
                    classroom: {
                      OR: [
                        {
                          teachers_teachers_id: Number(teacher.teachers_id),
                        },
                        {
                          classroom_teacher: {
                            some: {
                              teacher_teachers_id: Number(teacher.teachers_id),
                            },
                          },
                        },
                      ],
                    },
                  },
                },
              },
            ],
          }),
    },
    select: { camp_id: true },
  });

  if (!camp) {
    return {
      teacher: null,
      error: NextResponse.json(
        { error: "คุณไม่มีสิทธิ์จัดการการเช็คชื่อของค่ายนี้" },
        { status: 403 },
      ),
    };
  }

  return { teacher, error: null };
}
