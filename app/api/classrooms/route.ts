// @ts-nocheck
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const yearId = searchParams.get("yearId");
    const page = searchParams.get("page");
    const limitParams = searchParams.get("limit");

    const whereClause = { deletedAt: null };

    if (yearId && yearId !== "all") {
      whereClause.academic_years_years_id = parseInt(yearId);
    }

    if (page) {
      const pageNum = parseInt(page) || 1;
      const limit = parseInt(limitParams) || 20;
      const skip = (pageNum - 1) * limit;

      const [classrooms, totalCount] = await Promise.all([
        prisma.classrooms.findMany({
          where: whereClause,
          include: {
            academic_years: true,
            teacher: true,
            classroom_types: true,
            classroom_teacher: {
              include: {
                teacher: true,
              },
            },
            _count: {
              select: { classroom_students: true },
            },
          },
          orderBy: { grade: "asc" },
          skip: skip,
          take: limit,
        }),
        prisma.classrooms.count({
          where: whereClause,
        }),
      ]);

      return NextResponse.json({
        data: classrooms,
        pagination: {
          total: totalCount,
          page: pageNum,
          limit,
          totalPages: Math.ceil(totalCount / limit),
        },
      });
    }

    const classrooms = await prisma.classrooms.findMany({
      where: whereClause,
      include: {
        academic_years: true,
        teacher: true,
        classroom_types: true,
        classroom_teacher: {
          include: {
            teacher: true,
          },
        },
        _count: {
          select: { classroom_students: true },
        },
      },
      orderBy: { grade: "asc" },
    });

    return NextResponse.json(classrooms);
  } catch {
    //     console.error("Error fetching classrooms:", error);

    return NextResponse.json(
      { _error: "ดึงข้อมูลห้องเรียนไม่สำเร็จ" },
      { status: 500 },
    );
  }
}

export async function POST(req) {
  try {
    const body = await req.json();

    if (
      !body.grade ||
      !body.type_classroom ||
      !body.academic_year_id ||
      !body.teacher_id
    ) {
      return NextResponse.json(
        { error: "กรุณากรอกข้อมูลให้ครบถ้วน" },
        { status: 400 },
      );
    }

    const existing = await prisma.classrooms.findFirst({
      where: {
        grade: body.grade,
        type_classroom: parseInt(body.type_classroom),
        academic_years_years_id: parseInt(body.academic_year_id),
      },
    });

    if (existing) {
      // ถ้าห้องเรียนถูก soft-delete อยู่ในถังขยะ ให้กู้คืนและอัปเดตข้อมูลใหม่
      if (existing.deletedAt) {
        const restored = await prisma.$transaction(async (tx) => {
          const classroom = await tx.classrooms.update({
            where: { classroom_id: existing.classroom_id },
            data: {
              teachers_teachers_id: parseInt(body.teacher_id),
              deletedAt: null, // กู้คืนออกจากถังขยะ
            },
          });

          // รีเซ็ตครูประจำชั้นคนที่ 2
          await tx.classroom_teacher.deleteMany({
            where: { classroom_classroom_id: existing.classroom_id },
          });
          if (body.teacher_id_2) {
            await tx.classroom_teacher.create({
              data: {
                classroom_classroom_id: existing.classroom_id,
                teacher_teachers_id: parseInt(body.teacher_id_2),
              },
            });
          }

          return classroom;
        });

        return NextResponse.json(restored, { status: 201 });
      }

      return NextResponse.json(
        { error: "มีห้องเรียนนี้ในปีการศึกษานี้แล้ว" },
        { status: 400 },
      );
    }

    if (body.teacher_id_2 && body.teacher_id_2 === body.teacher_id) {
      return NextResponse.json(
        { error: "ไม่สามารถเลือกครูประจำชั้นคนที่ 2 ซ้ำกับคนที่ 1 ได้" },
        { status: 400 },
      );
    }

    const teacherIdsToCheck = [parseInt(body.teacher_id)];

    if (body.teacher_id_2) {
      teacherIdsToCheck.push(parseInt(body.teacher_id_2));
    }

    const teacherAlreadyAssigned = await prisma.classrooms.findFirst({
      where: {
        academic_years_years_id: parseInt(body.academic_year_id),
        OR: [
          { teachers_teachers_id: { in: teacherIdsToCheck } },
          {
            classroom_teacher: {
              some: {
                teacher_teachers_id: { in: teacherIdsToCheck },
              },
            },
          },
        ],
      },
      include: {
        teacher: true,
        classroom_teacher: { include: { teacher: true } },
      },
    });

    if (teacherAlreadyAssigned) {
      return NextResponse.json(
        {
          error:
            "ครูท่านนี้เป็นที่ปรึกษาในห้องอื่นของปีการศึกษานี้แล้ว ไม่สามารถเลือกซ้ำได้",
        },
        { status: 400 },
      );
    }

    const newClassroom = await prisma.classrooms.create({
      data: {
        grade: body.grade,
        type_classroom: parseInt(body.type_classroom),
        academic_years_years_id: parseInt(body.academic_year_id),
        teachers_teachers_id: parseInt(body.teacher_id),
      },
    });

    if (body.teacher_id_2) {
      await prisma.classroom_teacher.create({
        data: {
          classroom_classroom_id: newClassroom.classroom_id,
          teacher_teachers_id: parseInt(body.teacher_id_2),
        },
      });
    }

    return NextResponse.json(newClassroom, { status: 201 });
  } catch {
    //     console.error("Error creating classroom:", error);

    return NextResponse.json(
      { _error: "เพิ่มห้องเรียนไม่สำเร็จ" },
      { status: 500 },
    );
  }
}

