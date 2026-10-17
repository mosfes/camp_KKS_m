"use client";

import type { CalendarDate } from "@internationalized/date";
import { DateRangePicker, type DateRangePickerProps } from "@heroui/date-picker";

export default function DocumentDateRangePicker(
  props: DateRangePickerProps<CalendarDate>,
) {
  return <DateRangePicker {...props} />;
}
