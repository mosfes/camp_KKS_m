type DatabaseClient = {
  classroom_students: {
    findMany: (args: any) => Promise<any[]>;
  };
};

export async function buildEnrollmentSnapshotMap(
  db: DatabaseClient,
  campId: number,
  studentIds: number[],
) {
  const uniqueStudentIds = Array.from(new Set(studentIds));

  if (uniqueStudentIds.length === 0)
    return new Map<number, Record<string, unknown>>();

  const memberships = await db.classroom_students.findMany({
    where: {
      student_students_id: { in: uniqueStudentIds },
      classroom: {
        deletedAt: null,
        camp_classroom: { some: { camp_camp_id: campId } },
      },
    },
    include: {
      student: {
        select: {
          prefix_name: true,
          firstname: true,
          lastname: true,
        },
      },
      classroom: {
        include: { classroom_types: true },
      },
    },
    orderBy: { classroom_classroom_id: "asc" },
  });

  const snapshots = new Map<number, Record<string, unknown>>();

  for (const membership of memberships) {
    if (snapshots.has(membership.student_students_id)) continue;
    const student = membership.student;

    snapshots.set(membership.student_students_id, {
      classroom_classroom_id: membership.classroom_classroom_id,
      academic_year_snapshot: membership.classroom.academic_years_years_id,
      grade_snapshot: membership.classroom.grade,
      classroom_name_snapshot: membership.classroom.classroom_types.name,
      student_name_snapshot:
        `${student.prefix_name ?? ""}${student.firstname} ${student.lastname}`.trim(),
    });
  }

  return snapshots;
}

export async function buildEnrollmentSnapshot(
  db: DatabaseClient,
  campId: number,
  studentId: number,
) {
  const snapshots = await buildEnrollmentSnapshotMap(db, campId, [studentId]);

  return snapshots.get(studentId) ?? {};
}
