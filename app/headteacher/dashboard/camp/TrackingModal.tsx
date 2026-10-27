"use client";

import type { TrackerData } from "@/components/camp-location/CampLocationTracker";
import type { CertificateRenderManifest } from "@/lib/certificate-renderer";

import {
  useState,
  useEffect,
  useMemo,
  type CSSProperties,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Pagination,
  Avatar,
  Input,
  Select,
  SelectItem,
} from "@heroui/react";
import {
  Search,
  Trophy,
  Clock,
  MapPin,
  Users,
  Award,
  ChevronDown,
  ChevronRight,
  Download,
  Eye,
} from "lucide-react";

import CampBreadcrumb from "./CampBreadcrumb";

import {
  getCleanTrackingStudentPath,
  rememberActiveTrackingStudentId,
} from "@/lib/client-active-camp";

const CampLocationTracker = dynamic(
  () => import("@/components/camp-location/CampLocationTracker"),
  { ssr: false },
);

interface StudentProgress {
  studentId: number;
  name: string;
  nickname: string | null;
  profileImageUrl: string | null;
  initials: string;
  isEnrolled: boolean;
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
  certificateEnabled?: boolean;
  summary: {
    totalStudents: number;
    issuedCertificates: number;
    pendingCertificates: number;
  };
  students: StudentProgress[];
}

type ProgressFilter =
  | "all"
  | "not_enrolled"
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
  initialLocationData?: TrackerData | null;
}

function hasCompletedAllMissions(student: StudentProgress) {
  return student.completedMissions >= student.totalMissions;
}

