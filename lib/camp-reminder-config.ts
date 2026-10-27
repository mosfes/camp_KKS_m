import { z } from "zod";

import {
  DEFAULT_SEND_HOUR,
  JOIN_DAYS_BEFORE,
  JOIN_REMINDER_TYPE,
  type ReminderSchedule,
} from "@/lib/camp-reminder-policy";

// Shared by the Cron job and the admin settings page, so keep this module free
// of server-only imports.

export const MIN_DAYS_BEFORE = 1;
export const MAX_DAYS_BEFORE = 30;
export const MAX_REMINDERS = 10;

// Admins type the Thai label in square brackets, e.g. [ชื่อค่าย]. The older
// {{campName}} form is still accepted.
export const REMINDER_PLACEHOLDERS = [
  { key: "name", label: "ชื่อผู้รับ", example: "ด.ช.สมชาย ใจดี" },
  { key: "campName", label: "ชื่อค่าย", example: "ค่ายลูกเสือ ม.2" },
  { key: "campDate", label: "วันเริ่มค่าย", example: "15 ธันวาคม 2569" },
  { key: "location", label: "สถานที่", example: "ค่ายลูกเสือวชิราวุธ" },
  { key: "countdown", label: "อีกกี่วัน", example: "พรุ่งนี้ / อีก 3 วัน" },
  { key: "daysLeft", label: "จำนวนวันที่เหลือ", example: "3" },
] as const;

export type ReminderPlaceholderKey =
  (typeof REMINDER_PLACEHOLDERS)[number]["key"];
export type ReminderPlaceholderValues = Record<ReminderPlaceholderKey, string>;

export function placeholderToken(label: string): string {
  return `[${label}]`;
}

export const NOT_JOINED_AUDIENCE = "NOT_JOINED" as const;
// Students who have registered. Before includeTeachers existed this audience
// also meant camp staff; see upgradeLegacyReminder.
export const PARTICIPANTS_AUDIENCE = "PARTICIPANTS" as const;
export const ALL_STUDENTS_AUDIENCE = "ALL_STUDENTS" as const;

export const REMINDER_AUDIENCES = [
  {
    key: NOT_JOINED_AUDIENCE,
    label: "นักเรียนที่ยังไม่ลงทะเบียน",
    description: "นักเรียนในห้องที่ร่วมค่ายแต่ยังไม่กดเข้าร่วม",
  },
  {
    key: PARTICIPANTS_AUDIENCE,
    label: "นักเรียนที่ลงทะเบียนแล้ว",
    description: "นักเรียนที่กดเข้าร่วมค่ายแล้ว",
  },
  {
    key: ALL_STUDENTS_AUDIENCE,
    label: "นักเรียนทั้งหมด",
    description:
      "นักเรียนทุกคนในห้องที่ร่วมค่าย ทั้งที่ลงทะเบียนแล้วและยังไม่ลงทะเบียน",
  },
] as const;

export type ReminderAudience = (typeof REMINDER_AUDIENCES)[number]["key"];

const templateSchema = z.object({
  // Stored in camp_email_reminder.reminder_type, which keeps each reminder
  // idempotent per camp and recipient. Never reuse an id for a new reminder.
  id: z.string().regex(/^[A-Za-z0-9_]{1,30}$/),
  // Admin-facing label only; never shown to recipients.
  name: z.string().trim().max(100, "ชื่อยาวเกิน 100 ตัวอักษร").default(""),
  enabled: z.boolean(),
  audience: z.enum([
    NOT_JOINED_AUDIENCE,
    PARTICIPANTS_AUDIENCE,
    ALL_STUDENTS_AUDIENCE,
  ]),
  // Also send to the camp creator, enrolled teachers, bus teachers and the
  // homeroom teachers of the camp's classrooms.
  includeTeachers: z.boolean(),
  daysBefore: z.number().int().min(MIN_DAYS_BEFORE).max(MAX_DAYS_BEFORE),
  subject: z.string().trim().min(1, "กรุณากรอกหัวเรื่อง").max(200),
  heading: z.string().trim().min(1, "กรุณากรอกหัวข้อในอีเมล").max(200),
  body: z.string().trim().min(1, "กรุณากรอกเนื้อหา").max(3000),
  action: z.string().trim().max(300),
  buttonLabel: z.string().trim().min(1, "กรุณากรอกข้อความปุ่ม").max(60),
});

export const campReminderSettingsSchema = z.object({
  sendHour: z.number().int().min(0).max(23),
  reminders: z
    .array(templateSchema)
    .min(1, "ต้องมีการแจ้งเตือนอย่างน้อย 1 ครั้ง")
    .max(MAX_REMINDERS, `เพิ่มการแจ้งเตือนได้ไม่เกิน ${MAX_REMINDERS} ครั้ง`)
    .refine(
      (reminders) =>
        new Set(reminders.map((reminder) => reminder.id)).size ===
        reminders.length,
      "รหัสการแจ้งเตือนซ้ำกัน",
    ),
});

export type ReminderTemplate = z.infer<typeof templateSchema>;
export type CampReminderSettings = z.infer<typeof campReminderSettingsSchema>;

export const DEFAULT_CAMP_REMINDER_SETTINGS: CampReminderSettings = {
  sendHour: DEFAULT_SEND_HOUR,
  reminders: [
    {
      // Keeps the id used by the original fixed join reminder so rows queued
      // before this setting existed are not sent a second time.
      id: JOIN_REMINDER_TYPE,
      name: "ชวนเข้าร่วมค่าย",
      enabled: true,
      audience: NOT_JOINED_AUDIENCE,
      includeTeachers: false,
      daysBefore: JOIN_DAYS_BEFORE,
      subject: "อย่าลืมลงทะเบียนเข้าร่วมค่าย [ชื่อค่าย]",
      heading: "อย่าลืมลงทะเบียนเข้าร่วมค่าย [ชื่อค่าย]",
      body: "ขณะนี้คุณยังไม่ได้ลงทะเบียนเข้าร่วมค่าย กรุณาลงทะเบียนผ่านระบบก่อนค่ายเริ่ม",
      action: "ลงทะเบียนเข้าร่วมค่ายในระบบ",
      buttonLabel: "ลงทะเบียนเข้าร่วมค่าย",
    },
  ],
};

