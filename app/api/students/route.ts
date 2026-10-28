// @ts-nocheck
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

async function getClassroomYear(db, classroomId) {
  const classroom = await db.classrooms.findUnique({
    where: { classroom_id: parseInt(classroomId) },
    select: { academic_years_years_id: true },
  });

  if (!classroom) throw new Error("ไม่พบห้องเรียนที่เลือก");
  return classroom.academic_years_years_id;
}

export async function GET(req) {
  const { error: authError } = await requireAdmin();

  if (authError) return authError;

  try {
    const { searchParams } = new URL(req.url);
    const yearId = searchParams.get("yearId");
    const grade = searchParams.get("grade");
    const roomType = searchParams.get("roomType");
    const search = searchParams.get("search");
    const page = searchParams.get("page");
    const limitParams = searchParams.get("limit");

    const whereClause = { deletedAt: null };
    const classroomIncludeClause = {
      orderBy: {
        classroom_students_id: "desc",
      },
      include: {
        classroom: {
          include: {
            teacher: true,
            academic_years: true,
          },
        },
      },
    };

    const classroomConditions = {};
    // นักเรียนที่ยังเรียนอยู่แต่ยังไม่ได้จัดห้องในปีการศึกษาที่เลือก
    const unassigned = grade === "unassigned" && /^\d+$/.test(yearId || "");

    if (unassigned) {
      whereClause.status = "ACTIVE";
      whereClause.classroom_students = {
        none: { classroom: { academic_years_years_id: parseInt(yearId) } },
      };
    } else if (/^\d+$/.test(yearId || "")) {
      classroomConditions.academic_years_years_id = parseInt(yearId);
    }
    if (!unassigned && /^Level_[1-6]$/.test(grade || "")) {
      classroomConditions.grade = grade;
    }
    if (!unassigned && /^\d+$/.test(roomType || "")) {
      classroomConditions.type_classroom = parseInt(roomType);
    }

    if (Object.keys(classroomConditions).length > 0) {
      whereClause.classroom_students = {
        some: {
          classroom: classroomConditions,
        },
      };
      classroomIncludeClause.where = {
        classroom: classroomConditions,
      };
    }

    if (search) {
      const searchConditions = [
        { firstname: { contains: search } },
        { lastname: { contains: search } },
        { nickname: { contains: search } },
      ];

      if (/^\d+$/.test(search)) {
        const searchParam = `${search}%`;
        const matchingIds =
          await prisma.$queryRaw`SELECT students_id FROM students WHERE CAST(students_id AS CHAR) LIKE ${searchParam}`;

        if (matchingIds.length > 0) {
          searchConditions.push({
            students_id: { in: matchingIds.map((r) => r.students_id) },
          });
        }
      }
      whereClause.OR = searchConditions;
    }

    if (page) {
      const pageNum = parseInt(page) || 1;
      const limit = parseInt(limitParams) || 20;
      const skip = (pageNum - 1) * limit;

      const [students, totalCount] = await Promise.all([
        prisma.students.findMany({
          where: whereClause,
          include: {
            classroom_students: classroomIncludeClause,
          },
          orderBy: { students_id: "asc" },
          skip: skip,
          take: limit,
        }),
        prisma.students.count({
          where: whereClause,
        }),
      ]);

      return NextResponse.json({
        data: students,
        pagination: {
          total: totalCount,
          page: pageNum,
          limit,
          totalPages: Math.ceil(totalCount / limit),
        },
      });
    }

    const students = await prisma.students.findMany({
      where: whereClause,
      include: {
        classroom_students: classroomIncludeClause,
      },
      orderBy: { students_id: "asc" },
    });

    return NextResponse.json(students);
  } catch {
    //     console.error("Error fetching students:", error);

    return NextResponse.json(
      { _error: "Failed to fetch students" },
      { status: 500 },
    );
  }
}

