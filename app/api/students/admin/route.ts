// @ts-nocheck
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireTeacher } from "@/lib/auth";

async function requireAdmin() {
  const { teacher, error: authError } = await requireTeacher();

  if (authError) return { teacher: null, error: authError };
  if (teacher.role !== "ADMIN") {
    return {
      teacher: null,
      error: NextResponse.json(
        { error: "คุณไม่มีสิทธิ์เข้าถึงข้อมูลนี้" },
        { status: 403 },
      ),
    };
  }

  return { teacher, error: null };
}

/**
 * GET - ดึงนักเรียนที่ถูกลบ (ถังขยะ)
 */
export async function GET(request) {
  const { error } = await requireAdmin();

  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const search = searchParams.get("search") || "";

    const skip = (page - 1) * limit;

    const where = { deletedAt: { not: null } };

    if (search) {
      where.OR = [
        { firstname: { contains: search } },
        { lastname: { contains: search } },
      ];
      if (/^\d+$/.test(search)) {
        const matchingIds = await prisma.$queryRawUnsafe(
          `SELECT students_id FROM students WHERE CAST(students_id AS CHAR) LIKE ? AND deletedAt IS NOT NULL`,
          `${search}%`,
        );

        if (matchingIds.length > 0) {
          where.OR.push({
            students_id: { in: matchingIds.map((r) => r.students_id) },
          });
        }
      }
    }

    const [students, total] = await Promise.all([
      prisma.students.findMany({
        where,
        include: {
          classroom_students: {
            include: {
              classroom: {
                include: { academic_years: true },
              },
            },
          },
        },
        orderBy: { deletedAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.students.count({ where }),
    ]);

    return NextResponse.json({
      data: students,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch {
    //     console.error("API_GET_TRASH_STUDENTS_ERROR:", error);

    return NextResponse.json(
      { _error: "ไม่สามารถดึงข้อมูลได้" },
      { status: 500 },
    );
  }
}

/**
 * PATCH - กู้คืนนักเรียน
 */
export async function PATCH(request) {
  const { error } = await requireAdmin();

  if (error) return error;

  try {
    const body = await request.json();
    const id = Number(body.students_id);

    if (!id)
      return NextResponse.json({ error: "ID ไม่ถูกต้อง" }, { status: 400 });

    const existing = await prisma.students.findFirst({
      where: { students_id: id, deletedAt: { not: null } },
    });

    if (!existing)
      return NextResponse.json(
        { error: "ไม่พบนักเรียนในถังขยะ" },
        { status: 404 },
      );

    await prisma.students.update({
      where: { students_id: id },
      data: { deletedAt: null },
    });

    return NextResponse.json({ message: "กู้คืนนักเรียนสำเร็จ" });
  } catch {
    //     console.error("API_RESTORE_STUDENT_ERROR:", error);

    return NextResponse.json({ _error: "กู้คืนไม่สำเร็จ" }, { status: 500 });
  }
}

/**
 * DELETE - ลบนักเรียนถาวร
 */
export async function DELETE(request) {
  const { error } = await requireAdmin();

  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get("id"));

    if (!id)
      return NextResponse.json({ error: "ID ไม่ถูกต้อง" }, { status: 400 });

    const existing = await prisma.students.findFirst({
      where: { students_id: id, deletedAt: { not: null } },
    });

    if (!existing)
      return NextResponse.json(
        { error: "ไม่พบนักเรียนในถังขยะ" },
        { status: 404 },
      );

    await prisma.$transaction(async (tx) => {
      await tx.parents.deleteMany({ where: { username_student_id: id } });

      const enrollments = await tx.student_enrollment.findMany({
        where: { student_students_id: id },
        select: { student_enrollment_id: true },
      });

      if (enrollments.length > 0) {
        const eIds = enrollments.map((e) => e.student_enrollment_id);

        const missionResults = await tx.mission_result.findMany({
          where: { student_enrollment_id: { in: eIds } },
          select: { mission_result_id: true },
        });

        if (missionResults.length > 0) {
          const mrIds = missionResults.map((r) => r.mission_result_id);
          const answers = await tx.mission_answer.findMany({
            where: { mission_result_mission_result_id: { in: mrIds } },
            select: { answer_id: true },
          });

          if (answers.length > 0) {
            const aIds = answers.map((a) => a.answer_id);

            await tx.mission_answer_mcq.deleteMany({
              where: { mission_answer_id: { in: aIds } },
            });
            await tx.mission_answer_text.deleteMany({
              where: { mission_answer_id: { in: aIds } },
            });
            await tx.mission_answer_photo.deleteMany({
              where: { mission_answer_id: { in: aIds } },
            });
            await tx.mission_answer.deleteMany({
              where: { answer_id: { in: aIds } },
            });
          }
          await tx.mission_result.deleteMany({
            where: { mission_result_id: { in: mrIds } },
          });
        }

        const evaluations = await tx.evaluation.findMany({
          where: { student_enrollment_id: { in: eIds } },
          select: { evaluation_id: true },
        });

        if (evaluations.length > 0) {
          const evIds = evaluations.map((e) => e.evaluation_id);
          const evalAnswers = await tx.evaluation_answer.findMany({
            where: { evaluation_evaluation_id: { in: evIds } },
            select: { answer_id: true },
          });

          if (evalAnswers.length > 0) {
            const eaIds = evalAnswers.map((a) => a.answer_id);

            await tx.evaluation_answer.deleteMany({
              where: { answer_id: { in: eaIds } },
            });
          }
          await tx.evaluation.deleteMany({
            where: { evaluation_id: { in: evIds } },
          });
        }

        await tx.attendance_record_student.deleteMany({
          where: { student_enrollment_student_enrollment_id: { in: eIds } },
        });
        await tx.certificate.deleteMany({
          where: { student_enrollment_id: { in: eIds } },
        });
        await tx.student_enrollment.deleteMany({
          where: { student_enrollment_id: { in: eIds } },
        });
      }

      await tx.classroom_students.deleteMany({
        where: { student_students_id: id },
      });
      await tx.students.delete({ where: { students_id: id } });
    });

    return NextResponse.json({ message: "ลบนักเรียนถาวรสำเร็จ" });
  } catch {
    //     console.error("API_PERMANENT_DELETE_STUDENT_ERROR:", error);

    return NextResponse.json({ _error: "ลบถาวรไม่สำเร็จ" }, { status: 500 });
  }
}
