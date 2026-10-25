import { NextResponse } from "next/server";

import { requireTeacher } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isBangkokDateBefore } from "@/lib/bangkok-date";

export async function POST(_request: Request, context: any) {
  const { teacher, error: authError } = await requireTeacher();

  if (authError) return authError;

  const { id } = await context.params;
  const campId = Number(id);
  const teacherId = Number(teacher.teachers_id);

  if (!Number.isInteger(campId) || campId <= 0) {
    return NextResponse.json({ error: "รหัสค่ายไม่ถูกต้อง" }, { status: 400 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const assignment = await tx.camp_bus_teacher.findFirst({
      where: {
        camp_camp_id: campId,
        teacher_teachers_id: teacherId,
        removed_at: null,
      },
      select: {
        assignment_id: true,
        status: true,
        last_boarded_at: true,
        position_position_id: true,
        bus: {
          select: {
            bus_id: true,
            name: true,
            status: true,
            camp: { select: { end_date: true } },
          },
        },
      },
    });

    if (!assignment) {
      return { error: "ยังไม่มีรถหรือที่นั่งที่จัดให้คุณ", status: 404 };
    }

    if (isBangkokDateBefore(assignment.bus.camp.end_date)) {
      return { error: "ค่ายสิ้นสุดแล้ว ไม่สามารถยืนยันขึ้นรถได้", status: 409 };
    }

    if (assignment.bus.status === "TRAVELING") {
      return {
        error: "รถกำลังเดินทาง ไม่สามารถกดยืนยันขึ้นรถในตอนนี้",
        status: 409,
      };
    }

    if (!assignment.position_position_id) {
      return { error: "ยังไม่ได้จัดที่นั่งให้คุณ", status: 409 };
    }

    if (assignment.status === "ON_BUS") {
      return {
        alreadyBoarded: true,
        busName: assignment.bus.name,
        checkedAt: assignment.last_boarded_at,
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
          error: "รายการรถของคุณถูกเปลี่ยน กรุณาโหลดหน้าใหม่",
          status: 409,
        };
      }

      if (current.status === "ON_BUS") {
        return {
          alreadyBoarded: true,
          busName: assignment.bus.name,
          checkedAt: current.last_boarded_at,
        };
      }

      return { error: "สถานะรถถูกเปลี่ยน กรุณาลองใหม่อีกครั้ง", status: 409 };
    }

    await tx.camp_bus_event.create({
      data: {
        bus_bus_id: assignment.bus.bus_id,
        teacher_assignment_id: assignment.assignment_id,
        teacher_teachers_id: teacherId,
        event_type: "BOARD",
        created_at: checkedAt,
      },
    });

    return {
      alreadyBoarded: false,
      busName: assignment.bus.name,
      checkedAt,
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
    message: result.alreadyBoarded
      ? "คุณอยู่บนรถแล้ว"
      : `เช็คชื่อขึ้นรถ ${result.busName} สำเร็จ`,
  });
}
