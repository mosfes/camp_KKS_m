import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  AlignmentType,
  BorderStyle,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  VerticalAlign,
  WidthType,
} from "docx";

import {
  CONTENT_WIDTH,
  type DocxCell,
  checkbox,
  clean,
  heading,
  imageParagraph,
  list,
  makeDocument,
  money,
  numberedParagraphs,
  paragraph,
  richParagraph,
  spacer,
  table,
} from "@/lib/project-docx";

const HEADER_LABEL_WIDTH = 2160;
const HEADER_VALUE_WIDTH = CONTENT_WIDTH - HEADER_LABEL_WIDTH;
const borderless = {
  top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
};

function headerCell(
  children: Paragraph[],
  width: number,
  margins = { top: 0, bottom: 0, left: 0, right: 0 },
) {
  return new TableCell({
    borders: borderless,
    children,
    margins,
    verticalAlign: VerticalAlign.TOP,
    width: { size: width, type: WidthType.DXA },
  });
}

function headerRow(label: string, value: Paragraph[], labelSize = 32) {
  return new TableRow({
    cantSplit: true,
    children: [
      headerCell(
        [paragraph(label, { bold: true, size: labelSize, spaceAfter: 0 })],
        HEADER_LABEL_WIDTH,
      ),
      headerCell(value, HEADER_VALUE_WIDTH),
    ],
  });
}

function projectHeaderTable(document: any) {
  return new Table({
    borders: borderless,
    columnWidths: [HEADER_LABEL_WIDTH, HEADER_VALUE_WIDTH],
    layout: TableLayoutType.FIXED,
    rows: [
      headerRow("ชื่อโครงการ", [
        richParagraph(
          [
            { text: clean(document.project_name) || "-" },
            {
              text: " รหัสโครงการ/กิจกรรม ",
              bold: true,
              size: 30,
            },
            { text: clean(document.project_code) || "-", size: 30 },
          ],
          { spaceAfter: 0 },
        ),
      ]),
      headerRow("ชื่อกิจกรรม", [
        richParagraph(
          [
            { text: clean(document.activity_name) || "-" },
            ...(clean(document.activity_order)
              ? [
                  { text: " ลำดับกิจกรรม ", bold: true },
                  { text: clean(document.activity_order) },
                ]
              : []),
          ],
          { spaceAfter: 0 },
        ),
      ]),
      headerRow("ลักษณะโครงการ", [
        paragraph(
          [
            checkbox(document.project_type === "NEW", "โครงการใหม่"),
            checkbox(document.project_type !== "NEW", "โครงการต่อเนื่อง"),
          ].join("    "),
          { spaceAfter: 0 },
        ),
      ]),
      headerRow("สนอง", [
        paragraph(clean(document.standards) || "-", { spaceAfter: 0 }),
        paragraph(clean(document.strategy) || "-", { spaceAfter: 0 }),
      ]),
      headerRow("ผู้รับผิดชอบโครงการ", [
        paragraph(clean(document.responsible_people) || "-", {
          spaceAfter: 0,
        }),
      ]),
      headerRow(
        "กลุ่มงาน/กลุ่มสาระฯ/ระดับ",
        [paragraph(clean(document.department) || "-", { spaceAfter: 0 })],
        28,
      ),
    ],
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
  });
}

function headerDivider() {
  return new Paragraph({
    border: {
      bottom: {
        color: "000000",
        size: 6,
        space: 1,
        style: BorderStyle.SINGLE,
      },
    },
    children: [],
    spacing: { before: 80, after: 80 },
  });
}

function signatoryTable(signatories: any[]) {
  const rows: TableRow[] = [];

  for (let index = 0; index < signatories.length; index += 2) {
    const pair = signatories.slice(index, index + 2);

    rows.push(
      new TableRow({
        cantSplit: true,
        children: [0, 1].map((column) => {
          const person = pair[column];
          const name = person
            ? `${clean(person.prefixName)}${clean(person.firstname)} ${clean(person.lastname)}`.trim()
            : "";

          return new TableCell({
            width: { size: CONTENT_WIDTH / 2, type: WidthType.DXA },
            margins: { top: 220, bottom: 220, left: 100, right: 100 },
            children: person
              ? [
                  paragraph(
                    `ลงชื่อ ........................................ ${clean(person.role) || "ผู้ลงนาม"}`,
                    {
                      align: AlignmentType.CENTER,
                      spaceAfter: 180,
                    },
                  ),
                  paragraph(`(${name || "................................"})`, {
                    align: AlignmentType.CENTER,
                    spaceAfter: 40,
                  }),
                  paragraph(clean(person.position) || "-", {
                    align: AlignmentType.CENTER,
                    spaceAfter: 0,
                  }),
                ]
              : [new Paragraph({ children: [] })],
          });
        }),
      }),
    );
  }

  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [CONTENT_WIDTH / 2, CONTENT_WIDTH / 2],
    rows,
  });
}

