"use client";

import type { CertificateRenderManifest } from "@/lib/certificate-renderer";

import React, { useState, useEffect, useRef } from "react";
import { Award, Download, Save, X } from "lucide-react";
import { Button } from "@heroui/button";
import { Select, SelectItem } from "@heroui/react";

import CertificateSettings from "./CertificateSettings";
import CampBreadcrumb from "./CampBreadcrumb";

import { useStatusModal } from "@/components/StatusModalProvider";

interface CampDetail {
  camp_id: number;
  img_certificate_url?: string;
  img_certificate_public_id?: string | null;
  img_certificate_bytes?: number | null;
  img_certificate_width?: number | null;
  img_certificate_height?: number | null;
  img_certificate_format?: string | null;
  cert_name_x?: number;
  cert_name_y?: number;
  cert_font_size?: number;
  cert_font_color?: string;
  cert_show_number?: boolean;
  cert_number_start?: number | null;
  cert_number_end?: number | null;
  cert_number_x?: number | null;
  cert_number_y?: number | null;
  cert_number_size?: number | null;
  cert_number_color?: string | null;
  cert_number_prefix?: string | null;
  cert_number_is_thai?: boolean;
  cert_year?: string | null;
  cert_show_qr?: boolean;
  cert_qr_x?: number | null;
  cert_qr_y?: number | null;
  cert_qr_size?: number | null;
  cert_mission_completion_percent?: number;
  cert_require_survey?: boolean;
  certificate_total_missions?: number;
  certificate_has_survey?: boolean;
  // จำนวนนักเรียนที่สามารถออกเกียรติบัตรได้ทั้งหมด
  certificate_candidate_count?: number;
  student_enrollment?: { student_enrollment_id: number }[];
}

interface CertificateImageMetadata {
  publicId: string | null;
  bytes: number | null;
  width: number | null;
  height: number | null;
  format: string | null;
}

const EMPTY_CERTIFICATE_IMAGE_METADATA: CertificateImageMetadata = {
  publicId: null,
  bytes: null,
  width: null,
  height: null,
  format: null,
};

interface EditCertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  campData: CampDetail | null;
  onSuccess: () => void;
  pageMode?: boolean;
}

