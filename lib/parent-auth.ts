import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";

export type ParentSession = {
  parentId: number;
  studentId: number;
  mustChangePassword: boolean;
};

/**
 * Reads and validates the parent session, then confirms that the parent still
 * belongs to an active student record. Keeping this check server-side means a
 * client cannot change a student id in a request and read another child's data.
 */
export async function getParentSession(): Promise<ParentSession | null> {
  try {
    const cookieStore = await cookies();
    const value = cookieStore.get("parent_session")?.value;

    if (!value || !process.env.JWT_SECRET) return null;

    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(value, secret);
    const studentId = Number(payload.students_id);
    const tokenParentId = Number(payload.parents_id);

    if (!Number.isInteger(studentId) || studentId <= 0) return null;

    const parent = await prisma.parents.findFirst({
      where: {
        ...(Number.isInteger(tokenParentId) && tokenParentId > 0
          ? { parents_id: tokenParentId }
          : {}),
        username_student_id: studentId,
        student: { deletedAt: null },
      },
      select: { parents_id: true, session_version: true },
    });

    if (!parent) return null;
    if (Number(payload.sessionVersion ?? 0) !== parent.session_version) {
      return null;
    }

    return {
      parentId: parent.parents_id,
      studentId,
      mustChangePassword: payload.mustChangePassword === true,
    };
  } catch {
    return null;
  }
}

export async function requireParentSession(options?: {
  allowPasswordChange?: boolean;
}) {
  const session = await getParentSession();

  if (!session) {
    return {
      session: null,
      error: NextResponse.json(
        { error: "กรุณาเข้าสู่ระบบผู้ปกครองก่อน" },
        { status: 401 },
      ),
    };
  }

  if (session.mustChangePassword && !options?.allowPasswordChange) {
    return {
      session: null,
      error: NextResponse.json(
        { error: "กรุณาเปลี่ยนรหัสผ่านก่อนใช้งานระบบ" },
        { status: 428 },
      ),
    };
  }

  return { session, error: null };
}
