export const runtime = "nodejs";

import { NextResponse } from "next/server";

import { hashParentAuthToken } from "@/lib/parent-account-email";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    const limit = checkRateLimit(
      "parent-password-reset-submit",
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        "unknown",
      { windowMs: 15 * 60 * 1000, max: 10 },
    );

    if (!limit.allowed) {
      return NextResponse.json(
        { error: "ลองตั้งรหัสผ่านหลายครั้งเกินไป กรุณารอสักครู่" },
        { status: 429 },
      );
    }

    const body = await request.json();
    const token = typeof body.token === "string" ? body.token.trim() : "";
    const newPassword =
      typeof body.newPassword === "string" ? body.newPassword : "";
    const confirmPassword =
      typeof body.confirmPassword === "string" ? body.confirmPassword : "";

    if (!token || !newPassword || !confirmPassword) {
      return NextResponse.json(
        { error: "กรุณากรอกข้อมูลให้ครบถ้วน" },
        { status: 400 },
      );
    }
    if (token.length > 200 || newPassword.length > 128) {
      return NextResponse.json(
        { error: "ข้อมูลตั้งรหัสผ่านไม่ถูกต้อง" },
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

    const tokenHash = hashParentAuthToken(token);
    const resetToken = await prisma.parent_auth_tokens.findUnique({
      where: { token_hash: tokenHash },
      select: {
        token_id: true,
        parents_id: true,
        type: true,
        expires_at: true,
        used_at: true,
        parent: { select: { username_student_id: true } },
      },
    });

    if (
      !resetToken ||
      resetToken.type !== "PASSWORD_RESET" ||
      resetToken.used_at ||
      resetToken.expires_at <= new Date()
    ) {
      return NextResponse.json(
        { error: "ลิงก์ตั้งรหัสผ่านไม่ถูกต้องหรือหมดอายุแล้ว" },
        { status: 400 },
      );
    }

    if (newPassword === `kks${resetToken.parent.username_student_id}`) {
      return NextResponse.json(
        { error: "กรุณาตั้งรหัสผ่านใหม่ที่ไม่ใช่รหัสผ่านเริ่มต้น" },
        { status: 400 },
      );
    }

    const bcrypt = await import("bcryptjs");
    const passwordHash = await bcrypt.hash(newPassword, 10);
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      const claimed = await tx.parent_auth_tokens.updateMany({
        where: {
          token_id: resetToken.token_id,
          type: "PASSWORD_RESET",
          used_at: null,
          expires_at: { gt: now },
        },
        data: { used_at: now },
      });

      if (claimed.count !== 1) throw new Error("TOKEN_ALREADY_USED");

      await tx.parents.update({
        where: { parents_id: resetToken.parents_id },
        data: {
          password: passwordHash,
          session_version: { increment: 1 },
        },
      });
      await tx.parent_auth_tokens.updateMany({
        where: {
          parents_id: resetToken.parents_id,
          type: "PASSWORD_RESET",
          used_at: null,
        },
        data: { used_at: now },
      });
    });

    const response = NextResponse.json({ success: true });

    response.cookies.set("parent_session", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (error) {
    if (error instanceof Error && error.message === "TOKEN_ALREADY_USED") {
      return NextResponse.json(
        { error: "ลิงก์ตั้งรหัสผ่านถูกใช้งานแล้ว" },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "ตั้งรหัสผ่านไม่สำเร็จ กรุณาลองใหม่" },
      { status: 500 },
    );
  }
}
