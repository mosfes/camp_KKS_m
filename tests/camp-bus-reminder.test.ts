import assert from "node:assert/strict";
import test from "node:test";

import {
  BUS_REMINDER_TTL_MS,
  getActiveBusReminder,
  getBusReminderContent,
} from "../lib/camp-bus-reminder";
import { createStudentBusPushPayload } from "../lib/web-push";

const now = new Date("2026-09-09T08:00:00.000Z");

test("uses the latest bus reminder when it matches the student's next action", () => {
  const reminder = getActiveBusReminder(
    [
      {
        event_type: "REMIND_BOARD",
        created_at: new Date("2026-09-09T07:59:00.000Z"),
      },
      {
        event_type: "REMIND_ALIGHT",
        created_at: new Date("2026-09-09T07:58:00.000Z"),
      },
    ],
    false,
    now,
  );

  assert.equal(reminder?.action, "board");
});

test("an updated bus reminder supersedes the previous action", () => {
  const reminder = getActiveBusReminder(
    [
      {
        event_type: "REMIND_ALIGHT",
        created_at: new Date("2026-09-09T07:59:00.000Z"),
      },
      {
        event_type: "REMIND_BOARD",
        created_at: new Date("2026-09-09T07:58:00.000Z"),
      },
    ],
    false,
    now,
  );

  assert.equal(reminder, null);
});

test("does not show a reminder after it expires", () => {
  const reminder = getActiveBusReminder(
    [
      {
        event_type: "REMIND_BOARD",
        created_at: new Date(now.getTime() - BUS_REMINDER_TTL_MS - 1),
      },
    ],
    false,
    now,
  );

  assert.equal(reminder, null);
});

test("does not show a boarding reminder after the student boards", () => {
  const reminder = getActiveBusReminder(
    [
      {
        event_type: "REMIND_BOARD",
        created_at: new Date("2026-09-09T07:59:00.000Z"),
      },
    ],
    true,
    now,
  );

  assert.equal(reminder, null);
});

test("builds consistent content for the notification center", () => {
  assert.deepEqual(getBusReminderContent("REMIND_BOARD"), {
    action: "board",
    title: "ถึงเวลาขึ้นรถ",
    message: "ครูประจำรถกำลังเช็กจำนวนคน กรุณากดยืนยันขึ้นรถ",
  });
  assert.deepEqual(getBusReminderContent("REMIND_ALIGHT"), {
    action: "alight",
    title: "ถึงเวลาลงรถ",
    message: "ครูประจำรถแจ้งว่ารถจอดแล้ว กรุณากดลงจากรถ",
  });
  assert.equal(getBusReminderContent("BOARD"), null);
});

test("builds a web push payload that opens the matching bus page", () => {
  assert.deepEqual(
    createStudentBusPushPayload({
      action: "alight",
      busName: "รถบัส 1",
      campId: 42,
      campName: "ค่ายวิทยาศาสตร์",
      eventId: 99,
      studentIds: [1001],
    }),
    {
      title: "ถึงเวลาลงรถ",
      body: "ครูประจำรถแจ้งว่ารถจอดแล้ว กรุณากดลงจากรถ\nค่ายวิทยาศาสตร์ · รถบัส 1",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: "student-bus-reminder-99",
      url: "/student/dashboard/camp/42/bus",
    },
  );
});
