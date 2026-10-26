import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireCampBusPermission } from "@/lib/camp-bus-auth";
import { formatStudentName } from "@/lib/student-display-name";
import { activeCampBusStudentWhere } from "@/lib/active-camp-student";
import { isBangkokDateBefore } from "@/lib/bangkok-date";

export async function GET(_request: Request, context: any) {
  const { id, busId: rawBusId } = await context.params;
  const campId = Number(id);
  const busId = Number(rawBusId);

  if (!Number.isInteger(campId) || !Number.isInteger(busId)) {
    return NextResponse.json({ error: "รหัสรถไม่ถูกต้อง" }, { status: 400 });
  }

  const permission = await requireCampBusPermission(campId, undefined, "view");

  if (permission.error) return permission.error;

  const bus = await prisma.camp_bus.findFirst({
    where: {
      bus_id: busId,
      camp_camp_id: campId,
      classroom_classroom_id: { in: permission.classroomIds },
    },
    select: {
      bus_id: true,
      status: true,
      events: {
        where: { event_type: "DEPART" },
        select: { event_id: true },
      },
      assignments: {
        where: {
          student_enrollment: {
            student: activeCampBusStudentWhere(campId, busId),
          },
        },
        orderBy: { assignment_id: "asc" },
        select: {
          assignment_id: true,
          status: true,
          participation_status: true,
          last_boarded_at: true,
          student_enrollment: {
            select: {
              student: {
                select: {
                  prefix_name: true,
                  firstname: true,
                  lastname: true,
                },
              },
            },
          },
          events: {
            where: { event_type: { in: ["BOARD", "ALIGHT"] } },
            orderBy: [{ created_at: "desc" }, { event_id: "desc" }],
            take: 2,
            select: {
              event_id: true,
              event_type: true,
              created_at: true,
              teacher: { select: { firstname: true, lastname: true } },
            },
          },
        },
      },
      teacher_assignments: {
        where: { removed_at: null },
        orderBy: { assignment_id: "asc" },
        select: {
          assignment_id: true,
          teacher_teachers_id: true,
          status: true,
          last_boarded_at: true,
          teacher: {
            select: {
              prefix_name: true,
              firstname: true,
              lastname: true,
            },
          },
          events: {
            where: { event_type: { in: ["BOARD", "ALIGHT"] } },
            orderBy: [{ created_at: "desc" }, { event_id: "desc" }],
            take: 2,
            select: {
              event_id: true,
              event_type: true,
              created_at: true,
              teacher: { select: { firstname: true, lastname: true } },
            },
          },
        },
      },
    },
  });

  if (!bus) {
    return NextResponse.json({ error: "ไม่พบรถของค่ายนี้" }, { status: 404 });
  }

  const assignmentStatuses = bus.assignments.map((assignment) => {
    const latestEvent = assignment.events[0] || null;
    const departedBeforeEvent = latestEvent
      ? bus.events.filter((event) => event.event_id < latestEvent.event_id)
          .length
      : 0;
    const previousBoardEvent = assignment.events
      .slice(1)
      .find((event) => event.event_type === "BOARD");
    const departedBeforePreviousBoard = previousBoardEvent
      ? bus.events.filter(
          (event) => event.event_id < previousBoardEvent.event_id,
        ).length
      : 0;
    const student = assignment.student_enrollment.student;
    const studentName = formatStudentName(student);

    return {
      assignmentId: assignment.assignment_id,
      status: assignment.status,
      participationStatus: assignment.participation_status,
      lastBoardedAt: assignment.last_boarded_at,
      lastStatusEvent: latestEvent
        ? {
            eventType: latestEvent.event_type,
            happenedAt: latestEvent.created_at,
            tripNumber:
              latestEvent.event_type === "BOARD"
                ? departedBeforeEvent + 1
                : previousBoardEvent
                  ? departedBeforePreviousBoard + 1
                  : Math.max(1, departedBeforeEvent),
            actorType: latestEvent.teacher ? "TEACHER" : "STUDENT",
            actorName: latestEvent.teacher
              ? `${latestEvent.teacher.firstname} ${latestEvent.teacher.lastname}`.trim()
              : studentName,
          }
        : null,
    };
  });
  const teacherAssignmentStatuses = bus.teacher_assignments.map(
    (assignment) => {
      const latestEvent = assignment.events[0] || null;
      const departedBeforeEvent = latestEvent
        ? bus.events.filter((event) => event.event_id < latestEvent.event_id)
            .length
        : 0;
      const previousBoardEvent = assignment.events
        .slice(1)
        .find((event) => event.event_type === "BOARD");
      const departedBeforePreviousBoard = previousBoardEvent
        ? bus.events.filter(
            (event) => event.event_id < previousBoardEvent.event_id,
          ).length
        : 0;
      const teacherName = [
        assignment.teacher.prefix_name,
        assignment.teacher.firstname,
        assignment.teacher.lastname,
      ]
        .filter(Boolean)
        .join(" ");

      return {
        assignmentId: assignment.assignment_id,
        teacherId: assignment.teacher_teachers_id,
        status: assignment.status,
        lastBoardedAt: assignment.last_boarded_at,
        lastStatusEvent: latestEvent
          ? {
              eventType: latestEvent.event_type,
              happenedAt: latestEvent.created_at,
              tripNumber:
                latestEvent.event_type === "BOARD"
                  ? departedBeforeEvent + 1
                  : previousBoardEvent
                    ? departedBeforePreviousBoard + 1
                    : Math.max(1, departedBeforeEvent),
              actorType: "TEACHER",
              actorName: latestEvent.teacher
                ? `${latestEvent.teacher.firstname} ${latestEvent.teacher.lastname}`.trim()
                : teacherName,
            }
          : null,
      };
    },
  );

  return NextResponse.json(
    {
      busId: bus.bus_id,
      isEnded: isBangkokDateBefore(permission.camp.end_date),
      status: bus.status,
      checkedInCount:
        assignmentStatuses.filter(
          (assignment) =>
            assignment.participationStatus === "ACTIVE" &&
            assignment.status === "ON_BUS",
        ).length +
        teacherAssignmentStatuses.filter(
          (assignment) => assignment.status === "ON_BUS",
        ).length,
      studentCheckedInCount: assignmentStatuses.filter(
        (assignment) =>
          assignment.participationStatus === "ACTIVE" &&
          assignment.status === "ON_BUS",
      ).length,
      teacherCheckedInCount: teacherAssignmentStatuses.filter(
        (assignment) => assignment.status === "ON_BUS",
      ).length,
      assignmentStatuses,
      teacherAssignmentStatuses,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
