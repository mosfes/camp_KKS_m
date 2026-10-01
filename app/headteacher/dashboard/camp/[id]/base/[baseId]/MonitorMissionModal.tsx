"use client";

import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Accordion,
  AccordionItem,
  Select,
  SelectItem,
  Avatar,
} from "@heroui/react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Eye,
  Clock,
  CheckCircle2,
  XCircle,
  Users,
  Search,
  ChevronDown,
  Copy,
  Check,
  X,
} from "lucide-react";
import QRCode from "react-qr-code";

import { useStatusModal } from "@/components/StatusModalProvider";
import VideoPlayer from "@/components/VideoPlayer";
import { BANGKOK_TIME_ZONE } from "@/lib/bangkok-date";
import { toThumbnail } from "@/lib/cloudinary-url";

interface MonitorMissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  missionData: any;
}

export default function MonitorMissionModal({
  isOpen,
  onClose,
  missionData,
}: MonitorMissionModalProps) {
  const { showError } = useStatusModal();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Lightbox
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  // QR Code for QR_CODE_SCANNING missions
  const [qrPayload, setQrPayload] = useState<string | null>(null);
  const [qrPin, setQrPin] = useState<string | null>(null);
  const [qrGeneratedAt, setQrGeneratedAt] = useState<Date | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [pinCopied, setPinCopied] = useState(false);

  // Close lightbox on Escape — use capture phase so we intercept BEFORE HeroUI
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && lightboxSrc) {
        e.stopPropagation(); // stop bubble phase
        e.stopImmediatePropagation(); // stop other listeners at same element
        setLightboxSrc(null);
      }
    },
    [lightboxSrc],
  );

  useEffect(() => {
    // capture: true  →  our handler fires before any bubble-phase listener (incl. HeroUI)
    document.addEventListener("keydown", handleKeyDown, { capture: true });

    return () =>
      document.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [handleKeyDown]);

  useEffect(() => {
    if (isOpen && missionData?.mission_id) {
      fetchResults();
      if (missionData.type === "QR_CODE_SCANNING") {
        fetchQrPayload();
      }
    }
  }, [isOpen, missionData]);

  const fetchResults = async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/missions/${missionData.mission_id}/results`,
      );

      if (!res.ok) throw new Error("Failed to fetch results");
      const data = await res.json();

      setResults(data);
    } catch (error) {
      console.error(error);
      showError("ข้อผิดพลาด", "ไม่สามารถโหลดข้อมูลคำตอบได้");
    } finally {
      setLoading(false);
    }
  };

  const fetchQrPayload = async () => {
    try {
      setQrLoading(true);
      const res = await fetch(`/api/missions/${missionData.mission_id}/qr`);

      if (!res.ok) throw new Error("Failed to fetch QR");
      const data = await res.json();

      setQrPayload(data.qrPayload);
      setQrPin(data.pin ?? null);
      setQrGeneratedAt(data.generatedAt ? new Date(data.generatedAt) : null);
    } catch (error) {
      console.error(error);
    } finally {
      setQrLoading(false);
    }
  };

  // regenerateQr removed

  const formatDate = (dateString: string) => {
    if (!dateString) return { date: "", time: "" };
    const d = new Date(dateString);

    return {
      date: d.toLocaleDateString("th-TH", {
        day: "numeric",
        month: "numeric",
        year: "2-digit",
        timeZone: BANGKOK_TIME_ZONE,
      }),
      time: d.toLocaleTimeString("th-TH", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: BANGKOK_TIME_ZONE,
      }),
    };
  };

  const filteredResults = useMemo(() => {
    return results.filter((r) => {
      if (selectedStatus === "submitted" && !r.isSubmitted) return false;
      if (selectedStatus === "unsubmitted" && r.isSubmitted) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchName = r.studentName?.toLowerCase().includes(query);
        const matchNickname = r.studentNickname?.toLowerCase().includes(query);
        const matchId = String(r.studentId).includes(query);

        if (!matchName && !matchNickname && !matchId) return false;
      }

      return true;
    });
  }, [results, selectedStatus, searchQuery]);

  const isQrMission = missionData?.type === "QR_CODE_SCANNING";
  const isMcqMission =
    missionData?.type === "MULTIPLE_CHOICE_QUIZ" ||
    missionData?.type === "PRE_TEST" ||
    missionData?.type === "POST_TEST";
  const totalMcqQuestions = missionData?.mission_question?.length || 0;

  // Render lightbox via portal so it always sits above HeroUI Modal portal
  const lightbox =
    lightboxSrc && typeof document !== "undefined"
      ? createPortal(
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
            <button
              aria-label="ปิดภาพคำตอบ"
              className="absolute inset-0 bg-black/85 backdrop-blur-md"
              type="button"
              onClick={() => setLightboxSrc(null)}
            />
            <div
              className="relative z-10 max-w-5xl w-full max-h-[92vh] flex flex-col items-center"
            >
              {/* Lightbox Top bar */}
              <div className="w-full flex items-center justify-between pb-3 text-white px-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Eye className="text-emerald-400" size={18} />
                  <span>ดูรูปภาพคำตอบขนาดเต็ม</span>
                </div>
                <button
                  className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                  title="ปิด"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.nativeEvent.stopImmediatePropagation();
                    setLightboxSrc(null);
                  }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Lightbox Image */}
              <div className="w-full flex items-center justify-center overflow-hidden rounded-2xl bg-black/40 border border-white/10 shadow-2xl p-2 sm:p-4">
                <img
                  alt="ภาพขนาดใหญ่"
                  className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-lg"
                  src={lightboxSrc}
                />
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      {lightbox}
      <Modal
        backdrop="blur"
        classNames={{
          base: "bg-white rounded-2xl shadow-xl max-h-[90vh]",
          backdrop: "bg-black/60 backdrop-blur-sm",
        }}
        // The image viewer is rendered in a portal outside this modal.  While it
        // is open, interactions with it must not be treated as an outside press
        // that dismisses the student-answer modal.
        isDismissable={!lightboxSrc}
        isOpen={isOpen}
        scrollBehavior="inside"
        size="3xl"
        onOpenChange={(open) => {
          if (!open && !lightboxSrc) onClose();
        }}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1 p-6 pb-4 border-b border-gray-100">
                <div className="flex items-center gap-2 text-[#6b857a]">
                  <Eye size={24} />
                  <h2 className="text-xl font-semibold text-gray-900">
                    ดูคำตอบนักเรียน
                  </h2>
                </div>
                <p className="text-sm text-gray-500 font-normal">
                  ภารกิจ: {missionData?.title}
                </p>
              </ModalHeader>

              <ModalBody className="py-6 px-6 bg-[#f5f5f2]/30">
                {loading ? (
                  <div className="space-y-4 py-1">
                    {/* Stats & Search Skeleton */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gray-200 animate-pulse" />
                        <div className="w-32 h-4 bg-gray-200 rounded animate-pulse" />
                      </div>
                      <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-3">
                        <div className="w-full sm:w-48 h-8 bg-gray-200 rounded-lg animate-pulse" />
                        <div className="w-full sm:w-40 h-8 bg-gray-200 rounded-lg animate-pulse" />
                      </div>
                    </div>

                    {/* Student Submissions Skeleton List */}
                    <div className="space-y-3">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div
                          key={i}
                          className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gray-200 animate-pulse" />
                            <div className="space-y-1.5">
                              <div className="w-36 h-4 bg-gray-200 rounded animate-pulse" />
                              <div className="w-24 h-3 bg-gray-200 rounded animate-pulse" />
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="w-20 h-6 rounded-full bg-gray-200 animate-pulse" />
                            <div className="w-5 h-5 rounded bg-gray-200 animate-pulse" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* QR CODE DISPLAY for QR missions */}
                    {isQrMission && (
                      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                        <div className="flex items-center gap-2 mb-4">
                          <h3 className="font-semibold text-gray-900">
                            QR Code สำหรับภารกิจนี้
                          </h3>
                        </div>
                        {qrGeneratedAt && (
                          <p className="text-[10px] text-gray-400 text-right -mt-3 mb-2">
                            สร้างเมื่อ{" "}
                            {qrGeneratedAt.toLocaleTimeString("th-TH", {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                              timeZone: BANGKOK_TIME_ZONE,
                            })}
                          </p>
                        )}
                        <div className="flex flex-col items-center gap-3">
                          {qrLoading ? (
                            <div className="w-52 h-52 bg-gray-100 rounded-2xl flex items-center justify-center">
                              <div className="w-8 h-8 border-4 border-[#6b857a] border-t-transparent rounded-full animate-spin" />
                            </div>
                          ) : qrPayload ? (
                            <>
                              <div className="p-4 bg-white border-4 border-[#6b857a]/20 rounded-2xl shadow-inner">
                                <QRCode
                                  bgColor="#ffffff"
                                  fgColor="#2d3748"
                                  size={200}
                                  value={qrPayload}
                                />
                              </div>
                              <p className="text-xs text-gray-400 text-center">
                                แสดง QR Code
                                นี้ให้นักเรียนแสกนเพื่อบันทึกการทำภารกิจ
                              </p>
                              {/* PIN Section */}
                              {qrPin && (
                                <div className="w-full mt-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="w-1 h-4 bg-[#6b857a] rounded-full" />
                                    <p className="text-xs font-medium text-gray-600">
                                      รหัส PIN สำรอง
                                    </p>
                                    <span className="text-[10px] text-gray-400">
                                      (สำหรับนักเรียนที่แสกนไม่ได้)
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3 bg-[#6b857a]/5 border-2 border-[#6b857a]/25 rounded-2xl px-5 py-4">
                                    <div className="flex-1 flex gap-2 items-center justify-center">
                                      {qrPin.split("").map((digit, i) => (
                                        <span
                                          key={i}
                                          className="w-10 h-12 bg-white border-2 border-[#6b857a]/30 rounded-xl flex items-center justify-center text-2xl font-bold text-[#3d5c52] font-mono shadow-sm"
                                        >
                                          {digit}
                                        </span>
                                      ))}
                                    </div>
                                    <button
                                      className="p-2 rounded-lg text-gray-400 hover:text-[#6b857a] hover:bg-white transition-all border border-transparent hover:border-[#6b857a]/20"
                                      title="คัดลอก PIN"
                                      onClick={() => {
                                        navigator.clipboard.writeText(qrPin);
                                        setPinCopied(true);
                                        setTimeout(
                                          () => setPinCopied(false),
                                          2000,
                                        );
                                      }}
                                    >
                                      {pinCopied ? (
                                        <Check
                                          className="text-green-500"
                                          size={18}
                                        />
                                      ) : (
                                        <Copy size={18} />
                                      )}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </>
                          ) : (
                            <p className="text-gray-400 text-sm">
                              ไม่สามารถโหลด QR Code ได้
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Stats + Filter row */}
                    {results.length > 0 && (
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <div className="p-2 bg-[#6b857a]/10 rounded-lg text-[#6b857a]">
                            <Users size={18} />
                          </div>
                          <span>
                            ส่งแล้ว{" "}
                            <span className="font-semibold text-gray-900">
                              {results.filter((r) => r.isSubmitted).length}
                            </span>{" "}
                            / {results.length} คน
                          </span>
                        </div>

                        <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-3">
                          <div className="relative w-full sm:w-48">
                            <Search
                              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                              size={16}
                            />
                            <input
                              className="pl-9 pr-4 py-1.5 text-sm h-[32px] border border-gray-200 rounded-lg focus:outline-none focus:border-[#6b857a] w-full bg-gray-50 hover:bg-gray-100 transition-colors"
                              placeholder="ค้นหาชื่อ ชื่อเล่น หรือรหัส..."
                              type="text"
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                            />
                          </div>
                          <div className="w-full sm:w-40">
                            <Select
                              aria-label="Filter status"
                              classNames={{
                                trigger:
                                  "border-gray-200 hover:border-[#6b857a] bg-gray-50 min-h-[32px] h-[32px]",
                                value: "text-gray-700 font-medium text-sm",
                              }}
                              selectedKeys={[selectedStatus]}
                              size="sm"
                              variant="bordered"
                              onSelectionChange={(keys) => {
                                const val = Array.from(keys)[0] as string;

                                setSelectedStatus(val || "all");
                              }}
                            >
                              <SelectItem key="all" textValue="นักเรียนทุกคน">
                                นักเรียนทุกคน
                              </SelectItem>
                              <SelectItem key="submitted" textValue="ส่งแล้ว">
                                ส่งแล้ว
                              </SelectItem>
                              <SelectItem
                                key="unsubmitted"
                                textValue="ยังไม่ส่ง"
                              >
                                ยังไม่ส่ง
                              </SelectItem>
                            </Select>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Student list */}
                    {results.length === 0 ? (
                      <div className="text-center py-20 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                          <Users size={32} />
                        </div>
                        <p className="text-gray-500 font-medium">
                          ยังไม่มีนักเรียนในฐานนี้
                        </p>
                      </div>
                    ) : filteredResults.length === 0 ? (
                      <div className="text-center py-12 text-gray-500">
                        ไม่พบนักเรียนที่คุณค้นหา
                      </div>
                    ) : isQrMission ? (
                      // QR mission: simple list (no answers to show)
                      <div className="space-y-3">
                        {filteredResults.map((result) => (
                          <div
                            key={result.enrollmentId}
                            className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4"
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <Avatar
                                className="h-10 w-10 shrink-0 bg-[#e8f0ee] text-[#3d6357]"
                                imgProps={{
                                  alt: `รูปโปรไฟล์ของ ${result.studentName}`,
                                }}
                                name={result.initials}
                                src={result.profileImageUrl || undefined}
                              />
                              <div className="min-w-0">
                                <p className="font-medium text-gray-900 truncate">
                                  {result.studentName}
                                </p>
                                <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-gray-500 font-light">
                                  <span>
                                    ชื่อเล่น: {result.studentNickname || "-"}
                                  </span>
                                  <span aria-hidden="true">·</span>
                                  <span>รหัส: {result.studentId}</span>
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 ml-[52px] sm:ml-0">
                              {result.isSubmitted ? (
                                <>
                                  <div className="flex items-center gap-1.5 bg-green-50 text-green-700 border border-green-100 px-3 py-1.5 rounded-full text-[10px] sm:text-xs font-medium">
                                    <CheckCircle2 size={14} />
                                    แสกนแล้ว
                                  </div>
                                  <div className="flex flex-col items-end text-[10px] text-gray-400 leading-tight">
                                    <span>
                                      {formatDate(result.submittedAt).date}
                                    </span>
                                    <span>
                                      {formatDate(result.submittedAt).time}
                                    </span>
                                  </div>
                                </>
                              ) : (
                                <div className="flex items-center gap-1.5 bg-gray-100 text-gray-500 px-3 py-1.5 rounded-full text-[10px] sm:text-xs font-medium">
                                  <XCircle size={14} />
                                  ยังไม่แสกน
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      // Non-QR mission: Accordion with answers
                      <Accordion
                        key={`${selectedStatus}-${searchQuery}`}
                        className="px-0 gap-4"
                        defaultExpandedKeys={[]}
                        selectionMode="multiple"
                        variant="splitted"
                      >
                        {filteredResults.map((result) => (
                          <AccordionItem
                            key={String(result.enrollmentId)}
                            aria-label={result.studentName}
                            classNames={{
                              base: "bg-white group-[.is-splitted]:shadow-sm group-[.is-splitted]:border border-gray-100 rounded-xl overflow-hidden",
                              title: "w-full",
                              trigger:
                                "py-4 px-5 hover:bg-gray-50/50 transition-colors",
                              content: "pt-0 pb-6 px-6",
                            }}
                            indicator={({ isOpen }) => (
                              <div
                                className={`p-1.5 rounded-lg transition-colors ${isOpen ? "bg-[#6b857a] text-white" : "bg-gray-100 text-gray-400"}`}
                              >
                                <ChevronDown
                                  className={`transition-transform duration-0 ${isOpen ? "rotate-270" : ""}`}
                                  size={18}
                                />
                              </div>
                            )}
                            title={
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full pr-2 gap-2 sm:gap-4">
                                <div className="flex items-center gap-3 min-w-0">
                                  <Avatar
                                    className="h-10 w-10 shrink-0 bg-[#e8f0ee] text-[#3d6357]"
                                    imgProps={{
                                      alt: `รูปโปรไฟล์ของ ${result.studentName}`,
                                    }}
                                    name={result.initials}
                                    src={result.profileImageUrl || undefined}
                                  />
                                  <div className="text-left min-w-0">
                                    <p className="font-medium text-gray-900 leading-tight truncate">
                                      {result.studentName}
                                    </p>
                                    <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-gray-500 font-light">
                                      <span>
                                        ชื่อเล่น:{" "}
                                        {result.studentNickname || "-"}
                                      </span>
                                      <span aria-hidden="true">·</span>
                                      <span>รหัส: {result.studentId}</span>
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-3 shrink-0 ml-[52px] sm:ml-0">
                                  {isMcqMission && result.isSubmitted && (
                                    <div className="flex items-center gap-1.5 bg-[#6b857a]/10 text-[#6b857a] px-3 py-1 sm:py-1.5 rounded-xl border border-[#6b857a]/20">
                                      <span className="text-[10px] sm:text-xs font-medium opacity-70">
                                        คะแนน
                                      </span>
                                      <span className="text-xs sm:text-sm font-medium">
                                        {result.answers?.filter(
                                          (ans: any) => ans.isCorrect === true,
                                        ).length || 0}{" "}
                                        / {totalMcqQuestions}
                                      </span>
                                    </div>
                                  )}
                                  <div className="flex items-center gap-2">
                                    {result.isSubmitted ? (
                                      <div className="flex flex-row items-center gap-1.5 bg-green-50/50 px-2 py-1 rounded-lg border border-green-100/50">
                                        <Clock
                                          className="text-green-600 shrink-0"
                                          size={14}
                                        />
                                        <div className="flex flex-col text-[10px] sm:text-[11px] font-medium text-green-700 leading-tight">
                                          <span>
                                            {
                                              formatDate(result.submittedAt)
                                                .date
                                            }
                                          </span>
                                          <span>
                                            {
                                              formatDate(result.submittedAt)
                                                .time
                                            }
                                          </span>
                                        </div>
                                      </div>
                                    ) : (
                                      <span className="text-[11px] font-medium text-gray-400 bg-gray-50 px-2 py-1 rounded-md border border-gray-100">
                                        ยังไม่ส่งงาน
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            }
                          >
                            {result.isSubmitted ? (
                              <>
                                <div className="divider h-px bg-gray-100 w-full mb-5" />
                                <div className="space-y-4">
                                  {result.answers.map(
                                    (ans: any, idx: number) => (
                                      <div
                                        key={ans.questionId}
                                        className="space-y-2"
                                      >
                                        <div className="flex gap-2.5 items-center">
                                          <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-[#6b857a]/10 text-[#5d7c6f]">
                                            {String(idx + 1).padStart(2, "0")}
                                          </span>
                                          <p className="text-sm font-medium text-gray-800">
                                            {ans.questionText || "คำถาม"}
                                          </p>
                                        </div>

                                        {ans.type === "TEXT" && (
                                          <div className="ml-6 sm:ml-7 bg-gray-50 p-3.5 sm:p-4 rounded-xl text-sm text-gray-800 border border-gray-100 whitespace-pre-wrap leading-relaxed">
                                            {ans.answerText}
                                          </div>
                                        )}

                                        {ans.type === "MCQ" && (
                                          <div className="ml-6 sm:ml-7 bg-gray-50 p-3 sm:p-4 rounded-xl text-sm text-gray-800 border border-gray-100 flex items-center justify-between">
                                            <span className="font-medium text-[#6b857a]">
                                              {ans.answerText}
                                            </span>
                                            {ans.isCorrect === true && (
                                              <div className="flex items-center gap-1.5 text-green-600 bg-green-50 px-2.5 py-1 rounded-full text-xs font-medium border border-green-100">
                                                <CheckCircle2 size={14} />
                                                ถูกต้อง
                                              </div>
                                            )}
                                            {ans.isCorrect === false && (
                                              <div className="flex items-center gap-1.5 text-red-600 bg-red-50 px-2.5 py-1 rounded-full text-xs font-medium border border-red-100">
                                                <XCircle size={14} />
                                                ไม่ถูกต้อง
                                              </div>
                                            )}
                                          </div>
                                        )}

                                        {ans.type === "PHOTO" && (
                                          <div className="ml-6 sm:ml-7">
                                            <button
                                              className="relative group inline-block rounded-xl overflow-hidden border border-gray-200 bg-gray-50 shadow-xs cursor-pointer transition-all hover:shadow-md hover:border-[#6b857a]/50"
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                e.nativeEvent.stopImmediatePropagation();
                                                setLightboxSrc(ans.answerText);
                                              }}
                                              onPointerDown={(e) =>
                                                e.stopPropagation()
                                              }
                                            >
                                              <img
                                                alt={`รูปภาพคำตอบของ ${result.studentName}`}
                                                className="max-h-[280px] sm:max-h-[320px] w-auto object-contain transition-transform duration-200 group-hover:scale-[1.02]"
                                                src={toThumbnail(
                                                  ans.answerText,
                                                )}
                                              />
                                              <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white text-xs font-medium backdrop-blur-[1px]">
                                                <Eye size={15} />
                                                <span>
                                                  คลิกดูรูปภาพขนาดเต็ม
                                                </span>
                                              </div>
                                            </button>
                                          </div>
                                        )}

                                        {ans.type === "VIDEO" && (
                                          <div className="ml-6 sm:ml-7 space-y-3">
                                            <VideoPlayer
                                              title={`วิดีโอของ ${result.studentName}`}
                                              url={ans.answerText}
                                            />
                                          </div>
                                        )}
                                      </div>
                                    ),
                                  )}
                                </div>
                              </>
                            ) : (
                              <div className="py-6 text-center text-gray-500 font-medium">
                                นักเรียนยังไม่ได้ส่งงาน
                              </div>
                            )}
                          </AccordionItem>
                        ))}
                      </Accordion>
                    )}
                  </div>
                )}
              </ModalBody>

              <ModalFooter className="p-4 border-t border-gray-100">
                <Button
                  fullWidth
                  className="bg-gray-100 text-gray-700 font-medium hover:bg-gray-200"
                  size="lg"
                  onPress={onClose}
                >
                  ปิดหน้าต่าง
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}
