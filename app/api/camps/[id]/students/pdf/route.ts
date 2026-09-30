// @ts-nocheck
import { NextResponse } from "next/server";

import { requireTeacher } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createCampStudentsPdf } from "@/lib/camp-students-export-pdf";
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

    const enrollments = await prisma.student_enrollment.findMany({
      where: {
        ...activeCampEnrollmentWhere(campId),
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
        certificate: {
          select: { certificate_no: true },
          take: 1,
        },
      },
      orderBy: {
        student: { firstname: "asc" },
      },
    });

    const campClassroomIds = adminCamp.camp_classroom.map(
      (cc) => cc.classroom_classroom_id,
    );

    let allergiesCount = 0;
    let chronicDiseasesCount = 0;
    let remarksCount = 0;

    const notSignificant = (v: string | null) => {
      if (!v) return false;
      const t = v.trim();

      return t !== "" && t !== "-" && t !== "ไม่มี";
    };

    const students = enrollments.map((enr) => {
      const stu = enr.student;

      if (notSignificant(stu.food_allergy)) allergiesCount++;
      if (notSignificant(stu.chronic_disease)) chronicDiseasesCount++;
      if (notSignificant(stu.remark)) remarksCount++;

      let classroomStr = "-";
      const matchedCs = stu.classroom_students?.find((cs) =>
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

      return {
        studentId: stu.students_id,
        name:
          enr.student_name_snapshot ||
          `${stu.prefix_name || ""}${stu.firstname} ${stu.lastname}`.trim(),
        nickname: stu.nickname,
        classroom: classroomStr,
        tel: stu.tel,
        foodAllergy: stu.food_allergy,
        chronicDisease: stu.chronic_disease,
        remark: stu.remark,
        certificateNo: enr.certificate?.[0]?.certificate_no || null,
      };
    });

    const pdfBytes = await createCampStudentsPdf({
      campName: adminCamp.name,
      summary: {
        totalStudents: students.length,
        allergiesCount,
        chronicDiseasesCount,
        remarksCount,
      },
      students,
    });

    const sanitizedCampName = encodeURIComponent(
      adminCamp.name.replace(/[/\\?%*:|"<>]/g, "-"),
    );

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="students-${sanitizedCampName}-${campId}.pdf"; filename*=UTF-8''students-${sanitizedCampName}-${campId}.pdf`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("Failed to generate student PDF:", err);

    return NextResponse.json(
      { error: "Failed to generate student PDF" },
      { status: 500 },
    );
  }
}
