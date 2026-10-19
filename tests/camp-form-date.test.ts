import assert from "node:assert/strict";
import test from "node:test";

import {
  getCampFormDayCount,
  getShirtReservationDateError,
  isCompleteCampDate,
} from "../lib/camp-form-date";

test("shirt submission validates current input without waiting for displayed errors", () => {
  for (const [start, end] of [
    ["0002-10-21", "2026-10-24"],
    ["2026-10-21", "0202-10-24"],
    ["", "2026-10-24"],
    ["2026-10-21", ""],
    ["2026-02-30", "2026-10-24"],
    ["2026-10-24", "2026-10-21"],
    ["2026-10-21", "2026-10-26"],
    ["2026-10-21", "2026-10-27"],
  ]) {
    assert.notEqual(getShirtReservationDateError(start, end, "2026-10-26"), "");
  }
  assert.equal(
    getShirtReservationDateError("2026-10-21", "2026-10-24", "2026-10-26"),
    "",
  );
  assert.equal(
    getShirtReservationDateError("2026-10-21", "2026-10-21", "2026-10-26"),
    "",
  );
});

test("partial years never generate hundreds of thousands of schedule days", () => {
  for (const year of ["2", "20", "202", "0002", "0020", "0202"]) {
    const date = `${year}-10-21`;

    assert.equal(isCompleteCampDate(date), false);
    assert.equal(getCampFormDayCount(date, "2026-10-25"), 0);
    assert.equal(getCampFormDayCount("2026-10-21", date), 0);
  }
});

test("empty, invalid and reversed ranges do not change the schedule", () => {
  for (const [start, end] of [
    ["", "2026-10-25"],
    ["2026-10-21", ""],
    ["2026-02-30", "2026-03-01"],
    ["2026-10-25", "2026-10-21"],
  ]) {
    assert.equal(getCampFormDayCount(start, end), 0);
  }
});

test("complete ranges generate inclusive days across months and leap years", () => {
  assert.equal(getCampFormDayCount("2026-10-21", "2026-10-21"), 1);
  assert.equal(getCampFormDayCount("2026-10-21", "2026-10-25"), 5);
  assert.equal(getCampFormDayCount("2026-12-31", "2027-01-02"), 3);
  assert.equal(getCampFormDayCount("2028-02-28", "2028-03-01"), 3);
});
