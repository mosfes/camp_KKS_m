export const BANGKOK_TIME_ZONE = "Asia/Bangkok";

type DateInput = Date | string | number;

export function getBangkokDateKey(input: DateInput = new Date()): string {
  const date = input instanceof Date ? input : new Date(input);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BANGKOK_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

export function getBangkokHour(input: DateInput = new Date()): number {
  const date = input instanceof Date ? input : new Date(input);
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: BANGKOK_TIME_ZONE,
    hour: "2-digit",
    hourCycle: "h23",
  }).format(date);

  return Number(hour) % 24;
}

export function isBangkokDateBefore(
  input: DateInput,
  comparedTo: DateInput = new Date(),
): boolean {
  return getBangkokDateKey(input) < getBangkokDateKey(comparedTo);
}

export function isBangkokDateInRange(
  startDate?: DateInput | null,
  endDate?: DateInput | null,
  currentDate: DateInput = new Date(),
): boolean {
  const current = getBangkokDateKey(currentDate);

  return (
    (!startDate || getBangkokDateKey(startDate) <= current) &&
    (!endDate || current <= getBangkokDateKey(endDate))
  );
}

export function getBangkokDateAsUtcMidnight(
  input: DateInput = new Date(),
): Date {
  return new Date(`${getBangkokDateKey(input)}T00:00:00.000Z`);
}

export function getBangkokDaysUntil(
  input: DateInput,
  currentDate: DateInput = new Date(),
): number {
  const target = getBangkokDateAsUtcMidnight(input);
  const current = getBangkokDateAsUtcMidnight(currentDate);

  return Math.max(
    0,
    Math.round((target.getTime() - current.getTime()) / 86_400_000),
  );
}

export type CampScheduleSlotState = "past" | "current" | "upcoming";

function getBangkokTimeInMinutes(input: DateInput = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BANGKOK_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(input instanceof Date ? input : new Date(input));
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return Number(values.hour) * 60 + Number(values.minute);
}

function parseScheduleTime(time: string): number | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(time);

  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (hour > 23 || minute > 59) return null;

  return hour * 60 + minute;
}

export function getCampScheduleDateKey(
  campStartDate: DateInput,
  day: number,
): string {
  const startDateKey = getBangkokDateKey(campStartDate);
  const date = new Date(`${startDateKey}T00:00:00.000Z`);

  date.setUTCDate(date.getUTCDate() + Math.max(0, day - 1));

  return date.toISOString().slice(0, 10);
}

export function formatCampScheduleDate(
  campStartDate?: DateInput | null,
  day?: number,
  options?: Intl.DateTimeFormatOptions,
): string {
  if (!campStartDate || !day) return "";
  const startDateKey = getBangkokDateKey(campStartDate);
  const date = new Date(`${startDateKey}T00:00:00.000Z`);

  date.setUTCDate(date.getUTCDate() + Math.max(0, day - 1));

  return date.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: BANGKOK_TIME_ZONE,
    ...options,
  });
}

export function isCampScheduleDayToday(
  campStartDate: DateInput,
  day: number,
  currentDate: DateInput = new Date(),
): boolean {
  return (
    getCampScheduleDateKey(campStartDate, day) ===
    getBangkokDateKey(currentDate)
  );
}

export function getCampScheduleSlotState(
  campStartDate: DateInput,
  day: number,
  startTime: string,
  endTime: string,
  currentDate: DateInput = new Date(),
): CampScheduleSlotState {
  const scheduleDateKey = getCampScheduleDateKey(campStartDate, day);
  const currentDateKey = getBangkokDateKey(currentDate);

  if (currentDateKey < scheduleDateKey) return "upcoming";
  if (currentDateKey > scheduleDateKey) return "past";

  const startMinutes = parseScheduleTime(startTime);
  const endMinutes = parseScheduleTime(endTime);

  if (startMinutes === null || endMinutes === null) return "upcoming";

  const currentMinutes = getBangkokTimeInMinutes(currentDate);

  if (currentMinutes < startMinutes) return "upcoming";
  if (currentMinutes >= endMinutes) return "past";

  return "current";
}
