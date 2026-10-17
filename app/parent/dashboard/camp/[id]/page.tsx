import { notFound, redirect } from "next/navigation";

import { getParentSession } from "@/lib/parent-auth";
import { prisma } from "@/lib/db";

export default async function LegacyParentCampPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getParentSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const [student, camp] = await Promise.all([
    prisma.students.findUnique({ where: { students_id: session.studentId }, select: { public_id: true } }),
    prisma.camp.findFirst({
      where: {
        ...(/^[1-9]\d*$/.test(id) ? { camp_id: Number(id) } : { public_id: id }),
        deletedAt: null,
        student_enrollment: {
          some: { student_students_id: session.studentId, enrolled_at: { not: null } },
        },
      },
      select: { public_id: true },
    }),
  ]);
  if (!student || !camp) notFound();
  redirect(`/parent/children/${student.public_id}/camps/${camp.public_id}`);
}
