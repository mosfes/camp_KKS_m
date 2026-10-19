import assert from "node:assert/strict";
import test from "node:test";

import {
  isMeaningfulSurveyText,
  scaleValuesForQuestion,
} from "../lib/survey-feedback";

test("ignores empty feedback but preserves meaningful positive and negative answers", () => {
  for (const answer of ["-", ".", "ไม่มี", "ไม่มีครับ", "ไม่มีข้อเสนอแนะ"]) {
    assert.equal(isMeaningfulSurveyText(answer), false);
  }

  assert.equal(isMeaningfulSurveyText("ไม่มีครับแต่อยากมาอีก"), true);
  assert.equal(isMeaningfulSurveyText("ครูมาเยอะเกินนนน"), true);
});

test("does not turn a text question's null scale answers into zero scores", () => {
  assert.deepEqual(
    scaleValuesForQuestion({
      question_type: "text",
      survey_answer: [{ scale_value: null }],
    }),
    [],
  );
  assert.deepEqual(
    scaleValuesForQuestion({
      question_type: "scale",
      survey_answer: [
        { scale_value: null },
        { scale_value: 5 },
        { scale_value: 4 },
      ],
    }),
    [5, 4],
  );
});
