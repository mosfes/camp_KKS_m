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

  const result = await prisma.$transaction(async (tx) => {
    const assignment = await tx.camp_bus_student.findFirst({
      where: studentCampBusAssignmentWhere(campId, studentId),
      select: {
        assignment_id: true,
        status: true,
        bus: { select: { bus_id: true, status: true } },
      },
    });

    if (!assignment) {
      return { error: "ยังไม่มีรถที่จัดให้คุณในค่ายนี้", status: 404 };
    }

    if (assignment.bus.status === "TRAVELING") {
      return {
        error: "รถกำลังเดินทาง กรุณารอรถจอดก่อนกดลงจากรถ",
        status: 409,
      };
    }

    if (assignment.status === "OFF_BUS") {
      return { alreadyAlighted: true };
    }

    const alightedAt = new Date();

    const updated = await tx.camp_bus_student.updateMany({
      where: {
        assignment_id: assignment.assignment_id,
        status: "ON_BUS",
      },
      data: { status: "OFF_BUS" },
    });

    if (updated.count === 0) {
      return { alreadyAlighted: true };
    }

    await tx.camp_bus_event.create({
      data: {
        bus_bus_id: assignment.bus.bus_id,
        student_assignment_id: assignment.assignment_id,
        event_type: "ALIGHT",
        created_at: alightedAt,
      },
    });

    return { alreadyAlighted: false, alightedAt };
  });

  if (result.error) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status || 400 },
    );
  }

  return NextResponse.json({
    success: true,
    alreadyAlighted: result.alreadyAlighted,
    alightedAt: result.alightedAt || null,
    message: result.alreadyAlighted ? "คุณลงจากรถแล้ว" : "บันทึกว่าลงจากรถแล้ว",
  });
}
