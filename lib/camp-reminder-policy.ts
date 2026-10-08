export const JOIN_REMINDER_TYPE = "JOIN_CAMP" as const;
export const STARTING_REMINDER_TYPE = "STARTING_SOON" as const;
export const TOMORROW_REMINDER_TYPE = "STARTING_TOMORROW" as const;
export const JOIN_DAYS_BEFORE = 7;
export const STARTING_DAYS_BEFORE = 3;
export const TOMORROW_DAYS_BEFORE = 1;

export type ReminderType =
  | typeof JOIN_REMINDER_TYPE
  | typeof STARTING_REMINDER_TYPE
  | typeof TOMORROW_REMINDER_TYPE;

export function addDateKeyDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00.000Z`);

  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

/**
 * Returns reminders due in the catch-up window. Camps must still be in the
 * future; each returned type is made idempotent by the queue's unique key.
 */
export function dueReminderTypes(
  todayKey: string,
  campStartDateKey: string,
): ReminderType[] {
  const tomorrowKey = addDateKeyDays(todayKey, 1);
  const joinDeadlineKey = addDateKeyDays(todayKey, JOIN_DAYS_BEFORE);
  const startingDeadlineKey = addDateKeyDays(todayKey, STARTING_DAYS_BEFORE);
  const tomorrowDeadlineKey = addDateKeyDays(todayKey, TOMORROW_DAYS_BEFORE);

  if (campStartDateKey < tomorrowKey || campStartDateKey > joinDeadlineKey) {
    return [];
  }

  if (campStartDateKey <= tomorrowDeadlineKey) {
    return [
      JOIN_REMINDER_TYPE,
      STARTING_REMINDER_TYPE,
      TOMORROW_REMINDER_TYPE,
    ];
  }

  return campStartDateKey <= startingDeadlineKey
    ? [JOIN_REMINDER_TYPE, STARTING_REMINDER_TYPE]
    : [JOIN_REMINDER_TYPE];
}
