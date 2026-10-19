"use client";

import type { CalendarDate } from "@internationalized/date";
import type { DateRangePickerProps } from "@heroui/date-picker";

import { useEffect, useMemo, useRef, useState } from "react";
import { DateRangePicker } from "@heroui/date-picker";
import { parseDate } from "@internationalized/date";

type DateRange = { start: CalendarDate; end: CalendarDate } | null;

interface Props
  extends Omit<
    DateRangePickerProps<CalendarDate>,
    "value" | "defaultValue" | "onChange" | "onBlur" | "onOpenChange"
  > {
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
  // Keep date objects stable so unrelated form renders preserve partial segments.
  const value = useMemo<DateRange>(() => {
    if (!startDate || !endDate) return null;

    return { start: parseDate(startDate), end: parseDate(endDate) };
  }, [startDate, endDate]);
  const [draft, setDraft] = useState(value);
  const draftRef = useRef(value);
  const dirtyRef = useRef(false);

  useEffect(() => {
    setDraft(value);
    draftRef.current = value;
    dirtyRef.current = false;
  }, [value]);

  const commit = () => {
    if (!dirtyRef.current) return;
    dirtyRef.current = false;

    // Use ISO serialization, including leading zeros for years typed in stages.
    onChange(
      draftRef.current?.start.toString() ?? "",
      draftRef.current?.end.toString() ?? "",
    );
  };

  return (
    <DateRangePicker
      {...props}
      value={draft}
      onBlur={commit}
      onChange={(range) => {
        draftRef.current = range;
        dirtyRef.current = true;
        setDraft(range);
      }}
      onOpenChange={(isOpen) => {
        // Calendar selections are complete; keyboard edits commit on field blur.
        if (!isOpen) commit();
      }}
    />
  );
}
