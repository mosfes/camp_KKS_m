// @ts-nocheck
import { NextResponse } from "next/server";

/**
 * POST /api/auth/student/logout
 * ลบ cookie student_session
 */
export async function POST() {
  const response = NextResponse.json({
    success: true,
    message: "ออกจากระบบสำเร็จ",
  });

  response.cookies.set("student_session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}
