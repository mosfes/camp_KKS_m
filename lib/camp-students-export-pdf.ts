import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, PDFPage, rgb } from "pdf-lib";

import { loadPublicAsset } from "@/lib/pdf-assets";

// A4 Landscape
const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;
const MARGIN_X = 40;
const TOP = 35;
const BOTTOM = 35;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2; // 761.89 pt

interface StudentRecord {
  studentId: number;
  name: string;
  nickname: string | null;
  classroom: string;
  tel: string | null;
  foodAllergy: string | null;
  chronicDisease: string | null;
  remark: string | null;
  certificateNo?: number | null;
}

interface CampStudentsPdfData {
  campName: string;
  summary: {
    totalStudents: number;
    allergiesCount: number;
    chronicDiseasesCount: number;
    remarksCount: number;
  };
  students: StudentRecord[];
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

export async function createCampStudentsPdf(
  data: CampStudentsPdfData,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();

  pdf.registerFontkit(fontkit);

  const fontBytes = await loadPublicAsset("fonts/THSarabunNew.ttf");
  const font = await pdf.embedFont(fontBytes, { subset: true });

  let logo: any = null;

  try {
    const logoBytes = await loadPublicAsset("images/logoKKS.png");

    logo = await pdf.embedPng(logoBytes);
  } catch {
    // Logo fallback
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
    size = 13,
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

  const wrap = (text: string, maxWidth: number, size = 13) => {
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
    const logoHeight = 40;
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
      "รายงานข้อมูลนักเรียนในค่าย",
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

    y += Math.max(logoHeight, 44) + 12;

    // Camp Name & Summary Stats Bar
    const barHeight = 26;

    page.drawRectangle({
      x: MARGIN_X,
      y: PAGE_HEIGHT - y - barHeight,
      width: CONTENT_WIDTH,
      height: barHeight,
      color: rgb(0.94, 0.96, 0.95),
      borderColor: rgb(0.82, 0.88, 0.85),
      borderWidth: 0.8,
    });

    drawAt(
      `ชื่อค่าย / โครงการ: ${data.campName || "ไม่ระบุชื่อค่าย"}`,
      MARGIN_X + 10,
      y + 5,
      13,
      rgb(0.15, 0.35, 0.28),
    );

    const summaryText = `นักเรียนทั้งหมด: ${data.summary.totalStudents} คน | แพ้อาหาร: ${data.summary.allergiesCount} คน | โรคประจำตัว: ${data.summary.chronicDiseasesCount} คน | ข้อมูลอื่นๆ: ${data.summary.remarksCount} คน`;
    const sumWidth = font.widthOfTextAtSize(summaryText, 11);

    drawAt(
      summaryText,
      PAGE_WIDTH - MARGIN_X - sumWidth - 10,
      y + 6,
      11,
      rgb(0.3, 0.45, 0.38),
    );

    y += barHeight + 14;
  };

  // Start Page 1
  addPage();
  drawHeaderBanner();

  // Table Columns
  const headers: Cell[] = [
    { text: "ลำดับ", width: 35, align: "center" },
    { text: "รหัสนักเรียน", width: 65, align: "center" },
    { text: "ชื่อ - นามสกุล", width: 145, align: "left" },
    { text: "ชื่อเล่น", width: 55, align: "center" },
    { text: "ระดับชั้น / ห้อง", width: 75, align: "center" },
    { text: "เบอร์โทร", width: 75, align: "center" },
    { text: "แพ้อาหาร", width: 105, align: "left" },
    { text: "โรคประจำตัว", width: 105, align: "left" },
    { text: "เงื่อนไขพิเศษ / อื่นๆ", width: 101.89, align: "left" },
  ];

  const fontSize = 11;
  const padding = 4;
  const headerHeight = 24;
  const rowHeight = 22;
  const headerBg = { r: 0.88, g: 0.93, b: 0.9 };

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

      drawAt(header.text, alignedX, y + 5, fontSize, rgb(0.15, 0.25, 0.2));
      curX += header.width;
    });
    y += headerHeight;
  };

  renderHeaderRow();

  data.students.forEach((student, index) => {
    if (y + rowHeight > PAGE_HEIGHT - BOTTOM) {
      addPage();
      renderHeaderRow();
    }

    const rowValues = [
      String(index + 1),
      String(student.studentId),
      student.name,
      student.nickname || "-",
      student.classroom || "-",
      student.tel || "-",
      student.foodAllergy || "-",
      student.chronicDisease || "-",
      student.remark || "-",
    ];

    let curX = MARGIN_X;
    const isEven = index % 2 === 0;
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

      const cellValue = clean(rowValues[colIndex]) || "-";
      const truncated =
        wrap(cellValue, header.width - padding * 2, fontSize)[0] || "-";
      const textWidth = font.widthOfTextAtSize(truncated, fontSize);
      const alignedX =
        header.align === "right"
          ? curX + header.width - padding - textWidth
          : header.align === "center"
            ? curX + (header.width - textWidth) / 2
            : curX + padding;

      // Color allergy & disease highlights if not empty
      let textColor = rgb(0.2, 0.2, 0.2);

      if (colIndex === 6 && cellValue !== "-") {
        textColor = rgb(0.8, 0.2, 0.2); // Red for allergies
      } else if (colIndex === 7 && cellValue !== "-") {
        textColor = rgb(0.15, 0.45, 0.35); // Sage/Green for chronic diseases
      }

      drawAt(truncated, alignedX, y + 4, fontSize, textColor);
      curX += header.width;
    });

    y += rowHeight;
  });

  // Page Numbers & Footer
  const totalPages = pages.length;

  pages.forEach((pg, index) => {
    const pageNumText = `หน้า ${index + 1} จาก ${totalPages} หน้า`;
    const numWidth = font.widthOfTextAtSize(pageNumText, 10);

    pg.drawText(pageNumText, {
      x: PAGE_WIDTH - MARGIN_X - numWidth,
      y: 18,
      size: 10,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });

    pg.drawText("ระบบจัดการค่าย KKS Camp • รายงานข้อมูลนักเรียนในค่าย", {
      x: MARGIN_X,
      y: 18,
      size: 10,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });
  });

  return pdf.save();
}
