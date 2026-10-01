// @ts-nocheck
import { cookies } from "next/headers";
import { jwtVerify } from "jose";

import { prisma } from "@/lib/db";

/**
 * อ่าน teacher session จาก HttpOnly cookie
 * @returns {{ teachers_id, firstname, lastname, email, role } | null}
 */
export async function getTeacherFromRequest() {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("teacher_session");

    if (!session?.value) return null;

    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(session.value, secret);
    const teacherId = Number(payload.teachers_id);

    if (!Number.isInteger(teacherId) || teacherId <= 0) return null;

    return prisma.teachers.findFirst({
      where: { teachers_id: teacherId, deletedAt: null },
      select: {
        teachers_id: true,
        firstname: true,
        lastname: true,
        email: true,
        role: true,
        profile_image_url: true,
      },
    });
  } catch {
    return null;
  }
}

/**
 * Helper: ตอบ 401 ถ้าไม่มี teacher session
 */
export async function requireTeacher() {
  const teacher = await getTeacherFromRequest();

  if (!teacher)
    return {
      teacher: null,
      error: Response.json({ error: "กรุณาเข้าสู่ระบบก่อน" }, { status: 401 }),
    };

  return { teacher, error: null };
}

/**
 * Helper for administration-only endpoints. The role comes from the current
 * database row rather than from the JWT so role changes take effect at once.
 */
export async function requireAdmin() {
  const { teacher, error } = await requireTeacher();

  if (error || !teacher) return { teacher: null, error };
  if (String(teacher.role).toUpperCase() !== "ADMIN") {
    return {
      teacher: null,
      error: Response.json(
        { error: "เฉพาะผู้ดูแลระบบเท่านั้น" },
        { status: 403 },
      ),
    };
  }

  return { teacher, error: null };
}

/**
 * อ่าน student session จาก HttpOnly cookie
 * @returns {{ students_id, firstname, lastname, email } | null}
 */
export async function getStudentFromRequest() {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("student_session");

    if (!session?.value) return null;

    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(session.value, secret);
    const studentId = Number(payload.students_id);

    if (!Number.isInteger(studentId) || studentId <= 0) return null;

    return prisma.students.findFirst({
      where: { students_id: studentId, deletedAt: null },
      select: {
        students_id: true,
        firstname: true,
        lastname: true,
        email: true,
      },
    });
  } catch {
    return null;
  }
}

/**
 * Helper: ตอบ 401 ถ้าไม่มี student session
 */
export async function requireStudent() {
  const student = await getStudentFromRequest();

  if (!student)
    return {
      student: null,
      error: Response.json({ error: "กรุณาเข้าสู่ระบบก่อน" }, { status: 401 }),
    };

  return { student, error: null };
}
