export const runtime = "nodejs";
// @ts-nocheck
import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";

import { prisma } from "@/lib/db";

/**
 * POST /api/auth/student/login
 * Body: { studentId: number }
 * ค้นหานักเรียนด้วย students_id → set HttpOnly cookie student_session
 */
export async function POST(req: any) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "กรุณาเข้าสู่ระบบด้วยบัญชีที่ยืนยันแล้ว" },
        { status: 401 },
      );
    }

    const { studentId } = await req.json();

    if (!studentId) {
      return NextResponse.json(
        { error: "กรุณากรอกรหัสนักเรียน" },
        { status: 400 },
      );
    }

    const student = await prisma.students.findFirst({
      where: {
        students_id: parseInt(studentId),
        deletedAt: null,
      },
      select: {
        students_id: true,
        firstname: true,
        lastname: true,
        email: true,
      },
    });

    if (!student) {
      return NextResponse.json(
        { error: "ไม่พบรหัสนักเรียนนี้ในระบบ" },
        { status: 404 },
      );
    }

    const clerkUser = await currentUser();
    const verifiedEmails = new Set(
      (clerkUser?.emailAddresses || [])
        .filter((entry) => entry.verification?.status === "verified")
        .map((entry) => entry.emailAddress.trim().toLowerCase()),
    );

    if (!verifiedEmails.has(student.email.trim().toLowerCase())) {
      return NextResponse.json(
        { error: "บัญชีที่เข้าสู่ระบบไม่ตรงกับนักเรียน" },
        { status: 403 },
      );
    }

    const { SignJWT } = await import("jose");
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);

    const token = await new SignJWT(student)
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("7d")
      .sign(secret);

    const response = NextResponse.json({ success: true, student });

    response.cookies.set("student_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 วัน
    });
    response.cookies.delete("teacher_session");
    response.cookies.delete("parent_session");

    return response;
  } catch {
    //     console.error("Student login error:", error);

    return NextResponse.json(
      { _error: "เข้าสู่ระบบไม่สำเร็จ" },
      { status: 500 },
    );
  }
}
