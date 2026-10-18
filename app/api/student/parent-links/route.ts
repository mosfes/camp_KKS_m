import { NextResponse } from "next/server";

import { requireStudent } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  expireParentLinkRequests,
  maskParentPhone,
} from "@/lib/parent-link-requests";

export async function GET() {
  const { student, error } = await requireStudent();

  if (error) return error;

  await expireParentLinkRequests();
  const studentId = student.students_id;
  const [pending, primaryParents, links] = await Promise.all([
    prisma.parent_student_link_requests.findMany({
      where: { students_id: studentId, status: "PENDING" },
      select: {
        request_id: true,
        requested_at: true,
        expires_at: true,
        parent: {
          select: { firstname: true, lastname: true, tel: true },
        },
      },
      orderBy: { requested_at: "desc" },
    }),
    prisma.parents.findMany({
      where: { username_student_id: studentId },
      select: { parents_id: true, firstname: true, lastname: true, tel: true },
    }),
    prisma.parent_student_links.findMany({
      where: { students_id: studentId },
      select: {
        parents_id: true,
        created_at: true,
        parent: {
          select: { firstname: true, lastname: true, tel: true },
        },
      },
      orderBy: { created_at: "desc" },
    }),
  ]);

  const primaryIds = new Set(primaryParents.map((parent) => parent.parents_id));
  const additional = links.filter((link) => !primaryIds.has(link.parents_id));
  const approvedRequests = await prisma.parent_student_link_requests.findMany({
    where: {
      students_id: studentId,
      parents_id: { in: additional.map((link) => link.parents_id) },
      status: "APPROVED",
    },
    select: { parents_id: true },
  });
  const approvedIds = new Set(
    approvedRequests.map((request) => request.parents_id),
  );

  return NextResponse.json(
    {
      pending: pending.map((request) => ({
        id: request.request_id,
        parentName:
          `${request.parent.firstname} ${request.parent.lastname}`.trim(),
        parentPhone: maskParentPhone(request.parent.tel),
        requestedAt: request.requested_at,
        expiresAt: request.expires_at,
      })),
      active: [
        ...primaryParents.map((parent) => ({
          parentId: parent.parents_id,
          parentName: `${parent.firstname} ${parent.lastname}`.trim(),
          parentPhone: maskParentPhone(parent.tel),
          source: "PRIMARY",
          revocable: false,
        })),
        ...additional.map((link) => ({
          parentId: link.parents_id,
          parentName: `${link.parent.firstname} ${link.parent.lastname}`.trim(),
          parentPhone: maskParentPhone(link.parent.tel),
          source: approvedIds.has(link.parents_id)
            ? "STUDENT_APPROVED"
            : "LEGACY",
          revocable: true,
        })),
      ],
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
