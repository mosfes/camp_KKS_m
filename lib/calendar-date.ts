import { parseDate, type CalendarDate } from "@internationalized/date";

export type CalendarDateRange = { start: CalendarDate; end: CalendarDate };

export function parseCalendarDate(
  value: string | null | undefined,
): CalendarDate | null {
  const date = value?.split("T")[0];

  if (!date || !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(date)) return null;

  try {
    const parsed = parseDate(date);

    return parsed.toString() === date ? parsed : null;
  } catch {
    return null;
  }
}

export function parseCalendarDateRange(
  start: string | null | undefined,
  end: string | null | undefined,
): CalendarDateRange | null {
  const startDate = parseCalendarDate(start);
  const endDate = parseCalendarDate(end);

  return startDate && endDate ? { start: startDate, end: endDate } : null;
}

const thaiMonths = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];

const thaiFullDate = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Asia/Bangkok",
});

export function parseDocumentDuration(
  value: string | null | undefined,
): CalendarDateRange | null {
  if (!value) return null;

  const match = value
    .trim()
    .match(
      /^(?:ระหว่างวันที่\s*)?(\d{1,2})\s+([ก-๙]+)\s+(\d{4})\s*(?:ถึง|[-–—])\s*(?:วันที่\s*)?(\d{1,2})\s+([ก-๙]+)\s+(\d{4})$/,
    );

  if (!match) return null;

  const parsePart = (day: string, month: string, year: string) => {
    const monthNumber = thaiMonths.indexOf(month) + 1;
    const gregorianYear =
      Number(year) >= 2400 ? Number(year) - 543 : Number(year);

    return monthNumber
      ? parseCalendarDate(
          `${gregorianYear}-${String(monthNumber).padStart(2, "0")}-${day.padStart(2, "0")}`,
        )
      : null;
  };

  const start = parsePart(match[1], match[2], match[3]);
  const end = parsePart(match[4], match[5], match[6]);

  return start && end && start.compare(end) <= 0 ? { start, end } : null;
}

export function formatDocumentDuration(range: CalendarDateRange): string {
  const format = (date: CalendarDate) =>
    thaiFullDate.format(date.toDate("Asia/Bangkok"));

  return `ระหว่างวันที่ ${format(range.start)} ถึง ${format(range.end)}`;
}
