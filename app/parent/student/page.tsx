import { redirect } from "next/navigation";

import { getParentSession } from "@/lib/parent-auth";

export default async function LegacyParentStudentPage() {
  const session = await getParentSession();
  if (!session) redirect("/login");
  redirect(`/parent/children/${session.studentId}/profile`);
}
