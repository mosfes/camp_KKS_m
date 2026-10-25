import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireSpecificCampBus } from "@/lib/camp-bus-auth";
import { busEventLocationSchema } from "@/lib/bus-event-location";
import { isBangkokDateBefore } from "@/lib/bangkok-date";

const statusSchema = z
  .object({
    status: z.enum(["PARKED", "TRAVELING"]),
    clearPassengers: z.boolean().optional().default(true),
    location: busEventLocationSchema,
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

  const teacherId = Number(access.permission?.teacher?.teachers_id) || null;

  let body;

  try {
    body = statusSchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: "สถานะรถหรือพิกัดไม่ถูกต้อง กรุณาเปิด GPS แล้วลองใหม่" },
      { status: 400 },
    );
  }

  if (
    body.status === "TRAVELING" &&
    access.permission?.camp &&
    isBangkokDateBefore(access.permission.camp.end_date)
  ) {
    return NextResponse.json(
      { error: "ค่ายสิ้นสุดแล้ว ไม่สามารถเริ่มเดินทางได้" },
      { status: 409 },
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const bus = await tx.camp_bus.findUnique({
      where: { bus_id: busId },
      select: { status: true },
    });

    if (!bus) return { error: "ไม่พบรถ", status: 404 };

    if (bus.status === body.status) {
      return { unchanged: true, status: body.status };
    }

    if (body.status === "TRAVELING") {
      const assignments = await tx.camp_bus_student.findMany({
        where: { bus_bus_id: busId, participation_status: "ACTIVE" },
        select: { position_position_id: true },
      });
      const teacherAssignments = await tx.camp_bus_teacher.findMany({
        where: { bus_bus_id: busId, removed_at: null },
        select: { position_position_id: true },
      });
      const passengerAssignments = [...assignments, ...teacherAssignments];

      if (
        passengerAssignments.length === 0 ||
        passengerAssignments.every(
          (assignment) => assignment.position_position_id === null,
        )
      ) {
        return {
          error: "กรุณาจัดที่นั่งให้ผู้โดยสารอย่างน้อย 1 คนก่อนออกรถ",
          status: 400,
        };
      }
    }

    const eventAt = new Date();

    await tx.camp_bus.update({
      where: { bus_id: busId },
      data: { status: body.status },
    });

    if (body.status === "PARKED" && body.clearPassengers) {
      const [studentPassengers, teacherPassengers] = await Promise.all([
        tx.camp_bus_student.findMany({
          where: { bus_bus_id: busId, status: "ON_BUS" },
          select: { assignment_id: true },
        }),
        tx.camp_bus_teacher.findMany({
          where: {
            bus_bus_id: busId,
            status: "ON_BUS",
            removed_at: null,
          },
          select: { assignment_id: true },
        }),
      ]);

      await Promise.all([
        tx.camp_bus_student.updateMany({
          where: { bus_bus_id: busId, status: "ON_BUS" },
          data: { status: "OFF_BUS" },
        }),
        tx.camp_bus_teacher.updateMany({
          where: {
            bus_bus_id: busId,
            status: "ON_BUS",
            removed_at: null,
          },
          data: { status: "OFF_BUS" },
        }),
      ]);

      if (studentPassengers.length > 0 || teacherPassengers.length > 0) {
        await tx.camp_bus_event.createMany({
          data: [
            ...studentPassengers.map((passenger) => ({
              bus_bus_id: busId,
              student_assignment_id: passenger.assignment_id,
              teacher_teachers_id: teacherId,
              event_type: "ALIGHT" as const,
              created_at: eventAt,
            })),
            ...teacherPassengers.map((passenger) => ({
              bus_bus_id: busId,
              teacher_assignment_id: passenger.assignment_id,
              teacher_teachers_id: teacherId,
              event_type: "ALIGHT" as const,
              created_at: eventAt,
            })),
          ],
        });
      }
    }

    await tx.camp_bus_event.create({
      data: {
        bus_bus_id: busId,
        teacher_teachers_id: teacherId,
        event_type: body.status === "PARKED" ? "PARK" : "DEPART",
        latitude: body.location.latitude,
        longitude: body.location.longitude,
        accuracy_meters: body.location.accuracy,
        created_at: eventAt,
      },
    });

    return {
      status: body.status,
      eventAt,
      clearPassengers: body.clearPassengers,
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
    status: result.status,
    eventAt: result.eventAt || null,
    message:
      result.status === "PARKED"
        ? result.clearPassengers
          ? "รถจอดแล้ว และเคลียร์สถานะนักเรียนกับครูที่อยู่บนรถแล้ว"
          : "รถจอดแล้ว นักเรียนและครูที่ยังอยู่บนรถต้องกดลงจากรถเอง"
        : "เปลี่ยนรถเป็นกำลังเดินทางแล้ว",
  });
}
