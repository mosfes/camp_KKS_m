import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createReminderTemplate,
  DEFAULT_CAMP_REMINDER_SETTINGS,
  fillReminderPlaceholders,
  normalizeCampReminderSettings,
  reminderSchedule,
} from "../lib/camp-reminder-config";
import { createCampReminderEmail } from "../lib/camp-reminder-email";
import {
  dueReminderTypes,
  JOIN_REMINDER_TYPE,
  STARTING_REMINDER_TYPE,
  TOMORROW_REMINDER_TYPE,
} from "../lib/camp-reminder-policy";

const today = "2026-11-01";
const original = {
  [JOIN_REMINDER_TYPE]: 7,
  [STARTING_REMINDER_TYPE]: 3,
  [TOMORROW_REMINDER_TYPE]: 1,
};

test("7/3/1 day schedule picks the reminders already due", () => {
  assert.deepEqual(dueReminderTypes(today, "2026-11-08", original), [
    JOIN_REMINDER_TYPE,
  ]);
  assert.deepEqual(dueReminderTypes(today, "2026-11-04", original), [
    JOIN_REMINDER_TYPE,
    STARTING_REMINDER_TYPE,
  ]);
  assert.deepEqual(dueReminderTypes(today, "2026-11-02", original), [
    JOIN_REMINDER_TYPE,
    STARTING_REMINDER_TYPE,
    TOMORROW_REMINDER_TYPE,
  ]);
  assert.deepEqual(dueReminderTypes(today, "2026-11-09", original), []);
  assert.deepEqual(dueReminderTypes(today, today, original), []);
});

test("reminders on their due day wait for the send hour", () => {
  const schedule = { R_a: 3 };

  assert.deepEqual(dueReminderTypes(today, "2026-11-04", schedule, 17, 18), []);
  assert.deepEqual(dueReminderTypes(today, "2026-11-04", schedule, 18, 18), [
    "R_a",
  ]);
  // A reminder missed on an earlier day is caught up before the send hour.
  assert.deepEqual(dueReminderTypes(today, "2026-11-03", schedule, 0, 18), [
    "R_a",
  ]);
});

test("default has only the first reminder; + adds a nearer one", () => {
  const settings = structuredClone(DEFAULT_CAMP_REMINDER_SETTINGS);

  assert.equal(settings.reminders.length, 1);
  assert.equal(settings.reminders[0].id, JOIN_REMINDER_TYPE);

  const added = createReminderTemplate(settings.reminders);

  assert.equal(added.daysBefore, 6);
  assert.equal(added.audience, "PARTICIPANTS");
  assert.notEqual(added.id, JOIN_REMINDER_TYPE);

  settings.reminders.push(added, { ...createReminderTemplate([]), id: "R_off", enabled: false });
  assert.deepEqual(reminderSchedule(settings), {
    [JOIN_REMINDER_TYPE]: 7,
    [added.id]: 6,
  });
});

test("stored settings are validated with a default fallback", () => {
  const stored = {
    sendHour: 18,
    reminders: [{ ...createReminderTemplate([]), id: "R_x", daysBefore: 10 }],
  };

  assert.deepEqual(normalizeCampReminderSettings(stored), stored);
  assert.deepEqual(
    normalizeCampReminderSettings({ sendHour: 99 }),
    DEFAULT_CAMP_REMINDER_SETTINGS,
  );
  assert.deepEqual(
    normalizeCampReminderSettings({
      sendHour: 7,
      reminders: [stored.reminders[0], stored.reminders[0]],
    }),
    DEFAULT_CAMP_REMINDER_SETTINGS,
  );
});

test("templates fill Thai and legacy placeholders and escape HTML", () => {
  const values = {
    name: "",
    campName: "A [ชื่อผู้รับ] {{name}}",
    campDate: "",
    location: "",
    daysLeft: "",
    countdown: "พรุ่งนี้",
  };

  assert.equal(
    fillReminderPlaceholders("[ชื่อค่าย] เริ่ม[ อีกกี่วัน ] [อื่นๆ]", values),
    "A [ชื่อผู้รับ] {{name}} เริ่มพรุ่งนี้ [อื่นๆ]",
  );
  assert.equal(
    fillReminderPlaceholders("{{campName}} {{unknown}}", values),
    "A [ชื่อผู้รับ] {{name}} {{unknown}}",
  );

  const email = createCampReminderEmail({
    template: {
      subject: "ค่าย [ชื่อค่าย]\nเริ่ม[อีกกี่วัน]",
      heading: "{{campName}}",
      body: "ย่อหน้า 1\n\nย่อหน้า 2",
      action: "",
      buttonLabel: "ดู",
    },
    values: {
      name: "<b>x</b>",
      campName: "Camp & Co",
      campDate: "1",
      location: "L",
      daysLeft: "1",
      countdown: "พรุ่งนี้",
    },
    campUrl: "",
  });

  assert.equal(email.subject, "ค่าย Camp & Co เริ่มพรุ่งนี้");
  assert.match(email.html, /Camp &amp; Co/);
  assert.match(email.html, /&lt;b&gt;x&lt;\/b&gt;/);
  assert.doesNotMatch(email.html, /สิ่งที่ต้องทำ/);
  assert.equal((email.html.match(/<p style="line-height:1.7">ย่อหน้า/g) ?? []).length, 2);
});

test("reminders saved before includeTeachers keep their old recipients", () => {
  const legacy = (audience: string) => {
    const { includeTeachers: _unused, ...rest } = {
      ...createReminderTemplate([]),
      id: `R_${audience}`,
      audience,
    };

    return rest;
  };
  const settings = normalizeCampReminderSettings({
    sendHour: 7,
    reminders: [legacy("PARTICIPANTS"), legacy("NOT_JOINED")],
  });

  assert.equal(settings.reminders[0].includeTeachers, true);
  assert.equal(settings.reminders[1].includeTeachers, false);
});

test("all-students audience is accepted", () => {
  const reminder = {
    ...createReminderTemplate([]),
    audience: "ALL_STUDENTS" as const,
    includeTeachers: false,
  };
  const settings = { sendHour: 7, reminders: [reminder] };

  assert.deepEqual(normalizeCampReminderSettings(settings), settings);
});
