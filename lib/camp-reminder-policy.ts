// Ids of the original fixed reminders. Admin-added reminders get their own ids;
// these stay reserved so earlier queue rows remain idempotent.
export const JOIN_REMINDER_TYPE = "JOIN_CAMP" as const;
export const STARTING_REMINDER_TYPE = "STARTING_SOON" as const;
export const TOMORROW_REMINDER_TYPE = "STARTING_TOMORROW" as const;
export const JOIN_DAYS_BEFORE = 7;
export const STARTING_DAYS_BEFORE = 3;
export const TOMORROW_DAYS_BEFORE = 1;
export const DEFAULT_SEND_HOUR = 7;

/** Days before the camp start, keyed by the id of each enabled reminder. */
export type ReminderSchedule = Record<string, number>;

export function addDateKeyDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00.000Z`);

  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

/**
 * Latest camp start date whose reminder is already due. A reminder becomes
 * due at `sendHour` (Bangkok) on the day `daysBefore` days before the camp, so
 * before that hour today only earlier camps qualify.
 */
export function reminderWindowEndKey(
  todayKey: string,
  daysBefore: number,
  currentHour: number = 24,
  sendHour: number = DEFAULT_SEND_HOUR,
): string {
  return addDateKeyDays(
    todayKey,
    currentHour >= sendHour ? daysBefore : daysBefore - 1,
  );
}

/**
 * Returns the ids of reminders due in the catch-up window. Camps must still be
 * in the future; each returned id is made idempotent by the queue's unique key.
 * A missed run is caught up on a later day regardless of the send hour.
 */
export function dueReminderTypes(
  todayKey: string,
  campStartDateKey: string,
  schedule: ReminderSchedule,
  currentHour: number = 24,
  sendHour: number = DEFAULT_SEND_HOUR,
): string[] {
  const tomorrowKey = addDateKeyDays(todayKey, 1);

  if (campStartDateKey < tomorrowKey) return [];

  return Object.entries(schedule)
    .filter(
      ([, daysBefore]) =>
        campStartDateKey <=
        reminderWindowEndKey(todayKey, daysBefore, currentHour, sendHour),
    )
    .map(([id]) => id);
}
