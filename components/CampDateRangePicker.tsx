"use client";

import type { CalendarDate } from "@internationalized/date";

import React from "react";

import { CalendarOnlyDateRangePicker } from "@/components/CalendarOnlyDateFields";
import { parseCalendarDateRange } from "@/lib/calendar-date";

interface Props {
  "aria-label": string;
  className?: string;
  errorMessage?: string;
  isInvalid?: boolean;
  isDisabled?: boolean;
  minValue?: CalendarDate;
  maxValue?: CalendarDate;
  startDate: string;
  endDate: string;
  onChange: (startDate: string, endDate: string) => void;
}

export default function CampDateRangePicker({
  startDate,
  endDate,
  onChange,
  ...props
}: Props) {
  return (
    <CalendarOnlyDateRangePicker
      {...props}
      value={parseCalendarDateRange(startDate, endDate)}
      onChange={(range) =>
        onChange(range?.start.toString() ?? "", range?.end.toString() ?? "")
      }
    />
  );
}
