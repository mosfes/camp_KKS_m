import assert from "node:assert/strict";
import test from "node:test";

import {
  classroomKey,
  defaultOutcome,
  expectedTargetGrade,
  getNextGrade,
  outcomeRequiresNote,
  roomSelectionKey,
  studentStatusForOutcome,
  supportsGrade,
  validateOutcomeForGrade,
  validatePromotionYearStatuses,
} from "../lib/student-promotion";

test("promotes grades one level and graduates Level 6", () => {
  assert.equal(getNextGrade("Level_1"), "Level_2");
  assert.equal(getNextGrade("Level_5"), "Level_6");
  assert.equal(getNextGrade("Level_6"), null);
  assert.equal(defaultOutcome("Level_5"), "PROMOTED");
  assert.equal(defaultOutcome("Level_6"), "GRADUATED");
});

test("repeat stays in the same grade while promotion moves forward", () => {
  assert.equal(expectedTargetGrade("Level_3", "REPEAT"), "Level_3");
  assert.equal(expectedTargetGrade("Level_3", "PROMOTED"), "Level_4");
  assert.equal(expectedTargetGrade("Level_6", "GRADUATED"), null);
});

test("classroom types enforce their configured valid grades", () => {
  assert.equal(supportsGrade("1,2,3", "Level_3"), true);
  assert.equal(supportsGrade("1,2,3", "Level_4"), false);
});

test("existing and planned room keys cannot collide", () => {
  assert.equal(classroomKey("Level_4", 8), "Level_4:8");
  assert.equal(roomSelectionKey(12, "Level_4", 8), "room:12");
  assert.equal(roomSelectionKey(null, "Level_4", 8), "planned:Level_4:8");
});

test("exception outcomes require an audit note", () => {
  assert.equal(outcomeRequiresNote("PROMOTED"), false);
  assert.equal(outcomeRequiresNote("GRADUATED"), false);
  assert.equal(outcomeRequiresNote("REPEAT"), true);
  assert.equal(outcomeRequiresNote("TRANSFERRED"), true);
  assert.equal(outcomeRequiresNote("WITHDRAWN"), true);
});

test("promotion outcomes update the student's current status", () => {
  assert.equal(studentStatusForOutcome("PROMOTED"), "ACTIVE");
  assert.equal(studentStatusForOutcome("REPEAT"), "ACTIVE");
  assert.equal(studentStatusForOutcome("GRADUATED"), "GRADUATED");
  assert.equal(studentStatusForOutcome("TRANSFERRED"), "TRANSFERRED");
  assert.equal(studentStatusForOutcome("WITHDRAWN"), "WITHDRAWN");
});

test("outcomes are valid only for supported grade levels", () => {
  assert.equal(validateOutcomeForGrade("Level_5", "PROMOTED"), null);
  assert.equal(validateOutcomeForGrade("Level_6", "GRADUATED"), null);
  assert.match(
    validateOutcomeForGrade("Level_6", "PROMOTED") || "",
    /ไม่สามารถ/,
  );
  assert.match(
    validateOutcomeForGrade("Level_5", "GRADUATED") || "",
    /เฉพาะนักเรียน ม\.6/,
  );
});

test("promotion requires one active source year and a draft target year", () => {
  assert.equal(validatePromotionYearStatuses("Active", "Draft", 1), null);
  assert.match(
    validatePromotionYearStatuses("Archived", "Draft", 1) || "",
    /ต้นทาง/,
  );
  assert.match(
    validatePromotionYearStatuses("Active", "Active", 2) || "",
    /ปลายทาง/,
  );
});
