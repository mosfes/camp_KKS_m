// @ts-nocheck
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireTeacher } from "@/lib/auth";
import { getBangkokDateAsUtcMidnight, isBangkokDateBefore } from "@/lib/bangkok-date";
import { isCampScheduleInRange } from "@/lib/camp-schedule-range";

/**
 *
 * POST - สร้างค่ายใหม่ พร้อม enroll students และ teachers จาก classrooms (รองรับหลายห้อง)
 */
export async function POST(req) {
  // ตรวจสอบ session
  const { teacher, error: authError } = await requireTeacher();

  if (authError) return authError;

  try {
    const body = await req.json();

    // Validation
    if (!body.name || !body.location) {
      return NextResponse.json(
        { error: "กรุณากรอกชื่อค่ายและสถานที่" },
        { status: 400 },
      );
    }

    if (
      !body.classroom_ids ||
      !Array.isArray(body.classroom_ids) ||
      body.classroom_ids.length === 0
    ) {
      return NextResponse.json(
        { error: "กรุณาเลือกห้องเรียนอย่างน้อย 1 ห้อง" },
        { status: 400 },
      );
    }

    const destination = body.destination;
    const hasValidDestination =
      destination &&
      typeof destination.name === "string" &&
      destination.name.trim() &&
      Number.isFinite(destination.latitude) &&
      destination.latitude >= -90 &&
      destination.latitude <= 90 &&
      Number.isFinite(destination.longitude) &&
      destination.longitude >= -180 &&
      destination.longitude <= 180;

    if (body.locationTrackingEnabled && !hasValidDestination) {
      return NextResponse.json(
        { error: "กรุณาปักหมุดจุดหมายก่อนเปิดติดตามตำแหน่ง" },
        { status: 400 },
      );
    }

    // Date Validation
    const requiredDates = [
      { name: "วันที่เริ่มค่าย", value: body.campStartDate },
      { name: "วันสิ้นสุดค่าย", value: body.campEndDate },
      { name: "วันที่เริ่มลงทะเบียน", value: body.registrationStartDate },
      { name: "วันสิ้นสุดลงทะเบียน", value: body.registrationEndDate },
    ];

    for (const d of requiredDates) {
      if (!d.value || isNaN(new Date(d.value).getTime())) {
        return NextResponse.json(
          { error: `ข้อมูล ${d.name} ไม่ถูกต้อง หรือยังไม่ได้ระบุ` },
          { status: 400 },
        );
      }
    }

    if (
      !Array.isArray(body.dailySchedule) ||
      !isCampScheduleInRange(
        body.dailySchedule,
        body.campStartDate,
        body.campEndDate,
      )
    ) {
      return NextResponse.json(
        { error: "กำหนดการต้องอยู่ภายในช่วงวันจัดค่ายและไม่ซ้ำวัน" },
        { status: 400 },
      );
    }

    // สร้าง camp
    const newCamp = await prisma.camp.create({
      data: {
        name: body.name,
        location: body.location,
        start_date: new Date(body.campStartDate),
        end_date: new Date(body.campEndDate),
        start_regis_date: new Date(body.registrationStartDate),
        end_regis_date: new Date(body.registrationEndDate),
        description: body.description || "",
        has_shirt: body.hasShirt || false,
        start_shirt_date:
          body.hasShirt && body.shirtStartDate
            ? new Date(body.shirtStartDate)
            : getBangkokDateAsUtcMidnight(),
        end_shirt_date:
          body.hasShirt && body.shirtEndDate
            ? new Date(body.shirtEndDate)
            : getBangkokDateAsUtcMidnight(),
        status: "OPEN",
        img_camp_url: body.img_camp_url || "",
        img_shirt_url: body.img_shirt_url || "",
        img_certificate_url: body.img_certificate_url || null,
        img_certificate_public_id: body.img_certificate_public_id || null,
        img_certificate_bytes:
          body.img_certificate_bytes != null
            ? Number(body.img_certificate_bytes)
            : null,
        img_certificate_width:
          body.img_certificate_width != null
            ? Number(body.img_certificate_width)
            : null,
        img_certificate_height:
          body.img_certificate_height != null
            ? Number(body.img_certificate_height)
            : null,
        img_certificate_format: body.img_certificate_format || null,
        cert_name_x: body.cert_name_x ? parseFloat(body.cert_name_x) : null,
        cert_name_y: body.cert_name_y ? parseFloat(body.cert_name_y) : null,
        cert_font_size: body.cert_font_size
          ? parseFloat(body.cert_font_size)
          : null,
        destination_name: hasValidDestination
          ? destination.name.trim().slice(0, 255)
          : null,
        destination_address: hasValidDestination
          ? (destination.address || "").trim().slice(0, 500) || null
          : null,
        destination_latitude: hasValidDestination ? destination.latitude : null,
        destination_longitude: hasValidDestination
          ? destination.longitude
          : null,
        location_sharing_enabled: Boolean(
          body.locationTrackingEnabled &&
            hasValidDestination &&
            !isBangkokDateBefore(body.campEndDate),
        ),
        has_transport: Boolean(
          body.hasTransport || body.locationTrackingEnabled,
        ),
        location_update_interval: body.locationUpdateInterval === 5 ? 5 : 10,
        created_by_teacher_id: teacher.teachers_id,
        camp_daily_schedule: {
          create: body.dailySchedule.map((day) => ({
            day: day.day,
            time_slots: {
              create: day.timeSlots.map((slot) => ({
                startTime: slot.startTime,
                endTime: slot.endTime,
                activity: slot.activity,
              })),
            },
          })),
        },
      },
    });

    // เชื่อมค่ายกับห้องเรียนทั้งหมด (Batch Operation)
    const campClassroomData = body.classroom_ids.map((classroomId) => ({
      camp_camp_id: newCamp.camp_id,
      classroom_classroom_id: classroomId,
    }));

    await prisma.camp_classroom.createMany({ data: campClassroomData });

    // ดึงครูทั้งหมดที่อยู่ในห้องเรียนที่ถูกเลือก (Batch Query)
    const classroomTeachers = await prisma.classroom_teacher.findMany({
      where: { classroom_classroom_id: { in: body.classroom_ids } },
      select: { teacher_teachers_id: true },
    });

    // กรอง ID ครูซ้ำ (ในกรณีที่ครู 1 คนเป็นที่ปรึกษาหลายห้อง)
    const uniqueTeacherIds = Array.from(
      new Set(classroomTeachers.map((ct) => ct.teacher_teachers_id)),
    );

    // Enroll teachers รวดเดียว (Batch Insert)
    if (uniqueTeacherIds.length > 0) {
      const teacherEnrollmentData = uniqueTeacherIds.map((tid) => ({
        teacher_teachers_id: tid,
        camp_camp_id: newCamp.camp_id,
      }));

      await prisma.teacher_enrollment.createMany({
        data: teacherEnrollmentData,
        skipDuplicates: true,
      });
    }

    // ถ้ามีการบันทึกเป็น template
    if (body.saveAsTemplate && body.templateName) {
      await prisma.camp_template.create({
        data: {
          name: body.templateName,
          camp_camp_id: newCamp.camp_id,
        },
      });
    }

    return NextResponse.json(
      {
        message: "สร้างค่ายสำเร็จ",
        camp: newCamp,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error creating camp:", error);

    // ส่งข้อความที่เป็นมิตรกับผู้ใช้งาน
    let friendlyMessage = "เกิดข้อผิดพลาดในการสร้างค่าย กรุณาลองใหม่อีกครั้ง";

    if (error?.message && error.message.includes("Invalid Date")) {
      friendlyMessage =
        "ข้อมูลวันที่ไม่ถูกต้อง กรุณาตรวจสอบข้อมูลวันที่อีกครั้ง";
    }

    return NextResponse.json(
      {
        error: friendlyMessage,
        details: error?.message || String(error),
      },
      { status: 500 },
    );
  }
}

/**
 * GET - ดึงรายการค่ายที่ครูมีส่วนเกี่ยวข้อง
 *   - ผู้สร้าง (created_by_teacher_id) → isOwner: true
 *   - ครูที่เกี่ยวข้อง (teacher_enrollment) → isOwner: false
 */
export async function GET(request) {
  const { teacher, error: authError } = await requireTeacher();

  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get("year");
    const view = searchParams.get("view");

    let dateFilter = {};

    if (year) {
      dateFilter.start_date = {
        gte: new Date(`${year}-01-01T00:00:00.000Z`),
        lte: new Date(`${year}-12-31T23:59:59.999Z`),
      };
    }

    const isAdmin = teacher.role === "ADMIN";

    let whereCondition = {
      deletedAt: null,
      ...dateFilter,
    };

    const orConditions = [
      // ผู้สร้างค่าย (ทุก role)
      { created_by_teacher_id: teacher.teachers_id },
      // ครูที่เข้าร่วมค่ายหรือถูกจัดเป็นครูบนรถ
      {
        teacher_enrollment: {
          some: { teacher_teachers_id: teacher.teachers_id },
        },
      },
      {
        camp_bus_teacher: {
          some: {
            teacher_teachers_id: teacher.teachers_id,
            removed_at: null,
          },
        },
      },
      // ครูประจำชั้นคนที่ 1 ของห้องเรียนที่เชื่อมกับค่ายนี้ (ทุก role)
      {
        camp_classroom: {
          some: {
            classroom: {
              teachers_teachers_id: teacher.teachers_id,
            },
          },
        },
      },
      // ครูประจำชั้นคนที่ 2 ของห้องเรียนที่เชื่อมกับค่ายนี้ (ทุก role)
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
    ];

    if (!isAdmin) {
      whereCondition.OR = orConditions;
    }

    let camps = await prisma.camp.findMany({
      where: whereCondition,
      include: {
        created_by: {
          select: { firstname: true, lastname: true },
        },
        _count: {
          select: {
            // Enrollment records with enrolled_at = null are pre-created
            // candidates (for example after bulk certificate generation),
            // not students who actually joined the camp.
            student_enrollment: { where: { enrolled_at: { not: null } } },
            teacher_enrollment: true,
          },
        },
        student_enrollment: {
          where: {
            enrolled_at: { not: null },
            student: { deletedAt: null },
          },
          select: { student_students_id: true },
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
                academic_years: true,
                classroom_types: true,
                teacher: {
                  select: { firstname: true, lastname: true },
                },
                classroom_teacher: {
                  include: {
                    teacher: {
                      select: { firstname: true, lastname: true },
                    },
                  },
                },
              },
            },
          },
        },
        teacher_enrollment: true,
      },
      orderBy: { camp_id: "desc" },
    });

    const campsWithMeta = camps.map((camp) => {
      const updated = { ...camp };

      const eligibleStudentIds = new Set(
        camp.camp_classroom.flatMap((item) =>
          item.classroom.classroom_students.map(
            (student) => student.student_students_id,
          ),
        ),
      );

      updated._count = {
        ...camp._count,
        student_enrollment: camp.student_enrollment.filter((enrollment) =>
          eligibleStudentIds.has(enrollment.student_students_id),
        ).length,
      };
      delete updated.student_enrollment;

      updated.isOwner =
        camp.created_by_teacher_id === teacher.teachers_id ||
        teacher.role === "ADMIN";

      // Extract Grades, Types, and Academic Year
      const typeMap = new Map();
      const allGrades = new Set();
      let campAcademicYear = "";

      if (camp.camp_classroom) {
        camp.camp_classroom.forEach((cc) => {
          if (cc.classroom) {
            if (!campAcademicYear && cc.classroom.academic_years) {
              campAcademicYear = cc.classroom.academic_years.year.toString();
            }
            const g = cc.classroom.grade;
            const typeName =
              cc.classroom.classroom_types?.name || cc.classroom.type_classroom;

            if (g) {
              const gradeStr = g.replace("Level_", "ม.");

              allGrades.add(gradeStr);

              if (typeName) {
                if (!typeMap.has(typeName)) {
                  typeMap.set(typeName, new Set());
                }
                typeMap.get(typeName).add(gradeStr);
              }
            }
          }
        });
      }

      const sortedGrades = Array.from(allGrades).sort((a, b) =>
        a.localeCompare(b),
      );

      updated.grades = sortedGrades;
      updated.academicYear = campAcademicYear;

      updated.gradeDisplay = Array.from(typeMap.entries())
        .sort((a, b) => a[0].toString().localeCompare(b[0].toString()))
        .map(([type, typeGrades]) => {
          const sortedTypeGrades = Array.from(typeGrades).sort((a, b) =>
            a.localeCompare(b),
          );

          return `${type}(${sortedTypeGrades.join(", ")})`;
        })
        .join(" ");

      return updated;
    });

    // The teacher dashboard only renders card summaries. Keep the larger
    // classroom and enrollment relations out of its server-rendered payload.
    const responseCamps = view === "dashboard"
      ? campsWithMeta.map((camp) => ({
          camp_id: camp.camp_id,
          name: camp.name,
          description: camp.description,
          location: camp.location,
          start_date: camp.start_date,
          end_date: camp.end_date,
          img_camp_url: camp.img_camp_url,
          isOwner: camp.isOwner,
          created_by: camp.created_by,
          grades: camp.grades,
          gradeDisplay: camp.gradeDisplay,
          academicYear: camp.academicYear,
          _count: { student_enrollment: camp._count.student_enrollment },
          camp_classroom: camp.camp_classroom.map((item) => ({
            classroom: {
              _count: {
                classroom_students: item.classroom._count.classroom_students,
              },
            },
          })),
        }))
      : campsWithMeta;

    return NextResponse.json(responseCamps, {
      status: 200,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("[GET /api/camps] failed:", error);

    return NextResponse.json(
      {
        _error: "ไม่สามารถดึงข้อมูลค่ายได้",
        errorCode: error?.code || "CAMPS_QUERY_FAILED",
      },
      { status: 500 },
    );
  }
}
