"use client";

import type { ReactNode } from "react";

import { Button } from "@heroui/button";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";
import {
  AlertCircle,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

export type PreviewPdf = { blob: Blob; fileName?: string };

export interface PreviewExtraDownload {
  key: string;
  label: string;
  icon?: ReactNode;
  onPress: () => void | Promise<void>;
}

interface DocumentPreviewModalProps {
  isOpen: boolean;
  title: string;
  /** ชื่อไฟล์สำรอง ใช้เมื่อเซิร์ฟเวอร์ไม่ได้ส่งชื่อไฟล์มา */
  fileName: string;
  loadPdf: () => Promise<PreviewPdf>;
  extraDownloads?: PreviewExtraDownload[];
  note?: string;
  onClose: () => void;
  onDownloaded?: () => void;
}

function fileNameFromDisposition(header: string | null) {
  if (!header) return undefined;
  const encoded = header.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);

  if (encoded) {
    try {
      return decodeURIComponent(encoded[1].trim());
    } catch {
      // ตกไปใช้ filename ปกติ
    }
  }
  const plain = header.match(/filename\s*=\s*"?([^";]+)"?/i);

  return plain?.[1]?.trim() || undefined;
}

/** ดึง PDF จาก API แล้วคืนเป็น blob พร้อมชื่อไฟล์จาก Content-Disposition */
export async function fetchPreviewPdf(url: string): Promise<PreviewPdf> {
  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    const errJson = await res.json().catch(() => null);

    throw new Error(errJson?.error || "สร้างตัวอย่างเอกสารไม่สำเร็จ");
  }

  return {
    blob: await res.blob(),
    fileName: fileNameFromDisposition(res.headers.get("Content-Disposition")),
  };
}

export default function DocumentPreviewModal({
  isOpen,
  title,
  fileName,
  loadPdf,
  extraDownloads = [],
  note,
  onClose,
  onDownloaded,
}: DocumentPreviewModalProps) {
  const [pdf, setPdf] = useState<PreviewPdf | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const loadRef = useRef(loadPdf);
  const requestRef = useRef(0);

  loadRef.current = loadPdf;

  const load = useCallback(async () => {
    const requestId = ++requestRef.current;

    setLoading(true);
    setError(null);
    setPdf(null);
    try {
      const result = await loadRef.current();

      if (requestId !== requestRef.current) return;
      setPdf({
        blob:
          result.blob.type === "application/pdf"
            ? result.blob
            : new Blob([result.blob], { type: "application/pdf" }),
        fileName: result.fileName,
      });
    } catch (err: any) {
      if (requestId !== requestRef.current) return;
      setError(err?.message || "สร้างตัวอย่างเอกสารไม่สำเร็จ");
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      void load();
    } else {
      requestRef.current++;
      setPdf(null);
      setError(null);
      setLoading(false);
    }
  }, [isOpen, load]);

  useEffect(() => {
    if (!pdf) {
      setPreviewUrl(null);

      return;
    }
    const url = URL.createObjectURL(pdf.blob);

    setPreviewUrl(url);

    return () => URL.revokeObjectURL(url);
  }, [pdf]);

  const downloadPdf = () => {
    if (!previewUrl) return;
    const anchor = document.createElement("a");

    anchor.style.display = "none";
    anchor.href = previewUrl;
    anchor.download = pdf?.fileName || fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    onDownloaded?.();
  };

  const runExtra = async (item: PreviewExtraDownload) => {
    if (busyKey) return;
    setBusyKey(item.key);
    try {
      await item.onPress();
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <Modal
      backdrop="blur"
      classNames={{
        base: "bg-white rounded-2xl shadow-xl h-[92dvh] max-h-[92dvh]",
        backdrop: "bg-black/60 backdrop-blur-sm",
      }}
      isOpen={isOpen}
      placement="center"
      scrollBehavior="inside"
      size="5xl"
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <ModalContent>
        <ModalHeader className="flex items-center gap-3 border-b border-gray-100 pr-12">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#edf4f1] text-[#5d7c6f]">
            <FileText size={18} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-gray-900">
              ตัวอย่างเอกสาร
            </p>
            <p className="truncate text-xs font-normal text-gray-500">
              {title}
            </p>
          </div>
        </ModalHeader>

        <ModalBody className="min-h-0 flex-1 bg-[#f5f5f2] p-0">
          {loading ? (
            <div className="flex h-full min-h-[50dvh] flex-col items-center justify-center gap-3 text-sm text-gray-500">
              <Loader2 className="animate-spin text-[#5d7c6f]" size={28} />
              กำลังสร้างตัวอย่างเอกสาร...
            </div>
          ) : error ? (
            <div className="flex h-full min-h-[50dvh] flex-col items-center justify-center gap-3 px-6 text-center">
              <AlertCircle className="text-red-500" size={28} />
              <p className="text-sm text-gray-700">{error}</p>
              <Button
                size="sm"
                startContent={<RefreshCw size={14} />}
                variant="flat"
                onPress={() => void load()}
              >
                ลองอีกครั้ง
              </Button>
            </div>
          ) : previewUrl ? (
            <iframe
              className="h-full min-h-[50dvh] w-full border-0 bg-white"
              src={`${previewUrl}#view=FitH`}
              title={`ตัวอย่าง ${title}`}
            />
          ) : null}
        </ModalBody>

        <ModalFooter className="flex flex-col gap-2 border-t border-gray-100 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            {note && <p className="text-xs text-gray-500">{note}</p>}
            {previewUrl && (
              <a
                className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-[#5d7c6f] hover:underline"
                href={previewUrl}
                rel="noreferrer"
                target="_blank"
              >
                <ExternalLink size={13} /> เปิดในแท็บใหม่
              </a>
            )}
          </div>
          <div className="grid grid-cols-1 gap-2 sm:flex sm:justify-end">
            <Button variant="light" onPress={onClose}>
              ปิด
            </Button>
            {extraDownloads.map((item) => (
              <Button
                key={item.key}
                isDisabled={!!busyKey && busyKey !== item.key}
                isLoading={busyKey === item.key}
                startContent={busyKey !== item.key && item.icon}
                variant="bordered"
                onPress={() => void runExtra(item)}
              >
                {item.label}
              </Button>
            ))}
            <Button
              className="bg-[#5d7c6f] font-semibold text-white"
              isDisabled={!previewUrl}
              startContent={<Download size={16} />}
              onPress={downloadPdf}
            >
              ดาวน์โหลด PDF
            </Button>
          </div>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
