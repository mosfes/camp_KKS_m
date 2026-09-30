// @ts-nocheck
import { NextResponse } from "next/server";

import { requireTeacher } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createShirtPdf } from "@/lib/shirt-export-pdf";
import { activeCampEnrollmentWhere } from "@/lib/active-camp-student";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { teacher, error } = await requireTeacher();

  if (error) return error;

  try {
    const { id } = await context.params;
    const campId = parseInt(id);

    if (isNaN(campId)) {
      return NextResponse.json({ error: "Invalid camp ID" }, { status: 400 });
    }

    // Verify access
    const camp = await prisma.camp.findFirst({
      where: {
        camp_id: campId,
        deletedAt: null,
        OR: [
          { created_by_teacher_id: teacher.teachers_id },
          {
            teacher_enrollment: {
              some: { teacher_teachers_id: teacher.teachers_id },
            },
          },
          {
            camp_classroom: {
              some: {
                classroom: { teachers_teachers_id: teacher.teachers_id },
              },
            },
          },
          {
            camp_classroom: {
              some: {
                classroom: {
                  classroom_teacher: {
                    some: { teacher_teachers_id: teacher.teachers_id },
                  },
                },
              },
            },
          },
        ],
      },
      include: {
        camp_classroom: true,
      },
    });

    if (!camp && teacher.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized access to this camp" },
        { status: 403 },
      );
    }

    const adminCamp =
      camp ||
      (await prisma.camp.findUnique({
        where: { camp_id: campId },
        include: { camp_classroom: true },
      }));

    if (!adminCamp) {
      return NextResponse.json({ error: "Camp not found" }, { status: 404 });
    }

    // Fetch enrollments
    const enrollments = await prisma.student_enrollment.findMany({
      where: {
        ...activeCampEnrollmentWhere(campId),
        enrolled_at: { not: null },
      },
      include: {
        classroom: { include: { classroom_types: true } },
        student: {
          include: {
            classroom_students: {
              include: {
                classroom: {
                  include: {
                    classroom_types: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        enrolled_at: "asc",
      },
    });

    let totalShirts = 0;
    const sizeSummary: Record<string, number> = {};
    const students = [];

    const campClassroomIds = adminCamp.camp_classroom.map(
      (cc) => cc.classroom_classroom_id,
    );

    for (const enr of enrollments) {
      const size = enr.shirt_size || "รอระบุไซส์";

      if (enr.shirt_size) {
        totalShirts++;
        sizeSummary[size] = (sizeSummary[size] || 0) + 1;
      } else {
        sizeSummary["รอระบุไซส์"] = (sizeSummary["รอระบุไซส์"] || 0) + 1;
      }

      let classroomStr = "-";
      const matchedCs = enr.student.classroom_students.find((cs) =>
        campClassroomIds.includes(cs.classroom_classroom_id),
      );

      const historicalClassroom = enr.classroom || matchedCs?.classroom;

      if (historicalClassroom || enr.grade_snapshot) {
        const gradeStr = String(
          enr.grade_snapshot || historicalClassroom.grade,
        ).replace("Level_", "");
        const typeStr =
          enr.classroom_name_snapshot ||
          historicalClassroom?.classroom_types?.name ||
          "";

        classroomStr = `ม.${gradeStr} ห้อง ${typeStr}`.trim();
      }

      students.push({
        enrollmentId: enr.student_enrollment_id,
        studentId: enr.student.students_id,
        name:
          enr.student_name_snapshot ||
          `${enr.student.prefix_name || ""}${enr.student.firstname} ${enr.student.lastname}`,
        nickname: enr.student.nickname,
        classroom: classroomStr,
        shirtSize: enr.shirt_size || null,
        enrolledAt: enr.enrolled_at ? enr.enrolled_at.toISOString() : undefined,
      });
    }

    const pdfBytes = await createShirtPdf({
      campName: adminCamp.name,
      summary: sizeSummary,
      totalShirts,
      totalStudents: students.length,
      students,
    });

    const sanitizedCampName = encodeURIComponent(
      adminCamp.name.replace(/[/\\?%*:|"<>]/g, "-"),
    );

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="shirts-${sanitizedCampName}-${campId}.pdf"; filename*=UTF-8''shirts-${sanitizedCampName}-${campId}.pdf`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("Failed to generate shirt PDF:", err);

    return NextResponse.json(
      { error: "Failed to generate shirt PDF" },
      { status: 500 },
    );
  }
}
