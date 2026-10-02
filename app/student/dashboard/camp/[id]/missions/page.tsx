import type { ComponentProps } from "react";

import StudentMissionsClient from "./StudentMissionsClient";

import { getStudentMissions } from "@/lib/server-student-api";

type InitialCamp = ComponentProps<typeof StudentMissionsClient>["initialCamp"];

export default async function StudentMissionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const camp = await getStudentMissions<InitialCamp>(id);

  return <StudentMissionsClient initialCamp={camp} />;
}
