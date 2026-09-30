"use client";

import { useState, useEffect, useMemo, type ReactNode } from "react";
import Link from "next/link";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Pagination,
  Avatar,
} from "@heroui/react";
import {
  Search,
  Trophy,
  Clock,
  MapPin,
  Users,
  Award,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

import CampBreadcrumb from "./CampBreadcrumb";

import CampLocationTracker from "@/components/camp-location/CampLocationTracker";
import {
  getCleanTrackingStudentPath,
  rememberActiveTrackingStudentId,
} from "@/lib/client-active-camp";

interface StudentProgress {
  studentId: number;
  name: string;
  nickname: string | null;
  profileImageUrl: string | null;
  initials: string;
  completedMissions: number;
  totalMissions: number;
  progressPercentage: number;
  hasCertificate: boolean;
  certificateNo: number | null;
  certificateIssuedAt: string | null;
}

interface TrackingData {
  campId: number;
  totalMissions: number;
  summary: {
    totalStudents: number;
    issuedCertificates: number;
    pendingCertificates: number;
  };
  students: StudentProgress[];
}

type ProgressFilter =
  | "all"
  | "mission_incomplete"
  | "mission_complete_certificate_pending"
  | "issued";
type TrackingView = "location" | "progress" | "both";

interface TrackingModalProps {
  isOpen: boolean;
  onClose: () => void;
  campId: number;
  campName: string;
  locationTrackingEnabled?: boolean;
  pageMode?: boolean;
  view?: TrackingView;
}

function hasCompletedAllMissions(student: StudentProgress) {
  return student.completedMissions >= student.totalMissions;
}

function matchesProgressFilter(
  student: StudentProgress,
  filter: ProgressFilter,
) {
  if (filter === "all") return true;
  if (filter === "issued") return student.hasCertificate;
  if (student.hasCertificate) return false;

  const missionsCompleted = hasCompletedAllMissions(student);

  return filter === "mission_incomplete"
    ? !missionsCompleted
    : missionsCompleted;
}

function TrackingShell({
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
      <main className="flex h-full min-h-0 flex-col overflow-hidden bg-[#f5f5f2]">
        {children}
      </main>
    );
  }

  return (
    <Modal
      backdrop="blur"
      classNames={{
        base: "mx-2 my-2 max-h-[98vh] w-[calc(100vw-1rem)] max-w-[1280px] rounded-3xl bg-white shadow-xl sm:w-[calc(100vw-2rem)]",
        backdrop: "bg-black/40 backdrop-blur-sm",
      }}
      isDismissable={true}
      isOpen={isOpen}
      scrollBehavior="inside"
      onOpenChange={onClose}
    >
      <ModalContent className="max-h-[98vh]">{children}</ModalContent>
    </Modal>
  );
}