export async function POST(req) {
  const { error: authError } = await requireAdmin();

  if (authError) return authError;

  try {
    const body = await req.json();

    if (Array.isArray(body)) {
      try {
        const ids = body.map((item) => parseInt(item.students_id));
        const existingStudents = await prisma.students.findMany({
          where: { students_id: { in: ids } },
          select: { students_id: true },
        });
        const existingIds = new Set(existingStudents.map((s) => s.students_id));

        const uniqueItems = new Map();

        for (const item of body) {
          const id = parseInt(item.students_id);

          if (!existingIds.has(id) && !Number.isNaN(id)) {
            uniqueItems.set(id, item);
          }
        }

        const studentsToCreate = Array.from(uniqueItems.values());

        if (studentsToCreate.length > 0) {
          const result = await prisma.$transaction(
            async (prisma) => {
              const studentsData = studentsToCreate.map((item) => ({
                students_id: parseInt(item.students_id),
                prefix_name: item.prefix_name || null,
                firstname: item.firstname,
                lastname: item.lastname,
                email: item.email || "",
                tel: item.tel || "",
                birthday: item.birthday ? new Date(item.birthday) : null,
              }));

              await prisma.students.createMany({
                data: studentsData,
                skipDuplicates: true,
              });

              const classroomIds = Array.from(
                new Set(
                  studentsToCreate
                    .filter((item) => item.classroom_id)
                    .map((item) => parseInt(item.classroom_id)),
                ),
              );
              const selectedClassrooms = await prisma.classrooms.findMany({
                where: { classroom_id: { in: classroomIds } },
                select: {
                  classroom_id: true,
                  academic_years_years_id: true,
                },
              });
              const classroomYearById = new Map(
                selectedClassrooms.map((room) => [
                  room.classroom_id,
                  room.academic_years_years_id,
                ]),
              );

              const classroomStudentsData = studentsToCreate
                .filter((item) => item.classroom_id)
                .map((item) => {
                  const classroomId = parseInt(item.classroom_id);
                  const academicYear = classroomYearById.get(classroomId);

                  if (!academicYear) throw new Error("ไม่พบห้องเรียนที่เลือก");
                  return {
                    student_students_id: parseInt(item.students_id),
                    classroom_classroom_id: classroomId,
                    academic_year: academicYear,
                  };
                });

              if (classroomStudentsData.length > 0) {
                await prisma.classroom_students.createMany({
                  data: classroomStudentsData,
                  skipDuplicates: true,
                });
              }

              return studentsToCreate;
            },
            { timeout: 30000 },
          );

          return NextResponse.json(result, { status: 201 });
        }

        return NextResponse.json([], { status: 201 });
      } catch {
        //         console.error("Bulk Insert Error:", e);

        return NextResponse.json(
          { error: "Bulk insert failed" },
          { status: 500 },
        );
      }
    }

    const rawId = String(body?.students_id ?? "").trim();

    if (!rawId) {
      return NextResponse.json(
        { error: "กรุณากรอกรหัสนักเรียน" },
        { status: 400 },
      );
    }

    const id = Number(rawId);

    if (!/^\d+$/.test(rawId) || !Number.isInteger(id) || id < 1 || id > 2147483647) {
      return NextResponse.json(
        { error: "รหัสนักเรียนต้องเป็นตัวเลขระหว่าง 1 ถึง 2147483647" },
        { status: 400 },
      );
    }

    if (typeof body.firstname !== "string" || !body.firstname.trim()) {
      return NextResponse.json(
        { error: "กรุณากรอกชื่อนักเรียน" },
        { status: 400 },
      );
    }

    const rawClassroomId = String(body.classroom_id ?? "").trim();
    const classroomId = rawClassroomId ? Number(rawClassroomId) : null;
    if (
      rawClassroomId &&
      (!/^\d+$/.test(rawClassroomId) || !Number.isInteger(classroomId) || classroomId < 1)
    ) {
      return NextResponse.json(
        { error: "รหัสห้องเรียนไม่ถูกต้อง" },
        { status: 400 },
      );
    }

    const birthday = body.birthday ? new Date(body.birthday) : null;
    if (birthday && Number.isNaN(birthday.getTime())) {
      return NextResponse.json(
        { error: "วันเกิดไม่ถูกต้อง" },
        { status: 400 },
      );
    }

    const existing = await prisma.students.findUnique({
      where: { students_id: id },
    });

    if (body.email) {
      const existingTeacher = await prisma.teachers.findFirst({
        where: { email: body.email },
      });

      if (existingTeacher)
        return NextResponse.json(
          { error: "อีเมลนี้ถูกใช้งานโดยครูแล้ว" },
          { status: 400 },
        );

      const existingStudentByEmail = await prisma.students.findFirst({
        where: { email: body.email },
      });

      if (existingStudentByEmail && existingStudentByEmail.students_id !== id) {
        return NextResponse.json(
          { error: "อีเมลนี้ถูกใช้งานโดยนักเรียนคนอื่นแล้ว" },
          { status: 400 },
        );
      }
    }

    if (existing) {
      // ถ้านักเรียนถูก soft-delete อยู่ในถังขยะ ให้กู้คืนและอัปเดตข้อมูลใหม่
      if (existing.deletedAt) {
        const result = await prisma.$transaction(async (prisma) => {
          const restored = await prisma.students.update({
            where: { students_id: id },
            data: {
              prefix_name: body.prefix_name || null,
              firstname: body.firstname,
              lastname: body.lastname,
              birthday,
              email: body.email || "",
              tel: body.tel || "",
              deletedAt: null, // กู้คืนออกจากถังขยะ
            },
          });

          if (classroomId) {
            // เช็คว่ามีอยู่ในห้องนั้นแล้วหรือเปล่า (กันซ้ำ)
            const alreadyInRoom = await prisma.classroom_students.findFirst({
              where: {
                student_students_id: id,
                classroom_classroom_id: classroomId,
              },
            });

            if (!alreadyInRoom) {
              const academicYear = await getClassroomYear(
                prisma,
                classroomId,
              );
              await prisma.classroom_students.create({
                data: {
                  student_students_id: id,
                  classroom_classroom_id: classroomId,
                  academic_year: academicYear,
                },
              });
            }
          }

          return restored;
        }, { timeout: 30000 });

        return NextResponse.json(result, { status: 201 });
      }

      return NextResponse.json(
        { error: "Student ID already exists" },
        { status: 400 },
      );
    }

    const result = await prisma.$transaction(async (prisma) => {
      const newStudent = await prisma.students.create({
        data: {
          students_id: id,
          prefix_name: body.prefix_name || null,
          firstname: body.firstname,
          lastname: body.lastname,
          birthday,
          email: body.email || "",
          tel: body.tel || "",
        },
      });

      if (classroomId) {
        const academicYear = await getClassroomYear(prisma, classroomId);
        await prisma.classroom_students.create({
          data: {
            student_students_id: id,
            classroom_classroom_id: classroomId,
            academic_year: academicYear,
          },
        });
      }

      return newStudent;
    }, { timeout: 30000 });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Error adding student:", error);

    if (error.message === "ไม่พบห้องเรียนที่เลือก") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "ข้อมูลนักเรียนหรือการจัดห้องเรียนซ้ำกับข้อมูลที่มีอยู่" },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: "ระบบไม่สามารถเพิ่มนักเรียนได้ในขณะนี้ กรุณาลองอีกครั้ง" },
      { status: 500 },
    );
  }
}

