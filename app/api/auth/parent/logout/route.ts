import { NextResponse } from "next/server";

/**
 * POST /api/auth/parent/logout
 * ลบ parent_session cookie
 */
export async function POST() {
  const response = NextResponse.json({ success: true });

  response.cookies.set("parent_session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  response.cookies.delete("parent_selected_student");

  return response;
}
