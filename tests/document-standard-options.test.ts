import assert from "node:assert/strict";
import test from "node:test";

import {
  documentIndicatorText,
  normalizeDocumentStandardOptions,
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
      indicators: [{ code: "1.1", label: "ผู้เรียนมีผลสัมฤทธิ์ทางการเรียน" }],
    },
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
