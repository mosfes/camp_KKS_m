// @ts-nocheck

import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireTeacher } from "@/lib/auth";
import { activeCampStudentWhere } from "@/lib/active-camp-student";
import { isBangkokDateBefore } from "@/lib/bangkok-date";
import { isCampScheduleInRange } from "@/lib/camp-schedule-range";
import { teacherCampAccessWhere } from "@/lib/teacher-camp-access";

// Define the schema for camp validation
const campSchema = z
  .object({
    name: z.string().optional(),
    location: z.string().optional(),
    start_date: z.string().optional().nullable(),
    end_date: z.string().optional().nullable(),
    start_regis_date: z.string().optional().nullable(),
    end_regis_date: z.string().optional().nullable(),
    start_shirt_date: z.string().optional().nullable(),
    end_shirt_date: z.string().optional().nullable(),
    description: z.string().optional(),
    status: z.string().optional(),
    has_shirt: z.boolean().optional(),
    img_shirt_url: z.string().optional(),
    img_camp_url: z.string().optional(),
    img_certificate_url: z.string().optional().nullable(),
    img_certificate_public_id: z.string().max(255).optional().nullable(),
    img_certificate_bytes: z.number().int().nonnegative().optional().nullable(),
    img_certificate_width: z.number().int().positive().optional().nullable(),
    img_certificate_height: z.number().int().positive().optional().nullable(),
    img_certificate_format: z.string().max(20).optional().nullable(),
    cert_name_x: z.number().optional().nullable(),
    cert_name_y: z.number().optional().nullable(),
    cert_font_size: z.number().optional().nullable(),
    cert_font_color: z.string().optional().nullable(),
    cert_show_number: z.boolean().optional(),
    cert_number_start: z.number().int().optional().nullable(),
    cert_number_end: z.number().int().optional().nullable(),
    cert_number_x: z.number().optional().nullable(),
    cert_number_y: z.number().optional().nullable(),
    cert_number_size: z.number().optional().nullable(),
    cert_number_color: z.string().optional().nullable(),
    cert_number_prefix: z.string().optional().nullable(),
    cert_number_is_thai: z.boolean().optional(),
    cert_year: z.string().optional().nullable(),
    cert_show_qr: z.boolean().optional(),
    cert_qr_x: z.number().min(0).max(100).optional().nullable(),
    cert_qr_y: z.number().min(0).max(100).optional().nullable(),
    cert_qr_size: z.number().min(48).max(600).optional().nullable(),
    cert_mission_completion_percent: z
      .number()
      .int()
      .min(0)
      .max(100)
      .optional(),
    cert_require_survey: z.boolean().optional(),
    destination: z
      .object({
        name: z.string().trim().min(1).max(255),
        address: z.string().trim().max(500).optional().nullable(),
        latitude: z.number().finite().min(-90).max(90),
        longitude: z.number().finite().min(-180).max(180),
      })
      .nullable()
      .optional(),
    location_sharing_enabled: z.boolean().optional(),
    has_transport: z.boolean().optional(),
    location_update_interval: z.union([z.literal(5), z.literal(10)]).optional(),
    dailySchedule: z.array(z.any()).optional(),
    classroom_ids: z.array(z.number()).optional(),
  })
  .passthrough();

