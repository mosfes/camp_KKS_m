import { NextResponse } from "next/server";

import { requireStudent } from "@/lib/auth";
import {
  getActiveBusReminder,
  getBusReminderContent,
} from "@/lib/camp-bus-reminder";
import { prisma } from "@/lib/db";

const NOTIFICATION_HISTORY_MS = 30 * 24 * 60 * 60 * 1000;
const NOTIFICATION_LIMIT = 30;

export async function GET() {
  const { student, error: authError } = await requireStudent();

  if (authError) return authError;

  try {
    const assignments = await prisma.camp_bus_student.findMany({
      where: {
        student_enrollment: {
          student_students_id: Number(student.students_id),
          enrolled_at: { not: null },
          camp: {
            deletedAt: null,
            has_transport: true,
          },
        },
      },
      select: {
        status: true,
        participation_status: true,
        bus: {
          select: {
            bus_id: true,
            name: true,
            status: true,
            camp: {
              select: {
                camp_id: true,
                name: true,
              },
            },
            events: {
              where: {
                event_type: { in: ["REMIND_BOARD", "REMIND_ALIGHT"] },
                created_at: {
                  gte: new Date(Date.now() - NOTIFICATION_HISTORY_MS),
                },
              },
              orderBy: { created_at: "desc" },
              take: NOTIFICATION_LIMIT,
              select: {
                event_id: true,
                event_type: true,
                created_at: true,
              },
            },
          },
        },
      },
    });

    const notifications = assignments
      .flatMap((assignment) => {
        const isOnBus = assignment.status === "ON_BUS";
        const activeReminder =
          assignment.participation_status === "ACTIVE" &&
          assignment.bus.status === "PARKED"
            ? getActiveBusReminder(assignment.bus.events, isOnBus)
            : null;

        return assignment.bus.events.flatMap((event) => {
          const content = getBusReminderContent(event.event_type);

          if (!content) return [];

          const sentAt = event.created_at.toISOString();

          return [
            {
              id: String(event.event_id),
              action: content.action,
              title: content.title,
              message: content.message,
              sentAt,
              active: activeReminder?.sentAt === sentAt,
              campId: assignment.bus.camp.camp_id,
              campName: assignment.bus.camp.name,
              busId: assignment.bus.bus_id,
              busName: assignment.bus.name,
            },
          ];
        });
      })
      .sort(
        (left, right) =>
          new Date(right.sentAt).getTime() - new Date(left.sentAt).getTime(),
      )
      .slice(0, NOTIFICATION_LIMIT);

    return NextResponse.json(
      { notifications },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[student notifications] error:", error);

    return NextResponse.json(
      { error: "ไม่สามารถโหลดการแจ้งเตือนได้" },
      { status: 500 },
    );
  }
}
