import assert from "node:assert/strict";
import test from "node:test";

import {
  getCampDayCount,
  isCampScheduleDayInRange,
  isCampScheduleInRange,
} from "../lib/camp-schedule-range";

test("schedule days stay within the inclusive camp dates", () => {
  assert.equal(getCampDayCount("2026-10-10", "2026-10-10"), 1);
  assert.equal(isCampScheduleDayInRange(1, "2026-10-10", "2026-10-10"), true);
  assert.equal(isCampScheduleDayInRange(2, "2026-10-10", "2026-10-10"), false);
  assert.equal(getCampDayCount("2026-10-20", "2026-10-24"), 5);
  assert.equal(isCampScheduleDayInRange(2, "2026-10-20", "2026-10-24"), true);
});

test("duplicate and out-of-range schedule days are rejected", () => {
  assert.equal(
    isCampScheduleInRange([{ day: 1 }, { day: 2 }], "2026-10-10", "2026-10-10"),
    false,
  );
  assert.equal(
    isCampScheduleInRange([{ day: 1 }, { day: 1 }], "2026-10-10", "2026-10-11"),
    false,
  );
  assert.equal(
    isCampScheduleInRange([{ day: 1 }, { day: 2 }], "2026-10-10", "2026-10-11"),
    true,
  );
});
