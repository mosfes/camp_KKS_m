export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getBangkokDateKey, isBangkokDateBefore } from "@/lib/bangkok-date";
import { requireParentSession } from "@/lib/parent-auth";
import { resolveParentStudent } from "@/lib/parent-student-access";

/**
 * GET /api/parent/camps
 * ดึงค่ายทั้งหมดที่นักเรียน (บุตร) เข้าร่วม – format เดียวกับ /api/student/camps
 */
export async function GET(request: Request) {
  try {
    const auth = await requireParentSession();
    if (auth.error) return auth.error;
    const { studentId, error } = await resolveParentStudent(request, auth.session);
    if (error) return error;

    // 1. Find classrooms for the student
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

    const classroomIds = classrooms.map((c) => c.classroom_id);

    if (classroomIds.length === 0) {
      return NextResponse.json([]);
    }

    // 2. Find Camps linked to these classrooms
    const camps = await prisma.camp.findMany({
      where: {
        deletedAt: null,
        camp_classroom: {
          some: {
            classroom_classroom_id: { in: classroomIds },
          },
        },
      },
      include: {
        student_enrollment: {
          where: { student: { deletedAt: null } },
        },
        camp_classroom: {
          include: {
            classroom: {
              include: {
                _count: {
                  select: {
                    classroom_students: {
                      where: { student: { deletedAt: null } },
                    },
                  },
                },
                classroom_students: {
                  where: { student: { deletedAt: null } },
                  select: { student_students_id: true },
                },
              },
            },
          },
        },
        station: {
          where: { deletedAt: null },
          include: {
            mission: {
              where: { deletedAt: null },
            },
          },
        },
      },
      orderBy: {
        camp_id: "desc",
      },
    });

    // 3. Transform – same shape as student camps
    const parentCamps = camps.map((camp) => {
      const enrollments = camp.student_enrollment;
      const activeStudentIds = new Set(
        camp.camp_classroom.flatMap((item) =>
          item.classroom.classroom_students.map(
            (classroomStudent) => classroomStudent.student_students_id,
          ),
        ),
      );
      const myEnrollment = enrollments.find(
        (e) => e.student_students_id === studentId,
      );

      const isRegistered = !!myEnrollment?.enrolled_at;
      const isEnded = isBangkokDateBefore(camp.end_date);

      const totalCapacity = camp.camp_classroom.reduce(
        (sum, cc) => sum + (cc.classroom?._count?.classroom_students || 0),
        0,
      );
      const totalEnrolled = enrollments.filter(
        (e) => e.enrolled_at && activeStudentIds.has(e.student_students_id),
      ).length;

      // Count missions
      const totalMissions =
        camp.station?.reduce((acc, s) => acc + (s.mission?.length || 0), 0) ||
        0;

      return {
        id: camp.camp_id,
        publicId: camp.public_id,
        title: camp.name,
        description: camp.description,
        location: camp.location,
        startDate: getBangkokDateKey(camp.start_date),
        endDate: getBangkokDateKey(camp.end_date),
        isRegistered,
        isEnded,
        rawStartDate: camp.start_date,
        rawEndDate: camp.end_date,
        station: camp.station,
        img_camp_url: camp.img_camp_url,
        totalCapacity,
        totalEnrolled,
        totalMissions,
        shirtSize: myEnrollment?.shirt_size || null,
        startRegisDate: camp.start_regis_date,
        endRegisDate: camp.end_regis_date,
        academicYear:
          camp.camp_classroom[0]?.classroom?.academic_years_years_id,
      };
    });

    return NextResponse.json(parentCamps, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    //     console.error("Parent camps error:", error);

    return NextResponse.json(
      { _error: "Failed to fetch camps" },
      { status: 500 },
    );
  }
}
