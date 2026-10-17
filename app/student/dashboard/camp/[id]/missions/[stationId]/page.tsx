import type { ComponentProps } from "react";

import { redirect } from "next/navigation";

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

  if (
    payload?.camp?.publicId &&
    payload?.station?.publicId &&
    (id !== payload.camp.publicId || stationId !== payload.station.publicId)
  ) {
    redirect(
      `/student/dashboard/camp/${payload.camp.publicId}/missions/${payload.station.publicId}`,
    );
  }

  return <StudentStationDetailClient initialPayload={payload} />;
}
