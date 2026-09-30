export const GRADE_LEVELS = [
  "Level_1",
  "Level_2",
  "Level_3",
  "Level_4",
  "Level_5",
  "Level_6",
] as const;

export type GradeLevelValue = (typeof GRADE_LEVELS)[number];

export const PROMOTION_OUTCOMES = [
  "PROMOTED",
  "REPEAT",
  "GRADUATED",
  "TRANSFERRED",
  "WITHDRAWN",
] as const;

export type PromotionOutcomeValue = (typeof PROMOTION_OUTCOMES)[number];
export type StudentStatusValue =
  | "ACTIVE"
  | "GRADUATED"
  | "TRANSFERRED"
  | "WITHDRAWN";

const NEXT_GRADE: Partial<Record<GradeLevelValue, GradeLevelValue>> = {
  Level_1: "Level_2",
  Level_2: "Level_3",
  Level_3: "Level_4",
  Level_4: "Level_5",
  Level_5: "Level_6",
};

export function getNextGrade(grade: GradeLevelValue) {
  return NEXT_GRADE[grade] ?? null;
}

export function gradeNumber(grade: GradeLevelValue) {
  return Number(grade.replace("Level_", ""));
}

export function gradeLabel(grade: GradeLevelValue) {
  return `ม.${gradeNumber(grade)}`;
}

export function classroomKey(grade: GradeLevelValue, classroomTypeId: number) {
  return `${grade}:${classroomTypeId}`;
}

export function roomSelectionKey(
  classroomId: number | null,
  grade: GradeLevelValue,
  classroomTypeId: number,
) {
  return classroomId
    ? `room:${classroomId}`
    : `planned:${classroomKey(grade, classroomTypeId)}`;
}

export function supportsGrade(validGrades: string, grade: GradeLevelValue) {
  const valid = new Set(
    String(validGrades || "")
      .split(",")
      .map((value) => Number(value.trim()))
      .filter(Number.isFinite),
  );

  return valid.has(gradeNumber(grade));
}

export function defaultOutcome(grade: GradeLevelValue): PromotionOutcomeValue {
  return grade === "Level_6" ? "GRADUATED" : "PROMOTED";
}

export function outcomeNeedsTarget(outcome: PromotionOutcomeValue) {
  return outcome === "PROMOTED" || outcome === "REPEAT";
}

export function outcomeRequiresNote(outcome: PromotionOutcomeValue) {
  return (
    outcome === "REPEAT" || outcome === "TRANSFERRED" || outcome === "WITHDRAWN"
  );
}

export function studentStatusForOutcome(
  outcome: PromotionOutcomeValue,
): StudentStatusValue {
  if (outcome === "GRADUATED") return "GRADUATED";
  if (outcome === "TRANSFERRED") return "TRANSFERRED";
  if (outcome === "WITHDRAWN") return "WITHDRAWN";
  return "ACTIVE";
}

export function validateOutcomeForGrade(
  grade: GradeLevelValue,
  outcome: PromotionOutcomeValue,
) {
  if (outcome === "PROMOTED" && grade === "Level_6") {
    return "นักเรียน ม.6 ไม่สามารถเลือกผลเป็นเลื่อนชั้นได้";
  }
  if (outcome === "GRADUATED" && grade !== "Level_6") {
    return "เลือกจบการศึกษาได้เฉพาะนักเรียน ม.6 เท่านั้น";
  }

  return null;
}

export function validatePromotionYearStatuses(
  sourceStatus: string,
  targetStatus: string,
  activeYearCount: number,
) {
  if (sourceStatus !== "Active") {
    return "ปีการศึกษาต้นทางต้องมีสถานะใช้งานอยู่ (Active)";
  }
  if (targetStatus !== "Draft") {
    return "ปีการศึกษาปลายทางต้องมีสถานะฉบับร่าง (Draft)";
  }
  if (activeYearCount !== 1) {
    return "ระบบต้องมีปีการศึกษาที่ใช้งานอยู่เพียงปีเดียวก่อนเลื่อนชั้น";
  }

  return null;
}

export function expectedTargetGrade(
  sourceGrade: GradeLevelValue,
  outcome: PromotionOutcomeValue,
) {
  if (outcome === "REPEAT") return sourceGrade;
  if (outcome === "PROMOTED") return getNextGrade(sourceGrade);

  return null;
}
