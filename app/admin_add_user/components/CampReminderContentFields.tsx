"use client";

import { useRef } from "react";
import { Checkbox, Input, Select, SelectItem, Textarea } from "@heroui/react";

import {
  MAX_DAYS_BEFORE,
  MIN_DAYS_BEFORE,
  placeholderToken,
  REMINDER_AUDIENCES,
  REMINDER_PLACEHOLDERS,
  type ReminderAudience,
  type ReminderPresetContent,
} from "@/lib/camp-reminder-config";
import { addDateKeyDays } from "@/lib/camp-reminder-policy";

type TextField = "subject" | "heading" | "body" | "action" | "buttonLabel";
export type ReminderContentValue = Omit<ReminderPresetContent, "name">;

const DAY_OPTIONS = Array.from(
  { length: MAX_DAYS_BEFORE - MIN_DAYS_BEFORE + 1 },
  (_, index) => MIN_DAYS_BEFORE + index,
);

export const SAMPLE_CAMP_START_KEY = "2026-12-15";

const FIELD_LABELS: Record<TextField, string> = {
  subject: "หัวเรื่องอีเมล (Subject)",
  heading: "หัวข้อในอีเมล",
  body: "เนื้อหา",
  action: "สิ่งที่ต้องทำ",
  buttonLabel: "ข้อความบนปุ่ม",
};

export function hourLabel(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}

export function thaiDate(dateKey: string) {
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${dateKey}T00:00:00.000Z`));
}

// HeroUI's outside label overlaps the Select trigger here, so render it apart.
export function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-sm text-foreground">{children}</span>;
}

/**
 * Recipients, schedule and email copy of one reminder. Shared by the reminder
 * cards and the template editor.
 */
export default function CampReminderContentFields({
  value,
  onChange,
  sendHour,
  isDisabled = false,
}: {
  value: ReminderContentValue;
  onChange: (patch: Partial<ReminderContentValue>) => void;
  sendHour: number;
  isDisabled?: boolean;
}) {
  const lastFocused = useRef<{
    field: TextField;
    element: HTMLInputElement | HTMLTextAreaElement;
  } | null>(null);
  const exampleSendKey = addDateKeyDays(
    SAMPLE_CAMP_START_KEY,
    -value.daysBefore,
  );

  const insertPlaceholder = (label: string) => {
    const token = placeholderToken(label);
    const target = lastFocused.current;

    // Nothing picked yet: add it to the end of the message.
    if (!target) {
      const body = value.body.trimEnd();

      onChange({ body: body ? `${body} ${token}` : token });

      return;
    }

    const current = value[target.field];
    const start = target.element.selectionStart ?? current.length;
    const end = target.element.selectionEnd ?? current.length;

    onChange({
      [target.field]: current.slice(0, start) + token + current.slice(end),
    });
    requestAnimationFrame(() => {
      target.element.focus();
      target.element.setSelectionRange(
        start + token.length,
        start + token.length,
      );
    });
  };

  const fieldProps = (field: TextField) => ({
    label: FIELD_LABELS[field],
    labelPlacement: "outside" as const,
    variant: "bordered" as const,
    value: value[field],
    onValueChange: (text: string) => onChange({ [field]: text }),
    onFocus: (
      event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => {
      lastFocused.current = { field, element: event.target };
    },
    isDisabled,
  });

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <FieldLabel>ส่งถึงนักเรียน</FieldLabel>
          <Select
            disallowEmptySelection
            aria-label="ส่งถึงนักเรียน"
            description={
              REMINDER_AUDIENCES.find(
                (audience) => audience.key === value.audience,
              )?.description
            }
            isDisabled={isDisabled}
            selectedKeys={[value.audience]}
            variant="bordered"
            onSelectionChange={(keys) => {
              const selected = Array.from(keys)[0];

              if (selected != null) {
                onChange({ audience: selected as ReminderAudience });
              }
            }}
          >
            {REMINDER_AUDIENCES.map((audience) => (
              <SelectItem key={audience.key}>{audience.label}</SelectItem>
            ))}
          </Select>
          <Checkbox
            className="mt-1"
            color="success"
            isDisabled={isDisabled}
            isSelected={value.includeTeachers}
            size="sm"
            onValueChange={(includeTeachers) => onChange({ includeTeachers })}
          >
            <span className="text-sm">ส่งถึงครูประจำค่ายด้วย</span>
          </Checkbox>
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel>ส่งก่อนวันเริ่มค่าย</FieldLabel>
          <Select
            disallowEmptySelection
            aria-label="ส่งก่อนวันเริ่มค่าย"
            description={`เช่น ค่ายเริ่ม ${thaiDate(SAMPLE_CAMP_START_KEY)} → ส่ง ${thaiDate(exampleSendKey)} ประมาณ ${hourLabel(sendHour)} น.`}
            isDisabled={isDisabled}
            selectedKeys={[String(value.daysBefore)]}
            variant="bordered"
            onSelectionChange={(keys) => {
              const selected = Array.from(keys)[0];

              if (selected != null) onChange({ daysBefore: Number(selected) });
            }}
          >
            {DAY_OPTIONS.map((days) => (
              <SelectItem key={String(days)}>{`${days} วัน`}</SelectItem>
            ))}
          </Select>
        </div>
      </div>

      <div className="rounded-xl bg-[#f4f7f5] p-3">
        <p className="text-sm font-medium text-gray-700">
          ใส่ข้อมูลของแต่ละค่ายลงในข้อความ
        </p>
        <p className="mt-0.5 text-xs text-gray-500">
          คลิกในช่องที่ต้องการก่อน แล้วกดปุ่มด้านล่าง
          ตอนส่งจริงระบบจะเปลี่ยนเป็นข้อมูลของผู้รับแต่ละคนให้เอง
          (ถ้ายังไม่ได้คลิกช่องไหน จะเติมไว้ท้ายเนื้อหา)
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {REMINDER_PLACEHOLDERS.map((placeholder) => (
            <button
              key={placeholder.key}
              className="rounded-full border border-[#d9e3de] bg-white px-3 py-1 text-xs text-[#3f5c50] transition-colors hover:border-[#5d7c6f] hover:bg-[#e6eee9] disabled:opacity-50"
              disabled={isDisabled}
              title={`เช่น ${placeholder.example}`}
              type="button"
              onClick={() => insertPlaceholder(placeholder.label)}
              onMouseDown={(event) => event.preventDefault()}
            >
              + {placeholder.label}
              <span className="ml-1 text-gray-400">
                (เช่น {placeholder.example})
              </span>
            </button>
          ))}
        </div>
      </div>

      <Input {...fieldProps("subject")} />
      <Input {...fieldProps("heading")} />
      <Textarea
        {...fieldProps("body")}
        description="เว้นบรรทัดว่างเพื่อขึ้นย่อหน้าใหม่"
        minRows={3}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          {...fieldProps("action")}
          description="เว้นว่างได้ถ้าไม่ต้องการแสดง"
        />
        <Input {...fieldProps("buttonLabel")} />
      </div>
    </>
  );
}
