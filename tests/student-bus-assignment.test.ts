import assert from "node:assert/strict";
import test from "node:test";

import { studentCampBusAssignmentWhere } from "../lib/student-bus-assignment";

test("finds a student's explicit bus assignment without requiring the bus classroom", () => {
  const where = studentCampBusAssignmentWhere(42, 28661);

  assert.equal(where.student_enrollment.camp_camp_id, 42);
  assert.equal(where.student_enrollment.student_students_id, 28661);
  assert.equal(where.bus.camp_camp_id, 42);
  assert.equal("classroom" in where.bus, false);
});
