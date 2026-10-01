// @ts-nocheck

import { NextResponse } from "next/server";

import { requireStudent } from "@/lib/auth";
import { isBangkokDateBefore } from "@/lib/bangkok-date";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  BUS_REMINDER_TTL_MS,
  getActiveBusReminder,
} from "@/lib/camp-bus-reminder";

export async function GET(request: Request) {
  const { student, error: authError } = await requireStudent();

  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const isManual = searchParams.get("manual") === "1";

  if (isManual) {
    const rateCheck = checkRateLimit(
      "student-bus-list-manual",
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

  try {
    const enrollments = await prisma.student_enrollment.findMany({
      where: {
        student_students_id: Number(student.students_id),
        enrolled_at: { not: null },
        camp: {
          deletedAt: null,
          has_transport: true,
          camp_classroom: {
            some: {
              classroom: {
                deletedAt: null,
                classroom_students: {
                  some: {
                    student_students_id: Number(student.students_id),
                    student: { deletedAt: null },
                  },
                },
              },
            },
          },
        },
      },
      select: {
        camp_camp_id: true,
        camp: {
          select: {
            name: true,
            start_date: true,
            end_date: true,
          },
        },
        camp_bus_student: {
          take: 1,
          select: {
            status: true,
            participation_status: true,
            last_boarded_at: true,
            position: {
              select: {
                label: true,
                floor: { select: { floor_number: true } },
              },
            },
            bus: {
              select: {
                name: true,
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
              },
            },
          },
        },
      },
      orderBy: { camp: { start_date: "asc" } },
    });

    const assignments = enrollments
      .filter((enrollment) => !isBangkokDateBefore(enrollment.camp.end_date))
      .map((enrollment) => {
        const assignment = enrollment.camp_bus_student[0];

        if (!assignment) {
          return {
            campId: enrollment.camp_camp_id,
            campName: enrollment.camp.name,
            configured: false,
          };
        }

        const isOnBus = assignment.status === "ON_BUS";

        return {
          campId: enrollment.camp_camp_id,
          campName: enrollment.camp.name,
          configured: true,
          bus: {
            name: assignment.bus.name,
            status: assignment.bus.status,
            floorCount: assignment.bus.floor_count,
            layoutTemplateId: assignment.bus.layout_template_id,
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
            position: assignment.position
              ? {
                  label: assignment.position.label,
                  floorNumber: assignment.position.floor.floor_number,
                }
              : null,
          },
        };
      });

    return NextResponse.json(
      { assignments },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[student bus shortcuts] error:", error);

    return NextResponse.json(
      { error: "ไม่สามารถโหลดข้อมูลรถได้" },
      { status: 500 },
    );
  }
}
