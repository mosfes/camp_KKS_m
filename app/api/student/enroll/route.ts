// @ts-nocheck
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { buildEnrollmentSnapshot } from "@/lib/student-enrollment-snapshot";
import { requireStudent } from "@/lib/auth";
import { isBangkokDateInRange } from "@/lib/bangkok-date";
import { positiveIntSchema } from "@/lib/api-validation";
import { activeCampEnrollmentWhere } from "@/lib/active-camp-student";

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
        camp_classroom: {
          select: {
            classroom: {
              select: {
                _count: {
                  select: {
                    classroom_students: {
                      where: { student: { deletedAt: null } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!camp) {
      return NextResponse.json({ error: "ไม่พบค่าย" }, { status: 404 });
    }

    if (camp.status !== "OPEN") {
      return NextResponse.json(
        { error: "ค่ายนี้ปิดรับลงทะเบียนแล้ว" },
        { status: 400 },
      );
    }

    const isRegistrationPeriod = isBangkokDateInRange(
      camp.start_regis_date,
      camp.end_regis_date,
    );
    const isCampPeriod = isBangkokDateInRange(camp.start_date, camp.end_date);

    if (!isRegistrationPeriod && !isCampPeriod) {
      return NextResponse.json(
        { error: "ไม่อยู่ในช่วงเวลาลงทะเบียนค่าย" },
        { status: 400 },
      );
    }

    const totalCapacity = camp.camp_classroom.reduce(
      (sum, campClassroom) =>
        sum + campClassroom.classroom._count.classroom_students,
      0,
    );

    // Lock the camp row while checking capacity and creating the enrollment.
    // Without this, two students registering at the same time could both see
    // one free seat and exceed the classroom capacity.
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT camp_id
        FROM camp
        WHERE camp_id = ${campId}
        FOR UPDATE
      `;

      const existing = await tx.student_enrollment.findFirst({
        where: {
          student_students_id: studentId,
          camp_camp_id: campId,
        },
      });

      if (existing) {
        if (!existing.enrolled_at) {
          const snapshot = await buildEnrollmentSnapshot(tx, campId, studentId);
          return {
            enrollment: await tx.student_enrollment.update({
              where: { student_enrollment_id: existing.student_enrollment_id },
              data: { enrolled_at: new Date(), ...snapshot },
            }),
            status: 200,
          };
        }

        return { enrollment: existing, status: 200 };
      }

      const snapshot = await buildEnrollmentSnapshot(tx, campId, studentId);

      const totalEnrolled = await tx.student_enrollment.count({
        where: {
          ...activeCampEnrollmentWhere(campId),
          enrolled_at: { not: null },
        },
      });

      if (totalCapacity > 0 && totalEnrolled >= totalCapacity) {
        const error = new Error("CAMP_CAPACITY_REACHED");

        error.code = "CAMP_CAPACITY_REACHED";
        throw error;
      }

      return {
        enrollment: await tx.student_enrollment.create({
          data: {
            student: { connect: { students_id: studentId } },
            camp: { connect: { camp_id: campId } },
            enrolled_at: new Date(),
            shirt_size: null,
            ...snapshot,
          },
        }),
        status: 201,
      };
    });

    return NextResponse.json(result.enrollment, { status: result.status });
  } catch (error) {
    if (error.code === "CAMP_CAPACITY_REACHED") {
      return NextResponse.json(
        { error: "ค่ายนี้มีผู้ลงทะเบียนเต็มจำนวนแล้ว" },
        { status: 409 },
      );
    }
    if (error.code === "P2002") {
      return NextResponse.json(
        { message: "Already enrolled" },
        { status: 200 },
      );
    }
    //     console.error("Enrollment Error:", error);

    return NextResponse.json({ error: "Failed to enroll" }, { status: 500 });
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
