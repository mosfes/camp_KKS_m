import { activeCampStudentWhere } from "@/lib/active-camp-student";

/**
 * Match the student's explicit bus assignment for a camp.
 *
 * A bus can contain students from another classroom when teachers build a
 * custom layout, so the assignment must not be filtered by the bus's owner
 * classroom. The enrollment itself remains the source of student and camp
 * authorization.
 */
export function studentCampBusAssignmentWhere(
  campId: number,
  studentId: number,
) {
  return {
    student_enrollment: {
      camp_camp_id: campId,
      student_students_id: studentId,
      enrolled_at: { not: null },
      student: activeCampStudentWhere(campId),
    },
    bus: { camp_camp_id: campId },
  };
}