export async function createProjectDocumentDocx(document: any) {
  const children: Array<Paragraph | Table> = [];

  try {
    const logo = await readFile(
      path.join(process.cwd(), "public/images/logoKKS.png"),
    );

    children.push(imageParagraph(new Uint8Array(logo), "png", 82, 82));
  } catch {
    // Keep Word export available without the optional logo.
  }

  children.push(
    paragraph(
      `โครงการตามแผนปฏิบัติราชการประจำปีงบประมาณ ${clean(document.fiscal_year) || "-"}`,
      { bold: true, align: AlignmentType.CENTER, spaceAfter: 0 },
    ),
    paragraph("โรงเรียนขุขันธ์ อำเภอขุขันธ์ จังหวัดศรีสะเกษ", {
      bold: true,
      align: AlignmentType.CENTER,
      spaceAfter: 200,
    }),
    projectHeaderTable(document),
    headerDivider(),
    heading("1", "หลักการและเหตุผล"),
    paragraph(clean(document.rationale) || "-", {
      align: AlignmentType.THAI_DISTRIBUTE,
      firstLineIndent: 720,
      spaceAfter: 160,
    }),
    heading("2", "วัตถุประสงค์"),
    ...numberedParagraphs(document.objectives, "2"),
    heading("3", "เป้าหมาย"),
    paragraph("3.1 เชิงปริมาณ", { bold: true, indent: 360, keepNext: true }),
    ...numberedParagraphs(document.quantitative_targets, "3.1", 620),
    paragraph("3.2 เชิงคุณภาพ", { bold: true, indent: 360, keepNext: true }),
    ...numberedParagraphs(document.qualitative_targets, "3.2", 620),
    heading("4", "วิธีดำเนินการ"),
    table(
      [
        { text: "ขั้นตอน" },
        { text: "วิธีดำเนินการ" },
        { text: "ระยะเวลา\nวัน/เดือน/ปี" },
        { text: "งบประมาณ/\nทรัพยากร" },
        { text: "ผู้รับผิดชอบ\n(บุคคล/กลุ่มงาน)" },
      ],
      list(document.procedures).map((row) => [
        { text: clean(row.step), bold: true },
        { text: clean(row.method) },
        { text: clean(row.period), align: AlignmentType.CENTER },
        { text: money(row.budget, ""), align: AlignmentType.CENTER },
        { text: clean(row.responsible), align: AlignmentType.CENTER },
      ]),
      [1400, 2800, 1550, 1350, 2538],
    ),
    spacer(),
    heading("5", "ระยะเวลาดำเนินการ"),
    paragraph(clean(document.duration_text) || "-", { indent: 500 }),
    heading("6", "สถานที่ดำเนินงาน"),
    paragraph(clean(document.location_text) || "-", { indent: 500 }),
    heading("7", `งบประมาณที่ใช้ทั้งสิ้น ${money(document.budget_total)} บาท`),
    paragraph(
      [
        checkbox(
          clean(document.budget_source).includes("เงินอุดหนุน"),
          "เงินอุดหนุน",
        ),
        checkbox(
          clean(document.budget_source).includes("เงินรายได้สถานศึกษา"),
          "เงินรายได้สถานศึกษา",
        ),
        checkbox(
          Boolean(clean(document.budget_source)) &&
            !clean(document.budget_source).includes("เงินอุดหนุน") &&
            !clean(document.budget_source).includes("เงินรายได้สถานศึกษา"),
          `อื่น ๆ ${clean(document.budget_source) || "........................"}`,
        ),
      ].join("    "),
      { indent: 500 },
    ),
  );

  const budgetItems = list(document.budget_items);
  const budgetRows: DocxCell[][] = budgetItems.map((row) => {
    const total =
      Number(row.compensation || 0) +
      Number(row.expenses || 0) +
      Number(row.materials || 0);

    return [
      { text: clean(row.description) },
      { text: money(row.compensation, ""), align: AlignmentType.CENTER },
      { text: money(row.expenses, ""), align: AlignmentType.CENTER },
      { text: money(row.materials, ""), align: AlignmentType.CENTER },
      { text: money(total, ""), align: AlignmentType.CENTER },
      { text: clean(row.responsible), align: AlignmentType.CENTER },
    ];
  });
  const total = budgetItems.reduce(
    (sum, row) =>
      sum +
      Number(row.compensation || 0) +
      Number(row.expenses || 0) +
      Number(row.materials || 0),
    0,
  );

  budgetRows.push([
    { text: "รวมทั้งสิ้น", bold: true, align: AlignmentType.CENTER },
    { text: "" },
    { text: "" },
    { text: "" },
    { text: money(total), bold: true, align: AlignmentType.CENTER },
    { text: "" },
  ]);
  children.push(
    table(
      [
        { text: "กิจกรรม/รายการใช้งบประมาณ" },
        { text: "ค่าตอบแทน" },
        { text: "ค่าใช้สอย" },
        { text: "ค่าวัสดุ" },
        { text: "รวม" },
        { text: "ผู้รับผิดชอบ" },
      ],
      budgetRows,
      [2200, 1100, 1050, 1050, 1050, 3188],
    ),
    spacer(),
    heading("8", "การวัดและประเมินผล"),
    table(
      [
        { text: "ที่" },
        { text: "ตัวชี้วัดความสำเร็จ" },
        { text: "วิธีวัด" },
        { text: "เครื่องมือที่ใช้" },
      ],
      list(document.evaluations).map((row, index) => [
        { text: `8.${index + 1}`, align: AlignmentType.CENTER },
        { text: clean(row.indicator) },
        { text: clean(row.method), align: AlignmentType.CENTER },
        { text: clean(row.tool), align: AlignmentType.CENTER },
      ]),
      [600, 5100, 1800, 2138],
    ),
    spacer(),
    heading("9", "ผลที่คาดว่าจะได้รับ"),
    ...numberedParagraphs(document.expected_results, "9"),
  );

  if (list(document.signatories).length) {
    children.push(spacer(240), signatoryTable(list(document.signatories)));
  }

  const file = makeDocument(
    children,
    `เอกสารโครงการ ${clean(document.project_name)}`,
  );

  return Packer.toBuffer(file);
}
