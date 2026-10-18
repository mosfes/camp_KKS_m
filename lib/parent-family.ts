import { prisma } from "@/lib/db";
import { expireParentLinkRequests } from "@/lib/parent-link-requests";
import type { ParentSession } from "@/lib/parent-auth";
import type {
  LinkedStudent,
  ParentLinkRequest,
} from "@/app/parent/dashboard/ParentStudentPicker";

export async function getParentFamilyData(session: ParentSession): Promise<{
  students: LinkedStudent[];
  requests: ParentLinkRequest[];
}> {
  await expireParentLinkRequests();

  const [links, requests] = await Promise.all([
    prisma.parent_student_links.findMany({
      where: { parents_id: session.parentId },
      select: { students_id: true },
    }),
    prisma.parent_student_link_requests.findMany({
      where: {
        parents_id: session.parentId,
        status: { not: "APPROVED" },
        dismissed_at: null,
      },
      select: {
        students_id: true,
        status: true,
        requested_at: true,
        expires_at: true,
      },
      orderBy: { requested_at: "desc" },
      take: 20,
    }),
  ]);

  const students = await prisma.students.findMany({
    where: {
      students_id: {
        in: [session.primaryStudentId, ...links.map((link) => link.students_id)],
      },
      deletedAt: null,
    },
    select: {
      students_id: true,
      public_id: true,
      prefix_name: true,
      firstname: true,
      lastname: true,
      nickname: true,
      profile_image_url: true,
      classroom_students: {
        orderBy: { classroom: { academic_years_years_id: "desc" } },
        take: 1,
        select: {
          classroom: {
            select: {
              grade: true,
              classroom_types: { select: { name: true } },
            },
          },
        },
      },
    },
    orderBy: { students_id: "asc" },
  });

  return {
    students,
    requests: requests.map((request) => ({
      students_id: request.students_id,
      status: request.status as ParentLinkRequest["status"],
      requested_at: request.requested_at.toISOString(),
      expires_at: request.expires_at.toISOString(),
    })),
  };
}
