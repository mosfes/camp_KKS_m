import { NextResponse } from "next/server";
import { z } from "zod";

import { requireSpecificCampBus } from "@/lib/camp-bus-auth";
import { prisma } from "@/lib/db";
import { isBangkokDateBefore } from "@/lib/bangkok-date";

const boardSchema = z
  .object({
    assignmentId: z.number().int().positive(),
    passengerType: z.enum(["STUDENT", "TEACHER"]).default("STUDENT"),
  })
  .strict();

export async function POST(request: Request, context: any) {
  const { id, busId: rawBusId } = await context.params;
  const campId = Number(id);
  const busId = Number(rawBusId);

  if (!Number.isInteger(campId) || !Number.isInteger(busId)) {
    return NextResponse.json({ error: "รหัสรถไม่ถูกต้อง" }, { status: 400 });
  }

  const access = await requireSpecificCampBus(campId, busId, "operate");

  if (access.error) return access.error;
  if (
    access.permission?.camp &&
    isBangkokDateBefore(access.permission.camp.end_date)
  ) {
    return NextResponse.json(
      { error: "ค่ายสิ้นสุดแล้ว ไม่สามารถยืนยันขึ้นรถได้" },
      { status: 409 },
    );
  }

  let body;

  try {
    body = boardSchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: "ข้อมูลผู้โดยสารไม่ถูกต้อง" },
      { status: 400 },
    );
  }

  const teacherId = Number(access.permission?.teacher?.teachers_id) || null;
  const result = await prisma.$transaction(async (tx) => {
    if (body.passengerType === "TEACHER") {
      const assignment = await tx.camp_bus_teacher.findFirst({
        where: {
          assignment_id: body.assignmentId,
          bus_bus_id: busId,
          removed_at: null,
        },
        select: {
          assignment_id: true,
          status: true,
          last_boarded_at: true,
          position_position_id: true,
          bus: { select: { status: true } },
        },
      });

      if (!assignment) {
        return {
          error: "ไม่พบครูในรถคันนี้",
          status: 404,
          passengerType: "TEACHER" as const,
        };
      }

      if (assignment.bus.status === "TRAVELING") {
        return {
          error: "รถกำลังเดินทาง ไม่สามารถยืนยันขึ้นรถได้",
          status: 409,
          passengerType: "TEACHER" as const,
        };
      }

      if (!assignment.position_position_id) {
        return {
          error: "ยังไม่ได้จัดที่นั่งให้ครู",
          status: 409,
          passengerType: "TEACHER" as const,
        };
      }

      if (assignment.status === "ON_BUS") {
        return {
          alreadyBoarded: true,
          checkedAt: assignment.last_boarded_at,
          passengerType: "TEACHER" as const,
        };
      }

      const checkedAt = new Date();
      const updated = await tx.camp_bus_teacher.updateMany({
        where: {
          assignment_id: assignment.assignment_id,
          status: "OFF_BUS",
          removed_at: null,
        },
        data: { status: "ON_BUS", last_boarded_at: checkedAt },
      });

      if (updated.count === 0) {
        const current = await tx.camp_bus_teacher.findUnique({
          where: { assignment_id: assignment.assignment_id },
          select: { status: true, removed_at: true, last_boarded_at: true },
        });

        if (!current || current.removed_at) {
          return {
            error: "รายการรถของครูถูกเปลี่ยน กรุณาโหลดหน้าใหม่",
            status: 409,
            passengerType: "TEACHER" as const,
          };
        }

        return {
          alreadyBoarded: current.status === "ON_BUS",
          checkedAt: current.last_boarded_at,
          passengerType: "TEACHER" as const,
          ...(current.status === "OFF_BUS"
            ? {
                error: "สถานะรถถูกเปลี่ยน กรุณาลองใหม่อีกครั้ง",
                status: 409,
              }
            : {}),
        };
      }

      await tx.camp_bus_event.create({
        data: {
          bus_bus_id: busId,
          teacher_assignment_id: assignment.assignment_id,
          teacher_teachers_id: teacherId,
          event_type: "BOARD",
          created_at: checkedAt,
        },
      });

      return {
        alreadyBoarded: false,
        checkedAt,
        passengerType: "TEACHER" as const,
      };
    }

    const assignment = await tx.camp_bus_student.findFirst({
      where: { assignment_id: body.assignmentId, bus_bus_id: busId },
      select: {
        assignment_id: true,
        status: true,
        participation_status: true,
        last_boarded_at: true,
        position_position_id: true,
        bus: { select: { status: true } },
      },
    });

    if (!assignment) {
      return {
        error: "ไม่พบนักเรียนในรถคันนี้",
        status: 404,
        passengerType: "STUDENT" as const,
      };
    }

    if (assignment.bus.status === "TRAVELING") {
      return {
        error: "รถกำลังเดินทาง ไม่สามารถยืนยันขึ้นรถได้",
        status: 409,
      };
    }

    if (assignment.participation_status === "NOT_TRAVELING") {
      return {
        error: "นักเรียนถูกระบุว่าไม่ร่วมเดินทางต่อในค่ายนี้",
        status: 409,
      };
    }

    if (!assignment.position_position_id) {
      return {
        error: "ยังไม่ได้จัดที่นั่งให้นักเรียน",
        status: 409,
      };
    }

    if (assignment.status === "ON_BUS") {
      return {
        alreadyBoarded: true,
        checkedAt: assignment.last_boarded_at,
      };
    }

    const checkedAt = new Date();

    const updated = await tx.camp_bus_student.updateMany({
      where: {
        assignment_id: assignment.assignment_id,
        status: "OFF_BUS",
        participation_status: "ACTIVE",
      },
      data: { status: "ON_BUS", last_boarded_at: checkedAt },
    });

    if (updated.count === 0) {
      return {
        alreadyBoarded: true,
        checkedAt: assignment.last_boarded_at,
      };
    }

    await tx.camp_bus_event.create({
      data: {
        bus_bus_id: busId,
        student_assignment_id: assignment.assignment_id,
        teacher_teachers_id: teacherId,
        event_type: "BOARD",
        created_at: checkedAt,
      },
    });

    return {
      alreadyBoarded: false,
      checkedAt,
      passengerType: "STUDENT" as const,
    };
  });

  if (result.error) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status || 400 },
    );
  }

  return NextResponse.json({
    success: true,
    alreadyBoarded: result.alreadyBoarded,
    checkedAt: result.checkedAt || null,
    message:
      result.passengerType === "TEACHER"
        ? result.alreadyBoarded
          ? "ครูอยู่บนรถแล้ว"
          : "ยืนยันครูขึ้นรถแล้ว"
        : result.alreadyBoarded
          ? "นักเรียนอยู่บนรถแล้ว"
          : "ยืนยันนักเรียนขึ้นรถแล้ว",
  });
}
