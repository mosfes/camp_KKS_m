import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, PDFPage, rgb } from "pdf-lib";

import { loadPublicAsset } from "@/lib/pdf-assets";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 40;
const TOP = 40;
const BOTTOM = 40;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2; // 515.28

interface StudentItem {
  enrollmentId: number;
  studentId: number;
  name: string;
  nickname: string | null;
  classroom: string;
  shirtSize: string | null;
  enrolledAt?: string;
}

interface ShirtPdfData {
  campName: string;
  summary: Record<string, number>;
  totalShirts: number;
  totalStudents: number;
  students: StudentItem[];
}

type Cell = {
  text: string;
  width: number;
  align?: "left" | "center" | "right";
};

function clean(value: unknown) {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .trim();
}

export async function createShirtPdf(data: ShirtPdfData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();

  pdf.registerFontkit(fontkit);

  const fontBytes = await loadPublicAsset("fonts/THSarabunNew.ttf");
  const font = await pdf.embedFont(fontBytes, { subset: true });

  let logo: any = null;

  try {
    const logoBytes = await loadPublicAsset("images/logoKKS.png");

    logo = await pdf.embedPng(logoBytes);
  } catch {
    // Graceful fallback if logo is not found
  }

  const pages: PDFPage[] = [];
  let page!: PDFPage;
  let y = TOP;

  const addPage = () => {
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pages.push(page);
    y = TOP;
  };

  const drawAt = (
    text: string,
    x: number,
    top: number,
    size = 14,
    color = rgb(0.1, 0.1, 0.1),
  ) => {
    page.drawText(text, {
      x,
      y: PAGE_HEIGHT - top - size,
      size,
      font,
      color,
    });
  };

  const segments = (text: string): string[] => {
    const normalized = clean(text);

    if (!normalized) return [""];
    if (typeof Intl !== "undefined" && (Intl as any).Segmenter) {
      const segmenter = new (Intl as any).Segmenter("th", {
        granularity: "word",
      });

      return Array.from(
        segmenter.segment(normalized) as Iterable<{ segment: string }>,
        (item) => item.segment,
      );
    }

    return normalized.split(" ");
  };

  const wrap = (text: string, maxWidth: number, size = 14) => {
    const output: string[] = [];

    for (const paragraph of clean(text).split("\n")) {
      if (!paragraph) {
        output.push("");
        continue;
      }
      let line = "";

      for (const segment of segments(paragraph)) {
        const candidate = line + segment;

        if (!line || font.widthOfTextAtSize(candidate, size) <= maxWidth) {
          line = candidate;
          continue;
        }
        output.push(line.trimEnd());
        if (font.widthOfTextAtSize(segment, size) <= maxWidth) {
          line = segment.trimStart();
        } else {
          let part = "";

          for (const character of Array.from(segment)) {
            if (
              part &&
              font.widthOfTextAtSize(part + character, size) > maxWidth
            ) {
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
    if (y + height > PAGE_HEIGHT - BOTTOM) {
      addPage();
    }
  };

  const drawHeaderBanner = () => {
    // Header section with Logo and Document Title
    const logoHeight = 44;
    const logoWidth = logo ? (logo.width / logo.height) * logoHeight : 0;

    if (logo) {
      page.drawImage(logo, {
        x: MARGIN_X,
        y: PAGE_HEIGHT - y - logoHeight,
        width: logoWidth,
        height: logoHeight,
      });
    }

    const textStartX = logo ? MARGIN_X + logoWidth + 12 : MARGIN_X;

    drawAt(
      "ระบบจัดการค่าย KKS Camp",
      textStartX,
      y + 1,
      12,
      rgb(0.4, 0.45, 0.45),
    );
    drawAt(
      "รายงานสรุปรายการจองเสื้อ",
      textStartX,
      y + 22,
      18,
      rgb(0.12, 0.28, 0.22),
    );

    const dateStr = new Date().toLocaleDateString("th-TH", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const dateText = `พิมพ์เมื่อ: ${dateStr} น.`;
    const dateWidth = font.widthOfTextAtSize(dateText, 11);

    drawAt(
      dateText,
      PAGE_WIDTH - MARGIN_X - dateWidth,
      y + 4,
      11,
      rgb(0.45, 0.45, 0.45),
    );

    y += Math.max(logoHeight, 44) + 14;

    // Camp Name Box
    const campBoxHeight = 28;

    page.drawRectangle({
      x: MARGIN_X,
      y: PAGE_HEIGHT - y - campBoxHeight,
      width: CONTENT_WIDTH,
      height: campBoxHeight,
      color: rgb(0.94, 0.96, 0.95),
      borderColor: rgb(0.82, 0.88, 0.85),
      borderWidth: 0.8,
    });

    drawAt(
      `ชื่อค่าย / โครงการ: ${data.campName || "ไม่ระบุชื่อค่าย"}`,
      MARGIN_X + 10,
      y + 6,
      13,
      rgb(0.15, 0.35, 0.28),
    );

    y += campBoxHeight + 18;
  };

  const drawTable = (
    headers: Cell[],
    rows: string[][],
    options: {
      tableTitle?: string;
      headerBgColor?: { r: number; g: number; b: number };
      fontSize?: number;
      rowHeight?: number;
      titleGap?: number;
      marginBottom?: number;
    } = {},
  ) => {
    const fontSize = options.fontSize || 12;
    const padding = 4;
    const headerHeight = 24;
    const rowHeight = options.rowHeight || 22;
    const headerBg = options.headerBgColor || { r: 0.91, g: 0.94, b: 0.92 };
    const titleGap = options.titleGap ?? 22;
    const marginBottom = options.marginBottom ?? 24;

    if (options.tableTitle) {
      ensure(36);
      drawAt(options.tableTitle, MARGIN_X, y, 14, rgb(0.12, 0.28, 0.22));
      y += titleGap;
    }

    const renderHeaderRow = () => {
      ensure(headerHeight);
      let curX = MARGIN_X;

      headers.forEach((header) => {
        page.drawRectangle({
          x: curX,
          y: PAGE_HEIGHT - y - headerHeight,
          width: header.width,
          height: headerHeight,
          color: rgb(headerBg.r, headerBg.g, headerBg.b),
          borderColor: rgb(0.75, 0.82, 0.78),
          borderWidth: 0.7,
        });

        const textWidth = font.widthOfTextAtSize(header.text, fontSize);
        const alignedX =
          header.align === "right"
            ? curX + header.width - padding - textWidth
            : header.align === "center"
              ? curX + (header.width - textWidth) / 2
              : curX + padding;

        drawAt(header.text, alignedX, y + 4, fontSize, rgb(0.15, 0.25, 0.2));
        curX += header.width;
      });
      y += headerHeight;
    };

    renderHeaderRow();

    rows.forEach((row, rowIndex) => {
      if (y + rowHeight > PAGE_HEIGHT - BOTTOM) {
        addPage();
        renderHeaderRow();
      }

      let curX = MARGIN_X;
      const isEven = rowIndex % 2 === 0;
      const rowBg = isEven ? rgb(1, 1, 1) : rgb(0.97, 0.98, 0.98);

      headers.forEach((header, colIndex) => {
        page.drawRectangle({
          x: curX,
          y: PAGE_HEIGHT - y - rowHeight,
          width: header.width,
          height: rowHeight,
          color: rowBg,
          borderColor: rgb(0.85, 0.88, 0.86),
          borderWidth: 0.5,
        });

        const cellValue = clean(row[colIndex]) || "-";
        const truncated =
          wrap(cellValue, header.width - padding * 2, fontSize)[0] || "-";
        const textWidth = font.widthOfTextAtSize(truncated, fontSize);
        const alignedX =
          header.align === "right"
            ? curX + header.width - padding - textWidth
            : header.align === "center"
              ? curX + (header.width - textWidth) / 2
              : curX + padding;

        drawAt(truncated, alignedX, y + 4, fontSize, rgb(0.2, 0.2, 0.2));
        curX += header.width;
      });

      y += rowHeight;
    });

    y += marginBottom;
  };

  // Start Page 1
  addPage();
  drawHeaderBanner();

  // 1. Summary Section
  const summaryHeaders: Cell[] = [
    { text: "ขนาดเสื้อ (Size)", width: 170, align: "center" },
    { text: "จำนวน (ตัว)", width: 170, align: "center" },
    { text: "สัดส่วน (%)", width: 175.28, align: "center" },
  ];

  const summaryRows: string[][] = Object.entries(data.summary).map(
    ([size, count]) => {
      const pct =
        data.totalStudents > 0
          ? `${((count / data.totalStudents) * 100).toFixed(1)}%`
          : "0%";

      return [size, `${count} ตัว`, pct];
    },
  );

  // Total summary row
  summaryRows.push([
    "รวมยอดจองเสื้อทั้งหมด",
    `${data.totalShirts} ตัว`,
    data.totalStudents > 0
      ? `${((data.totalShirts / data.totalStudents) * 100).toFixed(1)}%`
      : "100%",
  ]);

  drawTable(summaryHeaders, summaryRows, {
    tableTitle: `1. สรุปยอดจองเสื้อ (ยอดสั่งทำรวม ${data.totalShirts} ตัว / สมาชิกทั้งหมด ${data.totalStudents} คน)`,
    headerBgColor: { r: 0.88, g: 0.93, b: 0.9 },
  });

  // 2. Student List Section
  const studentHeaders: Cell[] = [
    { text: "ลำดับ", width: 35, align: "center" },
    { text: "รหัสนักเรียน", width: 68, align: "center" },
    { text: "ชื่อ - นามสกุล", width: 175, align: "left" },
    { text: "ชื่อเล่น", width: 60, align: "center" },
    { text: "ระดับชั้น / ห้อง", width: 102.28, align: "center" },
    { text: "ไซส์เสื้อ", width: 75, align: "center" },
  ];

  const studentRows: string[][] = data.students.map((student, index) => [
    String(index + 1),
    String(student.studentId),
    student.name,
    student.nickname || "-",
    student.classroom || "-",
    student.shirtSize ? `ไซส์ ${student.shirtSize}` : "รอระบุไซส์",
  ]);

  drawTable(studentHeaders, studentRows, {
    tableTitle: "2. รายชื่อนักเรียนและการเลือกไซส์เสื้อ",
    headerBgColor: { r: 0.88, g: 0.93, b: 0.9 },
  });

  // Add Page Numbers & Footer to all pages
  const totalPages = pages.length;

  pages.forEach((pg, index) => {
    const pageNumText = `หน้า ${index + 1} จาก ${totalPages} หน้า`;
    const numWidth = font.widthOfTextAtSize(pageNumText, 10);

    pg.drawText(pageNumText, {
      x: PAGE_WIDTH - MARGIN_X - numWidth,
      y: 20,
      size: 10,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });

    pg.drawText("ระบบจัดการค่าย KKS Camp • รายงานการจองเสื้อ", {
      x: MARGIN_X,
      y: 20,
      size: 10,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });
  });

  return pdf.save();
}
