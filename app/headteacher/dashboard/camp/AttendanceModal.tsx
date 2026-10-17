"use client";

import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Select,
  SelectItem,
  Pagination,
  Avatar,
} from "@heroui/react";
import { useState, useEffect, useMemo, useRef, type ReactNode } from "react";
import {
  UserCheck,
  QrCode,
  RefreshCw,
  Copy,
  Check,
  Users,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Trash2,
  Plus,
  CheckSquare,
  Nfc,
} from "lucide-react";
import QRCode from "react-qr-code";

import CampBreadcrumb from "./CampBreadcrumb";
import NfcAttendancePanel from "./NfcAttendancePanel";

import { useStatusModal } from "@/components/StatusModalProvider";
import { BANGKOK_TIME_ZONE } from "@/lib/bangkok-date";

interface RoundInfo {
  roundId: string;
  roundNumber: number;
  description: string;
  method: "QR" | "NFC";
  createdAt: string;
  expiresAt: string;
  isClosed: boolean;
  closedAt: string | null;
}

export type AttendanceInitialData = {
  qr: {
    active: boolean;
    roundId?: string;
    qrPayload?: string | null;
    pin?: string | null;
    expiresAt?: string | null;
    method?: "QR" | "NFC";
    rounds: RoundInfo[];
  };
  results: { results: any[]; totalCheckedIn: number };
};

interface AttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  campId: number;
  campName?: string;
  pageMode?: boolean;
  initialData?: AttendanceInitialData | null;
}

