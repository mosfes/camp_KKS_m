"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { Avatar, Button } from "@heroui/react";
import {
  ArrowLeft,
  CheckCircle2,
  CircleDashed,
  RefreshCw,
  Target,
  TrendingUp,
  Trophy,
} from "lucide-react";

import CampBreadcrumb from "./CampBreadcrumb";

import { getCleanCampPath } from "@/lib/client-active-camp";

type MissionStatus = "completed" | "not_started";
type MissionFilter = "all" | MissionStatus;

interface MissionDetail {
  missionId: number;
  title: string;
  description: string | null;
  type: string;
  stationId: number;
  stationName: string;
  status: MissionStatus;
  submittedAt: string | null;
  method: string | null;
}

interface StudentMissionDetail {
  camp: { campId: number; name: string };
  student: {
    studentId: number;
    name: string;
    nickname: string | null;
    profileImageUrl: string | null;
    initials: string;
    isEnrolled: boolean;
    hasCertificate: boolean;
  };
  summary: {
    totalMissions: number;
    completedMissions: number;
    notStartedMissions: number;
  };
  missions: MissionDetail[];
}

interface StudentMissionDetailPageProps {
  campId: number;
  studentId: number;
}

const MISSION_TYPE_LABELS: Record<string, string> = {
  QUESTION_ANSWERING: "ตอบคำถาม",
  PHOTO_SUBMISSION: "ส่งรูปภาพ",
  VIDEO_SUBMISSION: "ส่งวิดีโอ",
  QR_CODE_SCANNING: "สแกน QR Code",
  MULTIPLE_CHOICE_QUIZ: "แบบทดสอบ",
  PRE_TEST: "แบบทดสอบก่อนเรียน",
  POST_TEST: "แบบทดสอบหลังเรียน",
};

const RESULT_METHOD_LABELS: Record<string, string> = {
  NFC: "NFC",
  QR: "QR Code",
  Code: "รหัสภารกิจ",
  Aws: "คำตอบออนไลน์",
  Photo: "รูปภาพ",
};

function responseErrorMessage(response: Response) {
  return response
    .json()
    .then((body) => body?.error || body?._error || "โหลดรายละเอียดไม่สำเร็จ")
    .catch(() => "โหลดรายละเอียดไม่สำเร็จ");
}

function thaiDateTime(value: string) {
  return new Date(value).toLocaleString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  });
}

