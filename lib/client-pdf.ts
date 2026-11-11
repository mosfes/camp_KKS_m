"use client";

import type { PreviewPdf } from "@/components/documents/DocumentPreviewModal";

/**
 * สร้าง PDF และ Word ในเบราว์เซอร์ของผู้ใช้ (ไม่ใช้ CPU/เวลาของ Vercel)
 * เซิร์ฟเวอร์ส่งแค่ข้อมูล JSON ส่วนการวาด PDF ใช้โค้ดชุดเดิมแต่รันฝั่ง client
 * ไลบรารี PDF ถูก import แบบ dynamic จึงโหลดเฉพาะตอนกดดูเอกสาร
 */
async function fetchPdfData<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  const json = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(json?.error || "โหลดข้อมูลเอกสารไม่สำเร็จ");
  }

  return json as T;
}

function toPreview(bytes: Uint8Array, fileName?: string): PreviewPdf {
  return {
    blob: new Blob([bytes as BlobPart], { type: "application/pdf" }),
    fileName,
  };
}

export async function buildProjectDocumentPdf(
  campId: number | string,
): Promise<PreviewPdf> {
  const [{ document, fileName }, { createProjectDocumentPdf }] =
    await Promise.all([
      fetchPdfData<{ document: any; fileName: string }>(
        `/api/camps/${campId}/project-document/pdf-data`,
      ),
      import("@/lib/project-document-pdf"),
    ]);

  return toPreview(await createProjectDocumentPdf(document), fileName);
}

export async function buildProjectSummaryDocumentPdf(
  campId: number | string,
): Promise<PreviewPdf> {
  const [{ document, fileName }, { createProjectSummaryDocumentPdf }] =
    await Promise.all([
      fetchPdfData<{ document: any; fileName: string }>(
        `/api/camps/${campId}/project-summary-document/pdf-data`,
      ),
      import("@/lib/project-summary-document-pdf"),
    ]);

  return toPreview(await createProjectSummaryDocumentPdf(document), fileName);
}

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement("a");

  link.href = url;
  link.download = fileName;
  window.document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function docxFileName(pdfFileName: string) {
  return pdfFileName.replace(/\.pdf$/i, "") + ".docx";
}

/** สร้างไฟล์ Word ของเอกสารข้อเสนอโครงการในเบราว์เซอร์แล้วดาวน์โหลด */
export async function downloadProjectDocumentDocx(campId: number | string) {
  const [{ document, fileName }, { createProjectDocumentDocx }] =
    await Promise.all([
      fetchPdfData<{ document: any; fileName: string }>(
        `/api/camps/${campId}/project-document/pdf-data`,
      ),
      import("@/lib/project-document-docx"),
    ]);
  const blob = await createProjectDocumentDocx(document);

  saveBlob(new Blob([blob], { type: DOCX_MIME }), docxFileName(fileName));
}

/** สร้างไฟล์ Word ของเอกสารสรุปโครงการในเบราว์เซอร์แล้วดาวน์โหลด */
export async function downloadProjectSummaryDocumentDocx(
  campId: number | string,
) {
  const [{ document, fileName }, { createProjectSummaryDocumentDocx }] =
    await Promise.all([
      fetchPdfData<{ document: any; fileName: string }>(
        `/api/camps/${campId}/project-summary-document/pdf-data`,
      ),
      import("@/lib/project-summary-document-docx"),
    ]);
  const blob = await createProjectSummaryDocumentDocx(document);

  saveBlob(new Blob([blob], { type: DOCX_MIME }), docxFileName(fileName));
}

export async function buildShirtListPdf(
  campId: number | string,
): Promise<PreviewPdf> {
  const [{ data, fileName }, { createShirtPdf }] = await Promise.all([
    fetchPdfData<{ data: any; fileName: string }>(
      `/api/camps/${campId}/shirts/pdf-data`,
    ),
    import("@/lib/shirt-export-pdf"),
  ]);

  return toPreview(await createShirtPdf(data), fileName);
}

export async function buildCampStudentsPdf(
  campId: number | string,
): Promise<PreviewPdf> {
  const [{ data, fileName }, { createCampStudentsPdf }] = await Promise.all([
    fetchPdfData<{ data: any; fileName: string }>(
      `/api/camps/${campId}/students/pdf-data`,
    ),
    import("@/lib/camp-students-export-pdf"),
  ]);

  return toPreview(await createCampStudentsPdf(data), fileName);
}