function AttendanceShell({
  pageMode,
  isOpen,
  onClose,
  children,
}: {
  pageMode: boolean;
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  if (pageMode) {
    return (
      <main className="h-full min-h-0 overflow-y-auto bg-[#f5f5f2]">
        {children}
      </main>
    );
  }

  return (
    <Modal
      backdrop="blur"
      classNames={{
        base: "bg-white rounded-2xl shadow-xl max-h-[90vh]",
        backdrop: "bg-black/60 backdrop-blur-sm",
      }}
      isDismissable={true}
      isOpen={isOpen}
      scrollBehavior="inside"
      size="3xl"
      onOpenChange={onClose}
    >
      <ModalContent className="max-h-[90vh]">{children}</ModalContent>
    </Modal>
  );
}

export default function AttendanceModal({
  isOpen,
  onClose,
  campId,
  campName,
  pageMode = false,
  initialData,
}: AttendanceModalProps) {
  const { showError, showConfirm, close } = useStatusModal();
  const initialDataPending = useRef(Boolean(initialData));
  const initialRoundId = initialData?.qr.active
    ? initialData.qr.roundId || null
    : initialData?.qr.rounds.at(-1)?.roundId || null;

  // QR / PIN state
  const [qrPayload, setQrPayload] = useState<string | null>(initialData?.qr.qrPayload || null);
  const [qrPin, setQrPin] = useState<string | null>(initialData?.qr.pin || null);
  const [qrExpiresAt, setQrExpiresAt] = useState<Date | null>(
    initialData?.qr.expiresAt ? new Date(initialData.qr.expiresAt) : null,
  );
  const [durationMinutes, setDurationMinutes] = useState("60");
  const [attendanceMethod, setAttendanceMethod] = useState<"QR" | "NFC">(
    initialData?.qr.method === "NFC" ? "NFC" : "QR",
  );
  const [roundDescription, setRoundDescription] = useState("");
  const [qrLoading, setQrLoading] = useState(false);
  const [pinCopied, setPinCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  // Rounds state
  const [rounds, setRounds] = useState<RoundInfo[]>(initialData?.qr.rounds || []);
  const [activeRoundId, setActiveRoundId] = useState<string | null>(
    initialData?.qr.active ? initialData.qr.roundId || null : null,
  );
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(initialRoundId);

  // Student list state
  const [results, setResults] = useState<any[]>(initialData?.results.results || []);
  const [totalCheckedIn, setTotalCheckedIn] = useState(initialData?.results.totalCheckedIn || 0);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [autoRefresh] = useState(true);

  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  useEffect(() => {
    setPage(1);
  }, [searchQuery, selectedStatus, selectedRoundId]);

  // ─── Fetch helpers ────────────────────────────────────────────────────────

  const fetchResults = async (roundId?: string | null) => {
    try {
      setResultsLoading(true);
      const rid = roundId !== undefined ? roundId : selectedRoundId;
      const url = rid
        ? `/api/attendance/${campId}/results?roundId=${rid}`
        : `/api/attendance/${campId}/results`;
      const res = await fetch(url);

      if (!res.ok) throw new Error();
      const data = await res.json();

      setResults(data.results ?? []);
      setTotalCheckedIn(data.totalCheckedIn ?? 0);
    } catch {
    } finally {
      setResultsLoading(false);
    }
  };

  const fetchQr = async (): Promise<{
    roundId: string | null;
    rounds: RoundInfo[];
  }> => {
    try {
      setQrLoading(true);
      const res = await fetch(`/api/attendance/${campId}/qr`);

      if (!res.ok) throw new Error();
      const data = await res.json();
      const fetchedRounds: RoundInfo[] = data.rounds ?? [];

      setRounds(fetchedRounds);
      if (data.active) {
        setQrPayload(data.qrPayload);
        setQrPin(data.pin ?? null);
        setQrExpiresAt(data.expiresAt ? new Date(data.expiresAt) : null);
        setActiveRoundId(data.roundId);
        setAttendanceMethod(data.method === "NFC" ? "NFC" : "QR");

        return { roundId: data.roundId, rounds: fetchedRounds };
      } else {
        setQrPayload(null);
        setQrPin(null);
        setQrExpiresAt(null);
        setActiveRoundId(null);
        const lastRound = fetchedRounds[fetchedRounds.length - 1] ?? null;

        return { roundId: lastRound?.roundId ?? null, rounds: fetchedRounds };
      }
    } catch {
      return { roundId: null, rounds: [] };
    } finally {
      setQrLoading(false);
    }
  };

  // โหลดครั้งแรกเมื่อเปิด modal
  useEffect(() => {
    if (!isOpen || !campId) return;
    if (initialDataPending.current) {
      initialDataPending.current = false;
      return;
    }
    (async () => {
      // Both endpoints resolve the active/latest round independently. Start
      // them together so the initial attendance screen does not add the two
      // network latencies end-to-end.
      const qrRequest = fetchQr();
      const resultsRequest = fetchResults(null);
      const [{ roundId }] = await Promise.all([qrRequest, resultsRequest]);

      setSelectedRoundId(roundId);
    })();
  }, [isOpen, campId]);

  // Auto-refresh ทุก 10 วินาที
  useEffect(() => {
    if (!isOpen || !autoRefresh) return;
    const interval = setInterval(() => fetchResults(), 10000);

    return () => clearInterval(interval);
  }, [isOpen, autoRefresh, selectedRoundId]);

  // เมื่อเลือกรอบอื่น
  const handleSelectRound = (roundId: string) => {
    setSelectedRoundId(roundId);
    fetchResults(roundId);
    setSearchQuery("");
    setSelectedStatus("all");
  };

  const regenerateQr = async () => {
    try {
      setRegenerating(true);
      const res = await fetch(`/api/attendance/${campId}/qr`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          durationMinutes,
          description: roundDescription,
          method: attendanceMethod,
        }),
      });

      if (!res.ok) throw new Error();
      const data = await res.json();

      setQrPayload(data.qrPayload);
      setQrPin(data.pin ?? null);
      setQrExpiresAt(data.expiresAt ? new Date(data.expiresAt) : null);
      setActiveRoundId(data.roundId);
      setAttendanceMethod(data.method === "NFC" ? "NFC" : "QR");
      setRounds(data.rounds ?? []);
      setSelectedRoundId(data.roundId);
      setPinCopied(false);
      setRoundDescription("");
      await fetchResults(data.roundId);
    } catch {
    } finally {
      setRegenerating(false);
    }
  };

  const handleCloseSession = () => {
    showConfirm(
      "ปิดรับเช็คชื่อ",
      "คุณแน่ใจหรือไม่? นักเรียนจะไม่สามารถเช็คชื่อในรอบนี้ได้อีก",
      async () => {
        const res = await fetch(`/api/attendance/${campId}/qr`, {
          method: "DELETE",
        });

        if (!res.ok) return;
        const data = await res.json();

        setQrPayload(null);
        setQrPin(null);
        setQrExpiresAt(null);
        setActiveRoundId(null);
        setRounds(data.rounds ?? []);
        close();
      },
      "ปิดรับเช็คชื่อ",
    );
  };

  const handleClearRound = () => {
    const label =
      selectedRoundId === activeRoundId
        ? "รอบนี้"
        : `รอบที่ ${rounds.find((r) => r.roundId === selectedRoundId)?.roundNumber ?? ""}`;

    showConfirm(
      "ล้างข้อมูลเช็คชื่อ",
      `คุณแน่ใจหรือไม่? ข้อมูลการเช็คชื่อ${label}จะถูกล้าง`,
      async () => {
        await fetch(
          `/api/attendance/${campId}/results?roundId=${selectedRoundId}`,
          { method: "DELETE" },
        );
        fetchResults(selectedRoundId);
        close();
      },
      "ล้างข้อมูล",
    );
  };

  const handleClearAll = () => {
    showConfirm(
      "ล้างข้อมูลทั้งหมด",
      "คุณแน่ใจหรือไม่? ข้อมูลเช็คชื่อทุกรอบและประวัติรอบจะถูกล้างทั้งหมด",
      async () => {
        await fetch(`/api/attendance/${campId}/results`, { method: "DELETE" });
        setRounds([]);
        setSelectedRoundId(null);
        setActiveRoundId(null);
        setQrPayload(null);
        setQrPin(null);
        setQrExpiresAt(null);
        fetchResults(null);
        close();
      },
      "ล้างทั้งหมด",
    );
  };

  const handleToggleCheckin = async (
    studentId: number,
    enrollmentId: number,
    isCheckedIn: boolean,
    studentName: string,
  ) => {
    if (!selectedRoundId) {
      showError(
        "ไม่สามารถเช็คชื่อได้",
        "กรุณาสร้างรอบการเช็คชื่อก่อน หรือเลือกรอบที่ต้องการเช็คชื่อ",
      );

      return;
    }

    const title = isCheckedIn ? "ยกเลิกการเช็คชื่อ" : "ยืนยันการเช็คชื่อ";
    const message = isCheckedIn
      ? `คุณแน่ใจหรือไม่ว่าต้องการยกเลิกการเช็คชื่อของ "${studentName}" (รหัส: ${studentId}) ?`
      : `คุณต้องการเช็คชื่อให้ "${studentName}" (รหัส: ${studentId}) ใช่หรือไม่?`;
    const confirmText = isCheckedIn ? "ยกเลิกเช็คชื่อ" : "ยืนยันเช็คชื่อ";

    showConfirm(
      title,
      message,
      async () => {
        try {
          const res = await fetch(`/api/attendance/${campId}/manual-checkin`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              roundId: selectedRoundId,
              studentId,
              enrollmentId,
              action: isCheckedIn ? "uncheck" : "checkin",
            }),
          });

          if (res.ok) fetchResults(selectedRoundId);
          close();
        } catch {}
      },
      confirmText,
    );
  };

  const formatTime = (d: string | Date) => {
    return new Date(d).toLocaleString("th-TH", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: BANGKOK_TIME_ZONE,
    });
  };

  const filteredResults = useMemo(
    () =>
      results.filter((r) => {
        if (selectedStatus === "checked" && !r.isCheckedIn) return false;
        if (selectedStatus === "unchecked" && r.isCheckedIn) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();

          if (
            !r.studentName?.toLowerCase().includes(q) &&
            !r.studentNickname?.toLowerCase().includes(q) &&
            !String(r.studentId).includes(q)
          )
            return false;
        }

        return true;
      }),
    [results, selectedStatus, searchQuery],
  );

  const pages = Math.ceil((filteredResults?.length || 0) / ITEMS_PER_PAGE);

  const paginatedResults = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;

    return filteredResults?.slice(start, end);
  }, [page, filteredResults]);

  const selectedRound = rounds.find(
    (round) => round.roundId === selectedRoundId,
  );
  const attendanceRate = results.length
    ? Math.round(
        (Math.min(totalCheckedIn, results.length) / results.length) * 100,
      )
    : 0;
  const pendingCount = Math.max(results.length - totalCheckedIn, 0);

  // ─── Render ───────────────────────────────────────────────────────────────

  const Header = pageMode ? "header" : ModalHeader;
  const Body = pageMode ? "section" : ModalBody;

  return (
    <AttendanceShell isOpen={isOpen} pageMode={pageMode} onClose={onClose}>
      <div
        className={
          pageMode
            ? "min-h-full bg-[#f5f5f2] text-[#17251f]"
            : "flex min-h-0 flex-col bg-white"
        }
      >
        {/* Page header */}
        <Header
          className={
            pageMode
              ? "mx-auto flex w-full max-w-7xl flex-col gap-0 border-0 px-4 pb-8 pt-8 sm:px-8"
              : "relative flex shrink-0 flex-col gap-1 border-b border-gray-100 px-6 pb-4 pt-6"
          }
        >
          {pageMode && (
            <CampBreadcrumb
              campId={campId}
              campName={campName}
              className="mb-6"
              currentPage="เช็กชื่อนักเรียน"
            />
          )}
          <div className="flex items-center gap-2">
            {pageMode ? (
              <UserCheck className="shrink-0 text-[#6b857a]" size={20} />
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#eaf1ee] text-[#5d7c6f]">
                <UserCheck size={20} />
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-lg font-bold leading-tight text-gray-900">
                เช็กชื่อนักเรียน
              </h2>
              {campName && (
                <p className="mt-0.5 max-w-[300px] truncate text-sm font-normal text-gray-500">
                  {campName}
                </p>
              )}
            </div>
          </div>
        </Header>

        <Body
          className={
            pageMode
              ? "mx-auto block w-full max-w-7xl overflow-visible bg-[#f5f5f2] px-4 pb-10 pt-0 sm:px-8"
              : "flex min-h-0 flex-1 flex-col overflow-hidden bg-gray-50/30 px-6 py-4"
          }
        >
          <div
            className={
              pageMode
                ? "space-y-5 overflow-visible"
                : "min-h-0 flex-1 space-y-4 overflow-y-auto"
            }
          >
            {/* Main workspace */}
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)] lg:items-start">
              {/* Student roster */}
              <section className="order-last min-w-0 rounded-2xl border border-[#e0e9e4] bg-white p-4 shadow-sm sm:p-5 lg:order-none lg:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e6f1eb] text-[#2d6a58]">
                        <Users size={18} />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold tracking-[-0.02em] text-[#17251f]">
                          รายชื่อนักเรียน
                        </h2>
                        <p className="mt-0.5 text-xs text-[#87968e]">
                          คลิกที่รายชื่อเพื่อเช็กชื่อด้วยตนเอง
                        </p>
                      </div>
                    </div>
                  </div>
                  <button
                    className="inline-flex w-fit items-center gap-2 rounded-xl border border-[#e1eae5] bg-[#f8fbf9] px-3 py-2 text-xs font-semibold text-[#5c7469] transition-colors hover:border-[#bcd7ca] hover:bg-[#eef7f1] disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={resultsLoading}
                    type="button"
                    onClick={() => fetchResults()}
                  >
                    <RefreshCw
                      className={resultsLoading ? "animate-spin" : ""}
                      size={14}
                    />
                    รีเฟรชข้อมูล
                  </button>
                </div>

                <div className="mt-5 rounded-2xl bg-[#f5f9f6] p-3.5 sm:p-4">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-[#708278]">
                        ความคืบหน้ารอบนี้
                      </p>
                      <p className="mt-1 text-sm font-bold text-[#244d3e]">
                        เช็กชื่อแล้ว {totalCheckedIn} จาก {results.length} คน
                      </p>
                    </div>
                    <span className="text-lg font-bold text-[#2d6a58]">
                      {attendanceRate}%
                    </span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#dfeae3]">
                    <div
                      className="h-full rounded-full bg-[#6b857a] transition-all duration-500"
                      style={{ width: `${attendanceRate}%` }}
                    />
                  </div>
                  <div className="mt-2 flex justify-between text-[11px] text-[#8a9b91]">
                    <span>เช็กชื่อแล้ว {totalCheckedIn} คน</span>
                    <span>เหลือ {pendingCount} คน</span>
                  </div>
                </div>

                <div className="mt-5 flex flex-col gap-2.5 md:flex-row">
                  <div className="relative min-w-0 flex-1">
                    <Search
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#91a199]"
                      size={16}
                    />
                    <input
                      className="h-11 w-full rounded-xl border border-[#e1e9e4] bg-[#fbfcfb] pl-10 pr-4 text-sm text-[#25352d] outline-none transition-colors placeholder:text-[#a0ada6] focus:border-[#6ea58b] focus:bg-white focus:ring-4 focus:ring-[#70ad8e]/10"
                      placeholder="ค้นหาชื่อ ชื่อเล่น หรือรหัสนักเรียน"
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <div className="w-full md:w-48">
                    <Select
                      aria-label="ตัวกรองสถานะ"
                      classNames={{
                        trigger:
                          "h-11 min-h-11 rounded-xl border-[#e1e9e4] bg-[#fbfcfb] shadow-none",
                        value: "text-sm font-medium text-[#50645a]",
                      }}
                      selectedKeys={[selectedStatus]}
                      size="sm"
                      variant="bordered"
                      onSelectionChange={(keys) =>
                        setSelectedStatus(
                          (Array.from(keys)[0] as string) || "all",
                        )
                      }
                    >
                      <SelectItem key="all" textValue="นักเรียนทุกคน">
                        นักเรียนทุกคน
                      </SelectItem>
                      <SelectItem key="checked" textValue="เช็กชื่อแล้ว">
                        เช็กชื่อแล้ว
                      </SelectItem>
                      <SelectItem key="unchecked" textValue="ยังไม่เช็กชื่อ">
                        ยังไม่เช็กชื่อ
                      </SelectItem>
                    </Select>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between border-b border-[#edf1ee] pb-3">
                  <p className="text-xs font-semibold text-[#788a80]">
                    {filteredResults.length} รายการที่แสดง
                  </p>
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-[#9aa8a0]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#52b386]" />
                    ซิงก์ล่าสุดอัตโนมัติ
                  </span>
                </div>

                <div className="mt-3">
                  {resultsLoading && results.length === 0 ? (
                    <div
                      aria-label="กำลังโหลดรายชื่อนักเรียน"
                      className="space-y-2 py-1"
                    >
                      {Array.from({ length: 5 }).map((_, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-3 rounded-xl border border-[#edf1ee] px-3.5 py-3 sm:px-4"
                        >
                          <div className="h-10 w-10 animate-pulse rounded-xl bg-[#e7eee9]" />
                          <div className="min-w-0 flex-1">
                            <div className="h-3.5 w-2/5 animate-pulse rounded-full bg-[#e7eee9]" />
                            <div className="mt-2 h-2.5 w-1/4 animate-pulse rounded-full bg-[#eef3ef]" />
                          </div>
                          <div className="h-7 w-20 animate-pulse rounded-full bg-[#eef3ef]" />
                        </div>
                      ))}
                    </div>
                  ) : results.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[#dce7e1] bg-[#fafcfb] py-16 text-center">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#edf4ef] text-[#78998a]">
                        <Users size={25} />
                      </div>
                      <p className="mt-4 text-sm font-bold text-[#546b5f]">
                        ยังไม่มีนักเรียนในค่ายนี้
                      </p>
                      <p className="mt-1 text-xs text-[#9aa9a1]">
                        นักเรียนต้องลงทะเบียนก่อนจึงจะแสดงในรายการ
                      </p>
                    </div>
                  ) : filteredResults.length === 0 ? (
                    <div className="py-14 text-center text-sm text-[#809188]">
                      ไม่พบนักเรียนที่ตรงกับการค้นหา
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        {paginatedResults.map((result) => (
                          <button
                            key={result.enrollmentId}
                            className="group flex w-full items-center gap-3 rounded-xl border border-[#edf1ee] bg-white px-3.5 py-3 text-left transition-colors hover:border-[#cde1d5] hover:bg-[#f7faf8] sm:gap-4 sm:px-4"
                            type="button"
                            onClick={() =>
                              handleToggleCheckin(
                                result.studentId,
                                result.enrollmentId,
                                result.isCheckedIn,
                                result.studentName,
                              )
                            }
                          >
                            <Avatar
                              className={`h-10 w-10 shrink-0 transition-colors ${
                                result.isCheckedIn
                                  ? "bg-[#e1f3e8] text-[#3b966c] ring-2 ring-[#cce9d8]"
                                  : "bg-[#e8f0ee] text-[#3d6357]"
                              }`}
                              imgProps={{
                                alt: `รูปโปรไฟล์ของ ${result.studentName}`,
                              }}
                              name={result.initials}
                              src={result.profileImageUrl || undefined}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-[#26382e] transition-colors group-hover:text-[#2d765e]">
                                {result.studentName}
                              </p>
                              <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[11px] text-[#91a099] font-light">
                                <span>
                                  ชื่อเล่น: {result.studentNickname || "-"}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span>รหัสนักเรียน {result.studentId}</span>
                              </p>
                            </div>
                            <div className="shrink-0 text-right">
                              {result.isCheckedIn ? (
                                <>
                                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e5f5eb] px-2.5 py-1.5 text-[11px] font-bold text-[#388263]">
                                    <CheckCircle2 size={13} />
                                    เช็กชื่อแล้ว
                                  </span>
                                  <p className="mt-1 hidden text-[10px] text-[#a0aea6] sm:block">
                                    {formatTime(result.checkedAt)}
                                  </p>
                                </>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f5f7f6] px-2.5 py-1.5 text-[11px] font-semibold text-[#8c9d94] transition-colors group-hover:bg-[#e9f4ed] group-hover:text-[#4a8a70]">
                                  แตะเพื่อเช็กชื่อ
                                </span>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                      {pages > 1 && (
                        <div className="flex justify-center pt-5">
                          <Pagination
                            classNames={{
                              cursor: "bg-[#2d6a58] text-white font-bold",
                            }}
                            page={page}
                            total={pages}
                            onChange={setPage}
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              </section>

              {/* Round controls */}
              <div className="order-first space-y-5 lg:order-none">
                <section className="rounded-2xl border border-[#dfe9e3] bg-white p-4 shadow-sm sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e6f1eb] text-[#2d6a58]">
                        {activeRoundId && attendanceMethod === "NFC" ? (
                          <Nfc size={18} />
                        ) : (
                          <QrCode size={18} />
                        )}
                      </div>
                      <div>
                        <h2 className="text-base font-bold text-[#20352b]">
                          {activeRoundId
                            ? "ช่องทางเช็กชื่อ"
                            : "เปิดรอบเช็กชื่อ"}
                        </h2>
                        <p className="mt-0.5 text-[11px] text-[#8c9c93]">
                          {activeRoundId
                            ? attendanceMethod === "NFC"
                              ? "อ่านบัตรนักเรียนด้วย NFC"
                              : "ให้นักเรียนสแกน QR Code หรือใช้ PIN"
                            : "กำหนดรายละเอียดก่อนเริ่มใช้งาน"}
                        </p>
                      </div>
                    </div>
                    {activeRoundId && (
                      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#e4f5eb] px-2.5 py-1.5 text-[10px] font-bold text-[#398365]">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#44af7b]" />
                        LIVE
                      </span>
                    )}
                  </div>

                  {activeRoundId ? (
                    <div className="mt-5">
                      <div className="rounded-2xl bg-[#f3f8f4] p-3.5">
                        <div className="flex items-center justify-between gap-2 text-[11px]">
                          <span className="font-semibold text-[#5d796a]">
                            {selectedRound?.description || "รอบปัจจุบัน"}
                          </span>
                          {qrExpiresAt && (
                            <span className="inline-flex items-center gap-1 text-[#a7723c]">
                              <Clock size={12} />
                              หมดเวลา{" "}
                              {qrExpiresAt.toLocaleTimeString("th-TH", {
                                hour: "2-digit",
                                minute: "2-digit",
                                timeZone: BANGKOK_TIME_ZONE,
                              })}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="mt-4">
                        {qrLoading ? (
                          <div className="rounded-2xl border border-[#e4ece6] bg-[#fbfcfb] p-4">
                            <div className="mx-auto h-48 w-48 animate-pulse rounded-2xl bg-[#e5eee8]" />
                            <div className="mx-auto mt-4 h-3 w-44 animate-pulse rounded-full bg-[#e5eee8]" />
                            <div className="mt-5 border-t border-[#edf2ee] pt-4">
                              <div className="h-3 w-20 animate-pulse rounded-full bg-[#e5eee8]" />
                              <div className="mt-3 flex justify-center gap-2">
                                {Array.from({ length: 4 }).map((_, index) => (
                                  <div
                                    key={index}
                                    className="h-10 w-10 animate-pulse rounded-lg bg-[#e5eee8]"
                                  />
                                ))}
                              </div>
                            </div>
                          </div>
                        ) : attendanceMethod === "NFC" ? (
                          <NfcAttendancePanel
                            campId={campId}
                            roundId={activeRoundId}
                            onDataChanged={() => fetchResults(activeRoundId)}
                          />
                        ) : qrPayload ? (
                          <div className="rounded-2xl border border-[#e0ece4] bg-[#fbfdfb] p-4">
                            <div className="mx-auto flex w-fit rounded-2xl border-4 border-white bg-white p-3 shadow-sm">
                              <QRCode
                                bgColor="#ffffff"
                                fgColor="#173b31"
                                size={184}
                                value={qrPayload}
                              />
                            </div>
                            <p className="mt-3 text-center text-[11px] font-medium text-[#7d9185]">
                              แสดง QR Code ให้นักเรียนสแกนเพื่อเช็กชื่อ
                            </p>
                            {qrPin && (
                              <div className="mt-4 border-t border-[#e4eee7] pt-4">
                                <div className="flex items-center justify-between gap-2">
                                  <div>
                                    <p className="text-xs font-bold text-[#496657]">
                                      PIN สำรอง
                                    </p>
                                    <p className="mt-0.5 text-[10px] text-[#97a79e]">
                                      ใช้เมื่อสแกน QR ไม่ได้
                                    </p>
                                  </div>
                                  <button
                                    aria-label="คัดลอก PIN"
                                    className="flex h-8 w-8 items-center justify-center rounded-lg text-[#82958a] transition-colors hover:bg-white hover:text-[#2d6a58]"
                                    type="button"
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
                                        className="text-[#3b9a6c]"
                                        size={16}
                                      />
                                    ) : (
                                      <Copy size={16} />
                                    )}
                                  </button>
                                </div>
                                <div className="mt-2 flex items-center justify-center gap-1.5">
                                  {qrPin.split("").map((digit, i) => (
                                    <span
                                      key={i}
                                      className="flex h-10 w-9 items-center justify-center rounded-lg border border-[#cfe2d5] bg-white font-mono text-lg font-bold text-[#2d6a58] shadow-sm sm:h-11 sm:w-10"
                                    >
                                      {digit}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="rounded-2xl bg-[#fff7f4] px-4 py-8 text-center text-sm text-[#b46d5f]">
                            ไม่สามารถสร้าง QR Code ของรอบนี้ได้
                          </p>
                        )}
                      </div>
                      <button
                        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-[#f0d8d4] bg-[#fffafa] py-2.5 text-xs font-bold text-[#b66b60] transition-colors hover:bg-[#fff1ee]"
                        type="button"
                        onClick={handleCloseSession}
                      >
                        <XCircle size={14} />
                        ปิดรับเช็กชื่อรอบนี้
                      </button>
                    </div>
                  ) : qrLoading ? (
                    <div
                      aria-label="กำลังโหลดรอบเช็กชื่อ"
                      className="mt-5 space-y-3"
                    >
                      <div className="rounded-2xl bg-[#f4f8f5] p-4">
                        <div className="mx-auto h-12 w-12 animate-pulse rounded-2xl bg-[#e4eee7]" />
                        <div className="mx-auto mt-3 h-3 w-44 animate-pulse rounded-full bg-[#e4eee7]" />
                        <div className="mx-auto mt-2 h-2.5 w-56 animate-pulse rounded-full bg-[#edf3ee]" />
                      </div>
                      <div className="h-11 animate-pulse rounded-xl bg-[#edf3ee]" />
                      <div className="h-11 animate-pulse rounded-xl bg-[#edf3ee]" />
                      <div className="h-11 animate-pulse rounded-xl bg-[#e4eee7]" />
                    </div>
                  ) : (
                    <div className="mt-5">
                      <div className="rounded-2xl bg-[#f4f8f5] p-4 text-center">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e0eee5] text-[#3d8067]">
                          <Clock size={23} />
                        </div>
                        <p className="mt-3 text-sm font-bold text-[#315746]">
                          สร้างรอบใหม่สำหรับนักเรียน
                        </p>
                        <p className="mt-1 text-[11px] leading-5 text-[#8b9d92]">
                          {rounds.length > 0
                            ? `รอบที่ ${rounds.length + 1} · ค่ายนี้มีประวัติแล้ว ${rounds.length} รอบ`
                            : "กำหนดเวลาและวิธีเช็กชื่อที่ต้องการใช้"}
                        </p>
                      </div>
                      <div className="mt-4 space-y-3">
                        <label className="block">
                          <span className="mb-1.5 block text-[11px] font-bold text-[#63786c]">
                            ชื่อรอบ
                          </span>
                          <input
                            className="h-11 w-full rounded-xl border border-[#e1e9e4] bg-white px-3.5 text-sm text-[#273a30] outline-none transition-colors placeholder:text-[#a5b0aa] focus:border-[#6ea58b] focus:ring-4 focus:ring-[#70ad8e]/10"
                            placeholder={`เช่น รอบเช้า หรือ รอบที่ ${rounds.length + 1}`}
                            type="text"
                            value={roundDescription}
                            onChange={(e) =>
                              setRoundDescription(e.target.value)
                            }
                          />
                        </label>
                        <Select
                          classNames={{
                            label: "text-[11px] font-medium text-[#63786c]",
                            trigger:
                              "h-11 min-h-11 rounded-xl border-[#e1e9e4] bg-white shadow-none",
                            value: "text-sm font-medium text-[#273a30]",
                          }}
                          label="วิธีเช็กชื่อ"
                          selectedKeys={[attendanceMethod]}
                          variant="bordered"
                          onSelectionChange={(keys) =>
                            setAttendanceMethod(
                              Array.from(keys)[0] === "NFC" ? "NFC" : "QR",
                            )
                          }
                        >
                          <SelectItem key="QR" textValue="QR Code / PIN">
                            QR Code / PIN
                          </SelectItem>
                          <SelectItem key="NFC" textValue="บัตร NFC">
                            บัตร NFC (แตะที่โทรศัพท์ครู)
                          </SelectItem>
                        </Select>
                        <Select
                          classNames={{
                            label: "text-[11px] font-medium text-[#63786c]",
                            trigger:
                              "h-11 min-h-11 rounded-xl border-[#e1e9e4] bg-white shadow-none",
                            value: "text-sm font-medium text-[#273a30]",
                          }}
                          label="ระยะเวลาเช็กชื่อ"
                          selectedKeys={[durationMinutes]}
                          variant="bordered"
                          onSelectionChange={(keys) =>
                            setDurationMinutes(Array.from(keys)[0] as string)
                          }
                        >
                          <SelectItem key="10" textValue="10 นาที">
                            10 นาที
                          </SelectItem>
                          <SelectItem key="15" textValue="15 นาที">
                            15 นาที
                          </SelectItem>
                          <SelectItem key="30" textValue="30 นาที">
                            30 นาที
                          </SelectItem>
                          <SelectItem key="60" textValue="1 ชั่วโมง">
                            1 ชั่วโมง
                          </SelectItem>
                          <SelectItem key="120" textValue="2 ชั่วโมง">
                            2 ชั่วโมง
                          </SelectItem>
                          <SelectItem key="240" textValue="4 ชั่วโมง">
                            4 ชั่วโมง
                          </SelectItem>
                        </Select>
                        <Button
                          className="h-11 w-full rounded-xl bg-[#6b857a] font-medium text-white hover:bg-[#5d7c6f]"
                          isLoading={regenerating}
                          startContent={!regenerating && <Plus size={17} />}
                          onPress={regenerateQr}
                        >
                          เริ่มรอบเช็กชื่อ
                        </Button>
                      </div>
                    </div>
                  )}
                </section>

                {/* Round history */}
                {rounds.length > 0 && (
                  <section className="rounded-2xl border border-[#dfe9e3] bg-white p-4 shadow-sm sm:p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f0f5f1] text-[#6b8879]">
                          <CheckSquare size={16} />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-[#2c4437]">
                            ประวัติรอบเช็กชื่อ
                          </h3>
                          <p className="mt-0.5 text-[10px] text-[#98a79f]">
                            เลือกดูผลของแต่ละรอบ
                          </p>
                        </div>
                      </div>
                      <span className="rounded-full bg-[#f3f7f4] px-2.5 py-1 text-[10px] font-bold text-[#789083]">
                        {rounds.length} รอบ
                      </span>
                    </div>
                    <div className="mt-4 space-y-2">
                      {rounds.map((round) => {
                        const isActive = round.roundId === activeRoundId;
                        const isSelected = round.roundId === selectedRoundId;

                        return (
                          <button
                            key={round.roundId}
                            className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                              isSelected
                                ? "border-[#a8cdb8] bg-[#eef8f1]"
                                : "border-[#edf1ee] bg-white hover:border-[#d3e4d9] hover:bg-[#fafdfb]"
                            }`}
                            type="button"
                            onClick={() => handleSelectRound(round.roundId)}
                          >
                            <span
                              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold ${isSelected ? "bg-[#2d6a58] text-white" : "bg-[#f0f4f1] text-[#81948a]"}`}
                            >
                              {round.roundNumber}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span
                                className={`block truncate text-xs font-bold ${isSelected ? "text-[#2d6a58]" : "text-[#4d6256]"}`}
                              >
                                {round.description}
                              </span>
                              <span className="mt-0.5 block text-[10px] text-[#9aa9a1]">
                                {round.method === "NFC" ? "NFC" : "QR Code"} ·{" "}
                                {formatTime(round.createdAt)}
                              </span>
                            </span>
                            {isActive && (
                              <span className="shrink-0 rounded-full bg-[#dcf3e5] px-2 py-1 text-[9px] font-bold text-[#3b916b]">
                                เปิดอยู่
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {selectedRound && (
                      <p className="mt-3 border-t border-[#edf1ee] pt-3 text-[10px] text-[#96a69d]">
                        หมดเวลา: {formatTime(selectedRound.expiresAt)}
                      </p>
                    )}
                  </section>
                )}

                {/* Data actions */}
                {(selectedRoundId || rounds.length > 0) && (
                  <div className="flex flex-wrap items-center gap-2 px-1">
                    {selectedRoundId && (
                      <button
                        className="rounded-lg px-2 py-1.5 text-[11px] font-semibold text-[#73877c] transition-colors hover:bg-[#e6f1eb] hover:text-[#2d6a58]"
                        type="button"
                        onClick={handleClearRound}
                      >
                        <Trash2 className="mr-1 inline-block" size={13} />
                        ล้างข้อมูลรอบนี้
                      </button>
                    )}
                    {rounds.length > 1 && (
                      <button
                        className="rounded-lg px-2 py-1.5 text-[11px] font-semibold text-[#b47770] transition-colors hover:bg-[#fff0ed] hover:text-[#a15e57]"
                        type="button"
                        onClick={handleClearAll}
                      >
                        <Trash2 className="mr-1 inline-block" size={13} />
                        ล้างทั้งหมด
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </Body>

        {!pageMode && (
          <ModalFooter className="flex shrink-0 justify-end border-t border-gray-100 bg-white p-4">
            <Button
              className="bg-gray-100 font-medium text-gray-700 hover:bg-gray-200"
              size="lg"
              onPress={onClose}
            >
              ปิดหน้าต่าง
            </Button>
          </ModalFooter>
        )}
      </div>
    </AttendanceShell>
  );
}
