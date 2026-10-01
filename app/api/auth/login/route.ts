// @ts-nocheck
import { after, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";

import { prisma } from "@/lib/db";
import { cacheGoogleProfileImage } from "@/lib/google-profile-image";

export const runtime = "nodejs";
export const maxDuration = 30;

async function cacheTeacherImage(
  teacherId: number,
  sourceUrl: unknown,
): Promise<void> {
  try {
    const cachedUrl = await cacheGoogleProfileImage({
      sourceUrl,
      accountType: "teacher",
      accountId: teacherId,
    });

    if (!cachedUrl) return;

    await prisma.teachers.updateMany({
      where: {
        teachers_id: teacherId,
        OR: [{ profile_image_url: null }, { profile_image_url: "" }],
      },
      data: { profile_image_url: cachedUrl },
    });
  } catch (error) {
    console.warn(
      "[login] Could not cache teacher Google image",
      error instanceof Error ? error.name : "UnknownError",
    );
  }
}

/**
 * POST /api/auth/login
 * Body: { email: string }
 * ค้นหาครูด้วย email → set HttpOnly cookie → return teacher info
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

    const { email } = await req.json();

    if (!email?.trim()) {
      return NextResponse.json({ error: "กรุณากรอก Email" }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const clerkUser = await currentUser();
    const verifiedEmails = new Set(
      (clerkUser?.emailAddresses || [])
        .filter((entry) => entry.verification?.status === "verified")
        .map((entry) => entry.emailAddress.trim().toLowerCase()),
    );

    if (!verifiedEmails.has(normalizedEmail)) {
      return NextResponse.json(
        { error: "อีเมลไม่ตรงกับบัญชีที่เข้าสู่ระบบ" },
        { status: 403 },
      );
    }

    const teacher = await prisma.teachers.findFirst({
      where: {
        email: normalizedEmail,
        deletedAt: null,
      },
      select: {
        teachers_id: true,
        firstname: true,
        lastname: true,
        email: true,
        role: true,
        profile_image_url: true,
      },
    });

    if (!teacher) {
      return NextResponse.json(
        { error: "ไม่พบบัญชีครูนี้ในระบบ" },
        { status: 404 },
      );
    }

    if (!teacher.profile_image_url) {
      after(() => cacheTeacherImage(teacher.teachers_id, clerkUser?.imageUrl));
    }

    // สร้าง session payload ด้วย JWT
    const { SignJWT } = await import("jose");
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);

    const token = await new SignJWT({
      teachers_id: teacher.teachers_id,
      firstname: teacher.firstname,
      lastname: teacher.lastname,
      email: teacher.email,
      role: teacher.role,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("7d")
      .sign(secret);

    const response = NextResponse.json({
      success: true,
      teacher,
    });

    // Set HttpOnly cookie (7 วัน)
    response.cookies.set("teacher_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });
    response.cookies.delete("student_session");
    response.cookies.delete("parent_session");

    return response;
  } catch {
    //     console.error("Login error:", error);

    return NextResponse.json(
      { _error: "เข้าสู่ระบบไม่สำเร็จ" },
      { status: 500 },
    );
  }
}