function matchesProgressFilter(
  student: StudentProgress,
  filter: ProgressFilter,
  certificateEnabled: boolean,
) {
  if (filter === "all") return true;
  if (filter === "issued") return certificateEnabled && student.hasCertificate;
  if (certificateEnabled && student.hasCertificate) return false;
  if (filter === "not_enrolled") return !student.isEnrolled;
  if (!student.isEnrolled) return false;

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

function TrackingSkeletonBlock({
  className,
  style,
}: {
  className: string;
  style?: CSSProperties;
}) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-lg bg-gray-200 ${className}`}
      style={style}
    />
  );
}

const PROGRESS_FILTERS: {
  key: ProgressFilter;
  label: string;
  helper: string;
  icon: typeof Users;
  iconClass: string;
  helperClass: string;
  activeClass: string;
}[] = [
  {
    key: "all",
    label: "นักเรียนทั้งหมด",
    helper: "ทุกสถานะ",
    icon: Users,
    iconClass: "text-[#6b857a]",
    helperClass: "text-[#6b857a]",
    activeClass: "border-[#6b857a] ring-1 ring-[#6b857a]/30",
  },
  {
    key: "not_enrolled",
    label: "ยังไม่ลงทะเบียน",
    helper: "ยังไม่ได้เข้าร่วมค่าย",
    icon: Clock,
    iconClass: "text-slate-500",
    helperClass: "text-slate-500",
    activeClass: "border-slate-400 ring-1 ring-slate-300",
  },
  {
    key: "mission_incomplete",
    label: "ภารกิจยังไม่ครบ",
    helper: "และยังไม่ได้เกียรติบัตร",
    icon: Clock,
    iconClass: "text-amber-500",
    helperClass: "text-amber-600",
    activeClass: "border-amber-400 ring-1 ring-amber-200",
  },
  {
    key: "mission_complete_certificate_pending",
    label: "ภารกิจครบ รอเกียรติบัตร",
    helper: "ยังไม่มีประวัติออกเกียรติบัตร",
    icon: Award,
    iconClass: "text-blue-500",
    helperClass: "text-blue-500",
    activeClass: "border-blue-400 ring-1 ring-blue-200",
  },
  {
    key: "issued",
    label: "ได้รับเกียรติบัตรแล้ว",
    helper: "มีประวัติออกเกียรติบัตร",
    icon: Trophy,
    iconClass: "text-emerald-600",
    helperClass: "text-emerald-600",
    activeClass: "border-emerald-400 ring-1 ring-emerald-200",
  },
];

function CertificatePreviewModal({
  campId,
  student,
  onClose,
}: {
  campId: number;
  student: StudentProgress | null;
  onClose: () => void;
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState("");
  const studentId = student?.studentId;

  useEffect(() => {
    if (studentId == null) return;

    let cancelled = false;
    let objectUrl: string | null = null;

    setImageUrl(null);
    setBlob(null);
    setError("");

    (async () => {
      try {
        const response = await fetch(
          `/api/camps/${campId}/tracking/${studentId}/certificate`,
          { cache: "no-store" },
        );
        const body = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(body?.error || "โหลดเกียรติบัตรไม่สำเร็จ");
        }

        // pdf-lib and qrcode are only needed once a certificate is previewed.
        const { renderCertificatePng } = await import(
          "@/lib/certificate-renderer"
        );
        const png = await renderCertificatePng(
          body.certificate as CertificateRenderManifest,
        );

        if (cancelled) return;
        objectUrl = URL.createObjectURL(png);
        setBlob(png);
        setImageUrl(objectUrl);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "โหลดเกียรติบัตรไม่สำเร็จ",
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [campId, studentId]);

  return (
    <Modal
      classNames={{
        base: "rounded-3xl",
        header: "border-b border-gray-100 px-6 py-5",
        body: "bg-[#f8f8f6] px-6 py-6",
        footer: "border-t border-gray-100 px-6 py-4",
        closeButton: "top-4 right-4 hover:bg-gray-100",
      }}
      isOpen={student !== null}
      scrollBehavior="inside"
      size="5xl"
      onClose={onClose}
    >
      <ModalContent>
        <ModalHeader className="flex items-start gap-3 pr-14">
          <Avatar
            className="h-10 w-10 shrink-0 bg-[#e8f0ee] text-[#3d6357]"
            name={student?.initials}
            src={student?.profileImageUrl || undefined}
          />
          <div className="min-w-0">
            <h2 className="text-base font-bold leading-snug text-gray-900">
              เกียรติบัตรของ {student?.name}
            </h2>
            {student?.certificateNo != null && (
              <p className="mt-0.5 text-xs font-normal text-gray-500">
                เลขที่ {student.certificateNo}
                {student.certificateIssuedAt &&
                  ` · ออกเมื่อ ${new Date(
                    student.certificateIssuedAt,
                  ).toLocaleDateString("th-TH", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}`}
              </p>
            )}
          </div>
        </ModalHeader>
        <ModalBody>
          {error ? (
            <p className="py-12 text-center text-sm text-red-600">{error}</p>
          ) : imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={`เกียรติบัตรของ ${student?.name ?? "นักเรียน"}`}
              className="mx-auto block h-auto shrink-0 max-h-[calc(100vh-22rem)] w-auto max-w-full rounded-xl bg-white object-contain shadow-md"
              src={imageUrl}
            />
          ) : (
            <div
              aria-label="กำลังสร้างเกียรติบัตร"
              className="mx-auto aspect-[1.414/1] max-h-[calc(100vh-22rem)] w-full animate-pulse rounded-xl bg-gray-200"
            />
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onClose}>
            ปิด
          </Button>
          <Button
            className="bg-[#5d7c6f] font-medium text-white"
            isDisabled={!blob}
            startContent={<Download size={16} />}
            onPress={async () => {
              if (!blob) return;
              const { downloadCertificateBlob } = await import(
                "@/lib/certificate-renderer"
              );

              downloadCertificateBlob(
                blob,
                `certificate-${student?.studentId ?? "student"}.png`,
              );
            }}
          >
            ดาวน์โหลด
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function getProgressFilters(certificateEnabled: boolean) {
  if (certificateEnabled) return PROGRESS_FILTERS;

  return PROGRESS_FILTERS.filter((item) => item.key !== "issued").map((item) =>
    item.key === "mission_incomplete"
      ? { ...item, helper: "ยังทำภารกิจไม่ครบ" }
      : item.key === "mission_complete_certificate_pending"
        ? { ...item, label: "ภารกิจครบแล้ว", helper: "ทำภารกิจครบทุกข้อ" }
        : item,
  );
}

function getProgressStatus(
  student: StudentProgress,
  certificateEnabled: boolean,
) {
  if (certificateEnabled && student.hasCertificate) {
    return {
      label: "ได้รับเกียรติบัตรแล้ว",
      icon: Trophy,
      className: "border-emerald-100 bg-emerald-50 text-emerald-700",
    };
  }
  if (!student.isEnrolled) {
    return {
      label: "ยังไม่ลงทะเบียน",
      icon: Clock,
      className: "border-slate-200 bg-slate-50 text-slate-600",
    };
  }
  if (hasCompletedAllMissions(student)) {
    return {
      label: certificateEnabled ? "ภารกิจครบ รอเกียรติบัตร" : "ภารกิจครบแล้ว",
      icon: Award,
      className: "border-blue-100 bg-blue-50 text-blue-700",
    };
  }

  return {
    label: "ภารกิจยังไม่ครบ",
    icon: Clock,
    className: "border-amber-100 bg-amber-50 text-amber-700",
  };
}

function TrackingProgressSkeleton() {
  return (
    <>
      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-6 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <div
            key={index}
            className={`rounded-xl border border-gray-100 bg-white p-3 shadow-sm md:p-6 ${
              index === 0 ? "col-span-2 md:col-span-1" : "hidden md:block"
            }`}
          >
            <div className="mb-2 flex items-center gap-2 md:mb-3">
              <TrackingSkeletonBlock className="h-5 w-5 rounded-full md:h-6 md:w-6" />
              <TrackingSkeletonBlock className="h-3.5 w-24" />
            </div>
            <TrackingSkeletonBlock className="h-7 w-16" />
            <TrackingSkeletonBlock className="mt-2 h-3 w-28" />
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl bg-white p-6 shadow-sm">
        <div className="mb-6 flex flex-col items-stretch justify-between gap-3 lg:flex-row lg:items-center">
          <TrackingSkeletonBlock className="h-5 w-32" />
          <div className="flex flex-col items-stretch gap-2.5 sm:flex-row sm:items-center">
            <TrackingSkeletonBlock className="h-10 w-full rounded-xl sm:w-[220px]" />
            <TrackingSkeletonBlock className="h-10 w-full rounded-xl sm:w-60" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead>
              <tr className="border-y border-gray-100 bg-gray-50">
                {[16, 28, 12, 24, 4].map((width, index) => (
                  <th key={index} className="p-4">
                    <TrackingSkeletonBlock
                      className="h-3.5"
                      style={{ width: `${width * 4}px` }}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 6 }, (_, rowIndex) => (
                <tr key={rowIndex} className="border-b border-gray-50">
                  <td className="p-4">
                    <div className="flex min-w-[260px] items-center gap-2.5">
                      <TrackingSkeletonBlock className="h-3 w-5" />
                      <TrackingSkeletonBlock className="h-10 w-10 shrink-0 rounded-full" />
                      <div className="space-y-1.5">
                        <TrackingSkeletonBlock className="h-3.5 w-40" />
                        <TrackingSkeletonBlock className="h-3 w-32" />
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex min-w-[200px] items-center gap-3">
                      <TrackingSkeletonBlock className="h-2 flex-1 rounded-full" />
                      <TrackingSkeletonBlock className="h-3 w-10" />
                    </div>
                  </td>
                  <td className="p-4">
                    <TrackingSkeletonBlock className="h-7 w-36 rounded-full" />
                  </td>
                  <td className="p-4">
                    <TrackingSkeletonBlock className="h-3.5 w-12" />
                  </td>
                  <td className="p-4">
                    <TrackingSkeletonBlock className="ml-auto h-4 w-4" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
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
  initialLocationData,
}: TrackingModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<TrackingData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [progressFilter, setProgressFilter] = useState<ProgressFilter>("all");
  const [page, setPage] = useState(1);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
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

  const [certificateStudent, setCertificateStudent] =
    useState<StudentProgress | null>(null);

  const certificateEnabled = data?.certificateEnabled !== false;
  const progressFilters = useMemo(
    () => getProgressFilters(certificateEnabled),
    [certificateEnabled],
  );

  const progressCounts = useMemo(() => {
    const counts: Record<ProgressFilter, number> = {
      all: data?.students.length ?? 0,
      not_enrolled: 0,
      mission_incomplete: 0,
      mission_complete_certificate_pending: 0,
      issued: 0,
    };

    data?.students.forEach((student) => {
      if (certificateEnabled && student.hasCertificate) {
        counts.issued += 1;
      } else if (!student.isEnrolled) {
        counts.not_enrolled += 1;
      } else if (hasCompletedAllMissions(student)) {
        counts.mission_complete_certificate_pending += 1;
      } else {
        counts.mission_incomplete += 1;
      }
    });

    return counts;
  }, [data, certificateEnabled]);

  const filteredStudents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return data?.students.filter((student) => {
      if (!matchesProgressFilter(student, progressFilter, certificateEnabled))
        return false;
      if (!query) return true;

      const matchName = student.name.toLowerCase().includes(query);
      const matchNickname = student.nickname?.toLowerCase().includes(query);
      const matchId = String(student.studentId).includes(query);

      return matchName || matchNickname || matchId;
    });
  }, [data, progressFilter, searchQuery, certificateEnabled]);

  const pages = Math.ceil((filteredStudents?.length || 0) / ITEMS_PER_PAGE);

  const paginatedStudents = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;

    return filteredStudents?.slice(start, end);
  }, [page, filteredStudents]);

  const openStudent = (studentId: number) => {
    rememberActiveTrackingStudentId(studentId);
    router.push(getCleanTrackingStudentPath());
  };

  const emptyMessage = searchQuery.trim()
    ? "ไม่พบนักเรียนที่ตรงกับคำค้นหาในสถานะนี้"
    : progressFilter === "issued"
      ? "ยังไม่มีนักเรียนที่ได้รับเกียรติบัตร"
      : progressFilter === "not_enrolled"
        ? "นักเรียนในรายชื่อนี้ลงทะเบียนครบแล้ว"
        : progressFilter === "mission_incomplete"
          ? certificateEnabled
            ? "ไม่มีนักเรียนที่ภารกิจยังไม่ครบและยังไม่ได้รับเกียรติบัตร"
            : "ไม่มีนักเรียนที่ภารกิจยังไม่ครบ"
          : progressFilter === "mission_complete_certificate_pending"
            ? certificateEnabled
              ? "ไม่มีนักเรียนที่ทำภารกิจครบแต่ยังไม่ได้รับเกียรติบัตร"
              : "ไม่มีนักเรียนที่ทำภารกิจครบแล้ว"
            : "ไม่พบรายชื่อในระบบ";

  const progressContent = loading ? (
    <TrackingProgressSkeleton />
  ) : !data ? (
    <p className="py-8 text-center text-gray-400">
      {loadError || "ไม่สามารถโหลดข้อมูลได้"}
    </p>
  ) : (
    <>
      {/* Summary Cards */}
      <div
        aria-label="กรองนักเรียนตามความก้าวหน้าและเกียรติบัตร"
        className={`mb-8 grid grid-cols-2 gap-3 md:gap-6 ${
          certificateEnabled
            ? "md:grid-cols-3 xl:grid-cols-5"
            : "md:grid-cols-4"
        }`}
        role="tablist"
      >
        {progressFilters.map((item) => {
          const Icon = item.icon;
          const isActive = progressFilter === item.key;
          const isAll = item.key === "all";

          const card = (
            <button
              key={item.key}
              aria-controls="tracking-student-list"
              aria-selected={isActive}
              className={`group h-full w-full cursor-pointer rounded-xl border bg-white p-3 text-left shadow-sm transition-all duration-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5d7c6f]/40 md:p-6 ${
                isActive ? item.activeClass : "border-gray-100"
              }`}
              id={`tracking-tab-${item.key}`}
              role="tab"
              type="button"
              onClick={() => setProgressFilter(item.key)}
            >
              <div className="mb-2 flex items-center gap-2 md:mb-3">
                <Icon
                  className={`h-5 w-5 shrink-0 md:h-6 md:w-6 ${item.iconClass}`}
                />
                <h3 className="truncate text-sm font-semibold text-gray-900">
                  {item.label}
                </h3>
              </div>
              <p className="text-xl font-bold text-gray-900 md:text-2xl">
                {progressCounts[item.key]}{" "}
                <span className="text-[9px] font-medium text-gray-500">คน</span>
              </p>
              <p className={`mt-2 truncate text-xs ${item.helperClass}`}>
                {item.helper}
              </p>
            </button>
          );

          if (isAll) {
            return (
              <div key={item.key} className="relative col-span-2 md:col-span-1">
                {card}
                <button
                  aria-controls="tracking-summary-more"
                  aria-expanded={isSummaryOpen}
                  aria-label={
                    isSummaryOpen ? "พับสถานะอื่น" : "ดูสถานะอื่นทั้งหมด"
                  }
                  className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg text-[#6b857a] hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5d7c6f]/40 md:hidden"
                  type="button"
                  onClick={() => setIsSummaryOpen((open) => !open)}
                >
                  <ChevronDown
                    aria-hidden="true"
                    className={`transition-transform ${
                      isSummaryOpen ? "rotate-180" : ""
                    }`}
                    size={18}
                  />
                </button>
              </div>
            );
          }

          return (
            <div
              key={item.key}
              className={`${isSummaryOpen ? "block" : "hidden"} md:block`}
              id={
                item.key === "not_enrolled"
                  ? "tracking-summary-more"
                  : undefined
              }
            >
              {card}
            </div>
          );
        })}
      </div>

      {/* Search & Table Section */}
      <div className="overflow-hidden rounded-2xl bg-white p-6 shadow-sm">
        <div className="mb-6 flex flex-col items-stretch justify-between gap-3 lg:flex-row lg:items-center">
          <h3 className="shrink-0 text-sm font-semibold text-gray-900">
            รายชื่อนักเรียน
          </h3>
          <div className="flex flex-col items-stretch gap-2.5 sm:flex-row sm:items-center">
            <div className="w-full sm:w-[220px]">
              <Select
                disallowEmptySelection
                aria-label="กรองตามสถานะ"
                className="w-full"
                classNames={{
                  trigger:
                    "bg-white border border-gray-200 text-gray-700 font-medium h-10 rounded-xl",
                }}
                selectedKeys={[progressFilter]}
                size="sm"
                onChange={(e) =>
                  setProgressFilter((e.target.value as ProgressFilter) || "all")
                }
              >
                {progressFilters.map((item) => (
                  <SelectItem
                    key={item.key}
                    textValue={item.key === "all" ? "แสดงทั้งหมด" : item.label}
                  >
                    {item.key === "all" ? "แสดงทั้งหมด" : item.label}
                  </SelectItem>
                ))}
              </Select>
            </div>
            <div className="w-full sm:w-60">
              <Input
                className="w-full"
                classNames={{
                  inputWrapper:
                    "h-10 border border-gray-200 bg-white rounded-xl",
                }}
                placeholder="ค้นหาชื่อ, ชื่อเล่น หรือรหัส..."
                size="sm"
                startContent={<Search className="text-gray-400" size={18} />}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div
          aria-labelledby={`tracking-tab-${progressFilter}`}
          className="overflow-x-auto"
          id="tracking-student-list"
          role="tabpanel"
        >
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead>
              <tr className="border-y border-gray-100 bg-gray-50 text-sm text-gray-600">
                <th className="whitespace-nowrap rounded-tl-lg p-4 font-semibold">
                  นักเรียน
                </th>
                <th className="whitespace-nowrap p-4 font-semibold">
                  ความก้าวหน้าภารกิจ
                </th>
                <th className="whitespace-nowrap p-4 font-semibold">สถานะ</th>
                {certificateEnabled && (
                  <th className="whitespace-nowrap p-4 font-semibold">
                    เลขที่เกียรติบัตร
                  </th>
                )}
                <th className="w-10 rounded-tr-lg p-4">
                  <span className="sr-only">ดูรายละเอียด</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents?.length === 0 ? (
                <tr>
                  <td
                    className="p-8 text-center text-gray-500"
                    colSpan={certificateEnabled ? 5 : 4}
                  >
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                paginatedStudents?.map((student, i) => {
                  const status = getProgressStatus(student, certificateEnabled);
                  const StatusIcon = status.icon;

                  return (
                    <tr
                      key={student.studentId}
                      className="group cursor-pointer border-b border-gray-50 text-sm transition-colors hover:bg-gray-50"
                      onClick={() => openStudent(student.studentId)}
                    >
                      <td className="p-4 text-gray-900">
                        <div className="flex min-w-[260px] items-center gap-2.5">
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
                            <Link
                              aria-label={`ดูรายละเอียดภารกิจของ ${student.name}`}
                              className="whitespace-nowrap font-medium focus-visible:underline focus-visible:outline-none"
                              href={getCleanTrackingStudentPath()}
                              prefetch={false}
                              onClick={(e) => {
                                e.stopPropagation();
                                rememberActiveTrackingStudentId(
                                  student.studentId,
                                );
                              }}
                            >
                              {student.name}
                            </Link>
                            <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-gray-500">
                              <span>ชื่อเล่น: {student.nickname || "-"}</span>
                              <span aria-hidden="true">·</span>
                              <span>รหัสนักเรียน {student.studentId}</span>
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex min-w-[200px] items-center gap-3">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                            <div
                              className="h-2 rounded-full bg-[#5d7c6f] transition-all duration-1000 ease-in-out"
                              style={{
                                width: `${student.progressPercentage}%`,
                              }}
                            />
                          </div>
                          <span className="w-10 shrink-0 text-right text-xs text-gray-500">
                            {student.completedMissions}/{student.totalMissions}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span
                          className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${status.className}`}
                        >
                          <StatusIcon size={14} />
                          {status.label}
                        </span>
                      </td>
                      {certificateEnabled && (
                        <td className="p-4">
                          {student.hasCertificate ? (
                            <div className="flex items-center gap-3">
                              <div className="whitespace-nowrap">
                                <p className="font-medium text-gray-900">
                                  {student.certificateNo ?? "ไม่มีเลขที่"}
                                </p>
                                {student.certificateIssuedAt && (
                                  <p className="mt-0.5 text-xs text-gray-500">
                                    {new Date(
                                      student.certificateIssuedAt,
                                    ).toLocaleDateString("th-TH", {
                                      day: "numeric",
                                      month: "short",
                                      year: "numeric",
                                    })}
                                  </p>
                                )}
                              </div>
                              <Button
                                className="bg-[#e8f0ee] font-medium text-[#3d6357]"
                                size="sm"
                                startContent={<Eye size={14} />}
                                variant="flat"
                                onClick={(e) => e.stopPropagation()}
                                onPress={() => setCertificateStudent(student)}
                              >
                                ดูเกียรติบัตร
                              </Button>
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      )}
                      <td className="p-4 text-right">
                        <ChevronRight
                          aria-hidden="true"
                          className="text-gray-300 transition-colors group-hover:text-[#6b857a]"
                          size={18}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {pages > 1 && (
          <div className="mt-6 flex items-center justify-center">
            <Pagination
              isCompact
              showControls
              classNames={{
                cursor: "bg-[#5d7c6f] text-white font-bold",
              }}
              color="default"
              page={page}
              total={pages}
              onChange={setPage}
            />
          </div>
        )}
      </div>
      <CertificatePreviewModal
        campId={campId}
        student={certificateStudent}
        onClose={() => setCertificateStudent(null)}
      />
    </>
  );

  if (pageMode && activeSection === "progress") {
    return (
      <TrackingShell isOpen={isOpen} pageMode={pageMode} onClose={onClose}>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl px-4 py-8">
            <CampBreadcrumb
              campId={campId}
              className="mb-6"
              currentPage="ติดตามความคืบหน้า"
            />

            <h1 className="mb-8 flex items-center gap-2 text-lg font-bold text-gray-900">
              <Users className="text-[#6b857a]" size={20} />
              <span>ติดตามนักเรียน</span>
            </h1>

            {progressContent}
          </div>
        </div>
      </TrackingShell>
    );
  }

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
        </Header>

        <Body
          className={`flex min-h-0 flex-1 flex-col px-6 py-6 ${
            activeSection === "location" ? "overflow-hidden" : "overflow-y-auto"
          } bg-[#f5f5f2]`}
        >
          {activeSection === "location" ? (
            <CampLocationTracker
              campId={campId}
              configureDestination={false}
              initialData={initialLocationData}
              showDestination={false}
              viewer="teacher"
            />
          ) : (
            progressContent
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