function SkeletonBlock({
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

function DetailSkeleton() {
  return (
    <div aria-label="กำลังโหลดรายละเอียดภารกิจ">
      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-6">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm md:p-6"
          >
            <div className="mb-2 flex items-center gap-2 md:mb-3">
              <SkeletonBlock className="h-5 w-5 rounded-full md:h-6 md:w-6" />
              <SkeletonBlock className="h-3.5 w-24" />
            </div>
            <SkeletonBlock className="h-7 w-16" />
            <SkeletonBlock className="mt-2 h-3 w-28" />
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center justify-between gap-3">
          <SkeletonBlock className="h-5 w-28" />
          <SkeletonBlock className="h-3.5 w-16" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead>
              <tr className="border-y border-gray-100 bg-gray-50">
                {[48, 20, 24, 28, 24, 20].map((width, index) => (
                  <th key={index} className="p-4">
                    <SkeletonBlock
                      className="h-3.5"
                      style={{ width: `${width * 2}px` }}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }, (_, rowIndex) => (
                <tr key={rowIndex} className="border-b border-gray-50">
                  <td className="p-4">
                    <div className="flex min-w-[220px] items-start gap-2.5">
                      <SkeletonBlock className="mt-0.5 h-3 w-5" />
                      <div className="space-y-1.5">
                        <SkeletonBlock className="h-3.5 w-40" />
                        <SkeletonBlock className="h-3 w-52" />
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <SkeletonBlock className="h-3.5 w-20" />
                  </td>
                  <td className="p-4">
                    <SkeletonBlock className="h-3.5 w-20" />
                  </td>
                  <td className="p-4">
                    <SkeletonBlock className="h-3.5 w-28" />
                  </td>
                  <td className="p-4">
                    <SkeletonBlock className="h-3.5 w-20" />
                  </td>
                  <td className="p-4">
                    <SkeletonBlock className="h-7 w-20 rounded-full" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function StudentMissionDetailPage({
  campId,
  studentId,
}: StudentMissionDetailPageProps) {
  const router = useRouter();
  const [detail, setDetail] = useState<StudentMissionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<MissionFilter>("all");
  const [requestVersion, setRequestVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);
    setError("");

    fetch(`/api/camps/${campId}/tracking/${studentId}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(await responseErrorMessage(response));

        return response.json() as Promise<StudentMissionDetail>;
      })
      .then(setDetail)
      .catch((fetchError: unknown) => {
        if (
          fetchError instanceof DOMException &&
          fetchError.name === "AbortError"
        ) {
          return;
        }

        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "โหลดรายละเอียดภารกิจไม่สำเร็จ",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [campId, requestVersion, studentId]);

  const filteredMissions = useMemo(
    () =>
      detail?.missions.filter(
        (mission) => filter === "all" || mission.status === filter,
      ) ?? [],
    [detail?.missions, filter],
  );

  const completedPercentage = detail?.summary.totalMissions
    ? Math.round(
        (detail.summary.completedMissions / detail.summary.totalMissions) * 100,
      )
    : 0;

  const backToTracking = () => {
    router.push(getCleanCampPath("tracking"));
  };

  const filterCards = detail
    ? [
        {
          key: "all" as const,
          label: "ภารกิจทั้งหมด",
          helper: "ทุกสถานะ",
          value: detail.summary.totalMissions,
          icon: Target,
          iconClass: "text-[#6b857a]",
          helperClass: "text-[#6b857a]",
          activeClass: "border-[#6b857a] ring-1 ring-[#6b857a]/30",
        },
        {
          key: "completed" as const,
          label: "ทำแล้ว",
          helper: "ส่งภารกิจเรียบร้อย",
          value: detail.summary.completedMissions,
          icon: CheckCircle2,
          iconClass: "text-emerald-600",
          helperClass: "text-emerald-600",
          activeClass: "border-emerald-400 ring-1 ring-emerald-200",
        },
        {
          key: "not_started" as const,
          label: "ยังไม่ทำ",
          helper: "ยังไม่มีการส่งภารกิจ",
          value: detail.summary.notStartedMissions,
          icon: CircleDashed,
          iconClass: "text-amber-500",
          helperClass: "text-amber-600",
          activeClass: "border-amber-400 ring-1 ring-amber-200",
        },
      ]
    : [];

  return (
    <main className="h-full min-h-0 overflow-y-auto bg-[#f5f5f2]">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <CampBreadcrumb
          campId={campId}
          className="mb-6"
          currentPage="รายละเอียดภารกิจนักเรียน"
        />

        <div className="mb-8 flex min-w-0 items-center gap-3">
          <Button
            isIconOnly
            aria-label="กลับไปหน้าติดตามนักเรียน"
            className="shrink-0 bg-white text-gray-600 shadow-sm"
            size="sm"
            variant="flat"
            onPress={backToTracking}
          >
            <ArrowLeft size={18} />
          </Button>

          {detail ? (
            <>
              <Avatar
                className="h-11 w-11 shrink-0 bg-[#e8f0ee] text-[#3d6357]"
                imgProps={{ alt: `รูปโปรไฟล์ของ ${detail.student.name}` }}
                name={detail.student.initials}
                src={detail.student.profileImageUrl || undefined}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-lg font-bold text-gray-900">
                    {detail.student.name}
                  </h1>
                  {detail.student.hasCertificate && (
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                      <Trophy size={14} /> ได้รับเกียรติบัตรแล้ว
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-gray-500">
                  ชื่อเล่น: {detail.student.nickname || "-"} · รหัสนักเรียน{" "}
                  {detail.student.studentId}
                </p>
              </div>
            </>
          ) : (
            <h1 className="flex items-center gap-2 text-lg font-bold text-gray-900">
              <Target className="text-[#6b857a]" size={20} />
              <span>รายละเอียดภารกิจนักเรียน</span>
            </h1>
          )}
        </div>

        {loading ? (
          <DetailSkeleton />
        ) : error ? (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-red-100 bg-red-50 p-6 text-center">
            <p className="font-semibold text-red-700">
              โหลดรายละเอียดภารกิจไม่สำเร็จ
            </p>
            <p className="mt-1 text-sm text-red-600">{error}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Button variant="flat" onPress={backToTracking}>
                กลับหน้าติดตามนักเรียน
              </Button>
              <Button
                color="danger"
                startContent={<RefreshCw size={16} />}
                variant="flat"
                onPress={() => setRequestVersion((version) => version + 1)}
              >
                ลองอีกครั้ง
              </Button>
            </div>
          </div>
        ) : detail ? (
          <>
            {/* Summary Cards */}
            <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-6">
              {filterCards.map((item) => {
                const Icon = item.icon;

                return (
                  <button
                    key={item.key}
                    aria-pressed={filter === item.key}
                    className={`cursor-pointer rounded-xl border bg-white p-3 text-left shadow-sm transition-all duration-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5d7c6f]/40 md:p-6 ${
                      filter === item.key ? item.activeClass : "border-gray-100"
                    }`}
                    type="button"
                    onClick={() => setFilter(item.key)}
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
                      {item.value}{" "}
                      <span className="text-[9px] font-medium text-gray-500">
                        ภารกิจ
                      </span>
                    </p>
                    <p className={`mt-2 truncate text-xs ${item.helperClass}`}>
                      {item.helper}
                    </p>
                  </button>
                );
              })}

              <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm md:p-6">
                <div className="mb-2 flex items-center gap-2 md:mb-3">
                  <TrendingUp className="h-5 w-5 shrink-0 text-[#6b857a] md:h-6 md:w-6" />
                  <h3 className="truncate text-sm font-semibold text-gray-900">
                    ความก้าวหน้า
                  </h3>
                </div>
                <p className="text-xl font-bold text-gray-900 md:text-2xl">
                  {completedPercentage}
                  <span className="text-[9px] font-medium text-gray-500">
                    {" "}
                    %
                  </span>
                </p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-[#5d7c6f] transition-all"
                    style={{ width: `${completedPercentage}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Mission Table */}
            <div className="overflow-hidden rounded-2xl bg-white p-6 shadow-sm">
              <div className="mb-6 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-gray-900">
                  รายการภารกิจ
                </h3>
                <span className="text-xs text-gray-500">
                  {filteredMissions.length} ภารกิจ
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-left">
                  <thead>
                    <tr className="border-y border-gray-100 bg-gray-50 text-sm text-gray-600">
                      <th className="whitespace-nowrap rounded-tl-lg p-4 font-semibold">
                        ภารกิจ
                      </th>
                      <th className="whitespace-nowrap p-4 font-semibold">
                        ฐาน
                      </th>
                      <th className="whitespace-nowrap p-4 font-semibold">
                        ประเภท
                      </th>
                      <th className="whitespace-nowrap p-4 font-semibold">
                        ทำเมื่อ
                      </th>
                      <th className="whitespace-nowrap p-4 font-semibold">
                        วิธีทำ
                      </th>
                      <th className="whitespace-nowrap rounded-tr-lg p-4 font-semibold">
                        สถานะ
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMissions.length === 0 ? (
                      <tr>
                        <td
                          className="p-8 text-center text-gray-500"
                          colSpan={6}
                        >
                          {detail.summary.totalMissions === 0
                            ? "ค่ายนี้ยังไม่มีภารกิจ"
                            : "ไม่มีภารกิจในสถานะที่เลือก"}
                        </td>
                      </tr>
                    ) : (
                      filteredMissions.map((mission, index) => (
                        <tr
                          key={mission.missionId}
                          className="border-b border-gray-50 text-sm transition-colors hover:bg-gray-50"
                        >
                          <td className="p-4 text-gray-900">
                            <div className="flex min-w-[220px] items-start gap-2.5">
                              <span className="mt-0.5 w-5 shrink-0 text-center text-xs font-semibold text-gray-400">
                                {index + 1}
                              </span>
                              <div className="min-w-0">
                                <p className="font-medium">{mission.title}</p>
                                {mission.description && (
                                  <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">
                                    {mission.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="whitespace-nowrap p-4 text-gray-600">
                            {mission.stationName}
                          </td>
                          <td className="whitespace-nowrap p-4 text-gray-600">
                            {MISSION_TYPE_LABELS[mission.type] || mission.type}
                          </td>
                          <td className="whitespace-nowrap p-4 text-gray-600">
                            {mission.submittedAt ? (
                              thaiDateTime(mission.submittedAt)
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap p-4 text-gray-600">
                            {mission.method ? (
                              RESULT_METHOD_LABELS[mission.method] ||
                              mission.method
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="p-4">
                            {mission.status === "completed" ? (
                              <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                                <CheckCircle2 size={14} />
                                ทำแล้ว
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-amber-100 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                                <CircleDashed size={14} />
                                ยังไม่ทำ
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}