function TrackingSkeletonBlock({ className }: { className: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-lg bg-gray-200 ${className}`}
    />
  );
}

function TrackingProgressSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="hidden grid-cols-[minmax(0,1.2fr)_minmax(240px,1fr)_auto] gap-4 border-b border-gray-100 bg-gray-50/70 px-4 py-3 sm:grid">
        <TrackingSkeletonBlock className="h-3 w-20" />
        <TrackingSkeletonBlock className="h-3 w-28" />
        <TrackingSkeletonBlock className="ml-auto h-3 w-12" />
      </div>

      <div className="min-h-0 flex-1 divide-y divide-gray-100 overflow-hidden">
        {Array.from({ length: 6 }, (_, rowIndex) => (
          <div
            key={rowIndex}
            className="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(240px,1fr)_auto] sm:items-center"
          >
            <div className="flex min-w-0 items-center gap-3">
              <TrackingSkeletonBlock className="h-8 w-8 rounded-full" />
              <div className="min-w-0 space-y-1.5">
                <TrackingSkeletonBlock className="h-3 w-32" />
                <TrackingSkeletonBlock className="h-2.5 w-20" />
              </div>
            </div>

            <div className="min-w-0 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <TrackingSkeletonBlock className="h-3 w-24" />
                <TrackingSkeletonBlock className="h-3 w-10" />
              </div>
              <TrackingSkeletonBlock className="h-2 w-full" />
              <TrackingSkeletonBlock className="ml-auto h-2.5 w-28" />
            </div>

            <TrackingSkeletonBlock className="h-6 w-32 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TrackingModal({
  isOpen,
  onClose,
  campId,
  campName,
  locationTrackingEnabled = false,
  pageMode = false,
  view = "both",
}: TrackingModalProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<TrackingData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [progressFilter, setProgressFilter] = useState<ProgressFilter>("all");
  const [isProgressStatusOpen, setIsProgressStatusOpen] = useState(false);
  const [page, setPage] = useState(1);
  const defaultSection =
    view === "location"
      ? "location"
      : view === "progress"
        ? "progress"
        : locationTrackingEnabled
          ? "location"
          : "progress";
  const [activeSection, setActiveSection] = useState<"location" | "progress">(
    defaultSection,
  );
  const ITEMS_PER_PAGE = 12;

  useEffect(() => {
    if (isOpen && campId) {
      if (view !== "location") {
        fetchTrackingData();
      }
      setSearchQuery("");
      setProgressFilter("all");
      setIsProgressStatusOpen(false);
      setPage(1);
      setActiveSection(defaultSection);
    }
  }, [isOpen, campId, defaultSection, view]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, progressFilter]);

  const fetchTrackingData = async () => {
    try {
      setLoading(true);
      setData(null);
      setLoadError("");
      const res = await fetch(`/api/camps/${campId}/tracking`);

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        setLoadError(
          body?.error || body?._error || "ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่",
        );

        return;
      }

      setData(body);
    } catch {
      setLoadError("ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  };

  const progressCounts = useMemo(() => {
    const counts = {
      all: data?.students.length ?? 0,
      missionIncomplete: 0,
      missionCompleteCertificatePending: 0,
      issued: 0,
    };

    data?.students.forEach((student) => {
      if (student.hasCertificate) {
        counts.issued += 1;
      } else if (hasCompletedAllMissions(student)) {
        counts.missionCompleteCertificatePending += 1;
      } else {
        counts.missionIncomplete += 1;
      }
    });

    return counts;
  }, [data]);

  const filteredStudents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return data?.students.filter((student) => {
      if (!matchesProgressFilter(student, progressFilter)) return false;
      if (!query) return true;

      const matchName = student.name.toLowerCase().includes(query);
      const matchNickname = student.nickname?.toLowerCase().includes(query);
      const matchId = String(student.studentId).includes(query);

      return matchName || matchNickname || matchId;
    });
  }, [data, progressFilter, searchQuery]);

  const pages = Math.ceil((filteredStudents?.length || 0) / ITEMS_PER_PAGE);

  const paginatedStudents = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;

    return filteredStudents?.slice(start, end);
  }, [page, filteredStudents]);

  const Header = pageMode ? "header" : ModalHeader;
  const Body = pageMode ? "section" : ModalBody;

  return (
    <TrackingShell isOpen={isOpen} pageMode={pageMode} onClose={onClose}>
      <>
        <Header
          className={`relative flex shrink-0 flex-col gap-1 border-b border-gray-100 px-6 ${
            pageMode ? "pb-3 pt-4" : "pb-4 pt-6"
          }`}
        >
          {pageMode && (
            <CampBreadcrumb
              campId={campId}
              className="mb-4"
              currentPage={
                view === "location" ? "ติดตามตำแหน่ง" : "ติดตามความคืบหน้า"
              }
            />
          )}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#eaf1ee] flex items-center justify-center text-[#5d7c6f] shrink-0">
              {view === "location" ? <MapPin size={20} /> : <Users size={20} />}
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 leading-tight">
                {pageMode
                  ? view === "location"
                    ? "ติดตามตำแหน่ง"
                    : "ติดตามนักเรียน"
                  : "การติดตามนักเรียน"}
              </h2>
              {campName && (
                <p className="mt-0.5 max-w-[300px] truncate text-sm font-normal text-gray-500">
                  {campName}
                </p>
              )}
            </div>
          </div>

          {view === "both" && (
            <div
              className={`mt-4 grid gap-2 rounded-xl bg-gray-100 p-1 ${
                locationTrackingEnabled ? "grid-cols-2" : "grid-cols-1"
              }`}
            >
              {locationTrackingEnabled && (
                <button
                  className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    activeSection === "location"
                      ? "bg-white text-[#5d7c6f] shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                  type="button"
                  onClick={() => setActiveSection("location")}
                >
                  <MapPin size={16} />
                  ตำแหน่งนักเรียน
                </button>
              )}
              <button
                className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  activeSection === "progress"
                    ? "bg-white text-[#5d7c6f] shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
                type="button"
                onClick={() => setActiveSection("progress")}
              >
                <Users size={16} />
                ความก้าวหน้านักเรียน
              </button>
            </div>
          )}

          {activeSection === "progress" && (
            <>
              <div className="mt-4 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="text-gray-400" size={16} />
                </div>
                <input
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#5d7c6f]/20 focus:border-[#5d7c6f] transition-all bg-white"
                  placeholder="ค้นหาชื่อ ชื่อเล่น หรือรหัสนักเรียน..."
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {data && (
                <section className="mt-3 rounded-xl border border-gray-200 bg-white p-2.5 sm:p-3">
                  <button
                    aria-controls="progress-status-filters"
                    aria-expanded={isProgressStatusOpen}
                    className={`flex w-full items-center justify-between gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5d7c6f]/40 ${
                      isProgressStatusOpen ? "mb-2" : ""
                    }`}
                    type="button"
                    onClick={() =>
                      setIsProgressStatusOpen((current) => !current)
                    }
                  >
                    <span className="flex min-w-0 items-start gap-2">
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#eef4f1] text-[#5d7c6f]">
                        <Award size={16} />
                      </span>
                      <span>
                        <span className="block text-xs font-bold text-gray-900">
                          สถานะความก้าวหน้าและเกียรติบัตร
                        </span>
                        <span className="mt-0.5 block text-[11px] leading-relaxed text-gray-500">
                          กดเพื่อดูและกรองนักเรียนแต่ละกลุ่ม
                        </span>
                      </span>
                    </span>
                    <ChevronDown
                      aria-hidden="true"
                      className={`shrink-0 text-[#5d7c6f] transition-transform ${
                        isProgressStatusOpen ? "rotate-180" : ""
                      }`}
                      size={17}
                    />
                  </button>

                  {isProgressStatusOpen && (
                    <div id="progress-status-filters">
                      <div
                        aria-label="กรองนักเรียนตามความก้าวหน้าและเกียรติบัตร"
                        className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4"
                        role="tablist"
                      >
                        {[
                          {
                            key: "all" as const,
                            label: "นักเรียนทั้งหมด",
                            helper: "ทุกสถานะ",
                            value: progressCounts.all,
                            activeClass: "border-[#5d7c6f] bg-[#eef4f1]",
                            iconClass: "bg-[#e2ece7] text-[#5d7c6f]",
                          },
                          {
                            key: "mission_incomplete" as const,
                            label: "ภารกิจยังไม่ครบ",
                            helper: "และยังไม่ได้เกียรติบัตร",
                            value: progressCounts.missionIncomplete,
                            activeClass: "border-amber-500 bg-amber-50",
                            iconClass: "bg-amber-100 text-amber-700",
                          },
                          {
                            key: "mission_complete_certificate_pending" as const,
                            label: "ภารกิจครบแล้วแต่ยังไม่ได้เกียรติบัตร",
                            helper: "ยังไม่มีประวัติออกเกียรติบัตร",
                            value:
                              progressCounts.missionCompleteCertificatePending,
                            activeClass: "border-blue-500 bg-blue-50",
                            iconClass: "bg-blue-100 text-blue-700",
                          },
                          {
                            key: "issued" as const,
                            label: "ได้รับเกียรติบัตรแล้ว",
                            helper: "มีประวัติออกเกียรติบัตร",
                            value: progressCounts.issued,
                            activeClass: "border-emerald-500 bg-emerald-50",
                            iconClass: "bg-emerald-100 text-emerald-700",
                          },
                        ].map((item) => (
                          <button
                            key={item.key}
                            aria-controls="tracking-student-list"
                            aria-selected={progressFilter === item.key}
                            className={`relative flex items-center gap-2 rounded-lg border px-2.5 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5d7c6f]/40 ${
                              progressFilter === item.key
                                ? `${item.activeClass} shadow-sm`
                                : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                            }`}
                            id={`tracking-tab-${item.key}`}
                            role="tab"
                            type="button"
                            onClick={() => setProgressFilter(item.key)}
                          >
                            <span
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${item.iconClass}`}
                            >
                              {item.key === "all" ? (
                                <Users size={16} />
                              ) : item.key === "issued" ? (
                                <CheckCircle2 size={16} />
                              ) : item.key ===
                                "mission_complete_certificate_pending" ? (
                                <Award size={16} />
                              ) : (
                                <Clock size={16} />
                              )}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-xs font-semibold leading-tight text-gray-800">
                                {item.label}
                              </span>
                              {item.helper && (
                                <span className="mt-0.5 block text-[10px] leading-tight text-gray-500">
                                  {item.helper}
                                </span>
                              )}
                            </span>
                            <span className="text-lg font-bold text-gray-900">
                              {item.value}
                              <span className="ml-1 text-[11px] font-normal text-gray-500">
                                คน
                              </span>
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              )}
            </>
          )}
        </Header>

        <Body
          className={`flex min-h-0 flex-1 flex-col overflow-hidden px-6 py-4 ${
            pageMode ? "bg-[#f5f5f2]" : "bg-gray-50/30"
          }`}
        >
          {activeSection === "location" ? (
            <CampLocationTracker
              campId={campId}
              configureDestination={false}
              showDestination={false}
              viewer="teacher"
            />
          ) : loading ? (
            <TrackingProgressSkeleton />
          ) : !data ? (
            <p className="text-center text-gray-400 py-8">
              {loadError || "ไม่สามารถโหลดข้อมูลได้"}
            </p>
          ) : filteredStudents?.length === 0 ? (
            <div
              aria-labelledby={`tracking-tab-${progressFilter}`}
              className="text-center py-10 text-gray-400"
              id="tracking-student-list"
              role="tabpanel"
            >
              <Search className="mx-auto mb-2 opacity-30" size={32} />
              <p className="text-sm">
                {searchQuery.trim()
                  ? "ไม่พบนักเรียนที่ตรงกับคำค้นหาในสถานะนี้"
                  : progressFilter === "issued"
                    ? "ยังไม่มีนักเรียนที่ได้รับเกียรติบัตร"
                    : progressFilter === "mission_incomplete"
                      ? "ไม่มีนักเรียนที่ภารกิจยังไม่ครบและยังไม่ได้รับเกียรติบัตร"
                      : progressFilter ===
                          "mission_complete_certificate_pending"
                        ? "ไม่มีนักเรียนที่ทำภารกิจครบแต่ยังไม่ได้รับเกียรติบัตร"
                        : "ไม่พบรายชื่อในระบบ"}
              </p>
            </div>
          ) : (
            <div
              aria-labelledby={`tracking-tab-${progressFilter}`}
              className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm"
              id="tracking-student-list"
              role="tabpanel"
            >
              <div className="hidden grid-cols-[minmax(0,1.2fr)_minmax(240px,1fr)_auto] gap-4 border-b border-gray-100 bg-gray-50/70 px-4 py-3 text-xs font-semibold text-gray-500 sm:grid">
                <span>นักเรียน</span>
                <span>ความก้าวหน้าภารกิจ</span>
                <span className="text-right">สถานะ</span>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain divide-y divide-gray-100 [touch-action:pan-y]">
                {paginatedStudents?.map((student, i) => (
                  <Link
                    key={student.studentId}
                    aria-label={`ดูรายละเอียดภารกิจของ ${student.name}`}
                    className="grid cursor-pointer gap-3 px-4 py-2.5 transition hover:bg-[#f7faf8] focus-visible:bg-[#f7faf8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#5d7c6f]/40 sm:grid-cols-[minmax(0,1.2fr)_minmax(240px,1fr)_auto] sm:items-center"
                    href={getCleanTrackingStudentPath()}
                    prefetch={false}
                    onClick={() =>
                      rememberActiveTrackingStudentId(student.studentId)
                    }
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="w-5 shrink-0 text-center text-xs font-semibold text-gray-400">
                        {(page - 1) * ITEMS_PER_PAGE + i + 1}
                      </span>
                      <Avatar
                        className="h-10 w-10 shrink-0 bg-[#e8f0ee] text-[#3d6357]"
                        imgProps={{ alt: `รูปโปรไฟล์ของ ${student.name}` }}
                        name={student.initials}
                        src={student.profileImageUrl || undefined}
                      />
                      <div className="min-w-0">
                        <h3 className="break-words text-sm font-medium leading-6 text-gray-900">
                          {student.name}
                        </h3>
                        <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-gray-400 font-light">
                          <span>ชื่อเล่น: {student.nickname || "-"}</span>
                          <span aria-hidden="true">·</span>
                          <span>รหัสนักเรียน {student.studentId}</span>
                        </p>
                      </div>
                    </div>

                    <div className="min-w-0 space-y-1.5">
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="font-medium text-gray-500 sm:sr-only">
                          ความก้าวหน้าภารกิจ
                        </span>
                        <span className="font-bold text-[#5d7c6f]">
                          {student.progressPercentage}%
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="h-2 rounded-full bg-[#5d7c6f] transition-all duration-1000 ease-in-out"
                          style={{
                            width: `${student.progressPercentage}%`,
                          }}
                        />
                      </div>
                      <p className="text-right text-[11px] text-gray-400">
                        สำเร็จ {student.completedMissions} /{" "}
                        {student.totalMissions} ภารกิจ
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-2 sm:justify-end">
                      {student.hasCertificate ? (
                        <div className="text-left sm:text-right">
                          <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                            <Trophy size={14} />
                            <span>ได้รับเกียรติบัตรแล้ว</span>
                          </div>
                          {(student.certificateNo != null ||
                            student.certificateIssuedAt) && (
                            <p className="mt-1 text-[11px] text-gray-400 sm:text-right">
                              {student.certificateNo != null &&
                                `เลขที่ ${student.certificateNo}`}
                              {student.certificateNo != null &&
                                student.certificateIssuedAt &&
                                " · "}
                              {student.certificateIssuedAt &&
                                new Date(
                                  student.certificateIssuedAt,
                                ).toLocaleDateString("th-TH", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })}
                            </p>
                          )}
                        </div>
                      ) : hasCompletedAllMissions(student) ? (
                        <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                          <Award size={14} />
                          <span>ภารกิจครบ แต่ยังไม่ได้เกียรติบัตร</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-500">
                          <Clock size={14} />
                          <span>ภารกิจยังไม่ครบ และยังไม่ได้เกียรติบัตร</span>
                        </div>
                      )}
                      <ChevronRight
                        aria-hidden="true"
                        className="shrink-0 text-gray-300"
                        size={18}
                      />
                    </div>
                  </Link>
                ))}
              </div>

              {pages > 1 && (
                <div className="flex justify-center border-t border-gray-100 bg-gray-50/40 pb-2 pt-3">
                  <Pagination
                    isCompact
                    showControls
                    showShadow
                    className="bg-transparent"
                    classNames={{
                      cursor: "bg-[#5d7c6f] text-white font-medium",
                    }}
                    page={page}
                    total={pages}
                    onChange={(newPage) => {
                      setPage(newPage);
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </Body>

        {activeSection === "progress" && !pageMode && (
          <ModalFooter className="shrink-0 rounded-b-3xl border-t border-gray-100 bg-white px-6 py-4">
            <Button
              className="w-full font-medium sm:w-auto"
              size="md"
              variant="flat"
              onPress={onClose}
            >
              ปิดหน้าต่าง
            </Button>
          </ModalFooter>
        )}
      </>
    </TrackingShell>
  );
}
