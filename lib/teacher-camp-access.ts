/** The camps a teacher can see in the dashboard or open directly. */
export function teacherCampAccessWhere(teacherId: number, role: string) {
  return {
    deletedAt: null,
    ...(role === "ADMIN"
      ? {}
      : {
          OR: [
            { created_by_teacher_id: teacherId },
            {
              teacher_enrollment: {
                some: { teacher_teachers_id: teacherId },
              },
            },
            {
              camp_bus_teacher: {
                some: { teacher_teachers_id: teacherId, removed_at: null },
              },
            },
            {
              camp_classroom: {
                some: { classroom: { teachers_teachers_id: teacherId } },
              },
            },
            {
              camp_classroom: {
                some: {
                  classroom: {
                    classroom_teacher: {
                      some: { teacher_teachers_id: teacherId },
                    },
                  },
                },
              },
            },
          ],
        }),
  };
}
