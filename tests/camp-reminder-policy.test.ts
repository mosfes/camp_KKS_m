import assert from "node:assert/strict";
import test from "node:test";

import {
  addDateKeyDays,
  dueReminderTypes,
  JOIN_REMINDER_TYPE,
  STARTING_REMINDER_TYPE,
  TOMORROW_REMINDER_TYPE,
} from "../lib/camp-reminder-policy";

const today = "2026-09-09";

test("queues the join reminder exactly seven days before camp", () => {
  assert.deepEqual(dueReminderTypes(today, "2026-09-16"), [JOIN_REMINDER_TYPE]);
});

test("queues both reminders at D-3 so a missed D-7 run is caught up", () => {
  assert.deepEqual(dueReminderTypes(today, "2026-09-12"), [
    JOIN_REMINDER_TYPE,
    STARTING_REMINDER_TYPE,
  ]);
});

test("does not queue the final reminder two days before camp", () => {
  assert.deepEqual(dueReminderTypes(today, "2026-09-11"), [
    JOIN_REMINDER_TYPE,
    STARTING_REMINDER_TYPE,
  ]);
});

test("queues the final reminder on the day before camp", () => {
  assert.deepEqual(dueReminderTypes(today, "2026-09-10"), [
    JOIN_REMINDER_TYPE,
    STARTING_REMINDER_TYPE,
    TOMORROW_REMINDER_TYPE,
  ]);
});

test("does not queue camps outside the future D+1 through D+7 window", () => {
  assert.deepEqual(dueReminderTypes(today, today), []);
  assert.deepEqual(dueReminderTypes(today, "2026-09-17"), []);
});

test("date-key arithmetic crosses month and year boundaries", () => {
  assert.equal(addDateKeyDays("2026-12-29", 3), "2027-01-01");
});

test("the same policy is independently applicable to concurrent camps", () => {
  const camps = ["2026-09-12", "2026-09-12"];

  assert.deepEqual(
    camps.map((startDate) => dueReminderTypes(today, startDate)),
    [
      [JOIN_REMINDER_TYPE, STARTING_REMINDER_TYPE],
      [JOIN_REMINDER_TYPE, STARTING_REMINDER_TYPE],
    ],
  );
});
