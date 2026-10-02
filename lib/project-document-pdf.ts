import { readFile } from "node:fs/promises";
import path from "node:path";

import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, PDFImage, PDFPage, rgb } from "pdf-lib";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_LEFT = 70.8;
const MARGIN_RIGHT = 35.5;
const TABLE_LEFT = 65;
const TABLE_WIDTH = 488;
const FIRST_PAGE_TOP = 30;
const CONTINUATION_PAGE_TOP = 74;
const BOTTOM = 46;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
const BODY_SIZE = 16;
const LINE_HEIGHT = 21;
const BLACK = rgb(0, 0, 0);

type Align = "left" | "center" | "right" | "justify" | "thai-distribute";
type Cell = {
  text: string;
  width?: number;
  align?: Align;
  verticalAlign?: "top" | "middle";
  bold?: boolean;
};
type RichRun = { text: string; bold?: boolean };

function clean(value: unknown) {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .trim();
}

function money(value: unknown, empty = "-") {
  const amount = Number(value || 0);

  return amount
    ? amount.toLocaleString("th-TH", { maximumFractionDigits: 2 })
    : empty;
}

function sum(values: unknown[]) {
  return values.reduce<number>((total, value) => total + Number(value || 0), 0);
}

export async function createProjectDocumentPdf(document: any) {
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
    // Keep export available if a deployment omits the optional logo.
  }

  let page!: PDFPage;
  let y = FIRST_PAGE_TOP;

  const addPage = () => {
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = pdf.getPageCount() === 1 ? FIRST_PAGE_TOP : CONTINUATION_PAGE_TOP;
  };
  const textWidth = (text: string, size: number, bold = false) =>
    (bold ? boldFont : font).widthOfTextAtSize(text, size);
  const drawText = (
    text: string,
    x: number,
    top: number,
    size = BODY_SIZE,
    bold = false,
  ) => {
    const options = {
      x,
      y: PAGE_HEIGHT - top - size,
      size,
      font: bold ? boldFont : font,
      color: BLACK,
    };

    page.drawText(text, options);
  };
  const drawThaiDistributedText = (
    text: string,
    x: number,
    top: number,
    width: number,
    size = BODY_SIZE,
    bold = false,
  ) => {
    const graphemes = Array.from(
      new (Intl as any).Segmenter("th", { granularity: "grapheme" }).segment(
        text,
      ) as Iterable<{ segment: string }>,
      (item) => item.segment,
    );

    if (graphemes.length < 2) {
      drawText(text, x, top, size, bold);

      return;
    }

    const extra = Math.max(0, width - textWidth(text, size, bold));
    const letterGap = extra / (graphemes.length - 1);
    let cursor = x;

    graphemes.forEach((grapheme, index) => {
      drawText(grapheme, cursor, top, size, bold);
      cursor += textWidth(grapheme, size, bold);
      if (index < graphemes.length - 1) cursor += letterGap;
    });
  };
  const words = (text: string): string[] => {
    const normalized = clean(text);

    if (!normalized) return [""];
    const segmenter = new (Intl as any).Segmenter("th", {
      granularity: "word",
    });

    return Array.from(
      segmenter.segment(normalized) as Iterable<{ segment: string }>,
      (item) => item.segment,
    );
  };
  const wrap = (
    text: string,
    maxWidth: number,
    size = BODY_SIZE,
    bold = false,
  ) => {
    const output: string[] = [];

    for (const paragraph of clean(text).split("\n")) {
      if (!paragraph) {
        output.push("");
        continue;
      }
      let line = "";

      for (const word of words(paragraph)) {
        const candidate = line + word;

        if (!line || textWidth(candidate, size, bold) <= maxWidth) {
          line = candidate;
          continue;
        }
        output.push(line.trimEnd());
        if (textWidth(word, size, bold) <= maxWidth) {
          line = word.trimStart();
        } else {
          let part = "";

          for (const character of Array.from(word)) {
            if (part && textWidth(part + character, size, bold) > maxWidth) {
              output.push(part);
              part = character;
            } else {
              part += character;
            }
          }
          line = part;
        }
      }
      output.push(line.trimEnd());
    }

    return output.length ? output : [""];
  };
  const ensure = (height: number) => {
    if (y + height > PAGE_HEIGHT - BOTTOM) addPage();
  };
  const centered = (text: string, size: number, gapAfter = 4, bold = false) => {
    ensure(size + gapAfter);
    drawText(
      text,
      (PAGE_WIDTH - textWidth(text, size, bold)) / 2,
      y,
      size,
      bold,
    );
    y += size + gapAfter;
  };
  const drawWrapped = (
    text: string,
    options: {
      x?: number;
      width?: number;
      size?: number;
      lineHeight?: number;
      align?: Align;
      bold?: boolean;
      gap?: number;
      firstLineIndent?: number;
    } = {},
  ) => {
    const size = options.size ?? BODY_SIZE;
    const x = options.x ?? MARGIN_LEFT;
    const width = options.width ?? CONTENT_WIDTH;
    const lineHeight = options.lineHeight ?? LINE_HEIGHT;
    const firstLineIndent = options.firstLineIndent ?? 0;
    const paragraphs = clean(text).split("\n");

    paragraphs.forEach((paragraph) => {
      const indent = firstLineIndent;
      const lines = wrap(paragraph, width - indent, size, options.bold);

      lines.forEach((item, index) => {
        ensure(lineHeight);
        const currentIndent = index === 0 ? indent : 0;
        const available = width - currentIndent;
        const itemWidth = textWidth(item, size, options.bold);
        const itemX =
          options.align === "center"
            ? x + currentIndent + Math.max(0, (available - itemWidth) / 2)
            : options.align === "right"
              ? x + currentIndent + Math.max(0, available - itemWidth)
              : x + currentIndent;

        if (
          (options.align === "justify" ||
            options.align === "thai-distribute") &&
          index < lines.length - 1
        ) {
          drawThaiDistributedText(
            item,
            x + currentIndent,
            y,
            available,
            size,
            options.bold,
          );
        } else {
          drawText(item, itemX, y, size, options.bold);
        }
        y += lineHeight;
      });
    });
    y += options.gap ?? 0;
  };
  const richLine = (
    runs: RichRun[],
    x: number,
    top: number,
    size = BODY_SIZE,
  ) => {
    let cursor = x;

    runs.forEach((run) => {
      drawText(run.text, cursor, top, size, run.bold);
      cursor += textWidth(run.text, size, run.bold);
    });
  };
  const labeled = (label: string, value: string, labelWidth = 124) => {
    const labelLines = wrap(label, labelWidth - 8, BODY_SIZE, true);
    const valueLines = wrap(
      value || "-",
      CONTENT_WIDTH - labelWidth,
      BODY_SIZE,
    );
    const rowLines = Math.max(labelLines.length, valueLines.length);

    ensure(rowLines * LINE_HEIGHT);
    labelLines.forEach((item, index) =>
      drawText(item, MARGIN_LEFT, y + index * LINE_HEIGHT, BODY_SIZE, true),
    );
    valueLines.forEach((item, index) =>
      drawText(
        item,
        MARGIN_LEFT + labelWidth,
        y + index * LINE_HEIGHT,
        BODY_SIZE,
      ),
    );
    y += rowLines * LINE_HEIGHT;
  };
  const heading = (number: string, title: string) => {
    ensure(28);
    y += 4;
    drawWrapped(`${number}.  ${title}`, { bold: true, gap: 1 });
  };
  const numberedList = (
    items: unknown[],
    prefix: string,
    indent = 21,
    gapAfter = 0,
  ) => {
    const markerWidth = prefix.includes(".") ? 27 : 18;

    (Array.isArray(items) ? items : [])
      .filter((item) => clean(item))
      .forEach((item, index) => {
        const marker = `${prefix}.${index + 1}`;
        const itemLines = wrap(
          clean(item),
          CONTENT_WIDTH - indent - markerWidth,
          BODY_SIZE,
        );

        ensure(itemLines.length * LINE_HEIGHT);
        drawText(marker, MARGIN_LEFT + indent, y, BODY_SIZE);
        itemLines.forEach((itemLine, lineIndex) =>
          drawText(
            itemLine,
            MARGIN_LEFT + indent + markerWidth,
            y + lineIndex * LINE_HEIGHT,
            BODY_SIZE,
          ),
        );
        y += itemLines.length * LINE_HEIGHT;
      });
    y += gapAfter;
  };
  const drawCheckbox = (
    label: string,
    checked: boolean,
    x: number,
    top: number,
  ) => {
    const boxSize = 10.5;
    const boxTop = top + 4;

    page.drawRectangle({
      x,
      y: PAGE_HEIGHT - boxTop - boxSize,
      width: boxSize,
      height: boxSize,
      borderWidth: 0.8,
      borderColor: BLACK,
    });
    if (checked) {
      page.drawLine({
        start: { x: x + 2, y: PAGE_HEIGHT - boxTop - 5.8 },
        end: { x: x + 4.5, y: PAGE_HEIGHT - boxTop - 8.5 },
        thickness: 1,
        color: BLACK,
      });
      page.drawLine({
        start: { x: x + 4.5, y: PAGE_HEIGHT - boxTop - 8.5 },
        end: { x: x + 9, y: PAGE_HEIGHT - boxTop - 2.2 },
        thickness: 1,
        color: BLACK,
      });
    }
    drawText(label, x + boxSize + 4, top, BODY_SIZE);

    return boxSize + 4 + textWidth(label, BODY_SIZE);
  };
  const drawTable = (
    headers: Cell[],
    rows: Cell[][],
    options: {
      size?: number;
      headerHeight?: number;
      totalRow?: number;
      groupedBudgetHeader?: boolean;
      minimumRowHeights?: number[];
    } = {},
  ) => {
    const size = options.size ?? BODY_SIZE;
    const paddingX = 4;
    const paddingY = 1.5;
    const lineHeight = 21;
    const requestedHeaderHeight = options.headerHeight ?? 34;
    const widths = headers.map((header) => header.width || 0);
    const headerLines = headers.map((header, index) =>
      wrap(header.text, widths[index] - paddingX * 2, size, true),
    );
    const headerHeight = options.groupedBudgetHeader
      ? Math.max(
          requestedHeaderHeight,
          headerLines[0].length * lineHeight + paddingY * 2 + 2,
          headerLines.at(-1)!.length * lineHeight + paddingY * 2 + 2,
          21 +
            Math.max(...headerLines.slice(1, 4).map((lines) => lines.length)) *
              lineHeight +
            paddingY * 2 +
            2,
        )
      : Math.max(
          requestedHeaderHeight,
          Math.max(...headerLines.map((lines) => lines.length)) * lineHeight +
            paddingY * 2 +
            2,
        );
    const drawHeader = () => {
      ensure(headerHeight);

      if (options.groupedBudgetHeader) {
        const groupHeight = 21;
        const budgetWidth = widths[1] + widths[2] + widths[3];
        const drawHeaderCell = (
          text: string,
          x: number,
          top: number,
          width: number,
          height: number,
        ) => {
          page.drawRectangle({
            x,
            y: PAGE_HEIGHT - top - height,
            width,
            height,
            borderWidth: 0.65,
            borderColor: BLACK,
          });
          const lines = wrap(text, width - paddingX * 2, size, true);
          const blockHeight = lines.length * lineHeight;

          lines.forEach((headerLine, index) =>
            drawText(
              headerLine,
              x +
                Math.max(
                  paddingX,
                  (width - textWidth(headerLine, size, true)) / 2,
                ),
              top +
                Math.max(1, (height - blockHeight) / 2) +
                index * lineHeight,
              size,
              true,
            ),
          );
        };
        let x = TABLE_LEFT;

        drawHeaderCell(headers[0].text, x, y, widths[0], headerHeight);
        x += widths[0];
        drawHeaderCell("งบประมาณ", x, y, budgetWidth, groupHeight);
        for (let index = 1; index <= 3; index += 1) {
          drawHeaderCell(
            headers[index].text,
            x,
            y + groupHeight,
            widths[index],
            headerHeight - groupHeight,
          );
          x += widths[index];
        }
        drawHeaderCell(headers[4].text, x, y, widths[4], headerHeight);
        x += widths[4];
        drawHeaderCell(headers[5].text, x, y, widths[5], headerHeight);
        y += headerHeight;

        return;
      }
      let x = TABLE_LEFT;

      headers.forEach((header) => {
        const width = header.width || 0;

        page.drawRectangle({
          x,
          y: PAGE_HEIGHT - y - headerHeight,
          width,
          height: headerHeight,
          borderWidth: 0.65,
          borderColor: BLACK,
        });
        const lines = wrap(header.text, width - paddingX * 2, size, true);
        const blockHeight = lines.length * lineHeight;

        lines.forEach((headerLine, index) => {
          const lineWidth = textWidth(headerLine, size, true);

          drawText(
            headerLine,
            x + Math.max(paddingX, (width - lineWidth) / 2),
            y +
              Math.max(2, (headerHeight - blockHeight) / 2) +
              index * lineHeight,
            size,
            true,
          );
        });
        x += width;
      });
      y += headerHeight;
    };

    drawHeader();
    rows.forEach((row, rowIndex) => {
      const allLines = row.map((cell, index) => {
        const bold = Boolean(cell.bold || options.totalRow === rowIndex);

        return wrap(
          clean(cell.text) || " ",
          (headers[index].width || 0) - paddingX * 2,
          size,
          bold,
        );
      });
      const rowHeight = Math.max(
        options.minimumRowHeights?.[rowIndex] ?? 25,
        Math.max(...allLines.map((items) => items.length)) * lineHeight,
      );

      if (y + rowHeight > PAGE_HEIGHT - BOTTOM) {
        addPage();
        drawHeader();
      }
      let x = TABLE_LEFT;

      headers.forEach((header, columnIndex) => {
        const width = header.width || 0;
        const cell = row[columnIndex];

        page.drawRectangle({
          x,
          y: PAGE_HEIGHT - y - rowHeight,
          width,
          height: rowHeight,
          borderWidth: 0.65,
          borderColor: BLACK,
        });
        allLines[columnIndex].forEach((cellLine, lineIndex) => {
          const bold = Boolean(cell.bold || options.totalRow === rowIndex);
          const lineWidth = textWidth(cellLine, size, bold);
          const align = cell.align ?? header.align ?? "left";
          const blockHeight = allLines[columnIndex].length * lineHeight;
          const alignedTop =
            cell.verticalAlign === "middle"
              ? y + Math.max(paddingY, (rowHeight - blockHeight) / 2)
              : y + paddingY;
          const alignedX =
            align === "right"
              ? x + width - paddingX - lineWidth
              : align === "center"
                ? x + (width - lineWidth) / 2
                : x + paddingX;

          drawText(
            cellLine,
            alignedX,
            alignedTop + lineIndex * lineHeight,
            size,
            bold,
          );
        });
        x += width;
      });
      y += rowHeight;
    });
    y += 3;
  };
  const drawSignatories = (signatories: any[]) => {
    const cellWidth = TABLE_WIDTH / 2;
    const rowHeight = 112;

    for (let index = 0; index < signatories.length; index += 2) {
      const pair = signatories.slice(index, index + 2);
      const fullWidth = pair.length === 1;

      if (y + rowHeight > PAGE_HEIGHT - BOTTOM) addPage();
      pair.forEach((person: any, columnIndex: number) => {
        const x = fullWidth ? TABLE_LEFT : TABLE_LEFT + columnIndex * cellWidth;
        const width = fullWidth ? TABLE_WIDTH : cellWidth;
        const center = x + width / 2;
        const role = clean(person.role) || "ผู้ลงนาม";
        let dots = 29;
        let signatureSize = BODY_SIZE;
        let signature = `ลงชื่อ ${".".repeat(dots)} ${role}`;

        while (dots > 8 && textWidth(signature, BODY_SIZE) > width - 10) {
          dots -= 1;
          signature = `ลงชื่อ ${".".repeat(dots)} ${role}`;
        }
        while (
          signatureSize > 8.5 &&
          textWidth(signature, signatureSize) > width - 10
        ) {
          signatureSize -= 0.5;
        }
        page.drawRectangle({
          x,
          y: PAGE_HEIGHT - y - rowHeight,
          width,
          height: rowHeight,
          borderWidth: 0.65,
          borderColor: BLACK,
        });
        drawText(
          signature,
          center - textWidth(signature, signatureSize) / 2,
          y + 26,
          signatureSize,
        );
        const name = `(${clean(person.prefixName)}${clean(person.firstname)} ${clean(person.lastname)})`;

        drawText(
          name,
          center - textWidth(name, BODY_SIZE) / 2,
          y + 49,
          BODY_SIZE,
        );
        wrap(clean(person.position), width - 18, BODY_SIZE)
          .slice(0, 2)
          .forEach((position, lineIndex) =>
            drawText(
              position,
              center - textWidth(position, BODY_SIZE) / 2,
              y + 69 + lineIndex * 18,
              BODY_SIZE,
            ),
          );
      });
      y += rowHeight;
    }
  };

  addPage();
  if (logo) {
    const dimensions = logo.scale(0.2);

    page.drawImage(logo, {
      x: (PAGE_WIDTH - dimensions.width) / 2,
      y: PAGE_HEIGHT - y - dimensions.height,
      width: dimensions.width,
      height: dimensions.height,
    });
    y += dimensions.height + 7;
  }
  centered(
    `โครงการตามแผนปฏิบัติราชการประจำปีงบประมาณ  ${document.fiscal_year}`,
    16,
    3,
    true,
  );
  centered("โรงเรียนขุขันธ์ อำเภอขุขันธ์ จังหวัดศรีสะเกษ", 16, 13, true);

  const labelWidth = 108;
  const projectLabelWidth = labelWidth;
  const projectLineSize = 15;
  const codeLabel = "รหัสโครงการ/กิจกรรม";
  const projectName = clean(document.project_name) || "-";
  const projectCode = clean(document.project_code) || "-";
  const projectValueWidth = CONTENT_WIDTH - projectLabelWidth;
  const projectSpaceWidth = textWidth(" ", projectLineSize);
  const inlineCodeWidth =
    textWidth(codeLabel, projectLineSize, true) +
    textWidth(projectCode, projectLineSize) +
    projectSpaceWidth * 2;
  let projectLines = wrap(projectName, projectValueWidth, projectLineSize);

  if (
    textWidth(projectLines.at(-1) || "", projectLineSize) + inlineCodeWidth >
    projectValueWidth
  ) {
    projectLines = wrap(
      projectName,
      Math.max(80, projectValueWidth - inlineCodeWidth),
      projectLineSize,
    );
  }
  ensure(projectLines.length * LINE_HEIGHT);
  drawText("ชื่อโครงการ", MARGIN_LEFT, y, BODY_SIZE, true);
  projectLines.forEach((item, index) =>
    drawText(
      item,
      MARGIN_LEFT + projectLabelWidth,
      y + index * LINE_HEIGHT,
      projectLineSize,
    ),
  );
  const projectLastLine = projectLines.at(-1) || "";
  const codeX =
    MARGIN_LEFT +
    projectLabelWidth +
    textWidth(projectLastLine, projectLineSize) +
    projectSpaceWidth;
  const projectLastTop = y + (projectLines.length - 1) * LINE_HEIGHT;

  drawText(codeLabel, codeX, projectLastTop, projectLineSize, true);
  drawText(
    projectCode,
    codeX + textWidth(codeLabel, projectLineSize, true) + projectSpaceWidth,
    projectLastTop,
    projectLineSize,
  );
  y += projectLines.length * LINE_HEIGHT;

  const activityText = clean(document.activity_name) || "-";
  const activityLines = wrap(
    activityText,
    CONTENT_WIDTH - labelWidth,
    BODY_SIZE,
  );
  const orderText = clean(document.activity_order);
  const activitySpaceWidth = textWidth(" ", BODY_SIZE);
  const lastActivity = activityLines.at(-1) || "";
  const orderWidth = orderText
    ? activitySpaceWidth * 2 +
      textWidth("ลำดับกิจกรรม", BODY_SIZE, true) +
      textWidth(orderText, BODY_SIZE)
    : 0;

  ensure(activityLines.length * LINE_HEIGHT);
  drawText("ชื่อกิจกรรม", MARGIN_LEFT, y, BODY_SIZE, true);
  activityLines.forEach((item, index) =>
    drawText(
      item,
      MARGIN_LEFT + labelWidth,
      y + index * LINE_HEIGHT,
      BODY_SIZE,
    ),
  );
  if (
    orderText &&
    textWidth(lastActivity, BODY_SIZE) + orderWidth <=
      CONTENT_WIDTH - labelWidth
  ) {
    const orderX =
      MARGIN_LEFT +
      labelWidth +
      textWidth(lastActivity, BODY_SIZE) +
      activitySpaceWidth;

    richLine(
      [{ text: "ลำดับกิจกรรม", bold: true }, { text: ` ${orderText}` }],
      orderX,
      y + (activityLines.length - 1) * LINE_HEIGHT,
    );
    y += activityLines.length * LINE_HEIGHT;
  } else {
    y += activityLines.length * LINE_HEIGHT;
    if (orderText) {
      ensure(LINE_HEIGHT);
      richLine(
        [{ text: "ลำดับกิจกรรม", bold: true }, { text: ` ${orderText}` }],
        MARGIN_LEFT + labelWidth,
        y,
      );
      y += LINE_HEIGHT;
    }
  }

  ensure(LINE_HEIGHT);
  drawText("ลักษณะโครงการ", MARGIN_LEFT, y, BODY_SIZE, true);
  let checkboxX = MARGIN_LEFT + labelWidth;

  checkboxX +=
    drawCheckbox("โครงการใหม่", document.project_type === "NEW", checkboxX, y) +
    14;
  drawCheckbox(
    "โครงการต่อเนื่อง",
    document.project_type !== "NEW",
    checkboxX,
    y,
  );
  y += LINE_HEIGHT;
  labeled("สนอง", clean(document.standards), labelWidth);
  drawWrapped(clean(document.strategy) || "-", {
    x: MARGIN_LEFT + labelWidth,
    width: CONTENT_WIDTH - labelWidth,
  });
  labeled(
    "ผู้รับผิดชอบโครงการ",
    clean(document.responsible_people),
    labelWidth,
  );
  ensure(LINE_HEIGHT);
  drawText("กลุ่มงาน/กลุ่มสาระฯ/ระดับ", MARGIN_LEFT, y, 14, true);
  drawText(
    clean(document.department) || "-",
    MARGIN_LEFT + labelWidth,
    y,
    BODY_SIZE,
  );
  y += LINE_HEIGHT;

  ensure(17);
  y += 6;
  page.drawLine({
    start: { x: MARGIN_LEFT, y: PAGE_HEIGHT - y },
    end: { x: PAGE_WIDTH - MARGIN_RIGHT, y: PAGE_HEIGHT - y },
    thickness: 0.7,
    color: BLACK,
  });
  y += 9;

  heading("1", "หลักการและเหตุผล");
  drawWrapped(clean(document.rationale) || "-", {
    align: "thai-distribute",
    firstLineIndent: 36,
    lineHeight: 19,
    gap: 18,
  });
  heading("2", "วัตถุประสงค์");
  numberedList(document.objectives, "2", 21, 7);
  heading("3", "เป้าหมาย");
  drawWrapped("3.1  เชิงปริมาณ", { x: MARGIN_LEFT + 22, bold: true });
  numberedList(document.quantitative_targets, "3.1", 35);
  ensure(LINE_HEIGHT * 2);
  drawWrapped("3.2  เชิงคุณภาพ", { x: MARGIN_LEFT + 22, bold: true });
  numberedList(document.qualitative_targets, "3.2", 35, 11);

  heading("4", "วิธีดำเนินการ");
  drawTable(
    [
      { text: "ขั้นตอน", width: 76 },
      { text: "วิธีดำเนินการ", width: 149 },
      { text: "ระยะเวลา\nวัน/เดือน/ปี", width: 78, align: "center" },
      { text: "งบประมาณ/\nทรัพยากร", width: 71, align: "center" },
      { text: "ผู้รับผิดชอบ\n(บุคคล/กลุ่มงาน)", width: 114, align: "center" },
    ],
    (document.procedures || []).map((row: any) => [
      {
        text: clean(row.step).replace(/\s*(\([A-Za-z][^)]*\))\s*$/, "\n$1"),
        bold: true,
        align: "center",
        verticalAlign: "middle",
      },
      { text: row.method, align: "center", verticalAlign: "middle" },
      { text: row.period, align: "center" },
      { text: money(row.budget, ""), align: "center" },
      { text: row.responsible },
    ]),
    {
      headerHeight: 42,
      minimumRowHeights: [84, 168, 63, 63],
    },
  );

  heading("5", "ระยะเวลาดำเนินการ");
  drawWrapped(clean(document.duration_text) || "-", { x: MARGIN_LEFT + 28 });
  heading("6", "สถานที่ดำเนินงาน");
  drawWrapped(clean(document.location_text) || "-", { x: MARGIN_LEFT + 28 });
  ensure(170);
  heading(
    "7",
    `งบประมาณที่ใช้ทั้งสิ้น  ${money(document.budget_total, "0")}  บาท`,
  );

  ensure(22);
  const source = clean(document.budget_source);
  let sourceX = MARGIN_LEFT + 38;
  const subsidyChecked = source.includes("เงินอุดหนุน");
  const incomeChecked = source.includes("เงินรายได้สถานศึกษา");
  const otherChecked = Boolean(source) && !subsidyChecked && !incomeChecked;
  const otherSource = source === "อื่นๆ (ระบุ)" ? "" : source;

  sourceX += drawCheckbox("เงินอุดหนุน", subsidyChecked, sourceX, y) + 14;
  sourceX +=
    drawCheckbox("เงินรายได้สถานศึกษา", incomeChecked, sourceX, y) + 14;
  drawCheckbox(
    `อื่น ๆ (ระบุ) ${otherChecked && otherSource ? otherSource : "................................"}`,
    otherChecked,
    sourceX,
    y,
  );
  y += 21;

  const budgetItems = Array.isArray(document.budget_items)
    ? document.budget_items
    : [];
  const budgetRows: Cell[][] = budgetItems.map((row: any) => {
    const rowTotal =
      Number(row.compensation || 0) +
      Number(row.expenses || 0) +
      Number(row.materials || 0);

    return [
      { text: row.description },
      { text: money(row.compensation, ""), align: "center" },
      { text: money(row.expenses, ""), align: "center" },
      { text: money(row.materials, ""), align: "center" },
      { text: money(rowTotal, ""), align: "center" },
      { text: row.responsible },
    ];
  });
  const totalCompensation = sum(
    budgetItems.map((row: any) => row.compensation),
  );
  const totalExpenses = sum(budgetItems.map((row: any) => row.expenses));
  const totalMaterials = sum(budgetItems.map((row: any) => row.materials));

  budgetRows.push([
    { text: "รวมทั้งสิ้น", align: "center", bold: true },
    { text: "", align: "center" },
    { text: "", align: "center" },
    { text: "", align: "center" },
    {
      text: money(totalCompensation + totalExpenses + totalMaterials, "0"),
      align: "center",
      bold: true,
    },
    { text: "" },
  ]);
  drawTable(
    [
      {
        text: "กิจกรรม/รายการใช้งบประมาณ\n(ระบุรายละเอียดการใช้เงิน)",
        width: 120,
      },
      { text: "ค่าตอบแทน", width: 64, align: "center" },
      { text: "ค่าใช้สอย", width: 57, align: "center" },
      { text: "ค่าวัสดุ", width: 64, align: "center" },
      { text: "รวม", width: 64, align: "center" },
      { text: "ผู้รับผิดชอบ\n(บุคคล/กลุ่มงาน)", width: 119, align: "center" },
    ],
    budgetRows,
    {
      groupedBudgetHeader: true,
      headerHeight: 63,
      totalRow: budgetRows.length - 1,
    },
  );

  heading("8", "การวัดและประเมินผล");
  drawTable(
    [
      { text: "ที่", width: 28, align: "center" },
      { text: "ตัวชี้วัดความสำเร็จ", width: 286 },
      { text: "วิธีวัด", width: 78, align: "center" },
      { text: "เครื่องมือที่ใช้", width: 96, align: "center" },
    ],
    (document.evaluations || []).map((row: any, index: number) => [
      { text: `8.${index + 1}`, align: "center" },
      { text: row.indicator },
      { text: row.method, align: "center" },
      { text: row.tool, align: "center" },
    ]),
  );
  heading("9", "ผลที่คาดว่าจะได้รับ");
  numberedList(document.expected_results, "9");

  const signatories = Array.isArray(document.signatories)
    ? document.signatories
    : [];

  if (signatories.length) {
    const requiredHeight = Math.ceil(signatories.length / 2) * 112;

    if (y + requiredHeight + 18 > PAGE_HEIGHT - BOTTOM) addPage();
    y += 18;
    drawSignatories(signatories);
  }

  pdf.setTitle(`เอกสารโครงการ ${clean(document.project_name)}`);
  pdf.setAuthor("โรงเรียนขุขันธ์");
  pdf.setSubject("เอกสารข้อเสนอโครงการตามแผนปฏิบัติการ");

  return pdf.save();
}
