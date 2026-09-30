import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { buildEnrollmentSnapshotMap } from "@/lib/student-enrollment-snapshot";
import { requireCampBusPermission } from "@/lib/camp-bus-auth";
import {
  detectBusLayoutTemplate,
  getBusLayoutTemplate,
  PHEUNG_THIN_BUS_TEMPLATE_ID,
} from "@/lib/camp-bus-layout-templates";
import { positionLabel } from "@/lib/camp-bus-seating";
import { formatStudentName } from "@/lib/student-display-name";
import { activeCampStudentWhere } from "@/lib/active-camp-student";

const createBusSchema = z.object({
  classroomId: z.number().int().positive(),
  name: z.string().trim().min(1).max(100),
  registrationPlate: z.string().trim().max(30).optional().default(""),
  floorCount: z.number().int().min(1).max(2),
  rowCounts: z.array(z.number().int().min(1).max(80)).min(1).max(2),
  layoutTemplateId: z
    .union([z.enum([PHEUNG_THIN_BUS_TEMPLATE_ID]), z.number().int().positive()])
    .optional(),
  studentEnrollmentIds: z
    .array(z.number().int().positive())
    .max(500)
    .optional(),
});

async function getDatabaseLayoutTemplate(id: number) {
  const template = await prisma.bus_layout_template.findFirst({
    where: { template_id: id, status: "PUBLISHED" },
    include: {
      floors: {
        orderBy: { floor_number: "asc" },
        include: { elements: { orderBy: { element_id: "asc" } } },
      },
    },
  });

  if (!template) return null;

  const floors = template.floors.map((floor) => ({
    floorNumber: floor.floor_number,
    rowCount: floor.canvas_rows,
    canvasColumns: floor.canvas_columns,
    canvasRows: floor.canvas_rows,
    positions: floor.elements
      .filter((element) => element.type === "SEAT" && element.is_assignable)
      .map((element) => ({
        rowNumber: element.y + 1,
        seatIndex: element.x,
        label: element.label,
        x: element.x,
        y: element.y,
        width: element.width,
        height: element.height,
        rotation: element.rotation,
      })),
    elements: floor.elements
      .filter((element) => element.type === "SEAT" && !element.is_assignable)
      .map((element) => ({
        type: element.type,
        x: element.x,
        y: element.y,
        width: element.width,
        height: element.height,
        rotation: element.rotation,
        label: element.label,
        zIndex: element.z_index,
        metadata: element.metadata,
      })),
  }));

  return {
    id: template.template_id,
    name: template.name,
    description: template.description,
    defaultBusName: template.name,
    capacity: floors.reduce((sum, floor) => sum + floor.positions.length, 0),
    floors,
  };
}

function getTeacherName(classroom: any) {
  const names = [
    classroom.teacher,
    ...(classroom.classroom_teacher || []).map((item: any) => item.teacher),
  ]
    .filter(Boolean)
    .map((teacher: any) => `${teacher.firstname} ${teacher.lastname}`.trim());

  return Array.from(new Set(names)).join(", ");
}

