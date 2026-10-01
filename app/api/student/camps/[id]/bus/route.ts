// @ts-nocheck

import { NextResponse } from "next/server";

import { requireStudent } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { activeCampStudentWhere } from "@/lib/active-camp-student";
import { studentCampBusAssignmentWhere } from "@/lib/student-bus-assignment";
import {
  BUS_REMINDER_TTL_MS,
  getActiveBusReminder,
} from "@/lib/camp-bus-reminder";

export async function GET(request: Request, context: any) {
  const { student, error: authError } = await requireStudent();

  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const isManual = searchParams.get("manual") === "1";

  if (isManual) {
    const rateCheck = checkRateLimit(
      "student-camp-bus-manual",
      student.students_id,
      {
        windowMs: 60_000,
        max: 10,
      },
    );

    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: `คุณกดรีเฟรชบ่อยเกินไป (จำกัด 10 ครั้ง/นาที) กรุณารอ ${rateCheck.retryAfterSeconds} วินาทีก่อนลองใหม่`,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateCheck.retryAfterSeconds),
            "Cache-Control": "no-store",
          },
        },
      );
    }
  }

  const { id } = await context.params;
  const campId = Number(id);
  const studentId = Number(student.students_id);

  if (!Number.isInteger(campId) || campId <= 0) {
    return NextResponse.json({ error: "รหัสค่ายไม่ถูกต้อง" }, { status: 400 });
  }

  const isStatusOnly = searchParams.get("statusOnly") === "1";

  if (isStatusOnly) {
    const assignment = await prisma.camp_bus_student.findFirst({
      where: studentCampBusAssignmentWhere(campId, studentId),
      select: {
        status: true,
        participation_status: true,
        last_boarded_at: true,
        bus: {
          select: {
            status: true,
            events: {
              where: {
                event_type: { in: ["REMIND_BOARD", "REMIND_ALIGHT"] },
                created_at: {
                  gte: new Date(Date.now() - BUS_REMINDER_TTL_MS),
                },
              },
              orderBy: { created_at: "desc" },
              take: 6,
              select: { event_type: true, created_at: true },
            },
          },
        },
      },
    });

    if (!assignment) {
      return NextResponse.json({ configured: false });
    }

    const isOnBus = assignment.status === "ON_BUS";

    return NextResponse.json(
      {
        statusOnly: true,
        configured: true,
        busStatus: assignment.bus.status,
        studentStatus: assignment.status,
        participationStatus: assignment.participation_status,
        isOnBus,
        lastBoardedAt: assignment.last_boarded_at,
        reminder:
          assignment.participation_status === "ACTIVE"
            ? getActiveBusReminder(assignment.bus.events, isOnBus)
            : null,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const enrollment = await prisma.student_enrollment.findFirst({
    where: {
      camp_camp_id: campId,
      student_students_id: studentId,
      enrolled_at: { not: null },
      student: activeCampStudentWhere(campId),
    },
    select: {
      student_enrollment_id: true,
      camp: { select: { name: true, has_transport: true } },
      camp_bus_student: {
        where: { bus: { camp_camp_id: campId } },
        select: {
          assignment_id: true,
          status: true,
          participation_status: true,
          last_boarded_at: true,
          position: {
            select: {
              position_id: true,
              label: true,
              row_number: true,
              seat_index: true,
              x: true,
              y: true,
              width: true,
              height: true,
              rotation: true,
              floor: { select: { floor_number: true } },
            },
          },
          bus: {
            select: {
              bus_id: true,
              name: true,
              registration_plate: true,
              status: true,
              floor_count: true,
              layout_template_id: true,
              events: {
                where: {
                  event_type: { in: ["REMIND_BOARD", "REMIND_ALIGHT"] },
                  created_at: {
                    gte: new Date(Date.now() - BUS_REMINDER_TTL_MS),
                  },
                },
                orderBy: { created_at: "desc" },
                take: 6,
                select: { event_type: true, created_at: true },
              },
              classroom: {
                select: {
                  grade: true,
                  classroom_types: { select: { name: true } },
                },
              },
              floors: {
                orderBy: { floor_number: "asc" },
                select: {
                  floor_number: true,
                  row_count: true,
                  canvas_columns: true,
                  canvas_rows: true,
                  elements: {
                    orderBy: [{ z_index: "asc" }, { element_id: "asc" }],
                    select: {
                      element_id: true,
                      type: true,
                      x: true,
                      y: true,
                      width: true,
                      height: true,
                      rotation: true,
                      label: true,
                      z_index: true,
                    },
                  },
                  positions: {
                    orderBy: [{ row_number: "asc" }, { seat_index: "asc" }],
                    select: {
                      position_id: true,
                      label: true,
                      row_number: true,
                      seat_index: true,
                      x: true,
                      y: true,
                      width: true,
                      height: true,
                      rotation: true,
                    },
                  },
                },
              },
            },
          },
        },
        take: 1,
      },
    },
  });

  if (!enrollment) {
    return NextResponse.json(
      { error: "คุณยังไม่ได้ลงทะเบียนค่ายนี้" },
      { status: 403 },
    );
  }

  const assignment = enrollment.camp_bus_student[0];

  if (!assignment) {
    return NextResponse.json({
      configured: false,
      hasTransport: enrollment.camp.has_transport,
      campName: enrollment.camp.name,
      message: "ยังไม่มีข้อมูลรถหรือที่นั่งของคุณ",
    });
  }

  const ownPosition = assignment.position;
  const ownFloor = ownPosition?.floor?.floor_number;
  const isOnBus = assignment.status === "ON_BUS";

  return NextResponse.json(
    {
      configured: true,
      hasTransport: enrollment.camp.has_transport,
      campName: enrollment.camp.name,
      bus: {
        busId: assignment.bus.bus_id,
        name: assignment.bus.name,
        registrationPlate: assignment.bus.registration_plate,
        status: assignment.bus.status,
        floorCount: assignment.bus.floor_count,
        layoutTemplateId: assignment.bus.layout_template_id,
        classroom: {
          grade: assignment.bus.classroom.grade,
          roomName:
            assignment.bus.classroom.classroom_types?.name || "ห้องเรียน",
        },
        floors: assignment.bus.floors
          .filter((floor: any) => floor.floor_number === ownFloor)
          .map((floor: any) => ({
            floorNumber: floor.floor_number,
            rowCount: floor.row_count,
            canvasColumns: floor.canvas_columns,
            canvasRows: floor.canvas_rows,
            elements: floor.elements.map((element: any) => ({
              elementId: element.element_id,
              type: element.type,
              x: element.x,
              y: element.y,
              width: element.width,
              height: element.height,
              rotation: element.rotation,
              label: element.label,
              zIndex: element.z_index,
            })),
            positions: floor.positions.map((position: any) => ({
              positionId: position.position_id,
              label: position.label,
              rowNumber: position.row_number,
              seatIndex: position.seat_index,
              x: position.x,
              y: position.y,
              width: position.width,
              height: position.height,
              rotation: position.rotation,
              isOwn: position.position_id === ownPosition?.position_id,
            })),
          })),
      },
      student: {
        status: assignment.status,
        participationStatus: assignment.participation_status,
        isOnBus,
        lastBoardedAt: assignment.last_boarded_at,
        reminder:
          assignment.participation_status === "ACTIVE"
            ? getActiveBusReminder(assignment.bus.events, isOnBus)
            : null,
        position: ownPosition
          ? {
              positionId: ownPosition.position_id,
              label: ownPosition.label,
              rowNumber: ownPosition.row_number,
              seatIndex: ownPosition.seat_index,
              floorNumber: ownFloor,
              x: ownPosition.x,
              y: ownPosition.y,
              width: ownPosition.width,
              height: ownPosition.height,
              rotation: ownPosition.rotation,
            }
          : null,
      },
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
