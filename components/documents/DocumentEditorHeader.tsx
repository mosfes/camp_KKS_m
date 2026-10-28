"use client";

import type { ReactNode } from "react";
import type { DocumentSaveStatus } from "./useDocumentAutoSave";

import {
  AlertCircle,
  CheckCircle2,
  Eye,
  FileCheck2,
  Loader2,
  UnlockKeyhole,
} from "lucide-react";

interface DocumentEditorHeaderProps {
  description: string;
  icon: ReactNode;
  isFinalized: boolean;
  saveStatus: DocumentSaveStatus;
  title: string;
  onPreview: () => void | Promise<void>;
  onFinalize: () => void | Promise<unknown>;
  onRetrySave: () => void | Promise<unknown>;
  onUnlock: () => void;
}

export default function DocumentEditorHeader({
  description,
  icon,
  isFinalized,
  saveStatus,
  title,
  onPreview,
  onFinalize,
  onRetrySave,
  onUnlock,
}: DocumentEditorHeaderProps) {
  return (
    <section className="overflow-visible rounded-2xl border border-[#dce5e1] bg-white shadow-sm">
      <div className="flex flex-col gap-5 p-5 md:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#edf4f1] text-[#5d7c6f]">
            {icon}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold leading-tight text-gray-900">
                {title}
              </h1>
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  isFinalized
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-amber-50 text-amber-700"
                }`}
              >
                {isFinalized ? "ฉบับสมบูรณ์" : "ฉบับร่าง"}
              </span>
            </div>
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-gray-500">
              {description}
            </p>
          </div>
        </div>

        <div
          aria-label="การจัดการเอกสาร"
          className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center"
          role="group"
        >
          {isFinalized ? (
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 text-sm font-semibold text-amber-700 transition hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/30"
              type="button"
              onClick={onUnlock}
            >
              <UnlockKeyhole size={16} /> แก้ไขเอกสาร
            </button>
          ) : (
            <>
              {saveStatus === "error" ? (
                <button
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-medium text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/30"
                  type="button"
                  onClick={() => void onRetrySave()}
                >
                  <AlertCircle size={16} /> บันทึกไม่สำเร็จ · ลองอีกครั้ง
                </button>
              ) : (
                <span
                  aria-live="polite"
                  className={`inline-flex min-h-10 items-center justify-center ${
                    saveStatus === "saved"
                      ? "gap-1.5 text-xs font-normal text-gray-600"
                      : "gap-2 text-sm font-medium text-gray-600"
                  }`}
                  role="status"
                >
                  {saveStatus === "saved" ? (
                    <>
                      <CheckCircle2 size={14} />
                      เป็นปัจจุบันแล้ว
                    </>
                  ) : saveStatus === "saving" ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />{" "}
                      กำลังบันทึก...
                    </>
                  ) : (
                    <>
                      <Loader2 size={16} /> รอบันทึก...
                    </>
                  )}
                </span>
              )}
              <button
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#5d7c6f] px-4 text-sm font-semibold text-white transition hover:bg-[#4b685c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5d7c6f]/30"
                type="button"
                onClick={() => void onFinalize()}
              >
                <FileCheck2 size={16} /> ยืนยันเอกสาร
              </button>
            </>
          )}

          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 transition hover:border-[#aebfb8] hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5d7c6f]/30"
            type="button"
            onClick={() => void onPreview()}
          >
            <Eye size={16} />
            ดูตัวอย่างและดาวน์โหลด
          </button>
        </div>
      </div>
    </section>
  );
}
