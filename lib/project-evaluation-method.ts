const LEGACY_METHODS: Record<string, string> = {
  แบบสอบถาม: "สอบถาม",
  การประเมิน: "ประเมิน",
  การสังเกต: "สังเกต",
  การตรวจผลงาน: "ตรวจผลงาน",
  การทดสอบ: "ทดสอบ",
  การสัมภาษณ์: "สัมภาษณ์",
};

export function normalizeProjectEvaluationMethod(value: unknown): string {
  const method = typeof value === "string" ? value.trim() : "";

  return LEGACY_METHODS[method] || method;
}
