import { getBangkokDateKey } from "@/lib/bangkok-date";
import { getCampFormDayCount } from "@/lib/camp-form-date";

function dateKey(value: Date | string) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : getBangkokDateKey(value);
}

export function getCampDayCount(
  startDate: Date | string,
  endDate: Date | string,
) {
  return getCampFormDayCount(dateKey(startDate), dateKey(endDate));
}

export function isCampScheduleDayInRange(
  day: number,
  startDate: Date | string,
  endDate: Date | string,
) {
  return (
    Number.isInteger(day) &&
    day >= 1 &&
    day <= getCampDayCount(startDate, endDate)
  );
}

export function isCampScheduleInRange(
  days: Array<{ day: number }>,
  startDate: Date | string,
  endDate: Date | string,
) {
  const seen = new Set<number>();

  return (
    getCampDayCount(startDate, endDate) > 0 &&
    days.every(({ day }) => {
      if (!isCampScheduleDayInRange(day, startDate, endDate) || seen.has(day)) {
        return false;
      }

      seen.add(day);
      return true;
    })
  );
}
