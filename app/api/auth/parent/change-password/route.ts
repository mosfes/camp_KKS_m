export const runtime = "nodejs";

import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { getParentSession } from "@/lib/parent-auth";

/**
 * POST /api/auth/parent/change-password
 * Body: { newPassword: string, confirmPassword: string }
 */
export async function POST(req: Request) {
  const session = await getParentSession();

  if (!session) {
    return NextResponse.json(
      { error: "กรุณาเข้าสู่ระบบผู้ปกครองก่อน" },
      { status: 401 },
    );
  }

  try {
    const body = await req.json();
    const newPassword =
      typeof body.newPassword === "string" ? body.newPassword : "";
    const confirmPassword =
      typeof body.confirmPassword === "string" ? body.confirmPassword : "";

    if (!newPassword || !confirmPassword) {
      return NextResponse.json(
        { error: "กรุณากรอกรหัสผ่านใหม่และยืนยันรหัสผ่าน" },
        { status: 400 },
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร" },
        { status: 400 },
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { error: "รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน" },
        { status: 400 },
      );
    }

    if (newPassword === `kks${session.studentId}`) {
      return NextResponse.json(
        { error: "กรุณาตั้งรหัสผ่านใหม่ที่ไม่ใช่รหัสผ่านเริ่มต้น" },
        { status: 400 },
      );
    }

    const parent = await prisma.parents.findFirst({
      where: {
        parents_id: session.parentId,
        username_student_id: session.studentId,
      },
      select: { parents_id: true },
    });

    if (!parent) {
      return NextResponse.json(
        { error: "ไม่พบข้อมูลผู้ปกครอง" },
        { status: 404 },
      );
    }

    const bcrypt = await import("bcryptjs");

    const updatedParent = await prisma.parents.update({
      where: { parents_id: parent.parents_id },
      data: {
        password: await bcrypt.hash(newPassword, 10),
        session_version: { increment: 1 },
      },
      select: { session_version: true },
    });

    const { SignJWT } = await import("jose");
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const token = await new SignJWT({
      parents_id: session.parentId,
      students_id: session.studentId,
      mustChangePassword: false,
      sessionVersion: updatedParent.session_version,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("7d")
      .sign(secret);

    const response = NextResponse.json({ success: true });

    response.cookies.set("parent_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: "เปลี่ยนรหัสผ่านไม่สำเร็จ กรุณาลองใหม่" },
      { status: 500 },
    );
  }
}
