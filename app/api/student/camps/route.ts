// @ts-nocheck
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireStudent } from "@/lib/auth";
import { isBangkokDateBefore } from "@/lib/bangkok-date";

/**
 * Dashboard summary only.
 *
 * Keep this endpoint intentionally small: questions, choices, answers,
 * schedules and station details are loaded by the pages that need them.
 */
export async function GET() {
  const { student, error: authError } = await requireStudent();

  if (authError) return authError;

  const studentId = student.students_id;

  try {
    const classrooms = await prisma.classrooms.findMany({
      where: {
        deletedAt: null,
        classroom_students: {
          some: {
            student_students_id: studentId,
            student: { deletedAt: null },
          },
        },
      },
      select: { classroom_id: true },
    });

    const classroomIds = classrooms.map((classroom) => classroom.classroom_id);

    const camps = await prisma.camp.findMany({
      where: {
        deletedAt: null,
        camp_classroom: {
          some: { classroom_classroom_id: { in: classroomIds } },
        },
      },
      select: {
        camp_id: true,
        public_id: true,
        name: true,
        location: true,
        start_date: true,
        end_date: true,
        start_regis_date: true,
        img_camp_url: true,
        survey: { select: { survey_id: true } },
        student_enrollment: {
          where: { student_students_id: studentId },
          select: {
            enrolled_at: true,
          },
          take: 1,
        },
        camp_classroom: {
          select: {
            classroom: {
              select: { academic_years_years_id: true },
            },
          },
          take: 1,
        },
      },
      orderBy: { camp_id: "desc" },
    });

    return NextResponse.json(
      camps.map((camp) => {
        const enrollment = camp.student_enrollment[0];
        const isRegistered = !!enrollment?.enrolled_at;

        return {
          id: camp.camp_id,
          publicId: camp.public_id,
          title: camp.name,
          location: camp.location,
          rawStartDate: camp.start_date,
          rawEndDate: camp.end_date,
          startRegisDate: camp.start_regis_date,
          isRegistered,
          hasEnrollment: !!enrollment,
          hasSurvey: camp.survey.length > 0,
          isEnded: isBangkokDateBefore(camp.end_date),
          img_camp_url: camp.img_camp_url,
          academicYear:
            camp.camp_classroom[0]?.classroom?.academic_years_years_id ?? null,
        };
      }),
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch (error) {
    console.error("[student camps summary] error:", error);

    return NextResponse.json(
      { _error: "Failed to fetch camps" },
      { status: 500 },
    );
  }
}
