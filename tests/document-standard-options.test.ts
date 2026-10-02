import assert from "node:assert/strict";
import test from "node:test";

import {
  documentIndicatorText,
  documentStandardClauses,
  formatStandardReferenceSelection,
  normalizeDocumentStandardOptions,
  readStandardReferenceSelection,
  updateStandardReferenceSelection,
  updateStandardReferenceText,
} from "../components/documents/DocumentStandardsChecklist";

test("normalizes active standard options and their indicators", () => {
  const options = normalizeDocumentStandardOptions([
    {
      document_reference_option_id: 1,
      category: "STANDARD",
      label: "มาตรฐานที่ 1",
      is_active: true,
      indicators: [
        { code: "1.1", label: "ผู้เรียนมีผลสัมฤทธิ์ทางการเรียน" },
        { code: "", label: "" },
      ],
    },
    {
      document_reference_option_id: 2,
      category: "STANDARD",
      label: "มาตรฐานที่ปิดใช้งาน",
      is_active: false,
    },
    {
      document_reference_option_id: 3,
      category: "STRATEGY",
      label: "กลยุทธ์ที่ 1",
    },
  ]);

  assert.deepEqual(options, [
    {
      document_reference_option_id: 1,
      label: "มาตรฐานที่ 1",
      indicators: [
        {
          code: "1.1",
          label: "ผู้เรียนมีผลสัมฤทธิ์ทางการเรียน",
          clauseCode: "",
          clauseLabel: "",
        },
      ],
    },
  ]);
});

test("exposes each indicator clause once so summary documents can select it", () => {
  const [standard] = normalizeDocumentStandardOptions([
    {
      document_reference_option_id: 1,
      category: "STANDARD",
      label: "มาตรฐานที่ 1 คุณภาพของผู้เรียน",
      indicators: [
        {
          code: "1.1.1",
          label: "การอ่านและการเขียน",
          clauseCode: "1.1",
          clauseLabel: "ผลสัมฤทธิ์ทางวิชาการของผู้เรียน",
        },
        {
          code: "1.1.2",
          label: "การคิดวิเคราะห์",
          clauseCode: "1.1",
          clauseLabel: "ผลสัมฤทธิ์ทางวิชาการของผู้เรียน",
        },
        {
          code: "1.2.1",
          label: "คุณลักษณะและค่านิยมที่ดี",
          clauseCode: "1.2",
          clauseLabel: "คุณลักษณะที่พึงประสงค์ของผู้เรียน",
        },
      ],
    },
  ]);

  assert.deepEqual(documentStandardClauses(standard), [
    { code: "1.1", label: "ผลสัมฤทธิ์ทางวิชาการของผู้เรียน" },
    { code: "1.2", label: "คุณลักษณะที่พึงประสงค์ของผู้เรียน" },
  ]);
});

test("adds selected standards without discarding custom text", () => {
  assert.equal(
    updateStandardReferenceText(
      "ข้อความเดิม",
      [],
      ["มาตรฐานที่ 1", "1.1 ผู้เรียนมีผลสัมฤทธิ์ทางการเรียน"],
    ),
    "ข้อความเดิม\nมาตรฐานที่ 1\n1.1 ผู้เรียนมีผลสัมฤทธิ์ทางการเรียน",
  );
});

test("removes only catalog lines when a standard is unchecked", () => {
  assert.equal(
    updateStandardReferenceText(
      "ข้อความเดิม\nมาตรฐานที่ 1\n1.1 ตัวชี้วัด",
      ["มาตรฐานที่ 1", "1.1 ตัวชี้วัด"],
      [],
    ),
    "ข้อความเดิม",
  );
  assert.equal(
    documentIndicatorText({ code: "1.1", label: "ตัวชี้วัด" }),
    "1.1 ตัวชี้วัด",
  );
});

test("formats selected standards and indicators as the compact document summary", () => {
  const standards = normalizeDocumentStandardOptions([
    {
      document_reference_option_id: 1,
      category: "STANDARD",
      label: "มาตรฐานที่ 1 คุณภาพของผู้เรียน",
      indicators: [
        {
          code: "1.1.2",
          label: "มีความสามารถในการคิดวิเคราะห์",
          clauseCode: "1.1",
          clauseLabel: "ผลสัมฤทธิ์ทางวิชาการของผู้เรียน",
        },
      ],
    },
    {
      document_reference_option_id: 3,
      category: "STANDARD",
      label: "มาตรฐานที่ 3 กระบวนการจัดการเรียนการสอน",
      indicators: [{ code: "3.1", label: "จัดการเรียนรู้ผ่านการปฏิบัติจริง" }],
    },
  ]);

  const summary = formatStandardReferenceSelection(
    {
      standardCodes: ["3", "1"],
      indicatorCodes: ["3.1", "1.1.2"],
    },
    standards,
  );

  assert.equal(
    summary,
    "มาตรฐานการศึกษาขั้นพื้นฐานฯ มาตรฐานที่ 1,3 ข้อที่ 1.1, 3 ตัวชี้วัดที่ 1.1.2, 3.1",
  );
  assert.deepEqual(readStandardReferenceSelection(summary, standards), {
    standardCodes: ["1", "3"],
    indicatorCodes: ["1.1.2", "3.1"],
  });
});

test("updates the generated summary without discarding custom text", () => {
  const standards = normalizeDocumentStandardOptions([
    {
      document_reference_option_id: 1,
      category: "STANDARD",
      label: "มาตรฐานที่ 1 คุณภาพของผู้เรียน",
      indicators: [{ code: "1.1.2", label: "คิดวิเคราะห์" }],
    },
  ]);

  assert.equal(
    updateStandardReferenceSelection("หมายเหตุเพิ่มเติม", standards, {
      standardCodes: ["1"],
      indicatorCodes: ["1.1.2"],
    }),
    "มาตรฐานการศึกษาขั้นพื้นฐานฯ มาตรฐานที่ 1 ข้อที่ 1.1 ตัวชี้วัดที่ 1.1.2\nหมายเหตุเพิ่มเติม",
  );
});
