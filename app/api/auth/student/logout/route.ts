// @ts-nocheck
import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";

/**
 * POST /api/auth/student/logout
 * ลบ cookie student_session
 */
export async function POST() {
  try {
    const { sessionId } = await auth();

    if (sessionId) {
      const client = await clerkClient();

      await client.sessions.revokeSession(sessionId);
    }
  } catch {
    // Always clear the app session even if Clerk is temporarily unavailable.
  }

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
