import type { ComponentProps } from "react";

import { redirect } from "next/navigation";

import StudentBusCheckinClient from "./StudentBusCheckinClient";

import { getStudentCampBus } from "@/lib/server-student-api";
import { prisma } from "@/lib/db";

type InitialData = ComponentProps<
  typeof StudentBusCheckinClient
>["initialData"];

export default async function StudentBusCheckinPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getStudentCampBus<InitialData>(id);

  if (data && /^[1-9]\d*$/.test(id)) {
    const camp = await prisma.camp.findUnique({
      where: { camp_id: Number(id) },
      select: { public_id: true },
    });

    if (camp) redirect(`/student/dashboard/camp/${camp.public_id}/bus`);
  }

  return <StudentBusCheckinClient initialData={data} />;
}
