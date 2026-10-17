import { notFound, redirect } from "next/navigation";

import { getParentSession } from "@/lib/parent-auth";
import { canParentViewStudent } from "@/lib/parent-student-access";

export default async function ParentChildLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ studentId: string }>;
}) {
  const session = await getParentSession();
  if (!session) redirect("/login");
  if (session.mustChangePassword) redirect("/parent/change-password");

  const studentId = Number((await params).studentId);
  if (!(await canParentViewStudent(session, studentId))) notFound();

  return children;
}
