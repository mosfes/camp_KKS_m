export const runtime = "nodejs";

import { NextResponse } from "next/server";

import {
  hashParentAuthToken,
  normalizeEmail,
} from "@/lib/parent-account-email";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const token = typeof body.token === "string" ? body.token.trim() : "";

    if (!token || token.length > 200) {
      return NextResponse.json(
        { error: "ลิงก์ยืนยันอีเมลไม่ถูกต้อง" },
        { status: 400 },
      );
    }

    const tokenHash = hashParentAuthToken(token);
    const verificationToken = await prisma.parent_auth_tokens.findUnique({
      where: { token_hash: tokenHash },
      select: {
        token_id: true,
        parents_id: true,
        type: true,
        email: true,
        expires_at: true,
        used_at: true,
      },
    });
    const now = new Date();

    if (
      !verificationToken ||
      verificationToken.type !== "EMAIL_VERIFICATION" ||
      !verificationToken.email ||
      verificationToken.used_at ||
      verificationToken.expires_at <= now
    ) {
      return NextResponse.json(
        { error: "ลิงก์ยืนยันอีเมลไม่ถูกต้องหรือหมดอายุแล้ว" },
        { status: 400 },
      );
    }

    await prisma.$transaction(async (tx) => {
      const claimed = await tx.parent_auth_tokens.updateMany({
        where: {
          token_id: verificationToken.token_id,
          type: "EMAIL_VERIFICATION",
          used_at: null,
          expires_at: { gt: now },
        },
        data: { used_at: now },
      });

      if (claimed.count !== 1) throw new Error("TOKEN_ALREADY_USED");

      const parent = await tx.parents.findUnique({
        where: { parents_id: verificationToken.parents_id },
        select: { email: true },
      });

      if (
        normalizeEmail(parent?.email) !==
        normalizeEmail(verificationToken.email)
      ) {
        throw new Error("EMAIL_CHANGED");
      }

      await tx.parents.update({
        where: { parents_id: verificationToken.parents_id },
        data: { email_verified_at: now },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "TOKEN_ALREADY_USED" ||
        error.message === "EMAIL_CHANGED")
    ) {
      return NextResponse.json(
        { error: "ลิงก์ยืนยันอีเมลไม่ถูกต้องหรือถูกใช้งานแล้ว" },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "ยืนยันอีเมลไม่สำเร็จ กรุณาลองใหม่" },
      { status: 500 },
    );
  }
}