export default function EditCertificateModal({
  isOpen,
  onClose,
  campData,
  onSuccess,
  pageMode = false,
}: EditCertificateModalProps) {
  const { showError, showSuccess } = useStatusModal();

  // ชื่อ
  const [certImage, setCertImage] = useState<string | null>(null);
  const [certImageFile, setCertImageFile] = useState<File | null>(null);
  const [certImageMetadata, setCertImageMetadata] =
    useState<CertificateImageMetadata>(EMPTY_CERTIFICATE_IMAGE_METADATA);
  const [certNameX, setCertNameX] = useState<number>(50);
  const [certNameY, setCertNameY] = useState<number>(50);
  const [certFontSize, setCertFontSize] = useState<number>(48);
  const [certFontColor, setCertFontColor] = useState<string>("#000000");

  // เลขที่เกียรติบัตร
  const [certShowNumber, setCertShowNumber] = useState<boolean>(false);
  const [certNumberStart, setCertNumberStart] = useState<number | null>(null);
  const [certNumberEnd, setCertNumberEnd] = useState<number | null>(null);
  const [certNumberX, setCertNumberX] = useState<number>(50);
  const [certNumberY, setCertNumberY] = useState<number>(10);
  const [certNumberSize, setCertNumberSize] = useState<number>(36);
  const [certNumberColor, setCertNumberColor] = useState<string>("#000000");
  const [certNumberPrefix, setCertNumberPrefix] = useState<
    "เลขที่" | "No." | ""
  >("เลขที่");
  const [certNumberIsThai, setCertNumberIsThai] = useState<boolean>(false);
  const [certYear, setCertYear] = useState<string | null>(null);

  // คิวอาร์โค้ดตรวจสอบเกียรติบัตร
  const [certShowQr, setCertShowQr] = useState<boolean>(false);
  const [certQrX, setCertQrX] = useState<number>(90);
  const [certQrY, setCertQrY] = useState<number>(88);
  const [certQrSize, setCertQrSize] = useState<number>(140);

  // เงื่อนไขการรับเกียรติบัตร
  const [certMissionCompletionPercent, setCertMissionCompletionPercent] =
    useState<number>(100);
  const [certRequireSurvey, setCertRequireSurvey] = useState<boolean>(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitInFlightRef = useRef(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

  const [exportCondition, setExportCondition] = useState<string>("all");
  const [isExporting, setIsExporting] = useState(false);

  const enrolledCount =
    campData?.certificate_candidate_count ??
    campData?.student_enrollment?.length ??
    0;

  const normalizedInitialPrefix =
    campData?.cert_number_prefix === "เลขที่" ||
    campData?.cert_number_prefix === "No." ||
    campData?.cert_number_prefix === ""
      ? campData.cert_number_prefix
      : "เลขที่";
  const hasUnsavedChanges = Boolean(
    campData &&
      (certImageFile ||
        certImage !== (campData.img_certificate_url || null) ||
        certNameX !== (campData.cert_name_x ?? 50) ||
        certNameY !== (campData.cert_name_y ?? 50) ||
        certFontSize !== (campData.cert_font_size ?? 48) ||
        certFontColor !== (campData.cert_font_color ?? "#000000") ||
        certShowNumber !== (campData.cert_show_number ?? false) ||
        certNumberStart !== (campData.cert_number_start ?? null) ||
        certNumberEnd !== (campData.cert_number_end ?? null) ||
        certNumberX !== (campData.cert_number_x ?? 50) ||
        certNumberY !== (campData.cert_number_y ?? 10) ||
        certNumberSize !== (campData.cert_number_size ?? 36) ||
        certNumberColor !== (campData.cert_number_color ?? "#000000") ||
        certNumberPrefix !== normalizedInitialPrefix ||
        certNumberIsThai !== (campData.cert_number_is_thai ?? false) ||
        certYear !== (campData.cert_year ?? null) ||
        certShowQr !== (campData.cert_show_qr ?? false) ||
        certQrX !== (campData.cert_qr_x ?? 90) ||
        certQrY !== (campData.cert_qr_y ?? 88) ||
        certQrSize !== (campData.cert_qr_size ?? 140) ||
        certMissionCompletionPercent !==
          (campData.cert_mission_completion_percent ?? 100) ||
        certRequireSurvey !== (campData.cert_require_survey ?? false)),
  );

  useEffect(() => {
    if (isOpen && campData) {
      setCertImage(campData.img_certificate_url || null);
      setCertImageFile(null);
      setCertImageMetadata({
        publicId: campData.img_certificate_public_id ?? null,
        bytes: campData.img_certificate_bytes ?? null,
        width: campData.img_certificate_width ?? null,
        height: campData.img_certificate_height ?? null,
        format: campData.img_certificate_format ?? null,
      });
      setCertNameX(campData.cert_name_x ?? 50);
      setCertNameY(campData.cert_name_y ?? 50);
      setCertFontSize(campData.cert_font_size ?? 48);
      setCertFontColor(campData.cert_font_color ?? "#000000");
      setCertShowNumber(campData.cert_show_number ?? false);
      setCertNumberStart(campData.cert_number_start ?? null);
      setCertNumberEnd(campData.cert_number_end ?? null);
      setCertNumberX(campData.cert_number_x ?? 50);
      setCertNumberY(campData.cert_number_y ?? 10);
      setCertNumberSize(campData.cert_number_size ?? 36);
      setCertNumberColor(campData.cert_number_color ?? "#000000");
      const raw = campData.cert_number_prefix;

      setCertNumberPrefix(
        raw === "เลขที่" || raw === "No." || raw === "" ? raw : "เลขที่",
      );
      setCertNumberIsThai(campData.cert_number_is_thai ?? false);
      setCertYear(campData.cert_year ?? null);
      setCertShowQr(
        Boolean(
          campData.cert_show_qr &&
            campData.cert_show_number &&
            campData.cert_number_start != null,
        ),
      );
      setCertQrX(campData.cert_qr_x ?? 90);
      setCertQrY(campData.cert_qr_y ?? 88);
      setCertQrSize(campData.cert_qr_size ?? 140);
      setCertMissionCompletionPercent(
        campData.cert_mission_completion_percent ?? 100,
      );
      setCertRequireSurvey(campData.cert_require_survey ?? false);
    }
  }, [isOpen, campData]);

  if (!isOpen) return null;

  const handleExport = async () => {
    if (!campData) return;

    // Check if the current settings differ from saved ones
    // We assume the user has saved their changes before exporting.

    try {
      setIsExporting(true);
      const url = `/api/camps/${campData.camp_id}/certificate/bulk?condition=${exportCondition}`;

      const response = await fetch(url, {
        method: "GET",
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.error || "เกิดข้อผิดพลาดในการดาวน์โหลดเกียรติบัตร",
        );
      }

      if (!data.certificate) {
        throw new Error("ข้อมูลสำหรับสร้างเกียรติบัตรไม่ครบถ้วน");
      }

      const renderer = await import("@/lib/certificate-renderer");
      const blob = await renderer.renderCertificatesPdf(
        data.certificate as CertificateRenderManifest,
      );

      renderer.downloadCertificateBlob(
        blob,
        `certificates_camp_${campData.camp_id}.pdf`,
      );

      showSuccess("สำเร็จ", "ดาวน์โหลดเกียรติบัตรเรียบร้อยแล้ว");
    } catch (error: any) {
      showError(
        "ข้อผิดพลาด",
        error.message || "ไม่สามารถดาวน์โหลดเกียรติบัตรได้",
      );
    } finally {
      setIsExporting(false);
    }
  };

  const uploadCertificateImage = (
    file: File,
  ): Promise<CertificateImageMetadata & { url: string }> =>
    new Promise((resolve, reject) => {
      if (!campData) {
        reject(new Error("ไม่พบข้อมูลค่าย"));

        return;
      }

      fetch(`/api/camps/${campData.camp_id}/certificate/upload-signature`, {
        method: "POST",
      })
        .then(async (signatureResponse) => {
          const signatureData = await signatureResponse
            .json()
            .catch(() => ({}));

          if (!signatureResponse.ok) {
            throw new Error(
              signatureData.error ||
                "ไม่สามารถเตรียมการอัปโหลดกรอบเกียรติบัตรได้",
            );
          }

          const uploadForm = new FormData();
          const request = new XMLHttpRequest();
          const cloudinaryUploadUrl = `https://api.cloudinary.com/v1_1/${signatureData.cloudName}/image/upload`;

          uploadForm.append(
            "file",
            file,
            file.name || "certificate-template.jpg",
          );
          uploadForm.append("api_key", signatureData.apiKey);
          uploadForm.append("timestamp", String(signatureData.timestamp));
          uploadForm.append("folder", signatureData.folder);
          uploadForm.append("public_id", signatureData.publicId);
          uploadForm.append("upload_preset", signatureData.uploadPreset);
          uploadForm.append("overwrite", String(signatureData.overwrite));
          uploadForm.append("invalidate", String(signatureData.invalidate));
          uploadForm.append("signature", signatureData.signature);

          request.open("POST", cloudinaryUploadUrl);

          request.upload.addEventListener("progress", (event) => {
            if (event.lengthComputable) {
              setUploadProgress(Math.round((event.loaded / event.total) * 100));
            }
          });

          request.addEventListener("load", async () => {
            if (request.status >= 200 && request.status < 300) {
              try {
                const data = JSON.parse(request.responseText);

                if (!data.secure_url && !data.url) {
                  throw new Error("Cloudinary response has no URL");
                }

                const commitResponse = await fetch(
                  `/api/camps/${campData.camp_id}/certificate/upload-commit`,
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      publicId: data.public_id || signatureData.publicId,
                    }),
                  },
                );
                const commitData = await commitResponse
                  .json()
                  .catch(() => ({}));

                if (!commitResponse.ok || !commitData.url) {
                  throw new Error(
                    commitData.error ||
                      "กรอบเกียรติบัตรไม่ผ่านการตรวจสอบจากเซิร์ฟเวอร์",
                  );
                }

                setUploadProgress(100);
                resolve({
                  url: commitData.url,
                  publicId: commitData.publicId,
                  bytes: commitData.bytes,
                  width: commitData.width,
                  height: commitData.height,
                  format: commitData.format,
                });
              } catch (error) {
                reject(error);
              }
            } else {
              let message = "Certificate upload failed";

              try {
                const data = JSON.parse(request.responseText);

                message = data.error?.message || data.error || message;
              } catch {
                // Keep the generic upload error when Cloudinary returns non-JSON.
              }

              reject(new Error(message));
            }
          });
          request.addEventListener("error", () =>
            reject(new Error("Certificate upload failed")),
          );
          request.addEventListener("abort", () =>
            reject(new Error("Certificate upload was cancelled")),
          );
          request.send(uploadForm);
        })
        .catch(reject);
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitInFlightRef.current) return;
    setHasAttemptedSubmit(true);
    if (!campData) return;

    if (certShowNumber) {
      if (
        certNumberStart == null ||
        certNumberEnd == null ||
        isNaN(certNumberStart) ||
        isNaN(certNumberEnd)
      ) {
        showError(
          "ข้อมูลไม่ครบถ้วน",
          "กรุณาระบุช่วงเลขเริ่มต้นและสิ้นสุดของเกียรติบัตร",
        );

        return;
      }

      if (certNumberStart > certNumberEnd) {
        showError(
          "ข้อมูลไม่ถูกต้อง",
          "เลขสิ้นสุดต้องมีค่ามากกว่าหรือเท่ากับเลขเริ่มต้น",
        );

        return;
      }
    }

    submitInFlightRef.current = true;
    try {
      setIsSubmitting(true);
      let finalCertUrl =
        certImage && !certImage.startsWith("blob:") ? certImage : null;
      let finalCertMetadata = certImageMetadata;

      if (certImageFile) {
        try {
          setUploadProgress(0);
          const uploaded = await uploadCertificateImage(certImageFile);

          finalCertUrl = uploaded.url;
          finalCertMetadata = {
            publicId: uploaded.publicId,
            bytes: uploaded.bytes,
            width: uploaded.width,
            height: uploaded.height,
            format: uploaded.format,
          };
          setCertImageMetadata(finalCertMetadata);
        } catch (error) {
          console.error("Certificate upload error:", error);
          showError(
            "อัปโหลดรูปล้มเหลว",
            error instanceof Error
              ? error.message
              : "ไม่สามารถอัปโหลดรูปเกียรติบัตรได้",
          );

          return;
        }
      }

      const imageMetadata = finalCertUrl
        ? {
            img_certificate_public_id: finalCertMetadata.publicId,
            img_certificate_bytes: finalCertMetadata.bytes,
            img_certificate_width: finalCertMetadata.width,
            img_certificate_height: finalCertMetadata.height,
            img_certificate_format: finalCertMetadata.format,
          }
        : {
            img_certificate_public_id: null,
            img_certificate_bytes: null,
            img_certificate_width: null,
            img_certificate_height: null,
            img_certificate_format: null,
          };

      const response = await fetch(`/api/camps/${campData.camp_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          img_certificate_url: finalCertUrl,
          ...imageMetadata,
          cert_name_x: certNameX,
          cert_name_y: certNameY,
          cert_font_size: certFontSize,
          cert_font_color: certFontColor,
          cert_show_number: certShowNumber,
          cert_number_start: certNumberStart,
          cert_number_end: certNumberEnd,
          cert_number_x: certNumberX,
          cert_number_y: certNumberY,
          cert_number_size: certNumberSize,
          cert_number_color: certNumberColor,
          cert_number_prefix: certNumberPrefix,
          cert_number_is_thai: certNumberIsThai,
          cert_year: certYear,
          cert_show_qr: certShowNumber && certNumberStart != null && certShowQr,
          cert_qr_x: certQrX,
          cert_qr_y: certQrY,
          cert_qr_size: certQrSize,
          cert_mission_completion_percent: certMissionCompletionPercent,
          cert_require_survey: certRequireSurvey,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();

        console.error("Server Error:", errorText);
        throw new Error(`Failed to update certificate: ${errorText}`);
      }

      // Keep the saved Cloudinary URL in state so a page-mode save does not
      // navigate away or accidentally clear the image on the next save.
      setCertImage(finalCertUrl);
      setCertImageFile(null);
      showSuccess("สำเร็จ", "อัปเดตการตั้งค่าเกียรติบัตรเรียบร้อยแล้ว");
      onSuccess();
      if (!pageMode) onClose();
    } catch (error) {
      console.error("Error updating certificate:", error);
      showError("ข้อผิดพลาด", "ไม่สามารถบันทึกการตั้งค่าเกียรติบัตรได้");
    } finally {
      submitInFlightRef.current = false;
      setIsSubmitting(false);
      setUploadProgress(null);
    }
  };

  return (
    <div
      className={
        pageMode
          ? "h-[calc(100dvh-4rem)] w-full overflow-hidden bg-[#f5f5f2]"
          : "fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      }
    >
      <div
        className={
          pageMode
            ? "flex h-[calc(100dvh-4rem)] w-full flex-col overflow-hidden bg-[#f5f5f2]"
            : "flex max-h-[90vh] w-full max-w-5xl transform flex-col overflow-hidden rounded-2xl bg-white shadow-xl animate-in zoom-in-95 duration-200"
        }
      >
        <div
          className={
            pageMode
              ? "mx-auto flex w-full max-w-[1440px] shrink-0 flex-col gap-4 px-4 pb-5 pt-6 sm:px-8"
              : "sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-6 py-4"
          }
        >
          {pageMode && (
            <CampBreadcrumb
              campId={campData?.camp_id}
              currentPage="ตั้งค่าเกียรติบัตร"
            />
          )}

          <div className="flex items-center gap-2">
            {pageMode && <Award className="text-[#6b857a]" size={20} />}
            <h2
              className={`${
                pageMode ? "text-lg leading-tight" : "text-xl"
              } font-bold text-gray-800`}
            >
              ตั้งค่าเกียรติบัตร
            </h2>
          </div>
          {pageMode && (
            <p className="max-w-2xl text-xs leading-relaxed text-gray-500">
              กำหนดเงื่อนไข เลือกเทมเพลต และจัดตำแหน่งข้อมูลบนเกียรติบัตร
            </p>
          )}

          {!pageMode && (
            <button
              className="rounded-full p-2 text-gray-500 transition-colors hover:bg-gray-100"
              type="button"
              onClick={onClose}
            >
              <X size={20} />
            </button>
          )}
        </div>

        <div
          className={
            pageMode
              ? "mx-auto min-h-0 w-full max-w-[1440px] flex-1 overflow-y-auto overscroll-contain bg-[#f5f5f2] px-4 pb-10 pt-0 sm:px-8"
              : "flex-1 overflow-y-auto bg-gray-50/50 p-6"
          }
        >
          <form id="certForm" onSubmit={handleSubmit}>
            <CertificateSettings
              certFontColor={certFontColor}
              certFontSize={certFontSize}
              certImage={certImage}
              certMissionCompletionPercent={certMissionCompletionPercent}
              certNameX={certNameX}
              certNameY={certNameY}
              certNumberColor={certNumberColor}
              certNumberEnd={certNumberEnd}
              certNumberIsThai={certNumberIsThai}
              certNumberPrefix={certNumberPrefix}
              certNumberSize={certNumberSize}
              certNumberStart={certNumberStart}
              certNumberX={certNumberX}
              certNumberY={certNumberY}
              certQrSize={certQrSize}
              certQrX={certQrX}
              certQrY={certQrY}
              certRequireSurvey={certRequireSurvey}
              certShowNumber={certShowNumber}
              certShowQr={certShowQr}
              certYear={certYear}
              certificateImageMetadata={certImageMetadata}
              enrolledCount={enrolledCount}
              hasAttemptedSubmit={hasAttemptedSubmit}
              hasSurvey={campData?.certificate_has_survey ?? false}
              setCertFontColor={setCertFontColor}
              setCertFontSize={setCertFontSize}
              setCertImage={setCertImage}
              setCertImageFile={setCertImageFile}
              setCertMissionCompletionPercent={setCertMissionCompletionPercent}
              setCertNameX={setCertNameX}
              setCertNameY={setCertNameY}
              setCertNumberColor={setCertNumberColor}
              setCertNumberEnd={setCertNumberEnd}
              setCertNumberIsThai={setCertNumberIsThai}
              setCertNumberPrefix={setCertNumberPrefix}
              setCertNumberSize={setCertNumberSize}
              setCertNumberStart={setCertNumberStart}
              setCertNumberX={setCertNumberX}
              setCertNumberY={setCertNumberY}
              setCertQrSize={setCertQrSize}
              setCertQrX={setCertQrX}
              setCertQrY={setCertQrY}
              setCertRequireSurvey={setCertRequireSurvey}
              setCertShowNumber={setCertShowNumber}
              setCertShowQr={setCertShowQr}
              setCertYear={setCertYear}
              totalMissions={campData?.certificate_total_missions ?? 0}
            />
          </form>
        </div>

        {uploadProgress !== null && (
          <div
            aria-live="polite"
            className={
              pageMode
                ? "mx-auto w-full max-w-[1440px] border-t border-gray-100 bg-[#f5f5f2] px-4 pt-3 sm:px-8"
                : "border-t border-gray-100 bg-white px-6 pt-3"
            }
          >
            <div className="flex items-center justify-between mb-1.5 text-xs font-medium text-[#1a3a32]">
              <span>กำลังอัปโหลดไฟล์เกียรติบัตร...</span>
              <span>{uploadProgress}%</span>
            </div>
            <div
              aria-label="ความคืบหน้าการอัปโหลดไฟล์เกียรติบัตร"
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={uploadProgress}
              className="h-2 w-full overflow-hidden rounded-full bg-gray-200"
              role="progressbar"
            >
              <div
                className="h-full rounded-full bg-[#6b857a] transition-[width] duration-200 ease-out"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        <div
          className={`sticky bottom-0 z-10 mx-auto flex w-full max-w-[1440px] shrink-0 flex-col gap-3 px-4 py-3 shadow-[0_-8px_24px_rgba(26,58,50,0.06)] sm:px-8 sm:py-4 lg:flex-row lg:items-center lg:justify-between ${pageMode ? "bg-[#f5f5f2]/95 backdrop-blur" : "bg-white"} ${uploadProgress === null ? "border-t border-gray-100" : ""}`}
        >
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:w-auto">
            <Select
              aria-label="เลือกกลุ่มนักเรียนสำหรับดาวน์โหลดเกียรติบัตร"
              className="w-full sm:w-80"
              selectedKeys={[exportCondition]}
              size="sm"
              onChange={(e) => setExportCondition(e.target.value)}
            >
              <SelectItem key="all">เฉพาะผู้ลงทะเบียนแล้ว</SelectItem>
              <SelectItem key="all_students">
                นักเรียนทั้งหมด (รวมผู้ยังไม่ลงทะเบียน)
              </SelectItem>
              <SelectItem key="passed_conditions">
                เฉพาะผู้ผ่านเงื่อนไข
              </SelectItem>
            </Select>
            <Button
              className="w-full font-medium bg-[#1a3a32]/10 text-[#1a3a32] hover:bg-[#1a3a32]/20 sm:w-auto"
              isDisabled={!campData?.img_certificate_url}
              isLoading={isExporting}
              size="sm"
              startContent={!isExporting && <Download size={16} />}
              onPress={handleExport}
            >
              ดาวน์โหลด PDF รวม
            </Button>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
            <p
              aria-live="polite"
              className={`text-center text-[11px] font-medium sm:text-right ${
                hasUnsavedChanges ? "text-amber-700" : "text-gray-400"
              }`}
            >
              {hasUnsavedChanges
                ? "มีการแก้ไขที่ยังไม่ได้บันทึก"
                : "การตั้งค่าปัจจุบันบันทึกแล้ว"}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end sm:gap-3">
              <Button
                className="w-full font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 sm:w-auto"
                isDisabled={isSubmitting}
                variant="flat"
                onPress={onClose}
              >
                ยกเลิก
              </Button>
              <Button
                className="w-full font-medium bg-[#1a3a32] text-white shadow-md shadow-[#1a3a32]/20 sm:w-auto"
                form="certForm"
                isLoading={isSubmitting}
                isDisabled={isSubmitting}
                startContent={<Save size={18} />}
                type="submit"
              >
                บันทึกการตั้งค่า
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
