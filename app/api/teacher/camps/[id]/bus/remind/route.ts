import { after, NextResponse } from "next/server";
import { z } from "zod";

import { requireTeacher } from "@/lib/auth";
import { requireSpecificCampBus } from "@/lib/camp-bus-auth";
import {
  BUS_REMINDER_COOLDOWN_MS,
  type BusReminderAction,
} from "@/lib/camp-bus-reminder";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendStudentBusPushNotifications } from "@/lib/web-push";

const requestSchema = z.object({
  action: z.enum(["board", "alight"]),
  busId: z.number().int().positive().optional(),
});

const eventTypeByAction = {
  board: "REMIND_BOARD",
  alight: "REMIND_ALIGHT",
} as const;

export async function POST(request: Request, context: any) {
  const { teacher, error: authError } = await requireTeacher();

  if (authError) return authError;

  const { id } = await context.params;
  const campId = Number(id);
  const teacherId = Number(teacher.teachers_id);

  if (!Number.isInteger(campId) || campId <= 0) {
    return NextResponse.json({ error: "รหัสค่ายไม่ถูกต้อง" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsed.success) {
    return NextResponse.json(
      { error: "กรุณาเลือกว่าจะเตือนให้ขึ้นหรือลงรถ" },
      { status: 400 },
    );
  }

  let targetBus: {
    bus_id: number;
    name: string;
    status: "PARKED" | "TRAVELING";
    campName: string;
  } | null = null;

  if (parsed.data.busId) {
    const permission = await requireSpecificCampBus(
      campId,
      parsed.data.busId,
      "operate",
    );

    if (permission.error) return permission.error;

    const selectedBus = await prisma.camp_bus.findFirst({
      where: {
        bus_id: parsed.data.busId,
        camp_camp_id: campId,
        camp: { deletedAt: null, has_transport: true },
      },
      select: {
        bus_id: true,
        name: true,
        status: true,
        camp: { select: { name: true } },
      },
    });

    if (selectedBus) {
      targetBus = {
        bus_id: selectedBus.bus_id,
        name: selectedBus.name,
        status: selectedBus.status,
        campName: selectedBus.camp.name,
      };
    }
  } else {
    const assignment = await prisma.camp_bus_teacher.findFirst({
      where: {
        camp_camp_id: campId,
        teacher_teachers_id: teacherId,
        removed_at: null,
        camp: { deletedAt: null, has_transport: true },
      },
      select: {
        bus: {
          select: {
            bus_id: true,
            name: true,
            status: true,
            camp: { select: { name: true } },
          },
        },
      },
    });

    targetBus = assignment?.bus
      ? {
          bus_id: assignment.bus.bus_id,
          name: assignment.bus.name,
          status: assignment.bus.status,
          campName: assignment.bus.camp.name,
        }
      : null;
  }

  if (!targetBus) {
    return NextResponse.json(
      { error: "คุณไม่ได้เป็นครูประจำรถของค่ายนี้" },
      { status: 403 },
    );
  }

  if (targetBus.status === "TRAVELING") {
    return NextResponse.json(
      { error: "รถกำลังเดินทาง กรุณารอรถจอดก่อนส่งการเตือน" },
      { status: 409 },
    );
  }

  const action: BusReminderAction = parsed.data.action;
  const eventType = eventTypeByAction[action];
  const rateCheck = checkRateLimit(
    "teacher-bus-reminder",
    `${teacherId}:${targetBus.bus_id}:${action}`,
    { windowMs: BUS_REMINDER_COOLDOWN_MS, max: 1 },
  );

  if (!rateCheck.allowed) {
    return NextResponse.json(
      {
        error: `เพิ่งส่งการเตือนนี้ไป กรุณารอ ${rateCheck.retryAfterSeconds} วินาทีก่อนส่งซ้ำ`,
      },
      {
        status: 429,
        headers: { "Retry-After": String(rateCheck.retryAfterSeconds) },
      },
    );
  }

  const targetStatus = action === "board" ? "OFF_BUS" : "ON_BUS";
  const [recipients, latestReminder] = await Promise.all([
    prisma.camp_bus_student.findMany({
      where: {
        bus_bus_id: targetBus.bus_id,
        participation_status: "ACTIVE",
        status: targetStatus,
      },
      select: {
        student_enrollment: {
          select: { student_students_id: true },
        },
      },
    }),
    prisma.camp_bus_event.findFirst({
      where: {
        bus_bus_id: targetBus.bus_id,
        event_type: eventType,
        created_at: {
          gte: new Date(Date.now() - BUS_REMINDER_COOLDOWN_MS),
        },
      },
      orderBy: { created_at: "desc" },
      select: { created_at: true },
    }),
  ]);
  const recipientCount = recipients.length;

  if (recipientCount === 0) {
    return NextResponse.json(
      {
        error:
          action === "board"
            ? "นักเรียนทุกคนยืนยันขึ้นรถแล้ว"
            : "ไม่มีนักเรียนที่ต้องยืนยันลงจากรถ",
      },
      { status: 409 },
    );
  }

  if (latestReminder) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil(
        (latestReminder.created_at.getTime() +
          BUS_REMINDER_COOLDOWN_MS -
          Date.now()) /
          1000,
      ),
    );

    return NextResponse.json(
      {
        error: `เพิ่งส่งการเตือนนี้ไป กรุณารอ ${retryAfterSeconds} วินาทีก่อนส่งซ้ำ`,
      },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfterSeconds) },
      },
    );
  }

  const reminder = await prisma.camp_bus_event.create({
    data: {
      bus_bus_id: targetBus.bus_id,
      teacher_teachers_id: teacherId,
      event_type: eventType,
    },
    select: { event_id: true, created_at: true },
  });

  after(async () => {
    try {
      await sendStudentBusPushNotifications({
        action,
        busName: targetBus.name,
        campId,
        campName: targetBus.campName,
        eventId: reminder.event_id,
        studentIds: recipients.map(
          (recipient) => recipient.student_enrollment.student_students_id,
        ),
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[student web push] reminder dispatch failed", error);
    }
  });

  return NextResponse.json(
    {
      action,
      recipientCount,
      sentAt: reminder.created_at,
      message: `ส่งการเตือน${action === "board" ? "ขึ้นรถ" : "ลงรถ"}ให้นักเรียน ${recipientCount} คนแล้ว`,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
