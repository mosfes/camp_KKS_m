// @ts-nocheck
import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { clearActiveCampCookies } from "@/lib/server-active-camp";

/**
 * POST /api/auth/logout
 * ลบ cookie teacher_session
 */
export async function POST() {
  try {
    const { sessionId } = await auth();
    if (sessionId) {
      const client = await clerkClient();
      await client.sessions.revokeSession(sessionId);
    }
  } catch (error) {
    console.error("Clerk logout failed:", error);
  }

  const response = NextResponse.json({
    success: true,
    message: "ออกจากระบบสำเร็จ",
  });

  response.cookies.set("teacher_session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0, // ลบ cookie ทันที
  });

  return clearActiveCampCookies(response);
}
