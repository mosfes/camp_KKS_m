import { readFile } from "node:fs/promises";
import path from "node:path";

import { AlignmentType, Packer, Paragraph, Table } from "docx";

import {
  checkbox,
  clean,
  imageParagraph,
  list,
  makeDocument,
  money,
  numberedParagraphs,
  pageBreak,
  paragraph,
  richParagraph,
  spacer,
  table,
  title,
} from "@/lib/project-docx";
import { normalizeProjectSummaryStandards } from "@/lib/project-summary-standards";

function statusLabel(value: unknown) {
  const labels: Record<string, string> = {
    COMPLETED: "ดำเนินการเสร็จสิ้น",
    IN_PROGRESS: "อยู่ระหว่างดำเนินการ",
    NOT_STARTED: "ยังไม่ดำเนินการ",
  };

  return labels[clean(value)] || clean(value) || "-";
}

function selectedOptions(selected: unknown, options: string[]) {
  return options
    .map((option) => checkbox(clean(selected) === option, option))
    .join("    ");
}

function pdfMatchedHeading(number: string, value: string) {
  return paragraph(`${number}. ${value}`, {
    spaceBefore: 180,
    spaceAfter: 60,
    keepNext: true,
  });
}

function imageInfo(data: Uint8Array, contentType: string | null) {
  if (
    data.length > 24 &&
    data[0] === 0x89 &&
    data[1] === 0x50 &&
    data[2] === 0x4e &&
    data[3] === 0x47
  ) {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

    return {
      type: "png" as const,
      width: view.getUint32(16),
      height: view.getUint32(20),
    };
  }
  if (data.length > 4 && data[0] === 0xff && data[1] === 0xd8) {
    let offset = 2;

    while (offset + 9 < data.length) {
      if (data[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = data[offset + 1];
      const length = (data[offset + 2] << 8) + data[offset + 3];

      if (
        [
          0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd,
          0xce, 0xcf,
        ].includes(marker)
      ) {
        return {
          type: "jpg" as const,
          width: (data[offset + 7] << 8) + data[offset + 8],
          height: (data[offset + 5] << 8) + data[offset + 6],
        };
      }
      if (!length) break;
      offset += length + 2;
    }
  }

  return {
    type: contentType?.includes("png") ? ("png" as const) : ("jpg" as const),
    width: 1200,
    height: 800,
  };
}

function scaledImage(width: number, height: number) {
  const scale = Math.min(600 / width, 380 / height, 1);

  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

export async function createProjectSummaryDocumentDocx(document: any) {
  const children: Array<Paragraph | Table> = [];

  try {
    const logo = await readFile(
      path.join(process.cwd(), "public/images/logoKKS.png"),
    );

    children.push(imageParagraph(new Uint8Array(logo), "png", 82, 82));
  } catch {
    // Keep Word export available without the optional logo.
  }

  const quantitative = list(document.quantitative_results);
  const qualitative = list(document.qualitative_results);
  const indicators = list(document.success_indicators);
  const evaluations = list(document.evaluation_results);
  const assessment = document.operation_assessment || {};
  const standards = normalizeProjectSummaryStandards(
    document.standard_alignments,
  );

  children.push(
    title("โรงเรียนขุขันธ์"),
    title("รายงานการดำเนินโครงการ"),
    title(
      `${clean(document.department) || "กลุ่มสาระ/กลุ่มงาน"} ปีงบประมาณ ${clean(document.fiscal_year) || "-"}`,
    ),
    spacer(200),
    richParagraph([
      { text: "1. ชื่อโครงการ  " },
      { text: clean(document.project_name) || "-" },
    ]),
    richParagraph(
      [{ text: "กิจกรรม  " }, { text: clean(document.activity_name) || "-" }],
      { indent: 360 },
    ),
    richParagraph(
      [
        { text: "ลำดับกิจกรรมที่  " },
        { text: clean(document.activity_order) || "-" },
      ],
      { indent: 360 },
    ),
    pdfMatchedHeading("2", "ลักษณะโครงการ"),
    paragraph(
      [
        checkbox(document.project_nature === "NEW", "ใหม่"),
        checkbox(document.project_nature === "CONTINUING", "ต่อเนื่อง"),
        checkbox(
          document.project_nature === "IN_EVALUATION_PLAN",
          "อยู่ในแผนประเมิน",
        ),
        checkbox(
          document.project_nature === "OUTSIDE_ACTION_PLAN",
          "นอกแผนปฏิบัติการ",
        ),
      ].join("    "),
      { indent: 360 },
    ),
    richParagraph([
      { text: "3. ผู้รับผิดชอบ  " },
      { text: clean(document.responsible_people) || "-" },
    ]),
    pdfMatchedHeading("4", "สอดคล้องกับมาตรฐานการศึกษา"),
  );

  if (standards.length) {
    standards.forEach((standard) => {
      children.push(
        paragraph(
          `${checkbox(Boolean(standard.achieved), clean(standard.title) || "มาตรฐาน")}${standard.relatedItems ? `    รายการที่ ${standard.relatedItems}` : ""}`,
          { indent: 360, spaceAfter: 20 },
        ),
      );
      standard.subItems.forEach((item) => {
        const label = [clean(item.code), clean(item.title)]
          .filter(Boolean)
          .join(" ");

        children.push(
          paragraph(
            `${checkbox(Boolean(item.achieved), label)}${clean(item.relatedItems) ? `    รายการที่ ${clean(item.relatedItems)}` : ""}`,
            { indent: 620, spaceAfter: 20 },
          ),
        );
      });
    });
  } else {
    children.push(paragraph(clean(document.standards) || "-", { indent: 360 }));
  }

  children.push(
    pdfMatchedHeading("5", "วัตถุประสงค์ของโครงการ"),
    ...numberedParagraphs(document.objectives, "", 360),
    pdfMatchedHeading("6", "การดำเนินการ"),
    paragraph(
      selectedOptions(statusLabel(document.execution_status), [
        "ดำเนินการเสร็จสิ้น",
        "อยู่ระหว่างดำเนินการ",
        "ยังไม่ดำเนินการ",
      ]),
      { indent: 360 },
    ),
    richParagraph([
      { text: "7. ระยะเวลาในการดำเนินการ  " },
      { text: clean(document.duration_text) || "-" },
    ]),
    richParagraph([
      { text: "8. สถานที่ดำเนินงาน  " },
      { text: clean(document.location_text) || "-" },
    ]),
    pdfMatchedHeading("9", "ตัวชี้วัดความสำเร็จของโครงการ"),
    paragraph("เชิงปริมาณ", { bold: true, indent: 360, keepNext: true }),
    ...numberedParagraphs(
      quantitative.map((row) => clean(row.indicator) || clean(row.target)),
      "",
      620,
    ),
    paragraph("เชิงคุณภาพ", { bold: true, indent: 360, keepNext: true }),
    ...numberedParagraphs(
      qualitative.map((row) => clean(row.indicator) || clean(row.target)),
      "",
      620,
    ),
    pageBreak(),
    pdfMatchedHeading("10", "งบประมาณโครงการ"),
    paragraph(
      `งบประมาณที่ได้รับ ${money(document.budget_received)} บาท    งบประมาณที่ใช้ไปทั้งหมด ${money(document.budget_spent)} บาท`,
      { indent: 360 },
    ),
    paragraph(
      `งบประมาณคงเหลือ ${money(Math.max(0, Number(document.budget_received || 0) - Number(document.budget_spent || 0)))} บาท    งบประมาณที่ใช้เกิน ${money(Math.max(0, Number(document.budget_spent || 0) - Number(document.budget_received || 0)))} บาท`,
      { indent: 360 },
    ),
    pdfMatchedHeading("11", "ผลการประเมินตัวชี้วัดความสำเร็จของโครงการ"),
    table(
      [
        { text: "ข้อที่" },
        { text: "ตัวชี้วัดความสำเร็จโครงการ" },
        { text: "เป้าหมาย" },
        { text: "ผลการดำเนินงาน" },
        { text: "บรรลุเป้าหมาย" },
      ],
      indicators.map((row, index) => [
        { text: String(index + 1), align: AlignmentType.CENTER },
        { text: clean(row.indicator) },
        {
          text:
            row.valueType === "PERCENT"
              ? `ร้อยละ ${clean(row.target) || "-"}`
              : clean(row.target),
          align: AlignmentType.CENTER,
        },
        {
          text:
            row.valueType === "PERCENT"
              ? `ร้อยละ ${clean(row.result) || "-"}`
              : clean(row.result),
          align: AlignmentType.CENTER,
        },
        { text: statusLabel(row.status), align: AlignmentType.CENTER },
      ]),
      [620, 3700, 1400, 1700, 2218],
    ),
    spacer(),
  );

  const assessed = indicators.filter(
    (row) => clean(row.status) && clean(row.status) !== "ยังไม่ประเมิน",
  );
  const reached = assessed.filter((row) =>
    ["บรรลุเป้าหมาย", "สูงกว่าเป้าหมาย", "เท่ากับเป้าหมาย"].includes(
      clean(row.status),
    ),
  );

  children.push(
    paragraph(
      `สรุปผลสำเร็จของโครงการตามตัวชี้วัด คิดเป็นร้อยละ ${assessed.length ? Math.round((reached.length / assessed.length) * 100) : 0}`,
    ),
    pdfMatchedHeading("12", "การประเมินโครงการ"),
  );
  if (clean(document.evaluation_summary))
    children.push(paragraph(document.evaluation_summary, { indent: 360 }));
  children.push(
    table(
      [
        { text: "ที่" },
        { text: "รายการประเมิน" },
        { text: "ค่าเฉลี่ย (X)" },
        { text: "ค่าเบี่ยงเบนมาตรฐาน (S.D.)" },
        { text: "แปลผล" },
      ],
      evaluations.map((row, index) => [
        { text: String(index + 1), align: AlignmentType.CENTER },
        { text: clean(row.topic) },
        {
          text:
            row.average == null || row.average === ""
              ? "-"
              : Number(row.average).toFixed(2),
          align: AlignmentType.CENTER,
        },
        {
          text:
            row.sd == null || row.sd === "" ? "-" : Number(row.sd).toFixed(3),
          align: AlignmentType.CENTER,
        },
        { text: clean(row.interpretation) || "-", align: AlignmentType.CENTER },
      ]),
      [600, 5100, 1200, 1450, 1288],
    ),
    spacer(),
    table(
      [
        { text: "รวม" },
        { text: "ค่าเฉลี่ย" },
        { text: "S.D." },
        { text: "แปลผล" },
      ],
      [
        [
          { text: "ผลการประเมินความพึงพอใจโดยรวม" },
          {
            text:
              document.overall_average == null
                ? "-"
                : Number(document.overall_average).toFixed(2),
            align: AlignmentType.CENTER,
          },
          {
            text:
              document.overall_sd == null
                ? "-"
                : Number(document.overall_sd).toFixed(3),
            align: AlignmentType.CENTER,
          },
          {
            text:
              document.overall_average == null
                ? "-"
                : Number(document.overall_average) >= 4.5
                  ? "ดีเยี่ยม"
                  : "ดี",
            align: AlignmentType.CENTER,
          },
        ],
      ],
      [5700, 1200, 1200, 1538],
    ),
    spacer(),
  );

  if (list(document.top_strengths).length) {
    children.push(
      paragraph("สรุป ประเด็นที่มีความพึงพอใจสูงสุด"),
      ...numberedParagraphs(document.top_strengths),
    );
  }
  const suggestions = list(document.suggestions)
    .map(clean)
    .filter((value) => value && !/^[-–—\s]*$/.test(value));

  if (suggestions.length) {
    children.push(
      paragraph("ข้อเสนอแนะ / สิ่งที่อยากให้มีเพิ่มเติม", { bold: true }),
      ...numberedParagraphs(suggestions),
    );
  }

  children.push(
    paragraph(
      `ผลการดำเนินงานตามกิจกรรม ${clean(document.activity_name) || clean(document.project_name)}`,
      { bold: true, spaceBefore: 200 },
    ),
    richParagraph([
      { text: "คำชี้แจง  ", bold: true },
      {
        text: "โปรดทำเครื่องหมาย (√) หน้าหัวข้อที่กำหนดให้ถูกต้อง และให้เหตุผลในหัวข้อที่ระบุไว้",
      },
    ]),
  );
  const assessments: Array<[string, string, unknown, string[]]> = [
    [
      "1",
      "การดำเนินงาน",
      statusLabel(document.execution_status),
      ["ดำเนินการเสร็จสิ้น", "อยู่ระหว่างดำเนินการ", "ยังไม่ดำเนินการ"],
    ],
    [
      "2",
      "ผลการดำเนินการ เปรียบเทียบกับเป้าหมายด้านปริมาณ",
      assessment.quantitativeStatus,
      ["สูงกว่าเป้าหมาย", "เท่ากับเป้าหมาย", "ต่ำกว่าเป้าหมาย"],
    ],
    [
      "3",
      "ผลการดำเนินการ เปรียบเทียบกับเป้าหมายด้านคุณภาพ",
      assessment.qualitativeStatus,
      ["สูงกว่าเป้าหมาย", "เท่ากับเป้าหมาย", "ต่ำกว่าเป้าหมาย"],
    ],
    [
      "4",
      "จำนวนบุคลากร หรือผู้ดำเนินการมีความเหมาะสมเพียงใด",
      assessment.personnel,
      ["มากเกินไป", "เหมาะสมดี", "ยังต้องปรับปรุง"],
    ],
    [
      "5",
      "ความร่วมมือของผู้ร่วมงานในการดำเนินการ",
      assessment.cooperation,
      [
        "ได้รับความร่วมมือดีมาก",
        "ได้รับความร่วมมือปานกลาง",
        "ได้รับความร่วมมือน้อยมาก",
      ],
    ],
    [
      "6",
      "โครงการที่จัดขึ้นมีความเหมาะสม",
      assessment.projectAppropriateness,
      ["ดี", "พอใช้", "ต้องปรับปรุง"],
    ],
    [
      "7",
      "สถานที่ใช้ในการดำเนินการมีความเหมาะสม",
      assessment.location,
      ["ดี", "พอใช้", "ต้องปรับปรุง"],
    ],
    [
      "8",
      "ระยะเวลาในการดำเนินการ",
      assessment.schedule,
      ["ตามระบุไว้ในแผน", "เร็วกว่าที่ระบุไว้ในแผน", "ช้ากว่าที่ระบุไว้ในแผน"],
    ],
    [
      "9",
      "ค่าใช้จ่ายจริง",
      assessment.budget,
      [
        "สูงกว่างบประมาณที่ได้รับ",
        "เท่ากับงบประมาณที่ได้รับ",
        "ต่ำกว่างบประมาณที่ได้รับ",
      ],
    ],
  ];

  assessments.forEach(([number, label, selected, options]) => {
    children.push(
      paragraph(`${number}. ${label}`, { keepNext: true }),
      paragraph(selectedOptions(selected, options), {
        indent: 360,
        spaceAfter: 180,
      }),
    );
    if (number === "2")
      children.push(
        paragraph(`ร้อยละ ${clean(assessment.quantitativePercent) || "-"}`, {
          indent: 620,
        }),
      );
    if (number === "3")
      children.push(
        paragraph(`ร้อยละ ${clean(assessment.qualitativePercent) || "-"}`, {
          indent: 620,
        }),
      );
  });

  children.push(
    paragraph("10. ปัญหาและอุปสรรคที่เกิดขึ้นระหว่างการดำเนินการ", {
      keepNext: true,
    }),
    ...numberedParagraphs(clean(document.problems).split("\n").filter(Boolean)),
    paragraph("11. ข้อเสนอแนะและแนวทางในการปรับปรุง", {
      keepNext: true,
    }),
    ...numberedParagraphs(
      clean(document.recommendations).split("\n").filter(Boolean),
    ),
    pageBreak(),
    paragraph(
      "12. โครงการนี้มีความสอดคล้องกับบริบทโรงเรียน และเมื่อพิจารณาถึงประสิทธิภาพและประสิทธิผลในการดำเนินการของโครงการนี้ในปีการศึกษาต่อไปหรือไม่ เพราะเหตุใด",
    ),
    paragraph(clean(document.continuation_reason) || "-", {
      indent: 360,
      spaceAfter: 300,
    }),
  );

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

  signatories.forEach((item) => {
    children.push(
      paragraph("ลงชื่อ ........................................ ผู้รายงาน", {
        align: AlignmentType.CENTER,
        spaceAfter: 140,
      }),
      paragraph(`(${clean(item.name) || "................................"})`, {
        align: AlignmentType.CENTER,
        spaceAfter: 100,
      }),
    );
  });

  children.push(
    pageBreak(),
    paragraph("ภาคผนวก", {
      bold: true,
      size: 50,
      align: AlignmentType.CENTER,
      spaceBefore: 3800,
    }),
    pageBreak(),
    paragraph("ประมวลภาพ", {
      bold: true,
      size: 42,
      align: AlignmentType.CENTER,
      spaceBefore: 2400,
      spaceAfter: 160,
    }),
    paragraph("ประกอบการดำเนินกิจกรรม", {
      bold: true,
      size: 42,
      align: AlignmentType.CENTER,
    }),
    pageBreak(),
  );

  const photos = list(document.photos);

  for (let index = 0; index < photos.length; index += 1) {
    const photo = photos[index];

    try {
      const response = await fetch(photo.image_url);

      if (!response.ok) throw new Error("image response failed");
      const data = new Uint8Array(await response.arrayBuffer());
      const info = imageInfo(data, response.headers.get("content-type"));
      const dimensions = scaledImage(info.width, info.height);

      children.push(
        imageParagraph(data, info.type, dimensions.width, dimensions.height),
      );
    } catch {
      children.push(
        paragraph("ไม่สามารถแสดงรูปภาพนี้ได้", {
          align: AlignmentType.CENTER,
          spaceBefore: 1000,
          spaceAfter: 1000,
        }),
      );
    }
    if (clean(photo.caption))
      children.push(
        paragraph(photo.caption, {
          align: AlignmentType.CENTER,
          spaceAfter: 180,
        }),
      );
    if (index % 2 === 1 && index < photos.length - 1)
      children.push(pageBreak());
  }

  const file = makeDocument(
    children,
    `รายงานการดำเนินโครงการ ${clean(document.project_name)}`,
  );

  return Packer.toBuffer(file);
}
