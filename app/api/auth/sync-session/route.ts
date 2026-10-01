// @ts-nocheck
import { after, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";

import { prisma } from "@/lib/db";
import { cacheGoogleProfileImage } from "@/lib/google-profile-image";

export const runtime = "nodejs";
export const maxDuration = 30;

async function cacheTeacherImageIfMissing(
  teacher: { teachers_id: number; profile_image_url: string | null },
  sourceUrl: unknown,
) {
  if (teacher.profile_image_url) return;

  try {
    const cachedUrl = await cacheGoogleProfileImage({
      sourceUrl,
      accountType: "teacher",
      accountId: teacher.teachers_id,
    });

    if (!cachedUrl) return;

    await prisma.teachers.updateMany({
      where: {
        teachers_id: teacher.teachers_id,
        OR: [{ profile_image_url: null }, { profile_image_url: "" }],
      },
      data: { profile_image_url: cachedUrl },
    });
  } catch (error) {
    console.warn(
      "[sync-session] Could not cache teacher Google image",
      error instanceof Error ? error.name : "UnknownError",
    );
  }
}

async function cacheStudentImageIfMissing(
  student: { students_id: number; profile_image_url: string | null },
  sourceUrl: unknown,
) {
  if (student.profile_image_url) return;

  try {
    const cachedUrl = await cacheGoogleProfileImage({
      sourceUrl,
      accountType: "student",
      accountId: student.students_id,
    });

    if (!cachedUrl) return;

    await prisma.students.updateMany({
      where: {
        students_id: student.students_id,
        OR: [{ profile_image_url: null }, { profile_image_url: "" }],
      },
      data: { profile_image_url: cachedUrl },
    });
  } catch (error) {
    console.warn(
      "[sync-session] Could not cache student Google image",
      error instanceof Error ? error.name : "UnknownError",
    );
  }
}

/**
 * GET /api/auth/sync-session?to=/headteacher/dashboard
 * อ่าน Clerk session → หา teacher/student ใน DB → set HttpOnly cookie → redirect
 */
export async function GET(req: any) {
  const { userId } = await auth();
  const requestedPath = new URL(req.url).searchParams.get("to");

  // รับเฉพาะ path ภายในเว็บไซต์ ป้องกัน external redirect
  const safeRequestedPath =
    requestedPath?.startsWith("/") && !requestedPath.startsWith("//")
      ? requestedPath
      : null;

  if (!userId) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  try {
    const user = await currentUser();
    const email = user?.emailAddresses?.[0]?.emailAddress;

    if (!email) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    const { SignJWT } = await import("jose");
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);

    // หา teacher
    const teacher = await prisma.teachers.findFirst({
      where: { email, deletedAt: null },
      select: {
        teachers_id: true,
        firstname: true,
        lastname: true,
        email: true,
        role: true,
        profile_image_url: true,
      },
    });

    if (teacher) {
      if (!teacher.profile_image_url) {
        after(() => cacheTeacherImageIfMissing(teacher, user?.imageUrl));
      }

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

      const destination = safeRequestedPath || "/headteacher/dashboard";
      const response = NextResponse.redirect(new URL(destination, req.url));

      response.cookies.set("teacher_session", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      });
      response.cookies.delete("student_session");
      response.cookies.delete("parent_session");

      return response;
    }

    // หา student
    const student = await prisma.students.findFirst({
      where: { email, deletedAt: null },
      select: {
        students_id: true,
        firstname: true,
        lastname: true,
        email: true,
        profile_image_url: true,
      },
    });

    if (student) {
      if (!student.profile_image_url) {
        after(() => cacheStudentImageIfMissing(student, user?.imageUrl));
      }

      const token = await new SignJWT({
        students_id: student.students_id,
        firstname: student.firstname,
        lastname: student.lastname,
        email: student.email,
      })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("7d")
        .sign(secret);

      const destination = safeRequestedPath || "/student/dashboard";
      const response = NextResponse.redirect(new URL(destination, req.url));

      response.cookies.set("student_session", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      });
      response.cookies.delete("teacher_session");
      response.cookies.delete("parent_session");

      return response;
    }

    // ไม่พบในระบบ
    return NextResponse.redirect(new URL("/", req.url));
  } catch {
    //     console.error("sync-session error:", error);

    return NextResponse.redirect(new URL("/", req.url));
  }
}