export function newReminderId(): string {
  return `R_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** A reminder's content without its queue id or on/off state. */
export const reminderContentSchema = templateSchema
  .omit({ id: true, enabled: true })
  .extend({
    name: z.string().trim().min(1, "กรุณาตั้งชื่อเท็มเพลต").max(100),
  });

export type ReminderPresetContent = z.infer<typeof reminderContentSchema>;

export function toReminderContent(
  reminder: ReminderTemplate,
): ReminderPresetContent {
  return {
    name: reminder.name,
    audience: reminder.audience,
    includeTeachers: reminder.includeTeachers,
    daysBefore: reminder.daysBefore,
    subject: reminder.subject,
    heading: reminder.heading,
    body: reminder.body,
    action: reminder.action,
    buttonLabel: reminder.buttonLabel,
  };
}

export function createReminderFromContent(
  content: ReminderPresetContent,
): ReminderTemplate {
  return { id: newReminderId(), enabled: true, ...content };
}

export function describeReminderContent(
  content: Pick<
    ReminderPresetContent,
    "audience" | "includeTeachers" | "daysBefore"
  >,
): string {
  const audience = REMINDER_AUDIENCES.find(
    (item) => item.key === content.audience,
  );

  return `${audience?.label ?? ""}${content.includeTeachers ? " และครู" : ""} · ส่งก่อน ${content.daysBefore} วัน`;
}

/** Template for a reminder added with the + button. */
export function createReminderTemplate(
  existing: ReminderTemplate[],
): ReminderTemplate {
  const nearest = Math.min(
    ...existing.map((reminder) => reminder.daysBefore),
    MAX_DAYS_BEFORE + 1,
  );

  return {
    id: newReminderId(),
    name: "",
    enabled: true,
    audience: PARTICIPANTS_AUDIENCE,
    includeTeachers: true,
    daysBefore: Math.max(MIN_DAYS_BEFORE, nearest - 1),
    subject: "ค่าย [ชื่อค่าย] จะเริ่ม[อีกกี่วัน]",
    heading: "ค่าย [ชื่อค่าย] จะเริ่ม[อีกกี่วัน]",
    body: "ค่ายจะเริ่ม[อีกกี่วัน] กรุณาตรวจสอบเวลา สถานที่ และสิ่งที่ต้องเตรียมให้เรียบร้อย",
    action: "ตรวจสอบรายละเอียดและเตรียมตัว",
    buttonLabel: "ดูรายละเอียดค่าย",
  };
}

/**
 * Fills `includeTeachers` on reminders and templates saved before it existed,
 * when PARTICIPANTS meant registered students plus camp staff.
 */
export function upgradeLegacyReminder(stored: unknown): unknown {
  if (typeof stored !== "object" || stored === null) return stored;

  const value = stored as { audience?: unknown; includeTeachers?: unknown };

  return value.includeTeachers === undefined
    ? { ...value, includeTeachers: value.audience === PARTICIPANTS_AUDIENCE }
    : stored;
}

/**
 * Validates the stored JSON; a missing or invalid record falls back to the
 * defaults rather than stopping the Cron job.
 */
export function normalizeCampReminderSettings(
  stored: unknown,
): CampReminderSettings {
  const value = (stored ?? {}) as Partial<{
    sendHour: unknown;
    reminders: unknown;
  }>;
  const parsed = campReminderSettingsSchema.safeParse({
    sendHour: value.sendHour ?? DEFAULT_CAMP_REMINDER_SETTINGS.sendHour,
    reminders: Array.isArray(value.reminders)
      ? value.reminders.map(upgradeLegacyReminder)
      : DEFAULT_CAMP_REMINDER_SETTINGS.reminders,
  });

  return parsed.success ? parsed.data : DEFAULT_CAMP_REMINDER_SETTINGS;
}

export function reminderSchedule(
  settings: CampReminderSettings,
): ReminderSchedule {
  return Object.fromEntries(
    settings.reminders
      .filter((reminder) => reminder.enabled)
      .map((reminder) => [reminder.id, reminder.daysBefore]),
  );
}

export function countdownText(daysLeft: number): string {
  if (daysLeft <= 0) return "วันนี้";
  if (daysLeft === 1) return "พรุ่งนี้";

  return `อีก ${daysLeft} วัน`;
}

export function fillReminderPlaceholders(
  template: string,
  values: ReminderPlaceholderValues,
): string {
  const byLabel = new Map<string, ReminderPlaceholderKey>(
    REMINDER_PLACEHOLDERS.map((placeholder) => [
      placeholder.label,
      placeholder.key,
    ]),
  );

  // One pass, so a filled-in value (e.g. a camp name) is never expanded again.
  return template.replace(
    /\[\s*([^[\]\n]+?)\s*\]|\{\{\s*(\w+)\s*\}\}/g,
    (match, label: string | undefined, legacyKey: string | undefined) => {
      const key = label
        ? byLabel.get(label)
        : legacyKey && Object.prototype.hasOwnProperty.call(values, legacyKey)
          ? (legacyKey as ReminderPlaceholderKey)
          : undefined;

      return key ? values[key] : match;
    },
  );
}
