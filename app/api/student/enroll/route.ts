// @ts-nocheck
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { buildEnrollmentSnapshot } from "@/lib/student-enrollment-snapshot";
import { requireStudent } from "@/lib/auth";
import { isBangkokDateInRange } from "@/lib/bangkok-date";
import { getRegistrationState } from "@/lib/camp-registration";
import { positiveIntSchema } from "@/lib/api-validation";

// POST: ลงทะเบียนเข้าร่วมค่าย
export async function POST(req) {
  const { student, error: authError } = await requireStudent();

  if (authError) return authError;

  try {
    const body = await req.json();
    const campIdResult = positiveIntSchema.safeParse(body?.campId);
    const studentId = Number(student.students_id);

    if (!campIdResult.success) {
      return NextResponse.json(
        { error: "รหัสค่ายไม่ถูกต้อง" },
        { status: 400 },
      );
    }

    const campId = campIdResult.data;

    const camp = await prisma.camp.findFirst({
      where: {
        camp_id: campId,
        deletedAt: null,
        camp_classroom: {
          some: {
            classroom: {
              deletedAt: null,
              classroom_students: {
                some: {
                  student_students_id: studentId,
                  student: { deletedAt: null },
                },
              },
            },
          },
        },
      },
      select: {
        status: true,
        start_regis_date: true,
        end_regis_date: true,
        start_date: true,
        end_date: true,
      },
    });

    if (!camp) {
      return NextResponse.json({ error: "ไม่พบค่าย" }, { status: 404 });
    }

    const registration = getRegistrationState(camp);

    if (!registration.canRegister) {
      return NextResponse.json(
        { error: registration.message, registration },
        { status: 400 },
      );
    }

    // ไม่ต้องล็อกแถวค่าย (SELECT ... FOR UPDATE) อีกต่อไป:
    // จำนวนที่นั่ง = จำนวนนักเรียนในห้องที่ผูกกับค่าย และนักเรียนหนึ่งคนลงทะเบียนได้
    // ครั้งเดียว (unique student+camp) จึงไม่มีทางเกินจำนวนที่นั่ง แต่การล็อกทำให้
    // นักเรียนทั้งห้องที่กดพร้อมกันต้องต่อคิว จนธุรกรรมเกินเวลา (P2028) และได้ 500
    const [snapshot, existing] = await Promise.all([
      buildEnrollmentSnapshot(prisma, campId, studentId),
      prisma.student_enrollment.findFirst({
        where: {
          student_students_id: studentId,
          camp_camp_id: campId,
        },
      }),
    ]);

    let result;

    if (existing) {
      result = existing.enrolled_at
        ? { enrollment: existing, status: 200 }
        : {
            enrollment: await prisma.student_enrollment.update({
              where: { student_enrollment_id: existing.student_enrollment_id },
              data: { enrolled_at: new Date(), ...snapshot },
            }),
            status: 200,
          };
    } else {
      result = {
        enrollment: await prisma.student_enrollment.create({
          // Use scalar foreign keys: the snapshot carries classroom_classroom_id,
          // which Prisma rejects when mixed with relation `connect` inputs.
          data: {
            student_students_id: studentId,
            camp_camp_id: campId,
            enrolled_at: new Date(),
            shirt_size: null,
            ...snapshot,
          },
        }),
        status: 201,
      };
    }

    return NextResponse.json(result.enrollment, { status: result.status });
  } catch (error) {
    if (error.code === "P2002") {
      return NextResponse.json(
        { message: "Already enrolled" },
        { status: 200 },
      );
    }
    console.error("[student enroll] error:", error);

    return NextResponse.json(
      { error: "ลงทะเบียนไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" },
      { status: 500 },
    );
  }
}

// PUT: อัปเดตขนาดเสื้อ
export async function PUT(req) {
  const { student, error: authError } = await requireStudent();

  if (authError) return authError;

  try {
    const body = await req.json();
    const campIdResult = positiveIntSchema.safeParse(body?.campId);
    const shirtSize =
      typeof body?.shirtSize === "string" ? body.shirtSize.trim() : "";

    if (!campIdResult.success || !shirtSize || shirtSize.length > 10) {
      return NextResponse.json(
        { error: "รหัสค่ายหรือขนาดเสื้อไม่ถูกต้อง" },
        { status: 400 },
      );
    }

    const campId = campIdResult.data;

    // ตรวจสอบว่าอยู่ในช่วงเวลาจองเสื้อหรือไม่
    const camp = await prisma.camp.findUnique({
      where: { camp_id: campId },
      select: { has_shirt: true, start_shirt_date: true, end_shirt_date: true },
    });

    if (!camp) {
      return NextResponse.json({ error: "Camp not found" }, { status: 404 });
    }

    if (!camp.has_shirt) {
      return NextResponse.json(
        { error: "ค่ายนี้ไม่ได้เปิดจองเสื้อ" },
        { status: 400 },
      );
    }

    if (!isBangkokDateInRange(camp.start_shirt_date, camp.end_shirt_date)) {
      return NextResponse.json(
        { error: "ไม่ได้อยู่ในช่วงเวลาจองเสื้อ" },
        { status: 400 },
      );
    }

    const enrollment = await prisma.student_enrollment.findFirst({
      where: {
        student_students_id: student.students_id,
        camp_camp_id: campId,
      },
    });

    if (!enrollment) {
      return NextResponse.json(
        { error: "Not enrolled in this camp" },
        { status: 404 },
      );
    }

    const updated = await prisma.student_enrollment.update({
      where: { student_enrollment_id: enrollment.student_enrollment_id },
      data: { shirt_size: shirtSize },
    });

    return NextResponse.json(updated);
  } catch {
    //     console.error("Update Shirt Error:", error);

    return NextResponse.json(
      { _error: "Failed to update shirt size" },
      { status: 500 },
    );
  }
}
