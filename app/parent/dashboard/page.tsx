import { redirect } from "next/navigation";

import { getParentSession } from "@/lib/parent-auth";

export default async function ParentDashboardEntry() {
  const session = await getParentSession();
  if (!session) redirect("/login");
  if (session.mustChangePassword) redirect("/parent/change-password");

  redirect("/parent/family");
}
