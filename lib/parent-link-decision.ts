import type { Prisma } from "@prisma/client";

export async function applyStudentParentLinkDecision(
  tx: Prisma.TransactionClient,
  {
    requestId,
    parentId,
    studentId,
    decision,
    now,
  }: {
    requestId: number;
    parentId: number;
    studentId: number;
    decision: "approve" | "reject";
    now: Date;
  },
) {
  const updated = await tx.parent_student_link_requests.updateMany({
    where: {
      request_id: requestId,
      students_id: studentId,
      status: "PENDING",
      expires_at: { gt: now },
    },
    data: {
      status: decision === "approve" ? "APPROVED" : "REJECTED",
      responded_at: now,
    },
  });

  if (updated.count !== 1) return false;

  if (decision === "approve") {
    await tx.parent_student_links.upsert({
      where: {
        parents_id_students_id: {
          parents_id: parentId,
          students_id: studentId,
        },
      },
      update: {},
      create: { parents_id: parentId, students_id: studentId },
    });
  }
  await tx.parent_student_link_events.create({
    data: {
      parents_id: parentId,
      students_id: studentId,
      action: decision === "approve" ? "APPROVED" : "REJECTED",
      actor_type: "STUDENT",
      actor_id: studentId,
    },
  });

  return true;
}
