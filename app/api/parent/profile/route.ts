export const runtime = "nodejs";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireParentSession } from "@/lib/parent-auth";
import {
  createParentAuthToken,
  createParentEmailVerificationEmail,
  isValidEmail,
  normalizeEmail,
  PARENT_AUTH_TOKEN_TTL_MS,
} from "@/lib/parent-account-email";
import { sendResendBatch } from "@/lib/resend";

/**
 * GET /api/parent/profile
 * ดึงข้อมูล parent ที่ผูกกับ studentId ใน session
 */
export async function GET() {
  try {
    const auth = await requireParentSession();

    if (auth.error) return auth.error;
    const { studentId } = auth.session;

    const parent = await prisma.parents.findFirst({
      where: { username_student_id: studentId },
      select: {
        parents_id: true,
        firstname: true,
        lastname: true,
        tel: true,
        email: true,
        email_verified_at: true,
      },
    });

    return NextResponse.json({
      parent: parent
        ? {
            parents_id: parent.parents_id,
            firstname: parent.firstname,
            lastname: parent.lastname,
            tel: parent.tel,
            email: parent.email,
            emailVerified: Boolean(parent.email_verified_at),
          }
        : null,
      hasProfile: !!parent,
    });
  } catch {
    //     console.error("Parent profile GET error:", error);

    return NextResponse.json({ _error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}

/**
 * POST /api/parent/profile
 * บันทึกข้อมูลผู้ปกครอง (สร้างใหม่ หรืออัปเดต)
 * Body: { firstname, lastname, tel, email? }
 */
async function saveProfile(req: Request) {
  try {
    const auth = await requireParentSession();

    if (auth.error) return auth.error;
    const { studentId } = auth.session;

    const body = await req.json();
    const { firstname, lastname, tel } = body;
    const email = normalizeEmail(body.email);

    // Validate
    if (!firstname?.trim() || !lastname?.trim() || !tel?.trim()) {
      return NextResponse.json(
        { error: "กรุณากรอกข้อมูลให้ครบถ้วน" },
        { status: 400 },
      );
    }

    const telDigits = tel.replace(/\D/g, "");

    if (telDigits.length !== 10) {
      return NextResponse.json(
        { error: "เบอร์โทรต้องมี 10 หลัก" },
        { status: 400 },
      );
    }

    if (email && !isValidEmail(email)) {
      return NextResponse.json(
        { error: "รูปแบบอีเมลไม่ถูกต้อง" },
        { status: 400 },
      );
    }

    // upsert: ถ้ามีแล้ว update, ถ้ายังไม่มี create
    const existing = await prisma.parents.findFirst({
      where: { username_student_id: studentId },
    });

    let parent;

    if (existing) {
      const emailChanged = normalizeEmail(existing.email) !== email;

      parent = await prisma.parents.update({
        where: { parents_id: existing.parents_id },
        data: {
          firstname: firstname.trim(),
          lastname: lastname.trim(),
          tel: telDigits,
          email: email || null,
          ...(emailChanged ? { email_verified_at: null } : {}),
        },
      });
    } else {
      const bcrypt = await import("bcryptjs");

      parent = await prisma.parents.create({
        data: {
          firstname: firstname.trim(),
          lastname: lastname.trim(),
          tel: telDigits,
          email: email || null,
          password: await bcrypt.hash(`kks${studentId}`, 10),
          username_student_id: studentId,
        },
      });
    }

    let verificationEmailSent = false;

    if (parent.email && !parent.email_verified_at) {
      const { token, tokenHash } = createParentAuthToken();
      const expiresAt = new Date(Date.now() + PARENT_AUTH_TOKEN_TTL_MS);

      await prisma.$transaction([
        prisma.parent_auth_tokens.updateMany({
          where: {
            parents_id: parent.parents_id,
            type: "EMAIL_VERIFICATION",
            used_at: null,
          },
          data: { used_at: new Date() },
        }),
        prisma.parent_auth_tokens.create({
          data: {
            parents_id: parent.parents_id,
            token_hash: tokenHash,
            type: "EMAIL_VERIFICATION",
            email: parent.email,
            expires_at: expiresAt,
          },
        }),
      ]);

      const verificationUrl = new URL("/parent/verify-email", req.url);

      verificationUrl.searchParams.set("token", token);
      const verificationEmail = createParentEmailVerificationEmail({
        recipientName: `${parent.firstname} ${parent.lastname}`.trim(),
        actionUrl: verificationUrl.toString(),
      });

      try {
        await sendResendBatch({
          messages: [{ to: parent.email, ...verificationEmail }],
          idempotencyKey: `parent-email-verification-${tokenHash}`,
        });
        verificationEmailSent = true;
      } catch {
        await prisma.parent_auth_tokens.deleteMany({
          where: { token_hash: tokenHash },
        });
      }
    }

    return NextResponse.json({
      success: true,
      verificationEmailSent,
      parent: {
        parents_id: parent.parents_id,
        firstname: parent.firstname,
        lastname: parent.lastname,
        tel: parent.tel,
        email: parent.email,
        emailVerified: Boolean(parent.email_verified_at),
      },
    });
  } catch {
    //     console.error("Parent profile POST error:", error);

    return NextResponse.json({ _error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  return saveProfile(req);
}

export async function PUT(req: Request) {
  return saveProfile(req);
}
