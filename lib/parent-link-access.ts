import { prisma } from "@/lib/db";

export async function revokeAdditionalParentLink({
  parentId,
  studentId,
  actorType,
  actorId,
}: {
  parentId: number;
  studentId: number;
  actorType: "ADMIN";
  actorId: number;
}): Promise<"revoked" | "missing" | "primary"> {
  const primary = await prisma.parents.findFirst({
    where: { parents_id: parentId, username_student_id: studentId },
    select: { parents_id: true },
  });

  if (primary) return "primary";

  return prisma.$transaction(async (tx) => {
    const deleted = await tx.parent_student_links.deleteMany({
      where: { parents_id: parentId, students_id: studentId },
    });

    if (deleted.count === 0) return "missing";

    await tx.parent_student_link_requests.updateMany({
      where: {
        parents_id: parentId,
        students_id: studentId,
        status: "APPROVED",
      },
      data: { status: "REVOKED", responded_at: new Date() },
    });
    await tx.parent_student_link_events.create({
      data: {
        parents_id: parentId,
        students_id: studentId,
        action: "REVOKED",
        actor_type: actorType,
        actor_id: actorId,
      },
    });

    return "revoked";
  });
}

/** A direct link is the parent account's login identity, so revoking it removes
 * that account and all of its access. The tombstone prevents legacy login from
 * silently recreating it with the predictable initial password. */
export async function deletePrimaryParentAccount({
  parentId,
  studentId,
  actorId,
}: {
  parentId: number;
  studentId: number;
  actorId: number;
}): Promise<"deleted" | "missing"> {
  return prisma.$transaction(async (tx) => {
    const account = await tx.parents.findFirst({
      where: { parents_id: parentId, username_student_id: studentId },
      select: { parents_id: true, account_no: true },
    });

    if (!account) return "missing";

    const linkedStudents = await tx.parent_student_links.findMany({
      where: { parents_id: parentId },
      select: { students_id: true },
    });

    // Only the first account can be recreated by the default login, so only
    // deleting it needs a tombstone. Extra accounts are created by an admin.
    if (account.account_no === 1) {
      await tx.parent_account_tombstones.upsert({
        where: { students_id: studentId },
        create: { students_id: studentId, deleted_parent_id: parentId },
        update: { deleted_parent_id: parentId, deleted_at: new Date() },
      });
    }
    await tx.parent_auth_tokens.deleteMany({ where: { parents_id: parentId } });
    await tx.parent_student_link_requests.deleteMany({
      where: { parents_id: parentId },
    });
    await tx.parent_student_links.deleteMany({
      where: { parents_id: parentId },
    });
    await tx.parents.delete({ where: { parents_id: parentId } });

    await tx.parent_student_link_events.createMany({
      data: [
        {
          parents_id: parentId,
          students_id: studentId,
          action: "ACCOUNT_DELETED",
          actor_type: "ADMIN",
          actor_id: actorId,
        },
        ...linkedStudents
          .filter((link) => link.students_id !== studentId)
          .map((link) => ({
            parents_id: parentId,
            students_id: link.students_id,
            action: "REVOKED",
            actor_type: "ADMIN",
            actor_id: actorId,
          })),
      ],
    });

    return "deleted";
  });
}
