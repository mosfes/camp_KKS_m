const emptyAnswers = new Set([
  "ไม่มี",
  "ไม่มีครับ",
  "ไม่มีค่ะ",
  "ไม่มีคะ",
  "ไม่มีอะไร",
  "ไม่มีอะไรเพิ่มเติม",
  "ไม่มีเพิ่มเติม",
  "ไม่มีข้อเสนอแนะ",
  "ไม่มีข้อเสนอแนะเพิ่มเติม",
  "ไม่มีข้อดี",
  "ไม่มีข้อเสีย",
  "ไม่มีสิ่งที่ควรปรับปรุง",
  "ไม่มีความคิดเห็น",
  "ไม่มีความคิดเห็นเพิ่มเติม",
  "none",
  "no",
  "n/a",
]);

export function isMeaningfulSurveyText(value: unknown): value is string {
  if (typeof value !== "string") return false;

  const normalized = value
    .trim()
    .replace(/\s+/g, "")
    .replace(/[.!。]+$/g, "")
    .toLowerCase();

  return (
    normalized.length > 0 &&
    !/^[-–—_.]+$/.test(normalized) &&
    !emptyAnswers.has(normalized)
  );
}

export function scaleValuesForQuestion(question: {
  question_type: string;
  survey_answer: Array<{ scale_value: number | null }>;
}): number[] {
  if (question.question_type !== "scale") return [];

  return question.survey_answer
    .map((answer) => answer.scale_value)
    .filter(
      (value): value is number =>
        typeof value === "number" && Number.isFinite(value),
    );
}
