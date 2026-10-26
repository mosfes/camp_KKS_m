"use client";

import type { CalendarDate } from "@internationalized/date";
import type { CalendarDateRange } from "@/lib/calendar-date";

import React, { useId, useState, type ReactNode } from "react";
import { Calendar, RangeCalendar } from "@heroui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@heroui/popover";
import { CalendarDays, X } from "lucide-react";

const formatter = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Bangkok",
});

function formatDate(date: CalendarDate) {
  return formatter.format(date.toDate("Asia/Bangkok"));
}

interface CommonProps {
  "aria-label": string;
  className?: string;
  isDisabled?: boolean;
  isInvalid?: boolean;
  errorMessage?: string;
  minValue?: CalendarDate;
  maxValue?: CalendarDate;
  showMonthAndYearPickers?: boolean;
}

export interface CalendarOnlyDateRangePickerProps extends CommonProps {
  value: CalendarDateRange | null;
  onChange: (value: CalendarDateRange | null) => void;
}

interface DateProps extends CommonProps {
  value: CalendarDate | null;
  onChange: (value: CalendarDate | null) => void;
}

function CalendarFieldShell({
  label,
  display,
  className,
  isDisabled,
  isInvalid,
  errorMessage,
  onClear,
  children,
  isOpen,
  onOpenChange,
}: {
  label: string;
  display: string;
  className?: string;
  isDisabled?: boolean;
  isInvalid?: boolean;
  errorMessage?: string;
  onClear: () => void;
  children: ReactNode;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const errorId = useId();

  return (
    <div className={className}>
      <div
        className="flex min-h-12 items-center rounded-xl border border-gray-300 bg-white shadow-sm focus-within:border-[#6b857a] focus-within:ring-2 focus-within:ring-[#6b857a]/20"
        style={isInvalid ? { borderColor: "#ef4444" } : undefined}
      >
        <Popover
          isOpen={isOpen}
          placement="bottom-start"
          onOpenChange={onOpenChange}
        >
          <PopoverTrigger>
            <button
              aria-describedby={isInvalid && errorMessage ? errorId : undefined}
              aria-expanded={isOpen}
              aria-haspopup="dialog"
              aria-label={label}
              className="flex min-h-12 min-w-0 flex-1 items-center gap-2 px-3 text-left text-sm text-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isDisabled}
              type="button"
            >
              <span className="min-w-0 flex-1 truncate">{display}</span>
              <CalendarDays
                aria-hidden="true"
                className="shrink-0 text-gray-500"
                size={18}
              />
            </button>
          </PopoverTrigger>
          <PopoverContent className="p-1">{children}</PopoverContent>
        </Popover>
        {display !== "เลือกวันที่" &&
          display !== "เลือกช่วงวันที่" &&
          !isDisabled && (
            <button
              aria-label={`ล้าง${label}`}
              className="mr-2 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              type="button"
              onClick={onClear}
            >
              <X aria-hidden="true" size={15} />
            </button>
          )}
      </div>
      {isInvalid && errorMessage && (
        <p className="mt-1 text-xs text-red-600" id={errorId} role="alert">
          {errorMessage}
        </p>
      )}
    </div>
  );
}

export function CalendarOnlyDateRangePicker({
  value,
  onChange,
  minValue,
  maxValue,
  showMonthAndYearPickers = true,
  ...props
}: CalendarOnlyDateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <CalendarFieldShell
      display={
        value
          ? `${formatDate(value.start)} – ${formatDate(value.end)}`
          : "เลือกช่วงวันที่"
      }
      isOpen={isOpen}
      label={props["aria-label"]}
      onClear={() => onChange(null)}
      onOpenChange={setIsOpen}
      {...props}
    >
      <RangeCalendar
        aria-label={props["aria-label"]}
        maxValue={maxValue}
        minValue={minValue}
        showMonthAndYearPickers={showMonthAndYearPickers}
        value={value}
        onChange={(range) => {
          onChange(range);
          setIsOpen(false);
        }}
      />
    </CalendarFieldShell>
  );
}

export function CalendarOnlyDatePicker({
  value,
  onChange,
  minValue,
  maxValue,
  showMonthAndYearPickers = true,
  ...props
}: DateProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <CalendarFieldShell
      display={value ? formatDate(value) : "เลือกวันที่"}
      isOpen={isOpen}
      label={props["aria-label"]}
      onClear={() => onChange(null)}
      onOpenChange={setIsOpen}
      {...props}
    >
      <Calendar
        aria-label={props["aria-label"]}
        maxValue={maxValue}
        minValue={minValue}
        showMonthAndYearPickers={showMonthAndYearPickers}
        value={value}
        onChange={(date) => {
          onChange(date);
          setIsOpen(false);
        }}
      />
    </CalendarFieldShell>
  );
}
