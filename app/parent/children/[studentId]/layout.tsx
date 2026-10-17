import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { getParentSession } from "@/lib/parent-auth";
import {
  canParentViewStudent,
  resolveStudentRouteId,
} from "@/lib/parent-student-access";

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

  const rawId = (await params).studentId;
  const student = await resolveStudentRouteId(rawId);
  if (!student || !(await canParentViewStudent(session, student.students_id))) {
    notFound();
  }

  const path = (await headers()).get("x-parent-route-path") || "";
  const prefix = `/parent/children/${rawId}`;
  if (path === prefix || path.startsWith(`${prefix}/`)) {
    let suffix = path.slice(prefix.length);
    let mustRedirect = rawId !== student.public_id;
    const legacyCamp = suffix.match(/^\/camps\/([1-9]\d*)(\/.*)?$/);
    if (legacyCamp) {
      const camp = await prisma.camp.findFirst({
        where: {
          camp_id: Number(legacyCamp[1]),
          deletedAt: null,
          student_enrollment: {
            some: {
              student_students_id: student.students_id,
              enrolled_at: { not: null },
            },
          },
        },
        select: { public_id: true },
      });
      if (!camp) notFound();
      suffix = `/camps/${camp.public_id}${legacyCamp[2] || ""}`;
      mustRedirect = true;
    }
    if (mustRedirect) {
      redirect(`/parent/children/${student.public_id}${suffix}`);
    }
  }

  return children;
}
