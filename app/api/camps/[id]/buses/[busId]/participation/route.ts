import { NextResponse } from "next/server";
import { z } from "zod";

import { requireSpecificCampBus } from "@/lib/camp-bus-auth";
import { prisma } from "@/lib/db";
import { isBangkokDateBefore } from "@/lib/bangkok-date";

const participationSchema = z.object({
  assignmentId: z.number().int().positive(),
  participationStatus: z.enum(["ACTIVE", "NOT_TRAVELING"]),
});

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
      { error: "ค่ายสิ้นสุดแล้ว ไม่สามารถเปลี่ยนสถานะการเดินทางได้" },
      { status: 409 },
    );
  }

  let body;

  try {
    body = participationSchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: "ข้อมูลสถานะการร่วมเดินทางไม่ถูกต้อง" },
      { status: 400 },
    );
  }

  const teacherId = Number(access.permission?.teacher?.teachers_id) || null;
  const result = await prisma.$transaction(async (tx) => {
    const assignment = await tx.camp_bus_student.findFirst({
      where: { assignment_id: body.assignmentId, bus_bus_id: busId },
      select: {
        assignment_id: true,
        status: true,
        participation_status: true,
        bus: { select: { status: true } },
      },
    });

    if (!assignment) {
      return { error: "ไม่พบนักเรียนในรถคันนี้", status: 404 };
    }

    if (assignment.bus.status === "TRAVELING") {
      return {
        error: "รถกำลังเดินทาง กรุณาปรับสถานะเมื่อรถจอด",
        status: 409,
      };
    }

    if (assignment.participation_status === body.participationStatus) {
      return { unchanged: true };
    }

    const changedAt = new Date();
    const shouldAlight =
      body.participationStatus === "NOT_TRAVELING" &&
      assignment.status === "ON_BUS";

    await tx.camp_bus_student.update({
      where: { assignment_id: assignment.assignment_id },
      data: {
        participation_status: body.participationStatus,
        ...(body.participationStatus === "NOT_TRAVELING"
          ? { status: "OFF_BUS" }
          : {}),
      },
    });

    if (shouldAlight) {
      await tx.camp_bus_event.create({
        data: {
          bus_bus_id: busId,
          student_assignment_id: assignment.assignment_id,
          teacher_teachers_id: teacherId,
          event_type: "ALIGHT",
          created_at: changedAt,
        },
      });
    }

    return { unchanged: false };
  });

  if (result.error) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status || 400 },
    );
  }

  return NextResponse.json({
    success: true,
    participationStatus: body.participationStatus,
    message:
      body.participationStatus === "NOT_TRAVELING"
        ? "จำไว้ว่านักเรียนไม่ร่วมเดินทางต่อในค่ายนี้แล้ว"
        : "นำนักเรียนกลับเข้าร่วมการเดินทางแล้ว",
  });
}