export async function DELETE(req) {
  const { error: authError } = await requireAdmin();

  if (authError) return authError;

  try {
    const { searchParams } = new URL(req.url);
    const id = parseInt(searchParams.get("id"));
    const classroomId = searchParams.get("classroomId")
      ? parseInt(searchParams.get("classroomId"))
      : null;

    if (!id) {
      return NextResponse.json(
        { error: "Invalid student ID" },
        { status: 400 },
      );
    }

    await prisma.$transaction(async (tx) => {
      // ถ้าระบุ classroomId → ลบออกจากห้องเรียนนั้นก่อน
      if (classroomId) {
        await tx.classroom_students.deleteMany({
          where: {
            student_students_id: id,
            classroom_classroom_id: classroomId,
          },
        });
      }

      // Soft-delete ตัวนักเรียน (ย้ายไปที่เก็บถาวร)
      await tx.students.update({
        where: { students_id: id },
        data: { deletedAt: new Date() },
      });
    });

    return NextResponse.json(
      { message: "Deleted successfully" },
      { status: 200 },
    );
  } catch {
    //     console.error("Error:", error);

    return NextResponse.json(
      { _error: "Failed to delete student" },
      { status: 500 },
    );
  }
}

export async function PUT(req) {
  const { error: authError } = await requireAdmin();

  if (authError) return authError;

  try {
    const body = await req.json();
    const id = parseInt(body.students_id);

    const result = await prisma.$transaction(async (prisma) => {
      if (body.email) {
        const existingTeacher = await prisma.teachers.findFirst({
          where: { email: body.email },
        });

        if (existingTeacher) throw new Error("อีเมลนี้ถูกใช้งานโดยครูแล้ว");

        const existingStudentByEmail = await prisma.students.findFirst({
          where: { email: body.email },
        });

        if (
          existingStudentByEmail &&
          existingStudentByEmail.students_id !== id
        ) {
          throw new Error("อีเมลนี้ถูกใช้งานโดยนักเรียนคนอื่นแล้ว");
        }
      }

      const updatedStudent = await prisma.students.update({
        where: { students_id: id },
        data: {
          prefix_name: body.prefix_name || null,
          firstname: body.firstname,
          lastname: body.lastname,
          birthday: body.birthday ? new Date(body.birthday) : null,
          email: body.email,
          tel: body.tel,
        },
      });

      if (body.classroom_id) {
        const newClassroomId = parseInt(body.classroom_id);
        const newClassroom = await prisma.classrooms.findUnique({
          where: { classroom_id: newClassroomId },
          select: { academic_years_years_id: true },
        });

        if (newClassroom) {
          const oldClassroomsInSameYear =
            await prisma.classroom_students.findMany({
              where: {
                student_students_id: id,
                classroom: {
                  academic_years_years_id: newClassroom.academic_years_years_id,
                },
              },
              select: { classroom_students_id: true },
            });

          if (oldClassroomsInSameYear.length > 0) {
            await prisma.classroom_students.deleteMany({
              where: {
                classroom_students_id: {
                  in: oldClassroomsInSameYear.map(
                    (c) => c.classroom_students_id,
                  ),
                },
              },
            });
          }

          const alreadyInRoom = await prisma.classroom_students.findFirst({
            where: {
              student_students_id: id,
              classroom_classroom_id: newClassroomId,
            },
          });

          if (!alreadyInRoom) {
            await prisma.classroom_students.create({
              data: {
                student_students_id: id,
                classroom_classroom_id: newClassroomId,
                academic_year: newClassroom.academic_years_years_id,
              },
            });
          }
        }
      }

      return updatedStudent;
    });

    return NextResponse.json(result);
  } catch {
    //     console.error("Update error:", error);

    return NextResponse.json(
      { _error: "Failed to update student" },
      { status: 500 },
    );
  }
}
