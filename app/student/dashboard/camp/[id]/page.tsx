import type { ComponentProps } from "react";

import StudentCampDetailClient from "./StudentCampDetailClient";

import { getStudentCamp } from "@/lib/server-student-api";

type InitialCamp = ComponentProps<
  typeof StudentCampDetailClient
>["initialCamp"];

export default async function StudentCampDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const camp = await getStudentCamp<InitialCamp>(id);

  return <StudentCampDetailClient initialCamp={camp} />;
}
