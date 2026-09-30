"use client";

import type { MouseEvent, ReactNode } from "react";

import {
  ChevronDown,
  Download,
  FileCheck2,
  FileText,
  FileType2,
  Save,
  UnlockKeyhole,
} from "lucide-react";

type DownloadFormat = "pdf" | "docx";

interface DocumentEditorHeaderProps {
  description: string;
  icon: ReactNode;
  isFinalized: boolean;
  title: string;
  onDownload: (format: DownloadFormat) => void | Promise<void>;
  onFinalize: () => void | Promise<unknown>;
  onSaveDraft: () => void | Promise<unknown>;
  onUnlock: () => void;
}

export default function DocumentEditorHeader({
  description,
  icon,
  isFinalized,
  title,
  onDownload,
  onFinalize,
  onSaveDraft,
  onUnlock,
}: DocumentEditorHeaderProps) {
  const downloadAndClose = (
    event: MouseEvent<HTMLButtonElement>,
    format: DownloadFormat,
  ) => {
    event.currentTarget.closest("details")?.removeAttribute("open");
    void onDownload(format);
  };

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
              <button
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 transition hover:border-[#aebfb8] hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5d7c6f]/30"
                type="button"
                onClick={() => void onSaveDraft()}
              >
                <Save size={16} /> บันทึก
              </button>
              <button
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#5d7c6f] px-4 text-sm font-semibold text-white transition hover:bg-[#4b685c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5d7c6f]/30"
                type="button"
                onClick={() => void onFinalize()}
              >
                <FileCheck2 size={16} /> ยืนยันเอกสาร
              </button>
            </>
          )}

          <details className="group relative">
            <summary className="flex h-10 cursor-pointer list-none items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 transition hover:border-[#aebfb8] hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5d7c6f]/30 [&::-webkit-details-marker]:hidden">
              <Download size={16} />
              ดาวน์โหลด
              <ChevronDown
                className="transition-transform group-open:rotate-180"
                size={15}
              />
            </summary>
            <div className="absolute right-0 z-30 mt-2 w-60 overflow-hidden rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl shadow-gray-900/10">
              <button
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5d7c6f]/30"
                type="button"
                onClick={(event) => downloadAndClose(event, "pdf")}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600">
                  <FileText size={16} />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-gray-800">
                    ดาวน์โหลด PDF
                  </span>
                  <span className="block text-xs text-gray-500">
                    เหมาะสำหรับพิมพ์และส่งต่อ
                  </span>
                </span>
              </button>
              <button
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5d7c6f]/30"
                type="button"
                onClick={(event) => downloadAndClose(event, "docx")}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <FileType2 size={16} />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-gray-800">
                    ดาวน์โหลด Word
                  </span>
                  <span className="block text-xs text-gray-500">
                    สำหรับแก้ไขเพิ่มเติมภายหลัง
                  </span>
                </span>
              </button>
            </div>
          </details>
        </div>
      </div>
    </section>
  );
}
