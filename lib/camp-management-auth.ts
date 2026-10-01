import { NextResponse } from "next/server";

import { requireTeacher } from "@/lib/auth";
import { prisma } from "@/lib/db";

type ActiveTeacher = NonNullable<
  Awaited<ReturnType<typeof requireTeacher>>["teacher"]
>;

function invalidId() {
  return NextResponse.json({ error: "รหัสข้อมูลไม่ถูกต้อง" }, { status: 400 });
}

function forbidden() {
  return NextResponse.json(
    { error: "คุณไม่มีสิทธิ์จัดการข้อมูลของค่ายนี้" },
    { status: 403 },
  );
}

async function authorizeCampOwner(teacher: ActiveTeacher, campId: number) {
  const camp = await prisma.camp.findFirst({
    where: { camp_id: campId, deletedAt: null },
    select: { camp_id: true, created_by_teacher_id: true },
  });
  const isAdmin = String(teacher.role).toUpperCase() === "ADMIN";
  const isOwner = camp?.created_by_teacher_id === Number(teacher.teachers_id);

  if (!camp || (!isAdmin && !isOwner)) {
    return { campId: null, error: forbidden() };
  }

  return { campId: camp.camp_id, error: null };
}

export async function requireCampOwner(campId: number) {
  if (!Number.isInteger(campId) || campId <= 0) {
    return { teacher: null, campId: null, error: invalidId() };
  }

  const { teacher, error } = await requireTeacher();

  if (error || !teacher) return { teacher: null, campId: null, error };

  const access = await authorizeCampOwner(teacher, campId);

  return { teacher, ...access };
}

export async function requireStationOwner(stationId: number) {
  if (!Number.isInteger(stationId) || stationId <= 0) {
    return { teacher: null, campId: null, error: invalidId() };
  }

  const { teacher, error } = await requireTeacher();

  if (error || !teacher) return { teacher: null, campId: null, error };

  const station = await prisma.station.findFirst({
    where: { station_id: stationId, deletedAt: null },
    select: { camp_camp_id: true },
  });

  if (!station) return { teacher, campId: null, error: forbidden() };

  const access = await authorizeCampOwner(teacher, station.camp_camp_id);

  return { teacher, ...access };
}

export async function requireMissionOwner(missionId: number) {
  if (!Number.isInteger(missionId) || missionId <= 0) {
    return { teacher: null, campId: null, error: invalidId() };
  }

  const { teacher, error } = await requireTeacher();

  if (error || !teacher) return { teacher: null, campId: null, error };

  const mission = await prisma.mission.findFirst({
    where: { mission_id: missionId, deletedAt: null },
    select: { station: { select: { camp_camp_id: true } } },
  });

  if (!mission) return { teacher, campId: null, error: forbidden() };

  const access = await authorizeCampOwner(
    teacher,
    mission.station.camp_camp_id,
  );

  return { teacher, ...access };
}

export async function requireCampTemplateOwner(templateId: number) {
  if (!Number.isInteger(templateId) || templateId <= 0) {
    return { teacher: null, campId: null, error: invalidId() };
  }

  const { teacher, error } = await requireTeacher();

  if (error || !teacher) return { teacher: null, campId: null, error };

  const template = await prisma.camp_template.findUnique({
    where: { camp_template_id: templateId },
    select: { camp_camp_id: true },
  });

  if (!template) return { teacher, campId: null, error: forbidden() };

  const access = await authorizeCampOwner(teacher, template.camp_camp_id);

  return { teacher, ...access };
}
