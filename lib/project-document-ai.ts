import { z } from "zod";

import { normalizeProjectEvaluationMethod } from "@/lib/project-evaluation-method";

/**
 * ส่วนกลางสำหรับให้ AI ร่างเนื้อหาเอกสารข้อเสนอโครงการ
 * ใช้ทั้งตอนสร้างค่ายด่วน และปุ่ม "ร่างด้วย AI" ในหน้าเอกสาร
 *
 * ไม่ให้ AI กรอกมาตรฐาน/กลยุทธ์ เพราะสองช่องนั้นเก็บเป็นรูปแบบเฉพาะของ checklist
 * ครูเลือกเองจากรายการอ้างอิงจะถูกต้องกว่า
 */

export const aiText = (max: number, fallback = "") =>
  z
    .unknown()
    .transform((value) =>
      typeof value === "string" ? value.trim().slice(0, max) : fallback,
    );

export const aiInt = (min: number, max: number, fallback: number) =>
  z.unknown().transform((value) => {
    const n = Math.round(Number(value));

    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  });

// .optional() ทำให้ AI ละ key นี้ได้ (zod 4 จะถือว่า key ที่ผ่าน pipe เป็นค่าบังคับ)
export const aiList = <T extends z.ZodTypeAny>(item: T, max: number) =>
  z
    .unknown()
    .transform((value) => (Array.isArray(value) ? value.slice(0, max) : []))
    .pipe(z.array(item))
    .optional()
    .transform((value) => value ?? []);

const aiTextList = (max: number, itemMax = 2000) =>
  aiList(aiText(itemMax), max).transform((items) => items.filter(Boolean));

const EMPTY_DOCUMENT_DRAFT = {
  project_type: "NEW" as const,
  department: "",
  rationale: "",
  objectives: [] as string[],
  quantitative_targets: [] as string[],
  qualitative_targets: [] as string[],
  procedures: [] as { step: string; method: string; budget: number }[],
  budget_source: "เงินอุดหนุน",
  budget_items: [] as {
    description: string;
    compensation: number;
    expenses: number;
    materials: number;
  }[],
  evaluations: [] as { indicator: string; method: string; tool: string }[],
  expected_results: [] as string[],
};

export const projectDocumentAiSchema = z
  .object({
    project_type: z
      .unknown()
      .transform((value) => (value === "CONTINUING" ? "CONTINUING" : "NEW")),
    department: aiText(500),
    rationale: aiText(50000),
    objectives: aiTextList(10),
    quantitative_targets: aiTextList(10),
    qualitative_targets: aiTextList(10),
    procedures: aiList(
      z.object({
        step: aiText(500),
        method: aiText(10000),
        budget: aiInt(0, 1_000_000, 0),
      }),
      10,
    ),
    budget_source: aiText(100, "เงินอุดหนุน"),
    budget_items: aiList(
      z.object({
        description: aiText(3000),
        compensation: aiInt(0, 1_000_000, 0),
        expenses: aiInt(0, 1_000_000, 0),
        materials: aiInt(0, 1_000_000, 0),
      }),
      20,
    ),
    evaluations: aiList(
      z.object({
        indicator: aiText(5000),
        method: aiText(1000, "สอบถาม"),
        tool: aiText(1000, "แบบสอบถาม"),
      }),
      10,
    ),
    expected_results: aiTextList(10),
  })
  .catch(() => ({ ...EMPTY_DOCUMENT_DRAFT }));

export type ProjectDocumentAiDraft = z.infer<typeof projectDocumentAiSchema>;

/** โครงสร้าง JSON ของเอกสาร ใช้แทรกใน prompt */
export const PROJECT_DOCUMENT_JSON_SPEC = `{
    "project_type": "NEW" | "CONTINUING",
    "department": "กลุ่มสาระการเรียนรู้/ฝ่ายที่รับผิดชอบ",
    "rationale": "หลักการและเหตุผล 2-3 ย่อหน้า คั่นย่อหน้าด้วย \\n\\n",
    "objectives": ["เพื่อ..."],
    "quantitative_targets": ["นักเรียน... จำนวน ... คน"],
    "qualitative_targets": ["ร้อยละ 80 ของนักเรียน..."],
    "procedures": [ { "step": "วางแผน (Plan)", "method": "...", "budget": 0 } ],
    "budget_source": "เงินอุดหนุน" | "เงินรายได้สถานศึกษา",
    "budget_items": [ { "description": "ค่าอาหาร...", "compensation": 0, "expenses": 0, "materials": 0 } ],
    "evaluations": [ { "indicator": "ตัวชี้วัดความสำเร็จ", "method": "สอบถาม", "tool": "แบบสอบถาม" } ],
    "expected_results": ["นักเรียน..."]
  }`;

