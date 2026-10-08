// @ts-nocheck
import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

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
    // Always clear the app session. The logout page also calls Clerk's client
    // signOut as a fallback if the server-side revoke is unavailable.
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
