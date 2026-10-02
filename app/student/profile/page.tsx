import type { ComponentProps } from "react";

import StudentProfileClient from "./StudentProfileClient";

import { getStudentProfile } from "@/lib/server-student-api";

type InitialProfile = ComponentProps<
  typeof StudentProfileClient
>["initialProfile"];

export default async function StudentProfilePage() {
  const profile = await getStudentProfile<InitialProfile>();

  return <StudentProfileClient initialProfile={profile} />;
}
