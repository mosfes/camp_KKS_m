import type { ComponentProps } from "react";

import StudentStationDetailClient from "./StudentStationDetailClient";

import { getStudentStation } from "@/lib/server-student-api";

type InitialPayload = ComponentProps<
  typeof StudentStationDetailClient
>["initialPayload"];

export default async function StudentStationDetailPage({
  params,
}: {
  params: Promise<{ id: string; stationId: string }>;
}) {
  const { id, stationId } = await params;
  const payload = await getStudentStation<InitialPayload>(id, stationId);

  return <StudentStationDetailClient initialPayload={payload} />;
}