export const PROJECT_DOCUMENT_RULES = `- objectives 3-4 ข้อ ขึ้นต้นด้วย "เพื่อ"
- procedures มี 4 ขั้นตามลำดับ step ต้องเป็น "วางแผน (Plan)", "ดำเนินการ (Do)", "ตรวจสอบ (Check)", "ประเมินผลและรายงาน (Action)"
- budget_items: compensation = ค่าตอบแทน, expenses = ค่าใช้สอย, materials = ค่าวัสดุ หน่วยเป็นบาท งบสมเหตุสมผลสำหรับโรงเรียนรัฐ
- ผลรวม budget ของ procedures ต้องเท่ากับผลรวมของ budget_items
- evaluations.method เลือกจาก: สอบถาม, ประเมิน, สังเกต, ตรวจผลงาน, ทดสอบ, สัมภาษณ์
- evaluations.tool เลือกจาก: แบบสอบถาม, แบบประเมินความพึงพอใจ, แบบสังเกต, แบบทดสอบ, แบบสัมภาษณ์, แบบตรวจผลงาน`;

export function buildProjectDocumentPrompt({
  projectName,
  location,
  durationText,
  description,
}: {
  projectName: string;
  location?: string | null;
  durationText?: string | null;
  description?: string | null;
}) {
  return `คุณเป็นครูผู้เชี่ยวชาญการเขียนเอกสารข้อเสนอโครงการของโรงเรียนมัธยมในประเทศไทย
ช่วยร่างเนื้อหาเอกสารข้อเสนอโครงการตามแบบฟอร์มราชการไทย จากข้อมูลต่อไปนี้

ชื่อโครงการ: ${JSON.stringify(projectName)}
${location ? `สถานที่: ${JSON.stringify(location)}\n` : ""}${durationText ? `ระยะเวลา: ${JSON.stringify(durationText)}\n` : ""}${description ? `รายละเอียดเพิ่มเติม: ${JSON.stringify(description)}\n` : ""}
ตอบเป็น JSON object เท่านั้น ภาษาไทยทั้งหมด ตามโครงสร้างนี้:
${PROJECT_DOCUMENT_JSON_SPEC}

กติกา:
${PROJECT_DOCUMENT_RULES}`;
}

/** แปลงร่างจาก AI ให้เป็นฟิลด์ของ camp_project_document (ยังไม่รวมฟิลด์เฉพาะค่าย) */
export function toProjectDocumentFields(
  draft: ProjectDocumentAiDraft,
  responsible: string,
) {
  const budgetItems = draft.budget_items
    .filter((item) => item.description)
    .map((item) => ({ ...item, responsible }));
  const budgetTotal = budgetItems.reduce(
    (sum, item) => sum + item.compensation + item.expenses + item.materials,
    0,
  );

  return {
    project_type: draft.project_type,
    department: draft.department || null,
    rationale: draft.rationale || null,
    objectives: draft.objectives,
    quantitative_targets: draft.quantitative_targets,
    qualitative_targets: draft.qualitative_targets,
    procedures: draft.procedures
      .filter((p) => p.step)
      .map((p) => ({
        step: p.step,
        method: p.method,
        period: "",
        budget: p.budget,
        responsible,
      })),
    budget_total: budgetTotal,
    budget_source: draft.budget_source || "เงินอุดหนุน",
    budget_items: budgetItems,
    evaluations: draft.evaluations
      .filter((row) => row.indicator)
      .map((row) => ({
        ...row,
        method: normalizeProjectEvaluationMethod(row.method),
      })),
    expected_results: draft.expected_results,
  };
}
