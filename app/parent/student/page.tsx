import { redirect } from "next/navigation";

import { getParentSession } from "@/lib/parent-auth";
import { prisma } from "@/lib/db";

export default async function LegacyParentStudentPage() {
  const session = await getParentSession();
  if (!session) redirect("/login");
  const student = await prisma.students.findUnique({ where: { students_id: session.studentId }, select: { public_id: true } });
  if (!student) redirect("/parent/family");
  redirect(`/parent/children/${student.public_id}/profile`);
}
