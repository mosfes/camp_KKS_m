import { redirect } from "next/navigation";

import ParentFamilyClient from "./ParentFamilyClient";
import { getParentSession } from "@/lib/parent-auth";
import { getParentFamilyData } from "@/lib/parent-family";

export default async function ParentFamilyPage() {
  const session = await getParentSession();
  if (!session) redirect("/login");
  if (session.mustChangePassword) redirect("/parent/change-password");

  const { students, requests } = await getParentFamilyData(session);
  return (
    <ParentFamilyClient
      initialStudents={students}
      initialRequests={requests}
    />
  );
}