export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = parseInt(searchParams.get("id"));

    if (!id)
      return NextResponse.json({ error: "ID ไม่ถูกต้อง" }, { status: 400 });

    await prisma.classrooms.update({
      where: { classroom_id: id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ message: "ลบห้องเรียนสำเร็จ" });
  } catch {
    //     console.error("Delete error:", error);

    return NextResponse.json({ _error: "ลบไม่สำเร็จ: " }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    const body = await req.json();
    const id = parseInt(body.classroom_id);

    if (!id)
      return NextResponse.json({ error: "ID ไม่ถูกต้อง" }, { status: 400 });

    // ตรวจสอบข้อมูลซ้ำตอนแก้ไข (กรณีแก้ไขเป็นห้องเรียนที่ซ้ำกับที่มีอยู่แล้วในปีการศึกษานั้น)
    const existing = await prisma.classrooms.findFirst({
      where: {
        grade: body.grade,
        type_classroom: parseInt(body.type_classroom),
        academic_years_years_id: parseInt(body.academic_year_id),
        NOT: {
          classroom_id: id,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "ข้อมูลซ้ำ: มีห้องเรียนนี้ในปีการศึกษานี้แล้ว" },
        { status: 400 },
      );
    }

    if (body.teacher_id_2 && body.teacher_id_2 === body.teacher_id) {
      return NextResponse.json(
        { error: "ไม่สามารถเลือกครูประจำชั้นคนที่ 2 ซ้ำกับคนที่ 1 ได้" },
        { status: 400 },
      );
    }

    const teacherIdsToCheck = [parseInt(body.teacher_id)];

    if (body.teacher_id_2) {
      teacherIdsToCheck.push(parseInt(body.teacher_id_2));
    }

    const teacherAlreadyAssigned = await prisma.classrooms.findFirst({
      where: {
        academic_years_years_id: parseInt(body.academic_year_id),
        NOT: {
          classroom_id: id,
        },
        OR: [
          { teachers_teachers_id: { in: teacherIdsToCheck } },
          {
            classroom_teacher: {
              some: {
                teacher_teachers_id: { in: teacherIdsToCheck },
              },
            },
          },
        ],
      },
    });

    if (teacherAlreadyAssigned) {
      return NextResponse.json(
        {
          error:
            "ครูท่านนี้เป็นที่ปรึกษาในห้องอื่นของปีการศึกษานี้แล้ว ไม่สามารถเลือกซ้ำได้",
        },
        { status: 400 },
      );
    }

    const targetAcademicYear = parseInt(body.academic_year_id);
    const classroomMemberships = await prisma.classroom_students.findMany({
      where: { classroom_classroom_id: id },
      select: { student_students_id: true },
    });
    const conflictingMembership = await prisma.classroom_students.findFirst({
      where: {
        student_students_id: {
          in: classroomMemberships.map((item) => item.student_students_id),
        },
        academic_year: targetAcademicYear,
        NOT: { classroom_classroom_id: id },
      },
      select: { student_students_id: true },
    });

    if (conflictingMembership) {
      return NextResponse.json(
        {
          error: `ไม่สามารถย้ายห้องไปปีการศึกษานี้ได้ เนื่องจากนักเรียน ${conflictingMembership.student_students_id} มีห้องในปีดังกล่าวแล้ว`,
        },
        { status: 409 },
      );
    }

    const updatedClassroom = await prisma.$transaction(async (prisma) => {
      const classroom = await prisma.classrooms.update({
        where: { classroom_id: id },
        data: {
          grade: body.grade,
          type_classroom: parseInt(body.type_classroom),
          academic_years_years_id: targetAcademicYear,
          teachers_teachers_id: parseInt(body.teacher_id),
        },
      });

      await prisma.classroom_students.updateMany({
        where: { classroom_classroom_id: id },
        data: { academic_year: targetAcademicYear },
      });

      await prisma.classroom_teacher.deleteMany({
        where: { classroom_classroom_id: id },
      });

      if (body.teacher_id_2) {
        await prisma.classroom_teacher.create({
          data: {
            classroom_classroom_id: id,
            teacher_teachers_id: parseInt(body.teacher_id_2),
          },
        });
      }

      return classroom;
    });

    return NextResponse.json(updatedClassroom);
  } catch {
    //     console.error("Update error:", error);

    return NextResponse.json({ _error: "แก้ไขไม่สำเร็จ" }, { status: 500 });
  }
}
