// @ts-nocheck

import { NextResponse } from "next/server";

import { requireStudent } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { studentCampBusAssignmentWhere } from "@/lib/student-bus-assignment";

export async function POST(request: Request, context: any) {
  const { student, error: authError } = await requireStudent();

  if (authError) return authError;

  const { id } = await context.params;
  const campId = Number(id);
  const studentId = Number(student.students_id);

  if (!Number.isInteger(campId) || campId <= 0) {
    return NextResponse.json({ error: "รหัสค่ายไม่ถูกต้อง" }, { status: 400 });
  }

  let result;

  try {
    result = await prisma.$transaction(async (tx) => {
      const assignment = await tx.camp_bus_student.findFirst({
        where: studentCampBusAssignmentWhere(campId, studentId),
        select: {
          assignment_id: true,
          status: true,
          participation_status: true,
          position: { select: { label: true } },
          bus: { select: { bus_id: true, status: true, name: true } },
        },
      });

      if (!assignment) {
        return {
          error: "ยังไม่มีรถหรือที่นั่งที่จัดให้คุณในค่ายนี้",
          status: 404,
        };
      }

      if (assignment.bus.status === "TRAVELING") {
        return {
          error: "รถกำลังเดินทาง ไม่สามารถกดยืนยันขึ้นรถในตอนนี้",
          status: 409,
        };
      }

      if (assignment.participation_status === "NOT_TRAVELING") {
        return {
          error:
            "ครูระบุว่าคุณไม่ร่วมเดินทางต่อในค่ายนี้ กรุณาติดต่อครูผู้ดูแลหากข้อมูลไม่ถูกต้อง",
          status: 409,
        };
      }

      if (!assignment.position) {
        return {
          error: "ยังไม่ได้จัดที่นั่งให้คุณ กรุณาติดต่อครูผู้ดูแล",
          status: 409,
        };
      }

      if (assignment.status === "ON_BUS") {
        return {
          alreadyBoarded: true,
          busName: assignment.bus.name,
          positionLabel: assignment.position?.label || null,
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
          busName: assignment.bus.name,
          positionLabel: assignment.position?.label || null,
        };
      }

      await tx.camp_bus_event.create({
        data: {
          bus_bus_id: assignment.bus.bus_id,
          student_assignment_id: assignment.assignment_id,
          event_type: "BOARD",
          created_at: checkedAt,
        },
      });

      return {
        alreadyBoarded: false,
        busName: assignment.bus.name,
        positionLabel: assignment.position?.label || null,
        checkedAt,
      };
    });
  } catch (error: any) {
    const isTransactionBusy =
      error?.code === "P2024" ||
      (error?.code === "P2028" &&
        String(error?.message || "").includes("Unable to start a transaction"));

    if (isTransactionBusy) {
      return NextResponse.json(
        {
          error: "มีผู้ใช้งานพร้อมกันจำนวนมาก ระบบกำลังลองใหม่",
          code: "BUS_TRANSACTION_BUSY",
          retryable: true,
        },
        {
          status: 503,
          headers: { "Retry-After": "1" },
        },
      );
    }

    console.error("Student bus boarding error:", error);

    return NextResponse.json(
      { error: "เช็คชื่อขึ้นรถไม่สำเร็จ กรุณาลองใหม่" },
      { status: 500 },
    );
  }

  if (result.error) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status || 400 },
    );
  }

  return NextResponse.json({
    success: true,
    alreadyBoarded: result.alreadyBoarded,
    busName: result.busName,
    positionLabel: result.positionLabel,
    checkedAt: result.checkedAt || null,
    message: result.alreadyBoarded
      ? "คุณยืนยันว่าอยู่บนรถแล้ว"
      : "เช็คชื่อขึ้นรถสำเร็จ",
  });
}
