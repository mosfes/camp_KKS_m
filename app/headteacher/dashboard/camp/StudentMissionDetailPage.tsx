"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, Button } from "@heroui/react";
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  CircleDashed,
  RefreshCw,
  Target,
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

function DetailSkeleton() {
  return (
    <div aria-label="กำลังโหลดรายละเอียดภารกิจ" className="space-y-4">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            className="h-20 animate-pulse rounded-xl bg-gray-200"
          />
        ))}
      </div>
      {Array.from({ length: 4 }, (_, index) => (
        <div
          key={index}
          className="h-24 animate-pulse rounded-xl bg-gray-200"
        />
      ))}
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

  const missionsByStation = useMemo(() => {
    const stations = new Map<
      number,
      { stationId: number; stationName: string; missions: MissionDetail[] }
    >();

    filteredMissions.forEach((mission) => {
      const station = stations.get(mission.stationId);

      if (station) {
        station.missions.push(mission);
      } else {
        stations.set(mission.stationId, {
          stationId: mission.stationId,
          stationName: mission.stationName,
          missions: [mission],
        });
      }
    });

    return Array.from(stations.values());
  }, [filteredMissions]);

  const completedPercentage = detail?.summary.totalMissions
    ? Math.round(
        (detail.summary.completedMissions / detail.summary.totalMissions) * 100,
      )
    : 0;

  const backToTracking = () => {
    router.push(getCleanCampPath("tracking"));
  };

  return (
    <main className="flex h-full min-h-0 flex-col overflow-hidden bg-[#f5f5f2]">
      <header className="shrink-0 border-b border-gray-100 bg-white px-6 pb-4 pt-4">
        <CampBreadcrumb
          campId={campId}
          className="mb-4"
          currentPage="รายละเอียดภารกิจนักเรียน"
        />

        <div className="flex min-w-0 items-center gap-3">
          <Button
            isIconOnly
            aria-label="กลับไปหน้าติดตามนักเรียน"
            className="shrink-0 text-gray-600"
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
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                      <Award size={13} /> ได้รับเกียรติบัตรแล้ว
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
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-bold text-gray-900">
                รายละเอียดภารกิจนักเรียน
              </h1>
              <p className="mt-0.5 text-xs text-gray-500">
                กำลังเตรียมข้อมูลนักเรียน
              </p>
            </div>
          )}
        </div>

        {detail && (
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="font-semibold text-gray-600">
                ทำสำเร็จ {detail.summary.completedMissions} จาก{" "}
                {detail.summary.totalMissions} ภารกิจ
              </span>
              <span className="font-bold text-[#5d7c6f]">
                {completedPercentage}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-[#5d7c6f] transition-all"
                style={{ width: `${completedPercentage}%` }}
              />
            </div>
          </div>
        )}
      </header>

      <section className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
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
          <div className="mx-auto max-w-5xl space-y-4">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {[
                {
                  key: "all" as const,
                  label: "ทั้งหมด",
                  value: detail.summary.totalMissions,
                  icon: <Target size={17} />,
                  active: "border-[#5d7c6f] bg-[#eef4f1] text-[#47685c]",
                },
                {
                  key: "completed" as const,
                  label: "ทำแล้ว",
                  value: detail.summary.completedMissions,
                  icon: <CheckCircle2 size={17} />,
                  active: "border-emerald-500 bg-emerald-50 text-emerald-700",
                },
                {
                  key: "not_started" as const,
                  label: "ยังไม่ทำ",
                  value: detail.summary.notStartedMissions,
                  icon: <CircleDashed size={17} />,
                  active: "border-amber-500 bg-amber-50 text-amber-700",
                },
              ].map((item) => (
                <button
                  key={item.key}
                  aria-pressed={filter === item.key}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5d7c6f]/40 ${
                    filter === item.key
                      ? `${item.active} shadow-sm`
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                  }`}
                  type="button"
                  onClick={() => setFilter(item.key)}
                >
                  <span className="shrink-0">{item.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold">
                      {item.label}
                    </span>
                    <span className="text-lg font-bold leading-tight">
                      {item.value}
                      <span className="ml-1 text-[10px] font-normal">
                        ภารกิจ
                      </span>
                    </span>
                  </span>
                </button>
              ))}
            </div>

            {missionsByStation.length ? (
              missionsByStation.map((station) => (
                <section
                  key={station.stationId}
                  className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
                >
                  <header className="flex items-center justify-between border-b border-gray-100 bg-gray-50/80 px-4 py-3">
                    <h2 className="text-sm font-bold text-gray-800">
                      ฐาน: {station.stationName}
                    </h2>
                    <span className="text-[11px] text-gray-400">
                      {station.missions.length} ภารกิจ
                    </span>
                  </header>

                  <div className="divide-y divide-gray-100">
                    {station.missions.map((mission) => (
                      <article
                        key={mission.missionId}
                        className="flex items-start gap-3 px-4 py-3.5"
                      >
                        <span
                          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                            mission.status === "completed"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {mission.status === "completed" ? (
                            <CheckCircle2 size={18} />
                          ) : (
                            <CircleDashed size={18} />
                          )}
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <h3 className="text-sm font-semibold text-gray-900">
                                {mission.title}
                              </h3>
                              {mission.description && (
                                <p className="mt-1 text-xs leading-relaxed text-gray-500">
                                  {mission.description}
                                </p>
                              )}
                            </div>

                            <span
                              className={`w-fit shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                mission.status === "completed"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-amber-50 text-amber-700"
                              }`}
                            >
                              {mission.status === "completed"
                                ? "ทำแล้ว"
                                : "ยังไม่ทำ"}
                            </span>
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-gray-400">
                            <span>
                              {MISSION_TYPE_LABELS[mission.type] ||
                                mission.type}
                            </span>
                            {mission.submittedAt && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>
                                  ทำเมื่อ {thaiDateTime(mission.submittedAt)}
                                </span>
                              </>
                            )}
                            {mission.method && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>
                                  วิธีทำ:{" "}
                                  {RESULT_METHOD_LABELS[mission.method] ||
                                    mission.method}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ))
            ) : (
              <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white p-6 text-center text-gray-400">
                <Target className="mb-2 opacity-40" size={32} />
                <p className="text-sm font-medium">
                  {detail.summary.totalMissions === 0
                    ? "ค่ายนี้ยังไม่มีภารกิจ"
                    : "ไม่มีภารกิจในสถานะที่เลือก"}
                </p>
              </div>
            )}
          </div>
        ) : null}
      </section>
    </main>
  );
}
