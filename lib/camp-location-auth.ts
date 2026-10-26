import { cookies } from "next/headers";
import { jwtVerify } from "jose";

import { prisma } from "@/lib/db";
import { isBangkokDateBefore } from "@/lib/bangkok-date";
import { getParentSession } from "@/lib/parent-auth";

type Viewer =
  | { kind: "teacher"; teacherId: number; role: string }
  | { kind: "student" | "parent"; studentId: number };

async function verifyCookie(name: string) {
  const cookieStore = await cookies();
  const value = cookieStore.get(name)?.value;

  if (!value || !process.env.JWT_SECRET) return null;

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(value, secret);

    return payload;
  } catch {
    return null;
  }
}

export async function getCampLocationViewer(): Promise<Viewer | null> {
  const teacher = await verifyCookie("teacher_session");

  if (teacher?.teachers_id) {
    return {
      kind: "teacher",
      teacherId: Number(teacher.teachers_id),
      role: String(teacher.role || "TEACHER").toUpperCase(),
    };
  }

  const student = await verifyCookie("student_session");

  if (student?.students_id) {
    return { kind: "student", studentId: Number(student.students_id) };
  }

  const parent = await getParentSession();

  if (parent && !parent.mustChangePassword) {
    return { kind: "parent", studentId: parent.studentId };
  }

  return null;
}

export async function getCampLocationAccess(campId: number, viewer: Viewer) {
  const camp = await prisma.camp.findFirst({
    where: { camp_id: campId, deletedAt: null },
    select: { created_by_teacher_id: true, end_date: true },
  });

  if (!camp)
    return {
      exists: false,
      canView: false,
      canConfigure: false,
      canSubmitStudentLocation: false,
      isEnded: false,
    };

  const isEnded = isBangkokDateBefore(camp.end_date);

  if (viewer.kind === "teacher") {
    const isAdmin = viewer.role === "ADMIN";
    const isOwner = camp.created_by_teacher_id === viewer.teacherId;
    const isRelated = await prisma.camp.findFirst({
      where: {
        camp_id: campId,
        OR: [
          {
            teacher_enrollment: {
              some: { teacher_teachers_id: viewer.teacherId },
            },
          },
          {
            camp_classroom: {
              some: {
                classroom: {
                  OR: [
                    { teachers_teachers_id: viewer.teacherId },
                    {
                      classroom_teacher: {
                        some: { teacher_teachers_id: viewer.teacherId },
                      },
                    },
                  ],
                },
              },
            },
          },
        ],
      },
      select: { camp_id: true },
    });
    const canView = isAdmin || isOwner || !!isRelated;

    return {
      exists: true,
      canView,
      canConfigure: isAdmin || isOwner,
      canSubmitStudentLocation: false,
      isEnded,
    };
  }

  const studentCamp = await prisma.camp.findFirst({
    where: {
      camp_id: campId,
      camp_classroom: {
        some: {
          classroom: {
            classroom_students: {
              some: { student_students_id: viewer.studentId },
            },
          },
        },
      },
    },
    select: { camp_id: true },
  });
  const enrollment = await prisma.student_enrollment.findUnique({
    where: {
      student_students_id_camp_camp_id: {
        student_students_id: viewer.studentId,
        camp_camp_id: campId,
      },
    },
    select: { enrolled_at: true },
  });

  return {
    exists: true,
    canView: !!studentCamp,
    canConfigure: false,
    canSubmitStudentLocation:
      viewer.kind === "student" && !isEnded && enrollment?.enrolled_at != null,
    isEnded,
  };
}

export type CampLocationViewer = Viewer;
