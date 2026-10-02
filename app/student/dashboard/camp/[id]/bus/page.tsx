import type { ComponentProps } from "react";

import StudentBusCheckinClient from "./StudentBusCheckinClient";

import { getStudentCampBus } from "@/lib/server-student-api";

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

  return <StudentBusCheckinClient initialData={data} />;
}
