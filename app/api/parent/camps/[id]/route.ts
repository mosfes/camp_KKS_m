export const runtime = "nodejs";

import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { getBangkokDateKey, isBangkokDateBefore } from "@/lib/bangkok-date";
import { requireParentSession } from "@/lib/parent-auth";
import { resolveParentStudent } from "@/lib/parent-student-access";

/**
 * Parent-safe camp detail. The camp must both belong to the child's class and
 * have an active enrollment for the child.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireParentSession();
  if (auth.error) return auth.error;

  const rawCampId = (await context.params).id;
  const numericCampId = /^[1-9]\d*$/.test(rawCampId) ? Number(rawCampId) : null;
  const { studentId, error } = await resolveParentStudent(request, auth.session);
  if (error) return error;

  const campRecord = await prisma.camp.findFirst({
    where: numericCampId !== null && Number.isSafeInteger(numericCampId)
      ? { camp_id: numericCampId }
      : { public_id: rawCampId },
    select: { camp_id: true },
  });
  if (!campRecord) return NextResponse.json({ error: "รหัสค่ายไม่ถูกต้อง" }, { status: 404 });
  const campId = campRecord.camp_id;

  try {
    const camp = await prisma.camp.findFirst({
      where: {
        camp_id: campId,
        deletedAt: null,
        camp_classroom: {
          some: {
            classroom: {
              deletedAt: null,
              classroom_students: {
                some: {
                  student_students_id: studentId,
                  student: { deletedAt: null },
                },
              },
            },
          },
        },
        student_enrollment: {
          some: { student_students_id: studentId, enrolled_at: { not: null } },
        },
      },
      select: {
        camp_id: true,
        public_id: true,
        name: true,
        description: true,
        location: true,
        destination_name: true,
        destination_address: true,
        destination_latitude: true,
        destination_longitude: true,
        location_sharing_enabled: true,
        start_date: true,
        end_date: true,
        start_shirt_date: true,
        end_shirt_date: true,
        start_regis_date: true,
        end_regis_date: true,
        has_shirt: true,
        has_transport: true,
        img_camp_url: true,
        img_shirt_url: true,
        created_by: {
          select: {
            teachers_id: true,
            prefix_name: true,
            firstname: true,
            lastname: true,
            tel: true,
            email: true,
          },
        },
        teacher_enrollment: {
          select: {
            teacher_enrollment_id: true,
            teacher: {
              select: {
                teachers_id: true,
                prefix_name: true,
                firstname: true,
                lastname: true,
                tel: true,
                email: true,
              },
            },
          },
        },
        camp_bus_teacher: {
          where: { removed_at: null },
          select: {
            teacher: {
              select: {
                teachers_id: true,
                prefix_name: true,
                firstname: true,
                lastname: true,
                tel: true,
                email: true,
              },
            },
          },
        },
        student_enrollment: {
          where: {
            student_students_id: studentId,
            enrolled_at: { not: null },
          },
          select: {
            student_enrollment_id: true,
            enrolled_at: true,
            shirt_size: true,
            location_sharing_enabled: true,
          },
          take: 1,
        },
        camp_daily_schedule: {
          orderBy: { day: "asc" },
          select: {
            daily_schedule_id: true,
            day: true,
            time_slots: {
              orderBy: { startTime: "asc" },
              select: {
                time_slot_id: true,
                startTime: true,
                endTime: true,
                activity: true,
              },
            },
          },
        },
        station: {
          where: { deletedAt: null },
          select: {
            station_id: true,
            name: true,
            description: true,
            mission: {
              where: { deletedAt: null },
              select: {
                mission_id: true,
                title: true,
                description: true,
                type: true,
              },
            },
          },
        },
      },
    });

    if (!camp) {
      return NextResponse.json(
        { error: "ไม่พบค่ายหรือไม่มีสิทธิ์ดูค่ายนี้" },
        { status: 404 },
      );
    }

    const enrollment = camp.student_enrollment[0];
    if (!enrollment) {
      return NextResponse.json(
        { error: "บุตรยังไม่ได้ลงทะเบียนค่ายนี้" },
        { status: 403 },
      );
    }

    const [results, attendance, busEvents] = await Promise.all([
      prisma.mission_result.findMany({
        where: { student_enrollment_id: enrollment.student_enrollment_id },
        select: {
          mission_mission_id: true,
          status: true,
          submitted_at: true,
          mission: {
            select: { title: true, station: { select: { name: true } } },
          },
        },
        orderBy: { submitted_at: "desc" },
      }),
      prisma.attendance_record_student.findMany({
        where: {
          student_students_id: studentId,
          attendance_teachers_session_id: { camp_camp_id: campId },
        },
        select: {
          record_id: true,
          checkin_time: true,
          attendance_teachers_session_id: {
            select: { description: true, round_number: true },
          },
        },
        orderBy: { checkin_time: "desc" },
        take: 20,
      }),
      prisma.camp_bus_event.findMany({
        where: {
          event_type: { in: ["BOARD", "ALIGHT"] },
          student_assignment: {
            student_enrollment_id: enrollment.student_enrollment_id,
          },
        },
        select: {
          event_id: true,
          event_type: true,
          created_at: true,
          bus: { select: { name: true, registration_plate: true } },
        },
        orderBy: { created_at: "desc" },
        take: 20,
      }),
    ]);

    const resultByMission = new Map<number, string>();
    for (const result of results) {
      const existingStatus = resultByMission.get(result.mission_mission_id);
      if (!existingStatus || result.status === "completed") {
        resultByMission.set(result.mission_mission_id, result.status);
      }
    }
    const stations = camp.station.map((station) => ({
      station_id: station.station_id,
      name: station.name,
      description: station.description,
      mission: station.mission.map((mission) => ({
        ...mission,
        status: resultByMission.get(mission.mission_id) ?? null,
      })),
    }));

    const activities = [
      ...results.map((result) => ({
        id: `mission-${result.mission_mission_id}-${result.submitted_at.toISOString()}`,
        type: "MISSION" as const,
        title: result.mission.title || "ภารกิจ",
        detail: result.mission.station.name,
        status: result.status,
        occurredAt: result.submitted_at,
      })),
      ...attendance.map((record) => ({
        id: `attendance-${record.record_id}`,
        type: "ATTENDANCE" as const,
        title: "เช็กชื่อเข้าร่วมกิจกรรม",
        detail:
          record.attendance_teachers_session_id.description ||
          `รอบที่ ${record.attendance_teachers_session_id.round_number}`,
        status: "checked_in",
        occurredAt: record.checkin_time,
      })),
      ...busEvents.map((event) => ({
        id: `bus-${event.event_id}`,
        type: "BUS" as const,
        title: event.event_type === "BOARD" ? "ขึ้นรถค่าย" : "ลงจากรถค่าย",
        detail: `${event.bus.name}${event.bus.registration_plate ? ` · ${event.bus.registration_plate}` : ""}`,
        status: event.event_type.toLowerCase(),
        occurredAt: event.created_at,
      })),
    ]
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
      .slice(0, 30);

    const contacts = [
      { ...camp.created_by, role: "ผู้สร้าง/หัวหน้าค่าย" },
      ...camp.teacher_enrollment.map(({ teacher }) => ({
        ...teacher,
        role: "ครูประจำค่าย",
      })),
      ...camp.camp_bus_teacher.map(({ teacher }) => ({
        ...teacher,
        role: "ครูประจำรถ",
      })),
    ].filter(
      (contact, index, all) =>
        all.findIndex((item) => item.teachers_id === contact.teachers_id) ===
        index,
    );

    const totalMissions = stations.reduce(
      (total, station) => total + station.mission.length,
      0,
    );
    const completedMissions = stations.reduce(
      (total, station) =>
        total +
        station.mission.filter((mission) => mission.status === "completed")
          .length,
      0,
    );

    return NextResponse.json(
      {
        id: camp.camp_id,
        publicId: camp.public_id,
        studentId,
        title: camp.name,
        description: camp.description,
        location: camp.location,
        destination:
          camp.destination_latitude != null &&
          camp.destination_longitude != null
            ? {
                name: camp.destination_name || camp.location,
                address: camp.destination_address,
                latitude: camp.destination_latitude,
                longitude: camp.destination_longitude,
              }
            : null,
        startDate: getBangkokDateKey(camp.start_date),
        endDate: getBangkokDateKey(camp.end_date),
        rawStartDate: camp.start_date,
        rawEndDate: camp.end_date,
        isEnded: isBangkokDateBefore(camp.end_date),
        hasShirt: camp.has_shirt,
        hasTransport: camp.has_transport,
        img_camp_url: camp.img_camp_url,
        img_shirt_url: camp.img_shirt_url,
        enrolledAt: enrollment.enrolled_at,
        shirtSize: enrollment.shirt_size,
        locationSharingEnabled: camp.location_sharing_enabled,
        studentSharingEnabled: enrollment.location_sharing_enabled,
        station: stations,
        camp_daily_schedule: camp.camp_daily_schedule,
        contacts,
        activities,
        summary: {
          totalMissions,
          completedMissions,
          progressPercent:
            totalMissions > 0
              ? Math.round((completedMissions / totalMissions) * 100)
              : 0,
          attendanceCount: attendance.length,
          latestActivityAt: activities[0]?.occurredAt ?? null,
        },
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "ไม่สามารถโหลดรายละเอียดค่ายได้" },
      { status: 500 },
    );
  }
}
