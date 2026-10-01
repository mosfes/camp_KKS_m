export const runtime = "nodejs";
// @ts-nocheck
import { NextResponse } from "next/server";

import { requireStudent } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  isCloudinaryUploadUrl,
  isIsoDate,
  isTenDigitPhone,
  profileUpdateSchema,
  validationErrorMessage,
} from "@/lib/api-validation";

export async function GET() {
  try {
    const { student: sessionStudent, error } = await requireStudent();

    if (error || !sessionStudent) return error;

    const studentId = Number(sessionStudent.students_id);

    const student = await prisma.students.findUnique({
      where: { students_id: studentId },
      select: {
        students_id: true,
        prefix_name: true,
        firstname: true,
        lastname: true,
        nickname: true,
        profile_image_url: true,
        birthday: true,
        food_allergy: true,
        chronic_disease: true,
        remark: true,
        tel: true,
        email: true,
        deletedAt: true,
        parents: {
          select: {
            parents_id: true,
            firstname: true,
            lastname: true,
            tel: true,
            username_student_id: true,
          },
        },
      },
    });

    if (!student)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    // ดึงข้อมูลห้องเรียนของนักเรียน
    const classroomInfo = await prisma.classroom_students.findFirst({
      where: { student_students_id: studentId },
      include: {
        classroom: {
          include: {
            classroom_types: true,
            academic_years: true,
            teacher: true,
            classroom_teacher: {
              include: { teacher: true },
            },
          },
        },
      },
      orderBy: {
        classroom_classroom_id: "desc",
      },
    });

    const classroom = classroomInfo?.classroom ?? null;
    let homeroomTeachers = null;

    if (classroom) {
      const teacherMap = new Map();

      if (classroom.teacher) {
        const t = classroom.teacher;

        teacherMap.set(
          t.teachers_id,
          `${t.prefix_name || ""}${t.firstname} ${t.lastname}`.trim(),
        );
      }
      for (const ct of classroom.classroom_teacher ?? []) {
        if (ct.teacher) {
          const t = ct.teacher;

          teacherMap.set(
            t.teachers_id,
            `${t.prefix_name || ""}${t.firstname} ${t.lastname}`.trim(),
          );
        }
      }
      homeroomTeachers =
        teacherMap.size > 0 ? Array.from(teacherMap.values()).join(", ") : null;
    }

    return NextResponse.json({
      ...student,
      classroom: classroom
        ? {
            classroom_id: classroom.classroom_id,
            grade: classroom.grade,
            grade_label: classroom.grade?.replace("Level_", "ม.") ?? null,
            class_name: classroom.classroom_types?.name ?? null,
            academic_year: classroom.academic_years?.year ?? null,
            homeroom_teacher: homeroomTeachers,
          }
        : null,
    });
  } catch {
    return NextResponse.json(
      { _error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function PUT(req: any) {
  try {
    const { student: sessionStudent, error } = await requireStudent();

    if (error || !sessionStudent) return error;

    const body = await req.json();
    const parsed = profileUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: validationErrorMessage(parsed.error) },
        { status: 400 },
      );
    }

    const validated = parsed.data;
    const studentId = Number(sessionStudent.students_id);

    if (
      (validated.student_tel && !isTenDigitPhone(validated.student_tel)) ||
      (validated.parent_tel && !isTenDigitPhone(validated.parent_tel))
    ) {
      return NextResponse.json(
        { error: "เบอร์โทรต้องเป็นตัวเลข 10 หลัก" },
        { status: 400 },
      );
    }

    if (validated.birthday && !isIsoDate(validated.birthday)) {
      return NextResponse.json({ error: "วันเกิดไม่ถูกต้อง" }, { status: 400 });
    }

    if (
      validated.profile_image_url &&
      !isCloudinaryUploadUrl(
        validated.profile_image_url,
        `camp_profiles/student_${studentId}/profile`,
      )
    ) {
      return NextResponse.json(
        { error: "รูปโปรไฟล์ต้องเป็นไฟล์ที่ตรวจสอบจาก Cloudinary แล้ว" },
        { status: 400 },
      );
    }

    const updateData: any = {};

    // Only update fields that were included in the request. This lets the
    // lightweight first-visit form save nickname/food allergy without
    // clearing the student's existing medical and contact information.
    if (validated.chronic_disease !== undefined) {
      updateData.chronic_disease = validated.chronic_disease || null;
    }
    if (validated.food_allergy !== undefined) {
      updateData.food_allergy = validated.food_allergy || null;
    }
    if (validated.birthday !== undefined) {
      updateData.birthday = validated.birthday
        ? new Date(`${validated.birthday}T00:00:00.000Z`)
        : null;
    }
    if (validated.remark !== undefined) {
      updateData.remark = validated.remark || null;
    }
    if (validated.student_tel !== undefined) {
      updateData.tel = validated.student_tel
        ? validated.student_tel.replace(/\D/g, "")
        : null;
    }

    // อัปเดตชื่อเล่นถ้ามี
    if (validated.nickname !== undefined) {
      updateData.nickname = validated.nickname || null;
    }

    // อัปเดต profile_image_url ถ้ามี
    if (validated.profile_image_url !== undefined) {
      updateData.profile_image_url = validated.profile_image_url || null;
    }

    const updatedStudent = await prisma.students.update({
      where: { students_id: studentId },
      data: updateData,
    });

    // Update parent phone if parent exists, if not, create a placeholder record
    if (validated.parent_tel) {
      const existingParent = await prisma.parents.findFirst({
        where: { username_student_id: studentId },
      });

      const parentTelDigits = validated.parent_tel.replace(/\D/g, "");

      if (existingParent) {
        await prisma.parents.update({
          where: { parents_id: existingParent.parents_id },
          data: { tel: parentTelDigits },
        });
      } else {
        await prisma.parents.create({
          data: {
            firstname: "รอระบุ",
            lastname: "รอระบุ",
            tel: parentTelDigits,
            password: await require("bcryptjs").hash(`kks${studentId}`, 10),
            username_student_id: studentId,
          },
        });
      }
    }

    return NextResponse.json({ success: true, data: updatedStudent });
  } catch {
    return NextResponse.json(
      { _error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
