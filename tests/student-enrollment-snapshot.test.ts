import assert from "node:assert/strict";
import test from "node:test";

import { buildEnrollmentSnapshotMap } from "../lib/student-enrollment-snapshot";

test("captures the student's classroom and identity at camp enrollment time", async () => {
  const db = {
    classroom_students: {
      findMany: async () => [
        {
          student_students_id: 42001,
          classroom_classroom_id: 18,
          student: {
            prefix_name: "นาย",
            firstname: "ทดสอบ",
            lastname: "ระบบ",
          },
          classroom: {
            academic_years_years_id: 2026,
            grade: "Level_4",
            classroom_types: { name: "1" },
          },
        },
      ],
    },
  };

  const snapshots = await buildEnrollmentSnapshotMap(db, 7, [42001]);

  assert.deepEqual(snapshots.get(42001), {
    classroom_classroom_id: 18,
    academic_year_snapshot: 2026,
    grade_snapshot: "Level_4",
    classroom_name_snapshot: "1",
    student_name_snapshot: "นายทดสอบ ระบบ",
  });
});
