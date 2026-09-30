import { readFile } from "node:fs/promises";
import path from "node:path";

import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, PDFImage, PDFPage, rgb } from "pdf-lib";

import { normalizeProjectSummaryStandards } from "@/lib/project-summary-standards";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const LEFT = 62;
const RIGHT = 42;
const TOP = 38;
const BOTTOM = 46;
const CONTENT_WIDTH = PAGE_WIDTH - LEFT - RIGHT;
const BODY_SIZE = 14.5;
const LINE_HEIGHT = 18;
const BLACK = rgb(0, 0, 0);
const BORDER = rgb(0.35, 0.35, 0.35);
const HEADER_FILL = rgb(0.91, 0.93, 0.92);

type Cell = {
  text: string;
  align?: "left" | "center" | "right";
  bold?: boolean;
};

function clean(value: unknown) {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .trim();
}

function isMeaningfulText(value: unknown) {
  return !/^[-–—\s]*$/.test(clean(value));
}

function suggestionLines(value: unknown) {
  return clean(value).split("\n").map(clean).filter(isMeaningfulText);
}

function list(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function money(value: unknown) {
  return Number(value || 0).toLocaleString("th-TH", {
    maximumFractionDigits: 2,
  });
}

function statusLabel(value: unknown) {
  const labels: Record<string, string> = {
    COMPLETED: "ดำเนินการเสร็จสิ้น",
    IN_PROGRESS: "อยู่ระหว่างดำเนินการ",
    NOT_STARTED: "ยังไม่ดำเนินการ",
  };

  return labels[clean(value)] || clean(value) || "-";
}

function choice(selected: boolean, label: string) {
  return `(${selected ? "√" : " "}) ${label}`;
}

export async function createProjectSummaryDocumentPdf(document: any) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(
    await readFile(path.join(process.cwd(), "public/fonts/THSarabunPSK.ttf")),
    { subset: true },
  );
  const boldFont = await pdf.embedFont(
    await readFile(
      path.join(process.cwd(), "public/fonts/THSarabunPSK-Bold.ttf"),
    ),
    { subset: true },
  );

  let logo: PDFImage | null = null;
  try {
    logo = await pdf.embedPng(
      await readFile(path.join(process.cwd(), "public/images/logoKKS.png")),
    );
  } catch {
    // The report remains downloadable when the optional logo is unavailable.
  }

  let page!: PDFPage;
  let y = TOP;
  const addPage = () => {
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = TOP;
  };
  const textWidth = (value: string, size = BODY_SIZE, bold = false) =>
    (bold ? boldFont : font).widthOfTextAtSize(value, size);
  const drawText = (
    value: string,
    x: number,
    top: number,
    size = BODY_SIZE,
    bold = false,
  ) => {
    page.drawText(value, {
      x,
      y: PAGE_HEIGHT - top - size,
      size,
      font: bold ? boldFont : font,
      color: BLACK,
    });
  };
  const splitLongToken = (
    token: string,
    maxWidth: number,
    size: number,
    bold: boolean,
  ) => {
    const chunks: string[] = [];
    let chunk = "";
    for (const character of token) {
      const candidate = chunk + character;
      if (chunk && textWidth(candidate, size, bold) > maxWidth) {
        chunks.push(chunk);
        chunk = character;
      } else {
        chunk = candidate;
      }
    }
    if (chunk) chunks.push(chunk);

    return chunks;
  };
  const wrap = (
    value: string,
    maxWidth: number,
    size = BODY_SIZE,
    bold = false,
  ) => {
    const lines: string[] = [];
    for (const paragraph of clean(value).split("\n")) {
      const tokens = paragraph.split(/\s+/).filter(Boolean);
      if (!tokens.length) {
        lines.push("");
        continue;
      }
      let line = "";
      for (const originalToken of tokens) {
        const tokenParts =
          textWidth(originalToken, size, bold) > maxWidth
            ? splitLongToken(originalToken, maxWidth, size, bold)
            : [originalToken];
        for (const token of tokenParts) {
          const candidate = line ? `${line} ${token}` : token;
          if (line && textWidth(candidate, size, bold) > maxWidth) {
            lines.push(line);
            line = token;
          } else {
            line = candidate;
          }
        }
      }
      if (line) lines.push(line);
    }

    return lines.length ? lines : [""];
  };
  const ensure = (height: number) => {
    if (y + height > PAGE_HEIGHT - BOTTOM) addPage();
  };
  const drawWrapped = (
    value: string,
    options: {
      x?: number;
      width?: number;
      size?: number;
      bold?: boolean;
      gap?: number;
    } = {},
  ) => {
    const size = options.size || BODY_SIZE;
    const bold = Boolean(options.bold);
    const x = options.x ?? LEFT;
    const width = options.width ?? CONTENT_WIDTH - (x - LEFT);
    const lines = wrap(value || "-", width, size, bold);
    ensure(lines.length * LINE_HEIGHT + (options.gap ?? 2));
    lines.forEach((line, index) =>
      drawText(line, x, y + index * LINE_HEIGHT, size, bold),
    );
    y += lines.length * LINE_HEIGHT + (options.gap ?? 2);
  };
  const centered = (value: string, size = 16, bold = false, gap = 2) => {
    const lines = wrap(value, CONTENT_WIDTH, size, bold);
    ensure(lines.length * (size + 5));
    lines.forEach((line) => {
      drawText(
        line,
        (PAGE_WIDTH - textWidth(line, size, bold)) / 2,
        y,
        size,
        bold,
      );
      y += size + 5;
    });
    y += gap;
  };
  const numberedLine = (number: string, label: string, value?: unknown) => {
    const prefix = `${number}. ${label}`;
    const labelWidth = Math.min(textWidth(prefix, BODY_SIZE) + 7, 190);
    const lines = wrap(clean(value) || "-", CONTENT_WIDTH - labelWidth);
    ensure(lines.length * LINE_HEIGHT + 1);
    drawText(prefix, LEFT, y);
    lines.forEach((line, index) =>
      drawText(line, LEFT + labelWidth, y + index * LINE_HEIGHT),
    );
    y += lines.length * LINE_HEIGHT + 1;
  };
  const projectNameLabelX = LEFT + textWidth("1. ", BODY_SIZE);
  const projectNameValueX =
    LEFT + Math.min(textWidth("1. ชื่อโครงการ", BODY_SIZE) + 7, 190);
  const subLine = (label: string, value: unknown) => {
    const valueX = Math.max(
      projectNameValueX,
      projectNameLabelX + textWidth(label, BODY_SIZE) + 7,
    );
    const lines = wrap(
      clean(value) || "-",
      CONTENT_WIDTH - (valueX - LEFT),
    );
    ensure(lines.length * LINE_HEIGHT);
    drawText(label, projectNameLabelX, y);
    lines.forEach((line, index) =>
      drawText(line, valueX, y + index * LINE_HEIGHT),
    );
    y += lines.length * LINE_HEIGHT;
  };
  const inlineLabeledLine = (label: string, value: string, gap = 2) => {
    const labelText = `${label} `;
    const labelWidth = textWidth(labelText, BODY_SIZE, true);
    const lines = wrap(value, CONTENT_WIDTH - labelWidth);

    ensure(lines.length * LINE_HEIGHT + gap);
    drawText(labelText, LEFT, y, BODY_SIZE, true);
    lines.forEach((line, index) =>
      drawText(line, LEFT + labelWidth, y + index * LINE_HEIGHT),
    );
    y += lines.length * LINE_HEIGHT + gap;
  };
  const firstLineIndented = (value: string, indent = 22, gap = 2) => {
    const normalized = clean(value).replace(/\s+/g, " ");
    const narrowLines = wrap(normalized || "-", CONTENT_WIDTH - indent);
    const firstLine = narrowLines[0];
    const remainingText = narrowLines.slice(1).join(" ");
    const remainingLines = remainingText
      ? wrap(remainingText, CONTENT_WIDTH)
      : [];
    const lines = [firstLine, ...remainingLines];

    ensure(lines.length * LINE_HEIGHT + gap);
    lines.forEach((line, index) =>
      drawText(line, index === 0 ? LEFT + indent : LEFT, y + index * LINE_HEIGHT),
    );
    y += lines.length * LINE_HEIGHT + gap;
  };
  const numberedList = (items: unknown[], x = LEFT + 22) => {
    const values = list(items).map(clean).filter(Boolean);
    if (!values.length) {
      drawWrapped("-", { x, width: CONTENT_WIDTH - (x - LEFT), gap: 0 });
      return;
    }
    values.forEach((item, index) => {
      const prefix = `${index + 1}.`;
      const lines = wrap(item, CONTENT_WIDTH - (x - LEFT) - 24);
      ensure(lines.length * LINE_HEIGHT);
      drawText(prefix, x, y);
      lines.forEach((line, lineIndex) =>
        drawText(line, x + 22, y + lineIndex * LINE_HEIGHT),
      );
      y += lines.length * LINE_HEIGHT;
    });
  };
  const drawTable = (headers: Cell[], rows: Cell[][], widths: number[]) => {
    const drawRow = (cells: Cell[], height: number, header = false) => {
      let x = LEFT;
      cells.forEach((cell, index) => {
        const width = widths[index];
        page.drawRectangle({
          x,
          y: PAGE_HEIGHT - y - height,
          width,
          height,
          borderColor: BORDER,
          borderWidth: 0.55,
          color: header ? HEADER_FILL : undefined,
        });
        const lines = wrap(
          cell.text || "-",
          width - 8,
          12.5,
          header,
        );
        const rowLineHeight = 15;
        const top =
          y + Math.max(4, (height - lines.length * rowLineHeight) / 2);
        lines.forEach((line, lineIndex) => {
          const bold = header;
          const widthOfLine = textWidth(line, 12.5, bold);
          const textX =
            cell.align === "center"
              ? x + (width - widthOfLine) / 2
              : cell.align === "right"
                ? x + width - widthOfLine - 4
                : x + 4;
          drawText(line, textX, top + lineIndex * rowLineHeight, 12.5, bold);
        });
        x += width;
      });
      y += height;
    };

    const headerHeight = 34;
    ensure(headerHeight);
    drawRow(headers, headerHeight, true);
    rows.forEach((row) => {
      const lineCounts = row.map(
        (cell, index) =>
          wrap(cell.text || "-", widths[index] - 8, 12.5).length,
      );
      const height = Math.max(27, Math.max(...lineCounts) * 15 + 9);
      if (y + height > PAGE_HEIGHT - BOTTOM) {
        addPage();
        drawRow(headers, headerHeight, true);
      }
      drawRow(row, height);
    });
    y += 7;
  };
  const selectedAssessment = (
    number: string,
    label: string,
    selected: unknown,
    options: string[],
  ) => {
    drawWrapped(`${number}. ${label}`, { gap: 0 });
    drawWrapped(
      options
        .map((option) => choice(clean(selected) === option, option))
        .join("    "),
      { x: LEFT + 22, width: CONTENT_WIDTH - 22, gap: 1 },
    );
  };

  const objectives = list(document.objectives).map(clean).filter(Boolean);
  const quantitative = list(document.quantitative_results);
  const qualitative = list(document.qualitative_results);
  const indicators = list(document.success_indicators);
  const evaluations = list(document.evaluation_results);
  const standardAlignments = normalizeProjectSummaryStandards(
    document.standard_alignments,
  );
  const assessment = document.operation_assessment || {};

  addPage();
  if (logo) {
    const dimensions = logo.scale(0.2);
    page.drawImage(logo, {
      x: (PAGE_WIDTH - dimensions.width) / 2,
      y: PAGE_HEIGHT - y - dimensions.height,
      width: dimensions.width,
      height: dimensions.height,
    });
    y += dimensions.height + 5;
  }
  centered("โรงเรียนขุขันธ์", 18, true, 0);
  centered("รายงานการดำเนินโครงการ", 18, true, 0);
  centered(
    `${clean(document.department) || "กลุ่มสาระ/กลุ่มงาน"} ปีงบประมาณ ${clean(document.fiscal_year) || "-"}`,
    18,
    true,
    7,
  );

  numberedLine("1", "ชื่อโครงการ", document.project_name);
  subLine("กิจกรรม", document.activity_name);
  subLine("ลำดับกิจกรรมที่", document.activity_order);
  drawWrapped("2. ลักษณะโครงการ", { gap: 0 });
  drawWrapped(
    [
      choice(document.project_nature === "NEW", "ใหม่"),
      choice(document.project_nature === "CONTINUING", "ต่อเนื่อง"),
      choice(
        document.project_nature === "IN_EVALUATION_PLAN",
        "อยู่ในแผนประเมิน",
      ),
      choice(
        document.project_nature === "OUTSIDE_ACTION_PLAN",
        "นอกแผนปฏิบัติการ",
      ),
    ].join("    "),
    { x: LEFT + 22, width: CONTENT_WIDTH - 22, gap: 1 },
  );
  numberedLine("3", "ผู้รับผิดชอบ", document.responsible_people);
  drawWrapped("4. สอดคล้องกับมาตรฐานการศึกษา", {
    gap: 0,
  });
  if (standardAlignments.length) {
    standardAlignments.forEach((standard) => {
      const standardTitle = clean(standard.title) || "มาตรฐาน";
      const standardLabel = standard.relatedItems
        ? `${standardTitle}    รายการที่ ${standard.relatedItems}`
        : standardTitle;

      drawWrapped(
        choice(Boolean(standard.achieved), standardLabel),
        {
          x: LEFT + 22,
          width: CONTENT_WIDTH - 22,
          gap: 0,
        },
      );
      standard.subItems.forEach((item) => {
        const label = [clean(item.code), clean(item.title)]
          .filter(Boolean)
          .join(" ");
        const related = clean(item.relatedItems);
        drawWrapped(
          `${choice(Boolean(item.achieved), label)}${related ? `    รายการที่ ${related}` : ""}`,
          {
            x: LEFT + 40,
            width: CONTENT_WIDTH - 40,
            gap: 0,
          },
        );
      });
    });
  } else {
    drawWrapped(clean(document.standards) || "-", {
      x: LEFT + 22,
      width: CONTENT_WIDTH - 22,
      gap: 0,
    });
  }
  drawWrapped("5. วัตถุประสงค์ของโครงการ", { gap: 0 });
  numberedList(objectives);
  drawWrapped("6. การดำเนินการ", { gap: 0 });
  drawWrapped(
    [
      choice(document.execution_status === "COMPLETED", "ดำเนินการเสร็จสิ้น"),
      choice(
        document.execution_status === "IN_PROGRESS",
        "อยู่ระหว่างการดำเนินการ",
      ),
      choice(document.execution_status === "NOT_STARTED", "ยังไม่ดำเนินการ"),
    ].join("    "),
    { x: LEFT + 22, width: CONTENT_WIDTH - 22, gap: 1 },
  );
  numberedLine("7", "ระยะเวลาในการดำเนินการ", document.duration_text);
  numberedLine("8", "สถานที่ดำเนินงาน", document.location_text);
  drawWrapped("9. ตัวชี้วัดความสำเร็จของโครงการ", { gap: 0 });
  drawWrapped("เชิงปริมาณ", { x: LEFT + 22, bold: true, gap: 0 });
  numberedList(
    quantitative.map((row) => clean(row.indicator) || clean(row.target)),
    LEFT + 38,
  );
  drawWrapped("เชิงคุณภาพ", { x: LEFT + 22, bold: true, gap: 0 });
  numberedList(
    qualitative.map((row) => clean(row.indicator) || clean(row.target)),
    LEFT + 38,
  );

  addPage();
  drawWrapped("10. งบประมาณโครงการ", { gap: 1 });
  drawWrapped(
    `งบประมาณที่ได้รับ ${money(document.budget_received)} บาท    งบประมาณที่ใช้ไปทั้งหมด ${money(document.budget_spent)} บาท`,
    { x: LEFT + 22, width: CONTENT_WIDTH - 22, gap: 0 },
  );
  drawWrapped(
    `งบประมาณคงเหลือ ${money(Math.max(0, Number(document.budget_received || 0) - Number(document.budget_spent || 0)))} บาท    งบประมาณที่ใช้เกิน ${money(Math.max(0, Number(document.budget_spent || 0) - Number(document.budget_received || 0)))} บาท`,
    { x: LEFT + 22, width: CONTENT_WIDTH - 22, gap: 5 },
  );

  drawWrapped("11. ผลการประเมินตัวชี้วัดความสำเร็จของโครงการ", {
    gap: 2,
  });
  drawTable(
    [
      { text: "ข้อที่", align: "center" },
      { text: "ตัวชี้วัดความสำเร็จโครงการ", align: "center" },
      { text: "เป้าหมาย", align: "center" },
      { text: "ผลการดำเนินงาน", align: "center" },
      { text: "บรรลุเป้าหมาย", align: "center" },
    ],
    indicators.map((row, index) => [
      { text: String(index + 1), align: "center" },
      { text: clean(row.indicator) },
      {
        text:
          row.valueType === "PERCENT"
            ? `ร้อยละ ${clean(row.target) || "-"}`
            : clean(row.target),
        align: "center",
      },
      {
        text:
          row.valueType === "PERCENT"
            ? `ร้อยละ ${clean(row.result) || "-"}`
            : clean(row.result) || "-",
        align: "center",
      },
      { text: statusLabel(row.status), align: "center" },
    ]),
    [34, 203, 78, 92, 84],
  );
  const assessedIndicators = indicators.filter(
    (row) => clean(row.status) && clean(row.status) !== "ยังไม่ประเมิน",
  );
  const reachedIndicators = assessedIndicators.filter((row) =>
    ["บรรลุเป้าหมาย", "สูงกว่าเป้าหมาย", "เท่ากับเป้าหมาย"].includes(
      clean(row.status),
    ),
  );
  const successPercent = assessedIndicators.length
    ? Math.round((reachedIndicators.length / assessedIndicators.length) * 100)
    : 0;
  drawWrapped(
    `สรุปผลสำเร็จของโครงการตามตัวชี้วัด คิดเป็นร้อยละ ${successPercent}`,
    { gap: 4 },
  );

  drawWrapped("12. การประเมินโครงการ", { gap: 1 });
  if (clean(document.evaluation_summary)) {
    firstLineIndented(document.evaluation_summary, 22, 4);
  }
  drawTable(
    [
      { text: "ที่", align: "center" },
      { text: "รายการประเมิน", align: "center" },
      { text: "ค่าเฉลี่ย (X)", align: "center" },
      { text: "ค่าเบี่ยงเบนมาตรฐาน (S.D.)", align: "center" },
      { text: "แปลผล", align: "center" },
    ],
    evaluations.map((row, index) => [
      { text: String(index + 1), align: "center" },
      { text: clean(row.topic) },
      {
        text:
          row.average == null || row.average === ""
            ? "-"
            : Number(row.average).toFixed(2),
        align: "center",
      },
      {
        text: row.sd == null || row.sd === "" ? "-" : Number(row.sd).toFixed(3),
        align: "center",
      },
      { text: clean(row.interpretation) || "-", align: "center" },
    ]),
    [30, 281, 58, 66, 56],
  );
  drawTable(
    [
      { text: "รวม", align: "center" },
      { text: "ค่าเฉลี่ย", align: "center" },
      { text: "S.D.", align: "center" },
      { text: "แปลผล", align: "center" },
    ],
    [
      [
        { text: "ผลการประเมินความพึงพอใจโดยรวม" },
        {
          text:
            document.overall_average == null
              ? "-"
              : Number(document.overall_average).toFixed(2),
          align: "center",
        },
        {
          text:
            document.overall_sd == null
              ? "-"
              : Number(document.overall_sd).toFixed(3),
          align: "center",
        },
        {
          text:
            document.overall_average == null
              ? "-"
              : Number(document.overall_average) >= 4.5
                ? "ดีเยี่ยม"
                : "ดี",
          align: "center",
        },
      ],
    ],
    [311, 58, 66, 56],
  );
  if (list(document.top_strengths).length) {
    drawWrapped("สรุป ประเด็นที่มีความพึงพอใจสูงสุด", { gap: 0 });
    numberedList(document.top_strengths);
  }
  const suggestions = list(document.suggestions)
    .map(clean)
    .filter(isMeaningfulText);
  if (suggestions.length) {
    drawWrapped("ข้อเสนอแนะ / สิ่งที่อยากให้มีเพิ่มเติม", {
      bold: true,
      gap: 0,
    });
    numberedList(suggestions);
  }

  const activityResultHeading =
    `ผลการดำเนินงานตามกิจกรรม ${clean(document.activity_name) || clean(document.project_name)}`;
  const activityResultHeadingLines = wrap(
    activityResultHeading,
    CONTENT_WIDTH,
    BODY_SIZE,
    true,
  );

  ensure((activityResultHeadingLines.length + 1) * LINE_HEIGHT + 9);
  drawWrapped(activityResultHeading, { bold: true, gap: 4 });
  inlineLabeledLine(
    "คำชี้แจง",
    "โปรดทำเครื่องหมาย (√) หน้าหัวข้อที่กำหนดให้ถูกต้อง และให้เหตุผลในหัวข้อที่ระบุไว้",
    5,
  );
  selectedAssessment(
    "1",
    "การดำเนินงาน",
    statusLabel(document.execution_status),
    ["ดำเนินการเสร็จสิ้น", "อยู่ระหว่างดำเนินการ", "ยังไม่ดำเนินการ"],
  );
  selectedAssessment(
    "2",
    "ผลการดำเนินการ เปรียบเทียบกับเป้าหมายด้านปริมาณ",
    assessment.quantitativeStatus,
    ["สูงกว่าเป้าหมาย", "เท่ากับเป้าหมาย", "ต่ำกว่าเป้าหมาย"],
  );
  drawWrapped(`ร้อยละ ${clean(assessment.quantitativePercent) || "-"}`, {
    x: LEFT + 40,
    gap: 1,
  });
  selectedAssessment(
    "3",
    "ผลการดำเนินการ เปรียบเทียบกับเป้าหมายด้านคุณภาพ",
    assessment.qualitativeStatus,
    ["สูงกว่าเป้าหมาย", "เท่ากับเป้าหมาย", "ต่ำกว่าเป้าหมาย"],
  );
  drawWrapped(`ร้อยละ ${clean(assessment.qualitativePercent) || "-"}`, {
    x: LEFT + 40,
    gap: 1,
  });
  selectedAssessment(
    "4",
    "จำนวนบุคลากร หรือผู้ดำเนินการมีความเหมาะสมเพียงใด",
    assessment.personnel,
    ["มากเกินไป", "เหมาะสมดี", "ยังต้องปรับปรุง"],
  );
  selectedAssessment(
    "5",
    "ความร่วมมือของผู้ร่วมงานในการดำเนินการ",
    assessment.cooperation,
    [
      "ได้รับความร่วมมือดีมาก",
      "ได้รับความร่วมมือปานกลาง",
      "ได้รับความร่วมมือน้อยมาก",
    ],
  );
  selectedAssessment(
    "6",
    "โครงการที่จัดขึ้นมีความเหมาะสม",
    assessment.projectAppropriateness,
    ["ดี", "พอใช้", "ต้องปรับปรุง"],
  );
  selectedAssessment(
    "7",
    "สถานที่ใช้ในการดำเนินการมีความเหมาะสม",
    assessment.location,
    ["ดี", "พอใช้", "ต้องปรับปรุง"],
  );
  selectedAssessment("8", "ระยะเวลาในการดำเนินการ", assessment.schedule, [
    "ตามระบุไว้ในแผน",
    "เร็วกว่าที่ระบุไว้ในแผน",
    "ช้ากว่าที่ระบุไว้ในแผน",
  ]);
  selectedAssessment("9", "ค่าใช้จ่ายจริง", assessment.budget, [
    "สูงกว่างบประมาณที่ได้รับ",
    "เท่ากับงบประมาณที่ได้รับ",
    "ต่ำกว่างบประมาณที่ได้รับ",
  ]);
  drawWrapped("10. ปัญหาและอุปสรรคที่เกิดขึ้นระหว่างการดำเนินการ", {
    gap: 0,
  });
  numberedList(clean(document.problems).split("\n").filter(Boolean));
  drawWrapped("11. ข้อเสนอแนะและแนวทางในการปรับปรุง", {
    gap: 0,
  });
  numberedList(suggestionLines(document.recommendations));

  addPage();
  drawWrapped(
    "12. โครงการนี้มีความสอดคล้องกับบริบทโรงเรียน และเมื่อพิจารณาถึงประสิทธิภาพและประสิทธิผลในการดำเนินการของโครงการนี้ในปีการศึกษาต่อไปหรือไม่ เพราะเหตุใด",
    { gap: 6 },
  );
  firstLineIndented(document.continuation_reason || "-", 22, 24);

  const allSignatories = list(document.signatories);
  const explicitReporters = allSignatories.filter((item) =>
    clean(item?.role).includes("ผู้รายงาน"),
  );
  const proposalReporters = allSignatories.filter((item) =>
    ["ผู้เสนอ", "ผู้รับผิดชอบ"].some((label) =>
      clean(item?.role).includes(label),
    ),
  );
  const signatories = explicitReporters.length
    ? explicitReporters
    : proposalReporters.length
      ? proposalReporters
      : allSignatories.slice(0, 2);
  if (signatories.length) {
    const columns = signatories.length > 1 ? 2 : 1;
    const columnWidth = CONTENT_WIDTH / columns;
    ensure(Math.ceil(signatories.length / columns) * 94);
    signatories.forEach((item, index) => {
      const row = Math.floor(index / columns);
      const column = index % columns;
      const x = LEFT + column * columnWidth;
      const top = y + row * 94;
      drawText(
        "ลงชื่อ ........................................ ผู้รายงาน",
        x,
        top,
      );
      drawText(
        `(${clean(item.name) || "................................"})`,
        x + 24,
        top + 24,
      );
    });
  }

  addPage();
  y = 370;
  centered("ภาคผนวก", 25, true, 0);

  const photos = list(document.photos);
  addPage();
  y = 330;
  centered("ประมวลภาพ", 23, true, 10);
  centered("ประกอบการดำเนินกิจกรรม", 23, true, 0);

  for (let index = 0; index < photos.length; index += 2) {
    addPage();
    const group = photos.slice(index, index + 2);
    for (const photo of group) {
      const imageTop = y;
      const boxWidth = CONTENT_WIDTH;
      const boxHeight = 315;
      let embedded: PDFImage | null = null;
      try {
        const response = await fetch(photo.image_url);
        if (response.ok) {
          const bytes = new Uint8Array(await response.arrayBuffer());
          try {
            embedded = await pdf.embedJpg(bytes);
          } catch {
            embedded = await pdf.embedPng(bytes);
          }
        }
      } catch {
        embedded = null;
      }
      if (embedded) {
        const scale = Math.min(
          boxWidth / embedded.width,
          boxHeight / embedded.height,
        );
        const width = embedded.width * scale;
        const height = embedded.height * scale;
        page.drawImage(embedded, {
          x: LEFT + (boxWidth - width) / 2,
          y: PAGE_HEIGHT - imageTop - height,
          width,
          height,
        });
      } else {
        page.drawRectangle({
          x: LEFT,
          y: PAGE_HEIGHT - imageTop - boxHeight,
          width: boxWidth,
          height: boxHeight,
          borderColor: BORDER,
          borderWidth: 0.6,
        });
        const message = "ไม่สามารถแสดงรูปภาพนี้ได้";
        drawText(
          message,
          LEFT + (boxWidth - textWidth(message)) / 2,
          imageTop + boxHeight / 2,
        );
      }
      y += boxHeight + 5;
      if (clean(photo.caption)) {
        drawWrapped(photo.caption, { size: 13, gap: 5 });
      } else {
        y += 8;
      }
    }
  }

  pdf.setTitle(`รายงานการดำเนินโครงการ ${clean(document.project_name)}`);
  pdf.setAuthor("โรงเรียนขุขันธ์");
  pdf.setSubject("รายงานผลการดำเนินโครงการ");

  return pdf.save();
}