// GET - ดึงข้อมูลค่ายเดียว + บอกว่า teacher ที่ login เป็น owner หรือไม่
export async function GET(request, context) {
  const { teacher, error: authError } = await requireTeacher();

  if (authError) return authError;

  try {
    const params = await context.params;
    const campId = Number(params.id);
    const view = new URL(request.url).searchParams.get("view");

    if (!Number.isSafeInteger(campId) || campId <= 0) {
      return NextResponse.json({ error: "Invalid camp id" }, { status: 400 });
    }

    const accessibleCamp = await prisma.camp.findFirst({
      where: {
        camp_id: campId,
        ...teacherCampAccessWhere(teacher.teachers_id, teacher.role),
      },
      select: { camp_id: true },
    });

    if (!accessibleCamp) {
      return NextResponse.json({ error: "Camp not found" }, { status: 404 });
    }

    if (view === "bases") {
      const camp = await prisma.camp.findFirst({
        where: { camp_id: campId, deletedAt: null },
        select: {
          camp_id: true,
          name: true,
          description: true,
          start_date: true,
          end_date: true,
          created_by_teacher_id: true,
          station: {
            where: { deletedAt: null },
            orderBy: { station_id: "asc" },
            select: {
              station_id: true,
              name: true,
              description: true,
              is_required_for_cert: true,
              mission: {
                where: { deletedAt: null },
                select: {
                  mission_id: true,
                  title: true,
                  type: true,
                },
              },
              _count: {
                select: {
                  mission: {
                    where: { deletedAt: null },
                  },
                },
              },
            },
          },
        },
      });

      if (!camp) {
        return NextResponse.json({ error: "Camp not found" }, { status: 404 });
      }

      return NextResponse.json({
        ...camp,
        isOwner:
          camp.created_by_teacher_id === teacher.teachers_id ||
          teacher.role === "ADMIN",
      });
    }

    if (view === "survey") {
      const camp = await prisma.camp.findFirst({
        where: { camp_id: campId, deletedAt: null },
        select: { created_by_teacher_id: true },
      });

      if (!camp) {
        return NextResponse.json({ error: "Camp not found" }, { status: 404 });
      }

      return NextResponse.json({
        ...camp,
        isOwner:
          camp.created_by_teacher_id === teacher.teachers_id ||
          teacher.role === "ADMIN",
      });
    }

    if (view === "certificate") {
      const camp = await prisma.camp.findFirst({
        where: { camp_id: campId, deletedAt: null },
        select: {
          camp_id: true,
          created_by_teacher_id: true,
          img_certificate_url: true,
          img_certificate_public_id: true,
          img_certificate_bytes: true,
          img_certificate_width: true,
          img_certificate_height: true,
          img_certificate_format: true,
          cert_name_x: true,
          cert_name_y: true,
          cert_font_size: true,
          cert_font_color: true,
          cert_show_number: true,
          cert_number_start: true,
          cert_number_end: true,
          cert_number_x: true,
          cert_number_y: true,
          cert_number_size: true,
          cert_number_color: true,
          cert_number_prefix: true,
          cert_number_is_thai: true,
          cert_year: true,
          cert_show_qr: true,
          cert_qr_x: true,
          cert_qr_y: true,
          cert_qr_size: true,
          cert_mission_completion_percent: true,
          cert_require_survey: true,
          survey: { select: { survey_id: true } },
          station: {
            where: { deletedAt: null },
            select: {
              mission: {
                where: { deletedAt: null },
                select: { mission_id: true },
              },
            },
          },
          student_enrollment: {
            where: { student: activeCampStudentWhere(campId) },
            select: { student_students_id: true },
          },
          camp_classroom: {
            where: { classroom: { deletedAt: null } },
            select: {
              classroom: {
                select: {
                  classroom_students: {
                    where: { student: { deletedAt: null } },
                    select: { student_students_id: true },
                  },
                },
              },
            },
          },
        },
      });

      if (!camp) {
        return NextResponse.json({ error: "Camp not found" }, { status: 404 });
      }

      const candidateIds = new Set([
        ...camp.student_enrollment.map((item) => item.student_students_id),
        ...camp.camp_classroom.flatMap((item) =>
          item.classroom.classroom_students.map(
            (student) => student.student_students_id,
          ),
        ),
      ]);

      const certificateData = {
        camp_id: camp.camp_id,
        created_by_teacher_id: camp.created_by_teacher_id,
        img_certificate_url: camp.img_certificate_url,
        img_certificate_public_id: camp.img_certificate_public_id,
        img_certificate_bytes: camp.img_certificate_bytes,
        img_certificate_width: camp.img_certificate_width,
        img_certificate_height: camp.img_certificate_height,
        img_certificate_format: camp.img_certificate_format,
        cert_name_x: camp.cert_name_x,
        cert_name_y: camp.cert_name_y,
        cert_font_size: camp.cert_font_size,
        cert_font_color: camp.cert_font_color,
        cert_show_number: camp.cert_show_number,
        cert_number_start: camp.cert_number_start,
        cert_number_end: camp.cert_number_end,
        cert_number_x: camp.cert_number_x,
        cert_number_y: camp.cert_number_y,
        cert_number_size: camp.cert_number_size,
        cert_number_color: camp.cert_number_color,
        cert_number_prefix: camp.cert_number_prefix,
        cert_number_is_thai: camp.cert_number_is_thai,
        cert_year: camp.cert_year,
        cert_show_qr: camp.cert_show_qr,
        cert_qr_x: camp.cert_qr_x,
        cert_qr_y: camp.cert_qr_y,
        cert_qr_size: camp.cert_qr_size,
        cert_mission_completion_percent: camp.cert_mission_completion_percent,
        cert_require_survey: camp.cert_require_survey,
        certificate_total_missions: camp.station.reduce(
          (total, station) => total + station.mission.length,
          0,
        ),
        certificate_has_survey: camp.survey.length > 0,
      };

      return NextResponse.json({
        ...certificateData,
        certificate_candidate_count: candidateIds.size,
        isOwner:
          camp.created_by_teacher_id === teacher.teachers_id ||
          teacher.role === "ADMIN",
      });
    }

    const camp = await prisma.camp.findFirst({
      where: { camp_id: campId, deletedAt: null },
      include: {
        created_by: {
          select: { firstname: true, lastname: true, email: true },
        },
        student_enrollment: {
          where: { student: activeCampStudentWhere(campId) },
          include: {
            student: {
              select: {
                students_id: true,
                firstname: true,
                lastname: true,
                email: true,
              },
            },
          },
        },
        teacher_enrollment: {
          include: {
            teacher: {
              select: {
                teachers_id: true,
                firstname: true,
                lastname: true,
                email: true,
              },
            },
          },
        },
        camp_bus_teacher: {
          where: {
            teacher_teachers_id: teacher.teachers_id,
            removed_at: null,
          },
          select: { assignment_id: true },
        },
        camp_classroom: {
          where: { classroom: { deletedAt: null } },
          include: {
            classroom: {
              include: {
                academic_years: true,
                classroom_types: true,
                classroom_teacher: true,
                _count: {
                  select: {
                    classroom_students: {
                      where: { student: { deletedAt: null } },
                    },
                  },
                },
                classroom_students: {
                  where: { student: { deletedAt: null } },
                  select: {
                    student_students_id: true,
                  },
                },
              },
            },
          },
        },
        camp_template: true,
        camp_daily_schedule: {
          include: { time_slots: true },
          orderBy: { day: "asc" },
        },
        station: {
          where: { deletedAt: null },
          include: {
            _count: {
              select: {
                mission: {
                  where: { deletedAt: null },
                },
              },
            },
          },
        },
      },
    });

    if (!camp) {
      return NextResponse.json({ error: "Camp not found" }, { status: 404 });
    }

    // ตรวจสอบว่า teacher คนนี้เป็นครูประจำชั้นของห้องใดห้องหนึ่งที่เชื่อมกับค่ายนี้หรือไม่
    const isHomeroomTeacher =
      camp.camp_classroom?.some(
        (cc) =>
          cc.classroom?.teachers_teachers_id === teacher.teachers_id ||
          cc.classroom?.classroom_teacher?.some(
            (ct) => ct.teacher_teachers_id === teacher.teachers_id,
          ),
      ) ?? false;

    const eligibleStudentIds = new Set(
      camp.camp_classroom?.flatMap(
        (cc) =>
          cc.classroom?.classroom_students?.map(
            (student) => student.student_students_id,
          ) ?? [],
      ) ?? [],
    );
    const certificateCandidateIds = new Set([
      ...eligibleStudentIds,
      ...(camp.student_enrollment?.map(
        (enrollment) => enrollment.student_students_id,
      ) ?? []),
    ]);
    const enrolledStudentCount =
      camp.student_enrollment?.filter((enrollment) => enrollment.enrolled_at)
        .length ?? 0;
    const totalEligibleStudents = eligibleStudentIds.size;
    const totalMissionCount =
      camp.station?.reduce(
        (total, station) => total + (station._count?.mission ?? 0),
        0,
      ) ?? 0;

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

    const gradeDisplayList = Array.from(typeMap.entries())
      .sort((a, b) => a[0].toString().localeCompare(b[0].toString()))
      .map(([type, typeGrades]) => {
        const sortedTypeGrades = Array.from(typeGrades).sort((a, b) =>
          a.localeCompare(b),
        );

        return { type, grades: sortedTypeGrades };
      });

    const gradeDisplay = gradeDisplayList
      .map((item) => `${item.type}(${item.grades.join(", ")})`)
      .join(" ");

    const detail = {
      ...camp,
      isOwner:
        camp.created_by_teacher_id === teacher.teachers_id ||
        teacher.role === "ADMIN",
      isHomeroomTeacher,
      isBusTeacher: camp.camp_bus_teacher.length > 0,
      total_eligible_students: totalEligibleStudents,
      enrolled_student_count: enrolledStudentCount,
      total_mission_count: totalMissionCount,
      certificate_candidate_count: certificateCandidateIds.size,
      grades: sortedGrades,
      gradeDisplay: gradeDisplay,
      gradeDisplayList: gradeDisplayList,
      academicYear: campAcademicYear,
    };
    const responseDetail = view === "overview"
      ? {
          ...detail,
          student_enrollment: undefined,
          teacher_enrollment: undefined,
          camp_bus_teacher: undefined,
          camp_template: undefined,
          camp_classroom: camp.camp_classroom.map((item) => ({
            classroom: {
              classroom_id: item.classroom.classroom_id,
              grade: item.classroom.grade,
              classroom_types: item.classroom.classroom_types && {
                name: item.classroom.classroom_types.name,
              },
            },
          })),
        }
      : detail;

    return NextResponse.json(
      responseDetail,
      {
        status: 200,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  } catch {
    //     console.error("Error fetching camp:", error);

    return NextResponse.json(
      { _error: "Failed to fetch camp" },
      { status: 500 },
    );
  }
}

export async function PUT(request, context) {
  // ตรวจสอบ session + ownership
  const { teacher, error: authError } = await requireTeacher();

  if (authError) return authError;

  const params = await context.params;
  const campId = Number(params.id);

  // เช็ค ownership
  const existing = await prisma.camp.findFirst({
    where: { camp_id: campId, deletedAt: null },
    select: {
      created_by_teacher_id: true,
      start_date: true,
      end_date: true,
      camp_daily_schedule: { select: { day: true } },
    },
  });

  if (!existing)
    return NextResponse.json({ error: "ไม่พบค่าย" }, { status: 404 });
  if (
    existing.created_by_teacher_id !== teacher.teachers_id &&
    teacher.role !== "ADMIN"
  ) {
    return NextResponse.json(
      { error: "ไม่มีสิทธิ์แก้ไขค่ายนี้" },
      { status: 403 },
    );
  }

  try {
    const rawBody = await request.json();

    // Validate payload structure using Zod
    const body = campSchema.parse(rawBody);

    const startDate = body.start_date || existing.start_date;
    const endDate = body.end_date || existing.end_date;
    if (
      Number.isNaN(new Date(startDate).getTime()) ||
      Number.isNaN(new Date(endDate).getTime()) ||
      !isCampScheduleInRange(
        body.dailySchedule ?? existing.camp_daily_schedule,
        startDate,
        endDate,
      )
    ) {
      return NextResponse.json(
        { error: "กำหนดการต้องอยู่ภายในช่วงวันจัดค่ายและไม่ซ้ำวัน" },
        { status: 400 },
      );
    }
    const isEnded = isBangkokDateBefore(endDate);

    if (body.location_sharing_enabled && !body.destination) {
      return NextResponse.json(
        { error: "กรุณาปักหมุดจุดหมายก่อนเปิดติดตามตำแหน่ง" },
        { status: 400 },
      );
    }

    const destinationData =
      body.destination === undefined
        ? {}
        : body.destination === null
          ? {
              destination_name: null,
              destination_address: null,
              destination_latitude: null,
              destination_longitude: null,
              location_sharing_enabled: false,
            }
          : {
              destination_name: body.destination.name,
              destination_address: body.destination.address || null,
              destination_latitude: body.destination.latitude,
              destination_longitude: body.destination.longitude,
            };

    // อัพเดทข้อมูลค่าย
    const updatedCamp = await prisma.camp.update({
      where: {
        camp_id: campId,
        deletedAt: null,
      },
      data: {
        ...destinationData,
        name: body.name,
        location: body.location,
        start_date: body.start_date ? new Date(body.start_date) : undefined,
        end_date: body.end_date ? new Date(body.end_date) : undefined,
        start_regis_date: body.start_regis_date
          ? new Date(body.start_regis_date)
          : undefined,
        end_regis_date: body.end_regis_date
          ? new Date(body.end_regis_date)
          : undefined,
        start_shirt_date: body.start_shirt_date
          ? new Date(body.start_shirt_date)
          : undefined,
        end_shirt_date: body.end_shirt_date
          ? new Date(body.end_shirt_date)
          : undefined,
        description: body.description,
        status: body.status,
        has_shirt: body.has_shirt,
        ...(body.img_shirt_url !== undefined && {
          img_shirt_url: body.img_shirt_url,
        }),
        ...(body.img_camp_url !== undefined && {
          img_camp_url: body.img_camp_url,
        }),
        ...(body.img_certificate_url !== undefined && {
          img_certificate_url: body.img_certificate_url,
        }),
        ...(body.img_certificate_public_id !== undefined && {
          img_certificate_public_id: body.img_certificate_public_id,
        }),
        ...(body.img_certificate_bytes !== undefined && {
          img_certificate_bytes: body.img_certificate_bytes,
        }),
        ...(body.img_certificate_width !== undefined && {
          img_certificate_width: body.img_certificate_width,
        }),
        ...(body.img_certificate_height !== undefined && {
          img_certificate_height: body.img_certificate_height,
        }),
        ...(body.img_certificate_format !== undefined && {
          img_certificate_format: body.img_certificate_format,
        }),
        ...(body.cert_name_x !== undefined && {
          cert_name_x: body.cert_name_x,
        }),
        ...(body.cert_name_y !== undefined && {
          cert_name_y: body.cert_name_y,
        }),
        ...(body.cert_font_size !== undefined && {
          cert_font_size: body.cert_font_size,
        }),
        ...(body.cert_font_color !== undefined && {
          cert_font_color: body.cert_font_color,
        }),
        ...(body.cert_show_number !== undefined && {
          cert_show_number: body.cert_show_number,
        }),
        ...(body.cert_number_start !== undefined && {
          cert_number_start: body.cert_number_start,
        }),
        ...(body.cert_number_end !== undefined && {
          cert_number_end: body.cert_number_end,
        }),
        ...(body.cert_number_x !== undefined && {
          cert_number_x: body.cert_number_x,
        }),
        ...(body.cert_number_y !== undefined && {
          cert_number_y: body.cert_number_y,
        }),
        ...(body.cert_number_size !== undefined && {
          cert_number_size: body.cert_number_size,
        }),
        ...(body.cert_number_color !== undefined && {
          cert_number_color: body.cert_number_color,
        }),
        ...(body.cert_number_prefix !== undefined && {
          cert_number_prefix: body.cert_number_prefix,
        }),
        ...(body.cert_number_is_thai !== undefined && {
          cert_number_is_thai: body.cert_number_is_thai,
        }),
        ...(body.cert_year !== undefined && {
          cert_year: body.cert_year,
        }),
        ...(body.cert_show_qr !== undefined && {
          // A verification QR must never be enabled without an assigned
          // certificate number. The settings UI sends these fields together.
          cert_show_qr: Boolean(
            body.cert_show_qr &&
              body.cert_show_number === true &&
              body.cert_number_start != null,
          ),
        }),
        ...(body.cert_qr_x !== undefined && {
          cert_qr_x: body.cert_qr_x,
        }),
        ...(body.cert_qr_y !== undefined && {
          cert_qr_y: body.cert_qr_y,
        }),
        ...(body.cert_qr_size !== undefined && {
          cert_qr_size: body.cert_qr_size,
        }),
        ...(body.cert_mission_completion_percent !== undefined && {
          cert_mission_completion_percent: body.cert_mission_completion_percent,
        }),
        ...(body.cert_require_survey !== undefined && {
          cert_require_survey: body.cert_require_survey,
        }),
        ...(isEnded
          ? { location_sharing_enabled: false }
          : body.location_sharing_enabled !== undefined
            ? { location_sharing_enabled: body.location_sharing_enabled }
            : {}),
        ...(body.has_transport !== undefined ||
        body.location_sharing_enabled === true
          ? {
              has_transport: Boolean(
                body.has_transport || body.location_sharing_enabled,
              ),
            }
          : {}),
        ...(body.location_update_interval !== undefined && {
          location_update_interval: body.location_update_interval,
        }),
      },
    });

    if (
      isEnded ||
      body.location_sharing_enabled === false ||
      body.destination === null
    ) {
      if (isEnded) {
        await prisma.student_enrollment.updateMany({
          where: { camp_camp_id: campId, location_sharing_enabled: true },
          data: { location_sharing_enabled: false },
        });
      }
      await prisma.student_location_update.deleteMany({
        where: { camp_camp_id: campId },
      });
    }

    // อัพเดท daily schedule (ทำเมื่อส่ง dailySchedule มาเท่านั้น)
    if (body.dailySchedule !== undefined) {
      // Delete existing time slots first (foreign key constraint)
      const schedules = await prisma.camp_daily_schedule.findMany({
        where: { camp_camp_id: campId },
        select: { daily_schedule_id: true },
      });

      const scheduleIds = schedules.map((s) => s.daily_schedule_id);

      if (scheduleIds.length > 0) {
        await prisma.camp_time_slot.deleteMany({
          where: { daily_schedule_id: { in: scheduleIds } },
        });
      }

      // Now delete daily schedules
      await prisma.camp_daily_schedule.deleteMany({
        where: { camp_camp_id: campId },
      });

      // เพิ่ม daily schedule ใหม่ (Optimize using transaction)
      if (body.dailySchedule.length > 0) {
        await prisma.$transaction(async (tx) => {
          for (const daySchedule of body.dailySchedule!) {
            const createdSchedule = await tx.camp_daily_schedule.create({
              data: {
                camp_camp_id: campId,
                day: daySchedule.day,
              },
            });

            // เพิ่ม time slots
            if (daySchedule.timeSlots && daySchedule.timeSlots.length > 0) {
              const timeSlotsData = daySchedule.timeSlots.map(
                (timeSlot: any) => ({
                  daily_schedule_id: createdSchedule.daily_schedule_id,
                  startTime: timeSlot.startTime,
                  endTime: timeSlot.endTime,
                  activity: timeSlot.activity,
                }),
              );

              await tx.camp_time_slot.createMany({
                data: timeSlotsData,
              });
            }
          }
        });
      }
    }

    // อัพเดทห้องเรียน (Optimize using createMany)
    if (body.classroom_ids && body.classroom_ids.length > 0) {
      // ลบความสัมพันธ์เก่า
      await prisma.camp_classroom.deleteMany({
        where: { camp_camp_id: campId },
      });

      // เพิ่มความสัมพันธ์ใหม่
      const classroomData = body.classroom_ids.map((classroomId) => ({
        camp_camp_id: campId,
        classroom_classroom_id: classroomId,
      }));

      await prisma.camp_classroom.createMany({
        data: classroomData,
      });
    }

    return NextResponse.json(updatedCamp, { status: 200 });
  } catch (error) {
    console.error("Error updating camp:", error);

    return NextResponse.json(
      {
        _error: "Failed to update camp",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

export async function DELETE(req, context) {
  // ตรวจสอบ session + ownership
  const { teacher, error: authError } = await requireTeacher();

  if (authError) return authError;

  try {
    const params = await context.params;
    const campId = Number(params.id);

    if (isNaN(campId)) {
      return NextResponse.json({ error: "Invalid camp id" }, { status: 400 });
    }

    // เช็ค ownership
    const existing = await prisma.camp.findFirst({
      where: { camp_id: campId, deletedAt: null },
      select: { created_by_teacher_id: true },
    });

    if (!existing)
      return NextResponse.json({ error: "ไม่พบค่าย" }, { status: 404 });
    if (
      existing.created_by_teacher_id !== teacher.teachers_id &&
      teacher.role !== "ADMIN"
    ) {
      return NextResponse.json(
        { error: "ไม่มีสิทธิ์ลบค่ายนี้" },
        { status: 403 },
      );
    }

    // Soft delete
    await prisma.camp.update({
      where: { camp_id: campId },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ message: "Deleted successfully" });
  } catch {
    //     console.error("DELETE CAMP ERROR:", error);

    return NextResponse.json({ _error: "ไม่สามารถลบค่ายได้" }, { status: 500 });
  }
}
