import { notFound, redirect } from "next/navigation";

import ParentCampProgressClient, {
  type CampDetail,
} from "./ParentCampProgressClient";
import { GET as getParentCamp } from "@/app/api/parent/camps/[id]/route";
import { prisma } from "@/lib/db";

export default async function ParentCampProgressPage({
  params,
}: {
  params: Promise<{ studentId: string; campId: string }>;
}) {
  const { studentId, campId } = await params;
  const [student, campResponse] = await Promise.all([
    prisma.students.findFirst({
      where: { public_id: studentId, deletedAt: null },
      select: { public_id: true, firstname: true, lastname: true },
    }),
    getParentCamp(
      new Request(
        `http://localhost/api/parent/camps/${encodeURIComponent(campId)}?studentId=${encodeURIComponent(studentId)}`,
      ),
      { params: Promise.resolve({ id: campId }) },
    ),
  ]);

  if (!student) notFound();
  if (!campResponse.ok) {
    if (campResponse.status === 403 || campResponse.status === 404) notFound();
    throw new Error(`โหลดรายละเอียดค่ายไม่สำเร็จ (HTTP ${campResponse.status})`);
  }
  const camp = (await campResponse.json()) as CampDetail;
  if (camp.publicId !== campId) {
    redirect(`/parent/children/${student.public_id}/camps/${camp.publicId}`);
  }

  return (
    <ParentCampProgressClient
      camp={camp}
      studentName={`${student.firstname} ${student.lastname}`}
      studentPublicId={student.public_id}
    />
  );
}
