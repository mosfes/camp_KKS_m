import {
  AlignmentType,
  BorderStyle,
  Document,
  ImageRun,
  PageBreak,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";

export const DOCX_FONT = "TH SarabunPSK";
export const BODY_SIZE = 32;
const SINGLE_LINE_SPACING = 240;

export const PAGE_WIDTH = 11906;
export const PAGE_HEIGHT = 16838;
export const PAGE_MARGIN = 1134;
export const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;
const DOCX_FONT_FAMILY = {
  ascii: DOCX_FONT,
  hAnsi: DOCX_FONT,
  eastAsia: DOCX_FONT,
  cs: DOCX_FONT,
  hint: "eastAsia",
} as const;

export type DocxCell = {
  text: unknown;
  align?: (typeof AlignmentType)[keyof typeof AlignmentType];
  bold?: boolean;
  shading?: string;
};

export function clean(value: unknown) {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .trim();
}

export function list(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

export function money(value: unknown, empty = "0") {
  const amount = Number(value || 0);

  return amount
    ? amount.toLocaleString("th-TH", { maximumFractionDigits: 2 })
    : empty;
}

export function textRuns(
  value: unknown,
  options: {
    bold?: boolean;
    size?: number;
    italics?: boolean;
    preserveWhitespace?: boolean;
  } = {},
) {
  const text = options.preserveWhitespace
    ? String(value ?? "").replace(/\r\n/g, "\n")
    : clean(value) || "-";
  const lines = text.split("\n");

  return lines.map(
    (line, index) =>
      new TextRun({
        text: line || " ",
        break: index ? 1 : undefined,
        bold: options.bold,
        italics: options.italics,
        size: options.size ?? BODY_SIZE,
        font: DOCX_FONT_FAMILY,
        sizeComplexScript: options.size ?? BODY_SIZE,
        color: "000000",
      }),
  );
}

export function paragraph(
  value: unknown,
  options: {
    bold?: boolean;
    size?: number;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    indent?: number;
    firstLineIndent?: number;
    spaceBefore?: number;
    spaceAfter?: number;
    keepNext?: boolean;
    pageBreakBefore?: boolean;
  } = {},
) {
  return new Paragraph({
    children: textRuns(value, { bold: options.bold, size: options.size }),
    alignment: options.align,
    indent:
      options.indent || options.firstLineIndent
        ? {
            left: options.indent,
            firstLine: options.firstLineIndent,
          }
        : undefined,
    spacing: {
      before: options.spaceBefore ?? 0,
      after: options.spaceAfter ?? 80,
      line: SINGLE_LINE_SPACING,
    },
    keepNext: options.keepNext,
    pageBreakBefore: options.pageBreakBefore,
  });
}

export function richParagraph(
  runs: Array<{ text: unknown; bold?: boolean; size?: number }>,
  options: {
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    indent?: number;
    spaceBefore?: number;
    spaceAfter?: number;
    keepNext?: boolean;
  } = {},
) {
  return new Paragraph({
    children: runs.flatMap((run) =>
      textRuns(run.text, {
        bold: run.bold,
        size: run.size,
        preserveWhitespace: true,
      }),
    ),
    alignment: options.align,
    indent: options.indent ? { left: options.indent } : undefined,
    spacing: {
      before: options.spaceBefore ?? 0,
      after: options.spaceAfter ?? 80,
      line: SINGLE_LINE_SPACING,
    },
    keepNext: options.keepNext,
  });
}

export function title(value: unknown, size = 36) {
  return paragraph(value, {
    bold: true,
    size,
    align: AlignmentType.CENTER,
    spaceAfter: 0,
    keepNext: true,
  });
}

export function heading(number: string, value: string) {
  return paragraph(`${number}. ${value}`, {
    bold: true,
    spaceBefore: 180,
    spaceAfter: 60,
    keepNext: true,
  });
}

export function numberedParagraphs(values: unknown, prefix = "", indent = 360) {
  const items = list(values).map(clean).filter(Boolean);

  if (!items.length) return [paragraph("-", { indent })];

  return items.map((item, index) =>
    richParagraph(
      [{ text: `${prefix ? `${prefix}.` : ""}${index + 1}  ` }, { text: item }],
      { indent, spaceAfter: 20 },
    ),
  );
}

const tableBorders = {
  top: { style: BorderStyle.SINGLE, size: 4, color: "D9D9D9" },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: "D9D9D9" },
  left: { style: BorderStyle.SINGLE, size: 4, color: "D9D9D9" },
  right: { style: BorderStyle.SINGLE, size: 4, color: "D9D9D9" },
  insideHorizontal: {
    style: BorderStyle.SINGLE,
    size: 4,
    color: "D9D9D9",
  },
  insideVertical: { style: BorderStyle.SINGLE, size: 4, color: "D9D9D9" },
};

function cell(cell: DocxCell, width: number, header = false) {
  const align =
    cell.align ?? (header ? AlignmentType.CENTER : AlignmentType.LEFT);

  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    shading:
      header || cell.shading ? { fill: cell.shading ?? "DCE6E1" } : undefined,
    margins: { top: 100, bottom: 100, left: 100, right: 100 },
    children: [
      new Paragraph({
        children: textRuns(cell.text, {
          bold: header || cell.bold,
          size: 28,
        }),
        alignment: align,
        spacing: { before: 0, after: 0, line: SINGLE_LINE_SPACING },
      }),
    ],
  });
}

export function table(
  headers: DocxCell[],
  rows: DocxCell[][],
  widths: number[],
) {
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    borders: tableBorders,
    rows: [
      new TableRow({
        tableHeader: true,
        cantSplit: true,
        children: headers.map((item, index) => cell(item, widths[index], true)),
      }),
      ...rows.map(
        (row) =>
          new TableRow({
            cantSplit: false,
            children: row.map((item, index) => cell(item, widths[index])),
          }),
      ),
    ],
  });
}

export function spacer(after = 120) {
  return new Paragraph({ spacing: { after } });
}

export function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

export function checkbox(selected: boolean, label: string) {
  return `${selected ? "☑" : "☐"} ${label}`;
}

export function imageParagraph(
  data: Uint8Array,
  type: "png" | "jpg",
  width: number,
  height: number,
) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 120 },
    children: [new ImageRun({ data, type, transformation: { width, height } })],
  });
}

export function makeDocument(
  children: Array<Paragraph | Table>,
  titleText: string,
) {
  return new Document({
    creator: "โรงเรียนขุขันธ์",
    title: titleText,
    description: titleText,
    styles: {
      default: {
        document: {
          run: {
            font: DOCX_FONT_FAMILY,
            size: BODY_SIZE,
            sizeComplexScript: BODY_SIZE,
            color: "000000",
          },
          paragraph: {
            spacing: { line: SINGLE_LINE_SPACING, after: 80 },
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: PAGE_WIDTH, height: PAGE_HEIGHT },
            margin: {
              top: PAGE_MARGIN,
              bottom: PAGE_MARGIN,
              left: PAGE_MARGIN,
              right: PAGE_MARGIN,
            },
          },
        },
        children,
      },
    ],
  });
}
