import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToString } from "react-dom/server";

import CampDateRangePicker from "../components/CampDateRangePicker";
import {
  formatDocumentDuration,
  parseCalendarDate,
  parseCalendarDateRange,
  parseDocumentDuration,
} from "../lib/calendar-date";

test("incomplete or invalid camp dates do not throw while rendering a picker", () => {
  for (const value of [
    "2-10-21",
    "202-10-21",
    "0202-10-21",
    "2026-02-30",
    "hello",
  ]) {
    assert.equal(parseCalendarDate(value), null);
    assert.equal(parseCalendarDateRange(value, "2026-10-25"), null);
    assert.equal(parseCalendarDateRange("2026-10-21", value), null);
  }
});

test("stored ISO timestamps and valid dates populate calendar fields", () => {
  assert.equal(
    parseCalendarDate("2026-10-21T00:00:00.000Z")?.toString(),
    "2026-10-21",
  );
  const range = parseCalendarDateRange("2026-10-21", "2026-10-25");

  assert.equal(range?.start.toString(), "2026-10-21");
  assert.equal(range?.end.toString(), "2026-10-25");
});

test("an incomplete date does not crash the camp creation field", () => {
  const html = renderToString(
    React.createElement(CampDateRangePicker, {
      "aria-label": "วันจัดค่าย",
      startDate: "202-10-21",
      endDate: "2026-10-25",
      onChange: () => {},
    }),
  );

  assert.match(html, /เลือกช่วงวันที่/);
});

test("document duration round trips through the calendar", () => {
  const original = "ระหว่างวันที่ 20 ตุลาคม 2569 ถึง 21 ตุลาคม 2569";
  const range = parseDocumentDuration(original);

  assert.equal(range?.start.toString(), "2026-10-20");
  assert.equal(range?.end.toString(), "2026-10-21");
  assert.equal(formatDocumentDuration(range!), original);
  assert.equal(parseDocumentDuration("ตลอดปีการศึกษา"), null);
});
