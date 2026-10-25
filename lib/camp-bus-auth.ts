import { NextResponse } from "next/server";

import { requireTeacher } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isBangkokDateBefore } from "@/lib/bangkok-date";

export type CampBusPermissionAction =
  | "view"
  | "operate"
  | "configure"
  | "manage-teachers";

export async function requireCampBusPermission(
  campId: number,
  classroomId?: number,
  action: CampBusPermissionAction = "configure",
) {
  const { teacher, error } = await requireTeacher();

  if (error || !teacher) return { teacher: null, camp: null, error };

  const teacherId = Number(teacher.teachers_id);
  const role = String(teacher.role || "TEACHER").toUpperCase();
  const camp = await prisma.camp.findFirst({
    where: { camp_id: campId, deletedAt: null },
    select: {
      camp_id: true,
      created_by_teacher_id: true,
      end_date: true,
      camp_classroom: {
        select: {
          classroom_classroom_id: true,
          classroom: {
            select: {
              teachers_teachers_id: true,
              classroom_teacher: {
                select: { teacher_teachers_id: true },
              },
            },
          },
        },
      },
      camp_bus: {
        select: {
          bus_id: true,
          classroom_classroom_id: true,
          teacher_assignments: {
            where: {
              teacher_teachers_id: teacherId,
              removed_at: null,
            },
            select: { assignment_id: true },
          },
        },
      },
    },
  });

  if (!camp) {
    return {
      teacher: null,
      camp: null,
      error: NextResponse.json({ error: "ไม่พบค่าย" }, { status: 404 }),
    };
  }

  const canManageAll =
    role === "ADMIN" ||
    role === "CAMP_LEADER" ||
    camp.created_by_teacher_id === teacherId;
  const canManageTeachers =
    role === "ADMIN" || camp.created_by_teacher_id === teacherId;

  const managedClassroomIds = camp.camp_classroom
    .filter(
      (item) =>
        item.classroom.teachers_teachers_id === teacherId ||
        item.classroom.classroom_teacher.some(
          (ct) => ct.teacher_teachers_id === teacherId,
        ),
    )
    .map((item) => item.classroom_classroom_id);

  const configurableClassroomIds = canManageAll
    ? camp.camp_classroom.map((item) => item.classroom_classroom_id)
    : managedClassroomIds;
  const teacherBusIds = camp.camp_bus
    .filter((bus) => bus.teacher_assignments.length > 0)
    .map((bus) => bus.bus_id);
  const teacherBusClassroomIds = camp.camp_bus
    .filter((bus) => bus.teacher_assignments.length > 0)
    .map((bus) => bus.classroom_classroom_id);
  const viewableClassroomIds = Array.from(
    new Set([...configurableClassroomIds, ...teacherBusClassroomIds]),
  );

  if (classroomId !== undefined) {
    const classroomBelongsToCamp = camp.camp_classroom.some(
      (item) => item.classroom_classroom_id === classroomId,
    );

    if (!classroomBelongsToCamp) {
      return {
        teacher: null,
        camp: null,
        error: NextResponse.json(
          { error: "ห้องเรียนนี้ไม่ได้อยู่ในค่าย" },
          { status: 400 },
        ),
      };
    }

    const hasPermission =
      action === "manage-teachers"
        ? canManageTeachers
        : action === "configure"
          ? configurableClassroomIds.includes(classroomId)
          : viewableClassroomIds.includes(classroomId);

    if (!hasPermission) {
      return {
        teacher: null,
        camp: null,
        error: NextResponse.json(
          {
            error:
              action === "view"
                ? "คุณไม่มีสิทธิ์ดูรถคันนี้"
                : "คุณไม่มีสิทธิ์จัดการรถคันนี้",
          },
          { status: 403 },
        ),
      };
    }
  }

  if (
    isBangkokDateBefore(camp.end_date) &&
    (action === "configure" || action === "manage-teachers")
  ) {
    return {
      teacher: null,
      camp: null,
      error: NextResponse.json(
        { error: "ค่ายสิ้นสุดแล้ว ไม่สามารถแก้ไขข้อมูลรถได้" },
        { status: 409 },
      ),
    };
  }

  return {
    teacher,
    camp,
    error: null,
    canManageAll,
    canManageTeachers,
    classroomIds:
      action === "configure"
        ? configurableClassroomIds
        : action === "manage-teachers"
          ? canManageTeachers
            ? camp.camp_classroom.map((item) => item.classroom_classroom_id)
            : []
          : viewableClassroomIds,
    configurableClassroomIds,
    teacherBusIds,
  };
}

export async function requireSpecificCampBus(
  campId: number,
  busId: number,
  action: CampBusPermissionAction = "configure",
) {
  const bus = await prisma.camp_bus.findFirst({
    where: { bus_id: busId, camp_camp_id: campId },
    select: { bus_id: true, classroom_classroom_id: true },
  });

  if (!bus) {
    return {
      bus: null,
      permission: null,
      error: NextResponse.json({ error: "ไม่พบรถของค่ายนี้" }, { status: 404 }),
    };
  }

  const permission = await requireCampBusPermission(
    campId,
    bus.classroom_classroom_id,
    action,
  );

  return { bus, permission, error: permission.error };
}
