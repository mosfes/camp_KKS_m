export const runtime = "nodejs";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";

function clientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * POST /api/auth/parent/login
 * Body: { username: string, password: string }
 * username = รหัสนักเรียน, password = "kks" + รหัสนักเรียน
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const username =
      typeof body.username === "string" ? body.username.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!username || !password) {
      return NextResponse.json(
        { error: "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน" },
        { status: 400 },
      );
    }

    if (!/^\d+$/.test(username) || password.length > 128) {
      return NextResponse.json(
        { error: "รหัสนักเรียนหรือรหัสผ่านไม่ถูกต้อง" },
        { status: 400 },
      );
    }

    const studentId = Number(username);

    if (!Number.isSafeInteger(studentId) || studentId <= 0) {
      return NextResponse.json(
        { error: "รหัสนักเรียนต้องเป็นตัวเลข" },
        { status: 400 },
      );
    }

    const ipLimit = checkRateLimit("parent-login-ip", clientIp(req), {
      windowMs: 15 * 60 * 1000,
      max: 20,
    });
    const accountLimit = checkRateLimit("parent-login-account", studentId, {
      windowMs: 15 * 60 * 1000,
      max: 8,
    });

    if (!ipLimit.allowed || !accountLimit.allowed) {
      const retryAfter = Math.max(
        ipLimit.retryAfterSeconds ?? 0,
        accountLimit.retryAfterSeconds ?? 0,
      );

      return NextResponse.json(
        { error: "ลองเข้าสู่ระบบหลายครั้งเกินไป กรุณารอสักครู่" },
        {
          status: 429,
          headers: { "Retry-After": String(retryAfter) },
        },
      );
    }

    // ตรวจสอบรหัสผ่าน: ค้นหา parent จาก DB และใช้ bcrypt
    let parent = await prisma.parents.findFirst({
      where: { username_student_id: studentId },
    });

    let isValid = false;
    const defaultPassword = `kks${studentId}`;
    const mustChangePassword = password === defaultPassword;
    const bcrypt = await import("bcryptjs");

    if (parent) {
      // ตรวจสอบแบบ hash
      isValid = await bcrypt.compare(password, parent.password);

      // ถ้า hash ไม่ตรง ให้ตรวจสอบแบบ plain text เผื่อว่าเป็นรหัสผ่านเก่าที่ยังไม่ถูกเข้ารหัส
      if (!isValid && parent.password === password) {
        isValid = true;
        // ทำการ hash และอัปเดตลงฐานข้อมูล
        await prisma.parents.update({
          where: { parents_id: parent.parents_id },
          data: { password: await bcrypt.hash(password, 10) },
        });
      }
    } else {
      // Lazy migration: ถอนรหัสเดิม "kks" + รหัสนักเรียน ถ้าล็อกอินด้วยรหัสนี้ ให้สร้าง parent record (จำลองข้อมูล)
      if (password === defaultPassword) {
        isValid = true;
        // สร้างข้อมูล placeholder ใน parents ให้เข้ารหัส
        parent = await prisma.parents.create({
          data: {
            firstname: "รอระบุ",
            lastname: "รอระบุ",
            tel: "0000000000",
            password: await bcrypt.hash(password, 10),
            username_student_id: studentId,
          },
        });
      }
    }

    if (!isValid) {
      return NextResponse.json(
        { error: "รหัสนักเรียนหรือรหัสผ่านไม่ถูกต้อง" },
        { status: 401 },
      );
    }

    if (!parent) {
      return NextResponse.json(
        { error: "ไม่พบข้อมูลผู้ปกครอง" },
        { status: 401 },
      );
    }

    // ค้นหานักเรียนพร้อมข้อมูลห้องเรียนและค่าย (ปีการศึกษาล่าสุด)
    const student = await prisma.students.findFirst({
      where: {
        students_id: studentId,
        deletedAt: null,
      },
      select: {
        students_id: true,
        prefix_name: true,
        firstname: true,
        lastname: true,
        classroom_students: {
          orderBy: {
            classroom: {
              academic_years_years_id: "desc",
            },
          },
          take: 1,
          select: {
            classroom: {
              select: {
                classroom_id: true,
                grade: true,
                academic_years_years_id: true,
                classroom_types: {
                  select: { name: true },
                },
                classroom_teacher: {
                  select: {
                    teacher: {
                      select: {
                        prefix_name: true,
                        firstname: true,
                        lastname: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        student_enrollment: {
          where: {
            enrolled_at: { not: null },
            camp: { deletedAt: null },
          },
          select: {
            enrolled_at: true,
            shirt_size: true,
            camp: {
              select: {
                camp_id: true,
                name: true,
                start_date: true,
                end_date: true,
                location: true,
                status: true,
                img_camp_url: true,
              },
            },
          },
          orderBy: {
            enrolled_at: "desc",
          },
        },
      },
    });

    if (!student) {
      return NextResponse.json(
        { error: "รหัสนักเรียนหรือรหัสผ่านไม่ถูกต้อง" },
        { status: 401 },
      );
    }

    // เตรียม session data
    const sessionData = {
      parents_id: parent.parents_id,
      students_id: student.students_id,
      prefix_name: student.prefix_name,
      firstname: student.firstname,
      lastname: student.lastname,
      mustChangePassword,
      sessionVersion: parent.session_version,
    };

    const response = NextResponse.json({
      success: true,
      student: sessionData,
      mustChangePassword,
    });

    const { SignJWT } = await import("jose");
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);

    const token = await new SignJWT(sessionData)
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("7d")
      .sign(secret);

    response.cookies.set("parent_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 วัน
    });
    response.cookies.delete("teacher_session");
    response.cookies.delete("student_session");

    return response;
  } catch {
    //     console.error("Parent login error:", error);

    return NextResponse.json(
      { _error: "เกิดข้อผิดพลาด กรุณาลองใหม่" },
      { status: 500 },
    );
  }
}