function formatTeacherName(teacher: any) {
  return [teacher.prefix_name, teacher.firstname, teacher.lastname]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function formatBus(bus: any, permission: any) {
  const lastParkedEvent = bus.events?.find(
    (event: any) => event.event_type === "PARK",
  );
  const lastDepartedEvent = bus.events?.find(
    (event: any) => event.event_type === "DEPART",
  );
  const departedEvents = (bus.events || []).filter(
    (event: any) => event.event_type === "DEPART",
  );
  const assignments = bus.assignments.map((assignment: any) => {
    const studentName = formatStudentName(
      assignment.student_enrollment.student,
    );
    const latestEvent = assignment.events?.[0] || null;
    const departedBeforeEvent = latestEvent
      ? departedEvents.filter(
          (event: any) => event.event_id < latestEvent.event_id,
        ).length
      : 0;
    const previousBoardEvent = assignment.events
      ?.slice(1)
      .find((event: any) => event.event_type === "BOARD");
    const departedBeforePreviousBoard = previousBoardEvent
      ? departedEvents.filter(
          (event: any) => event.event_id < previousBoardEvent.event_id,
        ).length
      : 0;
    const tripNumber = latestEvent
      ? latestEvent.event_type === "BOARD"
        ? departedBeforeEvent + 1
        : previousBoardEvent
          ? departedBeforePreviousBoard + 1
          : Math.max(1, departedBeforeEvent)
      : null;

    return {
      assignmentId: assignment.assignment_id,
      studentEnrollmentId: assignment.student_enrollment_id,
      studentId: assignment.student_enrollment.student.students_id,
      studentName,
      firstName: assignment.student_enrollment.student.firstname,
      prefixName: assignment.student_enrollment.student.prefix_name,
      nickname: assignment.student_enrollment.student.nickname,
      profileImageUrl: assignment.student_enrollment.student.profile_image_url,
      positionId: assignment.position_position_id,
      positionLabel: assignment.position?.label || null,
      floorNumber: assignment.position?.floor?.floor_number || null,
      status: assignment.status,
      participationStatus: assignment.participation_status,
      isRegistered: Boolean(assignment.student_enrollment.enrolled_at),
      lastBoardedAt: assignment.last_boarded_at,
      lastStatusEvent: latestEvent
        ? {
            eventType: latestEvent.event_type,
            happenedAt: latestEvent.created_at,
            tripNumber,
            actorType: latestEvent.teacher ? "TEACHER" : "STUDENT",
            actorName: latestEvent.teacher
              ? `${latestEvent.teacher.firstname} ${latestEvent.teacher.lastname}`.trim()
              : studentName,
          }
        : null,
    };
  });
  const visibleStudentAssignmentIds = new Set(
    assignments.map((assignment: any) => assignment.assignmentId),
  );
  const teacherAssignments = bus.teacher_assignments.map((assignment: any) => {
    const teacherName = formatTeacherName(assignment.teacher);
    const latestEvent = assignment.events?.[0] || null;
    const departedBeforeEvent = latestEvent
      ? departedEvents.filter(
          (event: any) => event.event_id < latestEvent.event_id,
        ).length
      : 0;
    const previousBoardEvent = assignment.events
      ?.slice(1)
      .find((event: any) => event.event_type === "BOARD");
    const departedBeforePreviousBoard = previousBoardEvent
      ? departedEvents.filter(
          (event: any) => event.event_id < previousBoardEvent.event_id,
        ).length
      : 0;
    const tripNumber = latestEvent
      ? latestEvent.event_type === "BOARD"
        ? departedBeforeEvent + 1
        : previousBoardEvent
          ? departedBeforePreviousBoard + 1
          : Math.max(1, departedBeforeEvent)
      : null;

    return {
      assignmentId: assignment.assignment_id,
      teacherId: assignment.teacher_teachers_id,
      teacherName,
      firstName: assignment.teacher.firstname,
      prefixName: assignment.teacher.prefix_name,
      positionId: assignment.position_position_id,
      positionLabel: assignment.position?.label || null,
      floorNumber: assignment.position?.floor?.floor_number || null,
      status: assignment.status,
      lastBoardedAt: assignment.last_boarded_at,
      isCurrentTeacher:
        assignment.teacher_teachers_id ===
        Number(permission.teacher?.teachers_id),
      lastStatusEvent: latestEvent
        ? {
            eventType: latestEvent.event_type,
            happenedAt: latestEvent.created_at,
            tripNumber,
            actorType: "TEACHER",
            actorName: latestEvent.teacher
              ? `${latestEvent.teacher.firstname} ${latestEvent.teacher.lastname}`.trim()
              : teacherName,
          }
        : null,
    };
  });
  const studentCheckedInCount = assignments.filter(
    (item: any) =>
      item.participationStatus === "ACTIVE" && item.status === "ON_BUS",
  ).length;
  const teacherCheckedInCount = teacherAssignments.filter(
    (item: any) => item.status === "ON_BUS",
  ).length;
  const assignedStudentCount = assignments.filter(
    (assignment: any) =>
      assignment.participationStatus === "ACTIVE" &&
      assignment.positionId !== null,
  ).length;

  return {
    busId: bus.bus_id,
    name: bus.name,
    registrationPlate: bus.registration_plate,
    floorCount: bus.floor_count,
    layoutTemplateId:
      bus.layout_template_id || detectBusLayoutTemplate(bus.floors),
    layoutTemplateName: bus.layout_template?.name || null,
    status: bus.status,
    lastParkedAt: lastParkedEvent?.created_at || null,
    lastDepartedAt: lastDepartedEvent?.created_at || null,
    classroomId: bus.classroom_classroom_id,
    capacity: bus.floors.reduce(
      (sum: number, floor: any) => sum + floor.positions.length,
      0,
    ),
    classroom: {
      classroomId: bus.classroom.classroom_id,
      grade: bus.classroom.grade,
      roomName: bus.classroom.classroom_types?.name || "ห้องเรียน",
      teacherName: getTeacherName(bus.classroom),
    },
    floors: bus.floors.map((floor: any) => ({
      floorId: floor.floor_id,
      floorNumber: floor.floor_number,
      rowCount: floor.row_count,
      canvasColumns: floor.canvas_columns,
      canvasRows: floor.canvas_rows,
      elements: (floor.elements || []).map((element: any) => ({
        elementId: element.element_id,
        type: element.type,
        x: element.x,
        y: element.y,
        width: element.width,
        height: element.height,
        rotation: element.rotation,
        label: element.label,
        zIndex: element.z_index,
        metadata: element.metadata,
      })),
      positions: floor.positions.map((position: any) => ({
        positionId: position.position_id,
        rowNumber: position.row_number,
        seatIndex: position.seat_index,
        label: position.label,
        x: position.x,
        y: position.y,
        width: position.width,
        height: position.height,
        rotation: position.rotation,
        assignmentId:
          position.assignment &&
          visibleStudentAssignmentIds.has(position.assignment.assignment_id)
            ? position.assignment.assignment_id
            : null,
        teacherAssignmentId: position.teacher_assignment?.assignment_id || null,
      })),
    })),
    assignments,
    teacherAssignments,
    checkedInCount: studentCheckedInCount + teacherCheckedInCount,
    studentCheckedInCount,
    teacherCheckedInCount,
    // Only students with a seat are participating in the current trip.
    // Students without a seat remain in the roster so the teacher can confirm
    // that they are not travelling this trip.
    assignedCount: assignedStudentCount + teacherAssignments.length,
    assignedStudentCount,
    assignedTeacherCount: teacherAssignments.length,
    unassignedSeatCount: bus.floors.reduce(
      (sum: number, floor: any) =>
        sum +
        floor.positions.filter(
          (position: any) =>
            (!position.assignment ||
              !visibleStudentAssignmentIds.has(
                position.assignment.assignment_id,
              )) &&
            !position.teacher_assignment,
        ).length,
      0,
    ),
    permissions: {
      canConfigure: permission.configurableClassroomIds.includes(
        bus.classroom_classroom_id,
      ),
      canOperate:
        permission.configurableClassroomIds.includes(
          bus.classroom_classroom_id,
        ) || permission.teacherBusIds.includes(bus.bus_id),
      canManageTeachers: permission.canManageTeachers,
    },
  };
}

async function getBusData(
  campId: number,
  classroomIds: number[],
  permission: any,
) {
  const classroomRows = await prisma.camp_classroom.findMany({
    where: {
      camp_camp_id: campId,
      classroom_classroom_id: { in: classroomIds },
    },
    select: {
      classroom_classroom_id: true,
      classroom: {
        select: {
          classroom_id: true,
          grade: true,
          classroom_types: { select: { name: true } },
          teacher: {
            select: { teachers_id: true, firstname: true, lastname: true },
          },
          classroom_teacher: {
            select: {
              teacher: {
                select: {
                  teachers_id: true,
                  prefix_name: true,
                  firstname: true,
                  lastname: true,
                  email: true,
                },
              },
            },
          },
          classroom_students: {
            where: { student: { deletedAt: null } },
            select: { student_students_id: true },
          },
        },
      },
    },
    orderBy: { classroom_classroom_id: "asc" },
  });

  const classroomStudentIds = Array.from(
    new Set(
      classroomRows.flatMap((row) =>
        row.classroom.classroom_students.map(
          (item) => item.student_students_id,
        ),
      ),
    ),
  );

  // Keep a nullable enrollment record for students who have not registered yet.
  // This lets the bus layout reserve a seat without making them count as enrolled.
  if (classroomStudentIds.length > 0) {
    const snapshots = await buildEnrollmentSnapshotMap(
      prisma,
      campId,
      classroomStudentIds,
    );
    await prisma.student_enrollment.createMany({
      data: classroomStudentIds.map((studentId) => ({
        student_students_id: studentId,
        camp_camp_id: campId,
        ...(snapshots.get(studentId) || {}),
      })),
      skipDuplicates: true,
    });
  }

  const enrollments = await prisma.student_enrollment.findMany({
    where: {
      camp_camp_id: campId,
      student_students_id: { in: classroomStudentIds },
      student: { deletedAt: null },
    },
    select: {
      student_enrollment_id: true,
      student_students_id: true,
      enrolled_at: true,
      student: {
        select: {
          students_id: true,
          prefix_name: true,
          firstname: true,
          lastname: true,
          nickname: true,
          profile_image_url: true,
        },
      },
    },
    orderBy: { student_enrollment_id: "asc" },
  });
  const assignedEnrollments = await prisma.camp_bus_student.findMany({
    where: {
      student_enrollment_id: {
        in: enrollments.map((enrollment) => enrollment.student_enrollment_id),
      },
    },
    select: { student_enrollment_id: true },
  });
  const assignedEnrollmentIdSet = new Set(
    assignedEnrollments.map((assignment) => assignment.student_enrollment_id),
  );
  const buses = await prisma.camp_bus.findMany({
    where: {
      camp_camp_id: campId,
      classroom_classroom_id: { in: classroomIds },
    },
    include: {
      layout_template: { select: { name: true } },
      classroom: {
        select: {
          classroom_id: true,
          grade: true,
          classroom_types: { select: { name: true } },
          teacher: {
            select: { teachers_id: true, firstname: true, lastname: true },
          },
          classroom_teacher: {
            select: {
              teacher: {
                select: { firstname: true, lastname: true },
              },
            },
          },
        },
      },
      floors: {
        orderBy: { floor_number: "asc" },
        include: {
          elements: { orderBy: [{ z_index: "asc" }, { element_id: "asc" }] },
          positions: {
            orderBy: [{ row_number: "asc" }, { seat_index: "asc" }],
            include: {
              assignment: { select: { assignment_id: true } },
              teacher_assignment: { select: { assignment_id: true } },
            },
          },
        },
      },
      assignments: {
        where: {
          student_enrollment: {
            student: activeCampStudentWhere(campId),
          },
        },
        include: {
          student_enrollment: {
            select: {
              student_enrollment_id: true,
              student_students_id: true,
              enrolled_at: true,
              student: {
                select: {
                  students_id: true,
                  prefix_name: true,
                  firstname: true,
                  lastname: true,
                  nickname: true,
                  profile_image_url: true,
                },
              },
            },
          },
          position: {
            include: { floor: { select: { floor_number: true } } },
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
        orderBy: { student_enrollment_id: "asc" },
      },
      teacher_assignments: {
        where: { removed_at: null },
        include: {
          teacher: {
            select: {
              teachers_id: true,
              prefix_name: true,
              firstname: true,
              lastname: true,
              email: true,
            },
          },
          position: {
            include: { floor: { select: { floor_number: true } } },
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
        orderBy: { teacher_teachers_id: "asc" },
      },
      events: {
        where: { event_type: { in: ["PARK", "DEPART"] } },
        orderBy: [{ created_at: "desc" }, { event_id: "desc" }],
        select: { event_id: true, event_type: true, created_at: true },
      },
    },
    orderBy: { bus_id: "asc" },
  });

  const classrooms = classroomRows.map((row) => {
    const studentIds = row.classroom.classroom_students.map(
      (item) => item.student_students_id,
    );
    const studentIdSet = new Set(studentIds);
    const classroomBuses = buses.filter(
      (item) => item.classroom_classroom_id === row.classroom_classroom_id,
    );
    const assignedStudentCount = new Set(
      buses.flatMap((bus) =>
        bus.assignments
          .map(
            (assignment) => assignment.student_enrollment.student_students_id,
          )
          .filter((studentId) => studentIdSet.has(studentId)),
      ),
    ).size;

    return {
      classroomId: row.classroom_classroom_id,
      grade: row.classroom.grade,
      roomName: row.classroom.classroom_types?.name || "ห้องเรียน",
      teacherName: getTeacherName(row.classroom),
      studentCount: studentIds.length,
      busId: classroomBuses[0]?.bus_id || null,
      busCount: classroomBuses.length,
      assignedStudentCount,
      unassignedStudentCount: Math.max(
        0,
        studentIds.length - assignedStudentCount,
      ),
    };
  });

  const allTeachers = permission.canManageTeachers
    ? await prisma.teachers.findMany({
        where: { deletedAt: null },
        select: {
          teachers_id: true,
          prefix_name: true,
          firstname: true,
          lastname: true,
          email: true,
        },
        orderBy: [{ firstname: "asc" }, { lastname: "asc" }],
      })
    : [];

  const teacherBusByTeacherId = new Map<number, any>();

  buses.forEach((bus) => {
    bus.teacher_assignments.forEach((assignment) => {
      teacherBusByTeacherId.set(assignment.teacher_teachers_id, {
        busId: bus.bus_id,
        busName: bus.name,
      });
    });
  });

  const eligibleTeachers = allTeachers
    .map((teacher) => ({
      teacherId: teacher.teachers_id,
      prefixName: teacher.prefix_name || null,
      firstName: teacher.firstname,
      lastName: teacher.lastname,
      teacherName: formatTeacherName(teacher),
      email: teacher.email || "",
      assignedBus: teacherBusByTeacherId.get(teacher.teachers_id) || null,
    }))
    .sort((a, b) => a.teacherName.localeCompare(b.teacherName, "th"));

  const assignableStudentIds = new Set(
    classroomRows
      .filter((row) =>
        permission.configurableClassroomIds.includes(
          row.classroom_classroom_id,
        ),
      )
      .flatMap((row) =>
        row.classroom.classroom_students.map(
          (item) => item.student_students_id,
        ),
      ),
  );
  const unassignedStudents = enrollments
    .filter(
      (enrollment) =>
        assignableStudentIds.has(enrollment.student_students_id) &&
        !assignedEnrollmentIdSet.has(enrollment.student_enrollment_id),
    )
    .map((enrollment) => {
      const classroom = classroomRows.find((row) =>
        row.classroom.classroom_students.some(
          (item) => item.student_students_id === enrollment.student_students_id,
        ),
      );

      return {
        studentEnrollmentId: enrollment.student_enrollment_id,
        studentId: enrollment.student.students_id,
        studentName: formatStudentName(enrollment.student),
        firstName: enrollment.student.firstname,
        prefixName: enrollment.student.prefix_name,
        nickname: enrollment.student.nickname,
        profileImageUrl: enrollment.student.profile_image_url,
        isRegistered: Boolean(enrollment.enrolled_at),
        classroom: classroom
          ? {
              classroomId: classroom.classroom_classroom_id,
              grade: classroom.classroom.grade,
              roomName:
                classroom.classroom.classroom_types?.name || "ห้องเรียน",
            }
          : null,
      };
    });

  return {
    classrooms,
    buses: buses.map((bus) => formatBus(bus, permission)),
    unassignedStudents,
    eligibleTeachers,
    permissions: {
      canManageTeachers: permission.canManageTeachers,
      canConfigureAny: permission.configurableClassroomIds.length > 0,
    },
  };
}

export async function GET(request: Request, context: any) {
  const { id } = await context.params;
  const campId = Number(id);

  if (!Number.isInteger(campId)) {
    return NextResponse.json({ error: "รหัสค่ายไม่ถูกต้อง" }, { status: 400 });
  }

  const classroomIdParam = new URL(request.url).searchParams.get("classroomId");
  const classroomId = classroomIdParam ? Number(classroomIdParam) : undefined;
  const permission = await requireCampBusPermission(
    campId,
    classroomId,
    "view",
  );

  if (permission.error) return permission.error;

  const classroomIds = classroomId ? [classroomId] : permission.classroomIds;
  const data = await getBusData(campId, classroomIds, permission);

  return NextResponse.json(data, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function POST(request: Request, context: any) {
  const { id } = await context.params;
  const campId = Number(id);

  if (!Number.isInteger(campId)) {
    return NextResponse.json({ error: "รหัสค่ายไม่ถูกต้อง" }, { status: 400 });
  }

  let body;

  try {
    body = createBusSchema.parse(await request.json());
  } catch (error: any) {
    return NextResponse.json(
      { error: "ข้อมูลสร้างรถไม่ครบหรือไม่ถูกต้อง", details: error?.issues },
      { status: 400 },
    );
  }

  const layoutTemplate =
    typeof body.layoutTemplateId === "number"
      ? await getDatabaseLayoutTemplate(body.layoutTemplateId)
      : getBusLayoutTemplate(body.layoutTemplateId);

  if (body.layoutTemplateId && !layoutTemplate) {
    return NextResponse.json(
      { error: "ไม่พบเทมเพลตผังรถหรือเทมเพลตยังไม่ได้เผยแพร่" },
      { status: 404 },
    );
  }
  const floorCount = layoutTemplate?.floors.length || body.floorCount;
  const rowCounts = layoutTemplate
    ? layoutTemplate.floors.map((floor) => floor.rowCount)
    : body.rowCounts;

  if (rowCounts.length !== floorCount) {
    return NextResponse.json(
      { error: "จำนวนแถวต้องตรงกับจำนวนชั้นของรถ" },
      { status: 400 },
    );
  }

  const permission = await requireCampBusPermission(campId, body.classroomId);

  if (permission.error) return permission.error;

  const classroom = await prisma.classrooms.findFirst({
    where: {
      classroom_id: body.classroomId,
      camp_classroom: { some: { camp_camp_id: campId } },
    },
    select: {
      classroom_id: true,
      classroom_students: {
        where: { student: { deletedAt: null } },
        select: { student_students_id: true },
      },
    },
  });

  if (!classroom) {
    return NextResponse.json(
      { error: "ไม่พบห้องเรียนนี้ในค่าย" },
      { status: 404 },
    );
  }

  const classroomStudentIds = Array.from(
    new Set(
      classroom.classroom_students.map((item) => item.student_students_id),
    ),
  );

  const capacity =
    layoutTemplate?.capacity ||
    rowCounts.reduce((sum, rows) => sum + rows * 4, 0);

  const bus = await prisma
    .$transaction(async (tx) => {
      const snapshots = await buildEnrollmentSnapshotMap(
        tx,
        campId,
        classroomStudentIds,
      );
      await tx.student_enrollment.createMany({
        data: classroomStudentIds.map((studentId) => ({
          student_students_id: studentId,
          camp_camp_id: campId,
          ...(snapshots.get(studentId) || {}),
        })),
        skipDuplicates: true,
      });

      const enrollments = await tx.student_enrollment.findMany({
        where: {
          camp_camp_id: campId,
          student_students_id: { in: classroomStudentIds },
        },
        select: { student_enrollment_id: true },
        orderBy: { student_enrollment_id: "asc" },
      });
      const classroomEnrollmentIdSet = new Set(
        enrollments.map((enrollment) => enrollment.student_enrollment_id),
      );
      const assignedEnrollments = await tx.camp_bus_student.findMany({
        where: {
          student_enrollment_id: { in: Array.from(classroomEnrollmentIdSet) },
        },
        select: { student_enrollment_id: true },
      });
      const assignedEnrollmentIdSet = new Set(
        assignedEnrollments.map(
          (assignment) => assignment.student_enrollment_id,
        ),
      );
      const requestedEnrollmentIds = body.studentEnrollmentIds;

      if (
        requestedEnrollmentIds &&
        (new Set(requestedEnrollmentIds).size !==
          requestedEnrollmentIds.length ||
          requestedEnrollmentIds.some(
            (enrollmentId) =>
              !classroomEnrollmentIdSet.has(enrollmentId) ||
              assignedEnrollmentIdSet.has(enrollmentId),
          ))
      ) {
        throw new Error("INVALID_STUDENT_SELECTION");
      }

      const selectedEnrollmentIds = requestedEnrollmentIds
        ? requestedEnrollmentIds
        : enrollments
            .filter(
              (enrollment) =>
                !assignedEnrollmentIdSet.has(enrollment.student_enrollment_id),
            )
            .slice(0, capacity)
            .map((enrollment) => enrollment.student_enrollment_id);

      if (selectedEnrollmentIds.length > capacity) {
        throw new Error("BUS_CAPACITY_EXCEEDED");
      }
      const createdBus = await tx.camp_bus.create({
        data: {
          camp_camp_id: campId,
          classroom_classroom_id: body.classroomId,
          name: body.name,
          registration_plate: body.registrationPlate,
          floor_count: floorCount,
          layout_template_id:
            typeof body.layoutTemplateId === "number"
              ? body.layoutTemplateId
              : null,
        },
      });

      for (let floorIndex = 0; floorIndex < floorCount; floorIndex += 1) {
        const floorNumber = floorIndex + 1;
        const templateFloor = layoutTemplate?.floors.find(
          (item) => item.floorNumber === floorNumber,
        );
        const floor = await tx.camp_bus_floor.create({
          data: {
            bus_bus_id: createdBus.bus_id,
            floor_number: floorNumber,
            row_count: rowCounts[floorIndex],
            canvas_columns: (templateFloor as any)?.canvasColumns || 5,
            canvas_rows:
              (templateFloor as any)?.canvasRows || rowCounts[floorIndex],
          },
        });

        const positions = [];

        if (templateFloor) {
          positions.push(
            ...templateFloor.positions.map((position) => ({
              floor_floor_id: floor.floor_id,
              row_number: position.rowNumber,
              seat_index: position.seatIndex,
              label: position.label,
              x:
                (position as any).x ??
                [0, 1, 3, 4][position.seatIndex] ??
                position.seatIndex,
              y: (position as any).y ?? position.rowNumber - 1,
              width: (position as any).width || 1,
              height: (position as any).height || 1,
              rotation: (position as any).rotation || 0,
            })),
          );
        } else {
          for (let row = 1; row <= rowCounts[floorIndex]; row += 1) {
            for (let seatIndex = 0; seatIndex < 4; seatIndex += 1) {
              const label = positionLabel(row, seatIndex);

              positions.push({
                floor_floor_id: floor.floor_id,
                row_number: row,
                seat_index: seatIndex,
                label,
                x: [0, 1, 3, 4][seatIndex],
                y: row - 1,
                width: 1,
                height: 1,
                rotation: 0,
              });
            }
          }
        }

        await tx.camp_bus_position.createMany({ data: positions });

        if ((templateFloor as any)?.elements?.length) {
          await tx.camp_bus_layout_element.createMany({
            data: (templateFloor as any).elements.map((element: any) => ({
              floor_floor_id: floor.floor_id,
              type: element.type,
              x: element.x,
              y: element.y,
              width: element.width,
              height: element.height,
              rotation: element.rotation,
              label: element.label,
              z_index: element.zIndex,
              metadata: element.metadata || undefined,
            })),
          });
        }
      }

      await tx.camp_bus_student.createMany({
        data: selectedEnrollmentIds.map((studentEnrollmentId) => ({
          bus_bus_id: createdBus.bus_id,
          student_enrollment_id: studentEnrollmentId,
        })),
      });

      return createdBus;
    })
    .catch((error: any) => {
      if (
        error?.message === "INVALID_STUDENT_SELECTION" ||
        error?.code === "P2002"
      ) {
        return null;
      }
      if (error?.message === "BUS_CAPACITY_EXCEEDED") {
        return undefined;
      }
      throw error;
    });

  if (bus === null) {
    return NextResponse.json(
      { error: "มีนักเรียนบางคนอยู่ในรถคันอื่นแล้ว กรุณาโหลดข้อมูลใหม่" },
      { status: 409 },
    );
  }
  if (bus === undefined) {
    return NextResponse.json(
      { error: `เลือกนักเรียนเกินความจุรถ ${capacity} ที่` },
      { status: 400 },
    );
  }

  return NextResponse.json(
    { busId: bus.bus_id, message: "สร้างรถและผังตำแหน่งเรียบร้อยแล้ว" },
    { status: 201 },
  );
}
