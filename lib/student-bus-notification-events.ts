import type { BusReminderAction } from "@/lib/camp-bus-reminder";

export const STUDENT_BUS_ACTION_COMPLETED_EVENT =
  "kks:student-bus-action-completed";

export type StudentBusActionCompletedDetail = {
  campId: number;
  action: BusReminderAction;
};

export function dispatchStudentBusActionCompleted(
  campId: string | number,
  action: BusReminderAction,
) {
  if (typeof window === "undefined") return;

  const normalizedCampId = Number(campId);

  if (!Number.isInteger(normalizedCampId) || normalizedCampId <= 0) return;

  window.dispatchEvent(
    new CustomEvent<StudentBusActionCompletedDetail>(
      STUDENT_BUS_ACTION_COMPLETED_EVENT,
      { detail: { campId: normalizedCampId, action } },
    ),
  );
}
