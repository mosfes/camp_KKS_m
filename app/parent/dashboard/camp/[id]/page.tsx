import { redirect } from "next/navigation";

import { getParentSession } from "@/lib/parent-auth";

export default async function LegacyParentCampPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getParentSession();
  if (!session) redirect("/login");
  const { id } = await params;
  redirect(`/parent/children/${session.studentId}/camps/${id}`);
}
