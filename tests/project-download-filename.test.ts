import assert from "node:assert/strict";
import test from "node:test";

import {
  buildProjectDownloadFilename,
  buildProjectSummaryDownloadFilename,
  projectDownloadContentDisposition,
} from "../lib/project-download-filename";

test("uses the project code and project name for Word downloads", () => {
  assert.equal(
    buildProjectDownloadFilename({
      projectCode: "ว2-201",
      projectName: "ส่งเสริมการแข่งขันโครงงาน",
      fallbackCode: 510001,
      extension: "docx",
    }),
    "ว2-201 ส่งเสริมการแข่งขันโครงงาน.docx",
  );
});

test("uses the same naming format for PDF downloads", () => {
  assert.equal(
    buildProjectDownloadFilename({
      projectCode: "ว2-201",
      projectName: "ส่งเสริมการแข่งขันโครงงาน",
      fallbackCode: 510001,
      extension: "pdf",
    }),
    "ว2-201 ส่งเสริมการแข่งขันโครงงาน.pdf",
  );
});

test("omits the internal fallback id when the project code is empty", () => {
  assert.equal(
    buildProjectDownloadFilename({
      projectCode: "",
      projectName: "โครงการการประชุมวิชาการและนำเสนอผลงานทางวิชาการ ม.6 SMTE",
      fallbackCode: 510001,
      extension: "pdf",
    }),
    "โครงการการประชุมวิชาการและนำเสนอผลงานทางวิชาการ ม.6 SMTE.pdf",
  );
});

test("prefixes summary PDF downloads with the Thai summary label", () => {
  assert.equal(
    buildProjectSummaryDownloadFilename({
      projectName: "โครงการการประชุมวิชาการและนำเสนอผลงานทางวิชาการ ม.6 SMTE",
      extension: "pdf",
    }),
    "สรุป โครงการการประชุมวิชาการและนำเสนอผลงานทางวิชาการ ม.6 SMTE.pdf",
  );
});

test("uses the same summary naming format for Word downloads", () => {
  assert.equal(
    buildProjectSummaryDownloadFilename({
      projectName: "โครงการการประชุมวิชาการและนำเสนอผลงานทางวิชาการ ม.6 SMTE",
      extension: "docx",
    }),
    "สรุป โครงการการประชุมวิชาการและนำเสนอผลงานทางวิชาการ ม.6 SMTE.docx",
  );
});

test("removes characters that are invalid in filenames", () => {
  assert.equal(
    buildProjectDownloadFilename({
      projectCode: "ว2/201",
      projectName: "ชื่อ: โครงการ?",
      fallbackCode: 510001,
      extension: "docx",
    }),
    "ว2 201 ชื่อ โครงการ.docx",
  );
});

test("provides an ASCII fallback and UTF-8 filename for response headers", () => {
  assert.equal(
    projectDownloadContentDisposition("ว2-201 ส่งเสริมการแข่งขันโครงงาน.docx"),
    "attachment; filename=\"2-201.docx\"; filename*=UTF-8''%E0%B8%A72-201%20%E0%B8%AA%E0%B9%88%E0%B8%87%E0%B9%80%E0%B8%AA%E0%B8%A3%E0%B8%B4%E0%B8%A1%E0%B8%81%E0%B8%B2%E0%B8%A3%E0%B9%81%E0%B8%82%E0%B9%88%E0%B8%87%E0%B8%82%E0%B8%B1%E0%B8%99%E0%B9%82%E0%B8%84%E0%B8%A3%E0%B8%87%E0%B8%87%E0%B8%B2%E0%B8%99.docx",
  );
});
