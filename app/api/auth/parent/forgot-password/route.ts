export const runtime = "nodejs";

import { NextResponse } from "next/server";

import {
  createParentAuthToken,
  createPasswordResetEmail,
  isValidEmail,
  normalizeEmail,
  PARENT_AUTH_TOKEN_TTL_MS,
  resolvePasswordResetRecipient,
} from "@/lib/parent-account-email";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendResendBatch } from "@/lib/resend";

const GENERIC_MESSAGE =
  "หากข้อมูลถูกต้อง ระบบจะส่งลิงก์ตั้งรหัสผ่านใหม่ไปยังอีเมลที่กำหนด";

function clientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username =
      typeof body.username === "string" ? body.username.trim() : "";
    const recipientEmail = normalizeEmail(
      body.recipientEmail ?? body.parentEmail,
    );
    const studentId = Number(username);

    if (!/^\d+$/.test(username) || !Number.isSafeInteger(studentId)) {
      return NextResponse.json({ message: GENERIC_MESSAGE });
    }

    if (recipientEmail && !isValidEmail(recipientEmail)) {
      return NextResponse.json(
        { error: "รูปแบบอีเมลไม่ถูกต้อง" },
        { status: 400 },
      );
    }

    const ipLimit = checkRateLimit(
      "parent-password-reset-ip",
      clientIp(request),
      {
        windowMs: 15 * 60 * 1000,
        max: 10,
      },
    );
    const accountLimit = checkRateLimit(
      "parent-password-reset-account",
      studentId,
      { windowMs: 15 * 60 * 1000, max: 3 },
    );

    if (!ipLimit.allowed || !accountLimit.allowed) {
      const retryAfter = Math.max(
        ipLimit.retryAfterSeconds ?? 0,
        accountLimit.retryAfterSeconds ?? 0,
      );

      return NextResponse.json(
        { error: "มีการขอลิงก์หลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่" },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      );
    }

    const parent = await prisma.parents.findFirst({
      where: {
        username_student_id: studentId,
        student: { deletedAt: null },
      },
      select: {
        parents_id: true,
        firstname: true,
        lastname: true,
        email: true,
        email_verified_at: true,
        student: {
          select: { firstname: true, lastname: true, email: true },
        },
      },
    });

    if (!parent) {
      return NextResponse.json({ message: GENERIC_MESSAGE });
    }

    const recipient = resolvePasswordResetRecipient({
      recipientEmailInput: recipientEmail,
      storedParentEmail: parent.email,
      parentEmailVerified: Boolean(parent.email_verified_at),
      parentName: `${parent.firstname} ${parent.lastname}`.trim(),
      studentEmail: parent.student.email,
      studentName:
        `${parent.student.firstname} ${parent.student.lastname}`.trim(),
    });

    if (!recipient) {
      return NextResponse.json({ message: GENERIC_MESSAGE });
    }

    const { token, tokenHash } = createParentAuthToken();
    const expiresAt = new Date(Date.now() + PARENT_AUTH_TOKEN_TTL_MS);

    await prisma.$transaction([
      prisma.parent_auth_tokens.updateMany({
        where: {
          parents_id: parent.parents_id,
          type: "PASSWORD_RESET",
          used_at: null,
        },
        data: { used_at: new Date() },
      }),
      prisma.parent_auth_tokens.create({
        data: {
          parents_id: parent.parents_id,
          token_hash: tokenHash,
          type: "PASSWORD_RESET",
          expires_at: expiresAt,
        },
      }),
    ]);

    const resetUrl = new URL("/parent/reset-password", request.url);

    resetUrl.searchParams.set("token", token);
    const email = createPasswordResetEmail({
      recipientName: recipient.name || "ผู้ใช้งาน",
      actionUrl: resetUrl.toString(),
    });

    try {
      await sendResendBatch({
        messages: [{ to: recipient.email, ...email }],
        idempotencyKey: `parent-password-reset-${tokenHash}`,
      });
    } catch {
      await prisma.parent_auth_tokens.deleteMany({
        where: { token_hash: tokenHash },
      });
    }

    return NextResponse.json({ message: GENERIC_MESSAGE });
  } catch {
    return NextResponse.json(
      { error: "ไม่สามารถดำเนินการได้ในขณะนี้ กรุณาลองใหม่ภายหลัง" },
      { status: 500 },
    );
  }
}
