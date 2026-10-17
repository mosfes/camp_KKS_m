import type { ComponentProps } from "react";

import { redirect } from "next/navigation";

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

  if (camp?.publicId && id !== camp.publicId) {
    redirect(`/student/dashboard/camp/${camp.publicId}`);
  }

  return <StudentCampDetailClient initialCamp={camp} />;
}
