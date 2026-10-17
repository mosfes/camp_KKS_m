import "server-only";

import { prisma } from "@/lib/db";

const positiveInteger = /^[1-9]\d*$/;

export async function resolveStudentCampId(
  value: string,
): Promise<number | null> {
  if (positiveInteger.test(value)) {
    const id = Number(value);

    return Number.isSafeInteger(id) ? id : null;
  }
  const camp = await prisma.camp.findUnique({
    where: { public_id: value },
    select: { camp_id: true },
  });

  return camp?.camp_id ?? null;
}

export async function resolveStudentStationId(
  value: string,
): Promise<number | null> {
  if (positiveInteger.test(value)) {
    const id = Number(value);

    return Number.isSafeInteger(id) ? id : null;
  }
  const station = await prisma.station.findUnique({
    where: { public_id: value },
    select: { station_id: true },
  });

  return station?.station_id ?? null;
}
