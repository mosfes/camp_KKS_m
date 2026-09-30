"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody } from "@heroui/card";
import { Tabs, Tab } from "@heroui/tabs";
import {
  MapPin,
  Calendar,
  Flag,
  Sparkles,
  History,
  GraduationCap,
  Phone,
  Mail,
  Users,
  UserCircle2,
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronRight,
} from "lucide-react";

import { ParentNavbar } from "@/components/ParentNavbar";
import {
  BANGKOK_TIME_ZONE,
  getBangkokDaysUntil,
  isBangkokDateBefore,
} from "@/lib/bangkok-date";
import { toThumbnail } from "@/lib/cloudinary-url";

// ─── Types ──────────────────────────────────────────────────────────────
interface Teacher {
  prefix_name: string | null;
  firstname: string;
  lastname: string;
  tel: string;
  email: string;
}

interface ClassroomInfo {
  classroom_id: number;
  grade: string;
  academic_years_years_id: number;
  classroom_types: { name: string };
  teacher: Teacher | null;
  classroom_teacher: { teacher: Teacher }[];
}

interface Student {
  students_id: number;
  prefix_name: string | null;
  firstname: string;
  lastname: string;
  tel: string | null;
  classroom_students: { classroom: ClassroomInfo }[];
}

// ─── Helpers ────────────────────────────────────────────────────────────
const gradeLabel: Record<string, string> = {
  Level_1: "ม.1",
  Level_2: "ม.2",
  Level_3: "ม.3",
  Level_4: "ม.4",
  Level_5: "ม.5",
  Level_6: "ม.6",
};

const formatDate = (start: string, end?: string) => {
  if (!start) return "";
  const s = new Date(start).toLocaleDateString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: BANGKOK_TIME_ZONE,
  });

  if (!end || start === end) return s;
  const e = new Date(end).toLocaleDateString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: BANGKOK_TIME_ZONE,
  });

  return `${s} - ${e}`;
};

// ─── Component ──────────────────────────────────────────────────────────
interface ParentProfile {
  parents_id: number;
  firstname: string;
  lastname: string;
  tel: string;
}

export default function ParentDashboard() {
  const router = useRouter();
  const [student, setStudent] = useState<Student | null>(null);
  const [camps, setCamps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [navigatingTo, setNavigatingTo] = useState<number | null>(null);
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [hasParentProfile, setHasParentProfile] = useState<boolean>(true);
  const [parentProfile, setParentProfile] = useState<ParentProfile | null>(
    null,
  );
  const [showProfileModal, setShowProfileModal] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const [meRes, campsRes] = await Promise.all([
          fetch("/api/auth/parent/me"),
          fetch("/api/parent/camps"),
        ]);

        if (meRes.ok) {
          const meData = await meRes.json();

          if (meData.student) {
            setStudent(meData.student);
            setHasParentProfile(meData.hasParentProfile);
            setParentProfile(meData.parentProfile ?? null);
            if (!meData.hasParentProfile) setShowProfileModal(true);
          } else {
            setError("ไม่สามารถโหลดข้อมูลได้");
          }
        } else {
          setError("ไม่สามารถโหลดข้อมูลได้");
        }

        if (campsRes.ok) {
          setCamps(await campsRes.json());
        }
      } catch {
        setError("เกิดข้อผิดพลาด");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const goToCamp = (campId: number) => {
    if (navigatingTo !== null) return;
    setNavigatingTo(campId);
    router.push(`/parent/dashboard/camp/${campId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f5f2]">
        <ParentNavbar />
        <main
          aria-label="กำลังโหลดหน้าผู้ปกครอง"
          aria-live="polite"
          className="mx-auto max-w-6xl space-y-8 p-4 sm:p-6 lg:p-8"
          role="status"
        >
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#5d7c6f] via-[#4d6a5f] to-[#365045] p-6 shadow-lg sm:p-8">
            <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
            <div className="relative flex items-center gap-3.5">
              <div className="h-12 w-12 animate-pulse rounded-2xl bg-white/20 sm:h-14 sm:w-14" />
              <div className="space-y-2">
                <div className="h-7 w-44 animate-pulse rounded-lg bg-white/25 sm:w-56" />
                <div className="h-4 w-56 animate-pulse rounded-md bg-white/20 sm:w-72" />
              </div>
            </div>
            <div className="relative mt-5 flex gap-2">
              <div className="h-8 w-32 animate-pulse rounded-xl bg-white/15" />
              <div className="h-8 w-24 animate-pulse rounded-xl bg-white/15" />
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex h-12 gap-6 border-b border-gray-200/80 px-1">
              <div className="h-4 w-28 animate-pulse rounded bg-gray-300/70" />
              <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
            </div>
            <div className="grid gap-6 pt-4 md:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((item) => (
                <div
                  key={item}
                  className="aspect-[4/3] animate-pulse rounded-2xl border border-gray-100 bg-white shadow-sm"
                />
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="min-h-screen bg-[#f5f5f2]">
        <ParentNavbar />
        <div className="flex min-h-[calc(100vh-64px)] items-center justify-center p-6 text-center">
          <p className="text-red-500">{error || "ไม่พบข้อมูล"}</p>
        </div>
      </div>
    );
  }

  // Classroom & Teachers
  const classroom = student.classroom_students[0]?.classroom;
  const parentDisplayName =
    parentProfile && parentProfile.firstname !== "รอระบุ"
      ? `${parentProfile.firstname} ${parentProfile.lastname}`
      : "ผู้ปกครอง";
  const primaryTeacher = classroom?.teacher ?? null;
  const secondaryTeachers =
    classroom?.classroom_teacher?.map((ct) => ct.teacher) ?? [];
  const teachers: Teacher[] = [
    ...(primaryTeacher ? [primaryTeacher] : []),
    ...secondaryTeachers,
  ];

  // Camp categories
  const myCamps = camps.filter((c: any) => c.isRegistered && !c.isEnded);
  let endedCamps = camps.filter((c: any) => c.isEnded && c.isRegistered);

  if (selectedYear !== "all") {
    endedCamps = endedCamps.filter(
      (c: any) => c.academicYear?.toString() === selectedYear,
    );
  }

  const uniqueYears = Array.from(
    new Set(camps.map((c: any) => c.academicYear).filter(Boolean)),
  ).sort((a: any, b: any) => b - a);

  return (
    <div className="min-h-screen bg-[#f5f5f2]">
      <ParentNavbar />

      {/* Profile Setup Modal (บังคับกรอกครั้งแรก) */}
      {showProfileModal && student && (
        <ProfileSetupModal
          initialTel={parentProfile?.tel || student.tel || ""}
          studentId={student.students_id}
          studentName={`${student.firstname} ${student.lastname}`}
          onSaved={(profile: ParentProfile) => {
            setParentProfile(profile);
            setHasParentProfile(true);
            setShowProfileModal(false);
          }}
        />
      )}

      <div className="mx-auto max-w-6xl space-y-8 p-4 sm:p-6 lg:p-8">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#5d7c6f] via-[#4d6a5f] to-[#365045] p-6 text-white shadow-lg sm:p-8">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-black/15 blur-2xl" />

          <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-3.5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20 shadow-inner backdrop-blur-md sm:h-14 sm:w-14">
                  <Sparkles className="animate-pulse text-white" size={24} />
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight sm:text-2xl lg:text-3xl">
                    สวัสดีคุณ{parentDisplayName}
                  </h1>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs font-normal text-white/85 sm:text-sm">
                    ติดตามค่ายและความปลอดภัยของ{student.prefix_name ?? ""}
                    {student.firstname} {student.lastname}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <div className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/15 px-3 py-1.5 text-xs shadow-sm backdrop-blur-md sm:text-sm">
                  <History className="text-white/80" size={13} />
                  <span className="text-xs text-white/80">รหัสนักเรียน:</span>
                  <span className="font-semibold">{student.students_id}</span>
                </div>
                {classroom?.grade && (
                  <div className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/15 px-3 py-1.5 text-xs font-semibold shadow-sm backdrop-blur-md sm:text-sm">
                    <Flag className="text-white/80" size={13} />
                    <span>
                      {gradeLabel[classroom.grade] ?? classroom.grade}/
                      {classroom.classroom_types?.name ?? "-"}
                    </span>
                  </div>
                )}
                {teachers[0] && (
                  <div className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/15 px-3 py-1.5 text-xs shadow-sm backdrop-blur-md sm:text-sm">
                    <Users className="text-white/80" size={13} />
                    <span>
                      ครู{teachers[0].firstname} {teachers[0].lastname}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="hidden shrink-0 items-center gap-3 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-md lg:flex">
              <div className="border-r border-white/20 px-3 text-center">
                <p className="text-2xl font-bold">{myCamps.length}</p>
                <p className="text-[11px] text-white/80">ค่ายที่เข้าร่วม</p>
              </div>
              <div className="border-r border-white/20 px-3 text-center">
                <p className="text-2xl font-bold">{endedCamps.length}</p>
                <p className="text-[11px] text-white/80">ประวัติค่าย</p>
              </div>
              <div className="px-3 text-center">
                <p className="text-2xl font-bold">{teachers.length}</p>
                <p className="text-[11px] text-white/80">ครูประจำชั้น</p>
              </div>
            </div>
          </div>
        </div>

        {/* ──────── Parent workspace ──────── */}
        <div className="space-y-4">
          <Tabs
            aria-label="Camp Options"
            classNames={{
              tabList: "gap-6 w-full border-b border-gray-200/80 p-0",
              cursor: "w-full bg-[#5d7c6f] h-[2px]",
              tab: "max-w-fit px-1 h-12 justify-start",
              tabContent:
                "group-data-[selected=true]:text-[#5d7c6f] font-semibold text-sm sm:text-base text-gray-500",
            }}
            color="primary"
            variant="underlined"
          >
            {/* ── Tab 1: ค่ายของลูก ── */}
            <Tab
              key="mycamps"
              title={
                <div className="flex items-center gap-2 whitespace-nowrap">
                  <span>ค่ายของบุตร</span>
                  {myCamps.length > 0 && (
                    <span className="rounded-full bg-[#e8f0ee] px-2 py-0.5 text-xs font-semibold text-[#3d6357]">
                      {myCamps.length}
                    </span>
                  )}
                </div>
              }
            >
              <div className="pt-4">
                {myCamps.length === 0 ? (
                  <div className="rounded-3xl border border-gray-100 bg-white p-12 text-center shadow-sm">
                    <Flag className="mx-auto mb-3 text-gray-300" size={40} />
                    <h3 className="text-base font-semibold text-gray-700">
                      ยังไม่มีค่ายที่บุตรเข้าร่วม
                    </h3>
                    <p className="mt-1 text-xs text-gray-400">
                      รายการค่ายจะปรากฏเมื่อมีการลงทะเบียนแล้ว
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {myCamps.map((camp: any) => (
                      <CampCard
                        key={camp.id}
                        camp={camp}
                        navigatingTo={navigatingTo}
                        onPress={() => goToCamp(camp.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </Tab>

            {/* ── Tab 2: ประวัติค่ายที่เข้าร่วม ── */}
            <Tab
              key="ended"
              title={
                <div className="flex items-center gap-2 whitespace-nowrap">
                  <span>ประวัติค่าย</span>
                  {endedCamps.length > 0 && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">
                      {endedCamps.length}
                    </span>
                  )}
                </div>
              }
            >
              <div className="space-y-4 pt-4">
                {uniqueYears.length > 0 && (
                  <div className="flex flex-wrap gap-2 pb-1">
                    <button
                      className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 border ${
                        selectedYear === "all"
                          ? "bg-[#5d7c6f] text-white border-[#5d7c6f] shadow-sm"
                          : "bg-white text-gray-500 border-gray-200 hover:border-[#5d7c6f]/50 hover:text-[#5d7c6f]"
                      }`}
                      onClick={() => setSelectedYear("all")}
                    >
                      ทั้งหมด
                    </button>
                    {uniqueYears.map((year: any) => (
                      <button
                        key={year}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 border ${
                          selectedYear === year.toString()
                            ? "bg-[#5d7c6f] text-white border-[#5d7c6f] shadow-sm"
                            : "bg-white text-gray-500 border-gray-200 hover:border-[#5d7c6f]/50 hover:text-[#5d7c6f]"
                        }`}
                        onClick={() => setSelectedYear(year.toString())}
                      >
                        ปี {(year + 543).toString()}
                      </button>
                    ))}
                  </div>
                )}

                {endedCamps.length === 0 ? (
                  <div className="rounded-3xl border border-gray-100 bg-white p-12 text-center shadow-sm">
                    <History className="mx-auto mb-3 text-gray-300" size={40} />
                    <h3 className="text-base font-semibold text-gray-700">
                      {selectedYear === "all"
                        ? "ยังไม่มีประวัติค่ายที่เข้าร่วม"
                        : `ไม่มีค่ายในปีการศึกษา ${(parseInt(selectedYear) + 543).toString()}`}
                    </h3>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {endedCamps.map((camp: any) => (
                      <CampCard
                        key={camp.id}
                        isEnded
                        camp={camp}
                        navigatingTo={navigatingTo}
                        onPress={() => goToCamp(camp.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </Tab>

            {/* ── Tab 3: ครูประจำชั้น ── */}
            <Tab
              key="teacher"
              title={
                <div className="flex items-center gap-2 whitespace-nowrap">
                  <GraduationCap size={15} />
                  <span>ครูประจำชั้น</span>
                </div>
              }
            >
              <div className="py-4">
                {teachers.length === 0 ? (
                  <div className="text-center text-gray-400 py-10">
                    <GraduationCap
                      className="mx-auto mb-3 opacity-30"
                      size={40}
                    />
                    <p>ไม่พบข้อมูลครูประจำชั้น</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    <p className="text-xs text-gray-500 px-1">
                      ช่องทางติดต่อครูประจำชั้น
                    </p>
                    {teachers.map((t, i) => (
                      <div
                        key={i}
                        className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5"
                      >
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 rounded-full bg-[#5d7c6f]/10 flex items-center justify-center text-[#5d7c6f]">
                            <GraduationCap size={20} />
                          </div>
                          <div>
                            <p className="font-bold text-[#3d6357] text-sm">
                              {t.prefix_name ?? ""}
                              {t.firstname} {t.lastname}
                            </p>
                            <p className="text-[10px] text-gray-400">
                              ครูประจำชั้น
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <a
                            className="flex items-center gap-3 bg-[#f5f0e7]/60 rounded-xl p-3 text-sm text-gray-700 hover:bg-[#5d7c6f]/10 transition-colors"
                            href={`tel:${t.tel}`}
                          >
                            <Phone
                              className="text-[#5d7c6f] shrink-0"
                              size={16}
                            />
                            <span>{t.tel || "-"}</span>
                          </a>
                          <a
                            className="flex items-center gap-3 bg-[#f5f0e7]/60 rounded-xl p-3 text-sm text-gray-700 hover:bg-[#5d7c6f]/10 transition-colors"
                            href={`mailto:${t.email}`}
                          >
                            <Mail
                              className="text-[#5d7c6f] shrink-0"
                              size={16}
                            />
                            <span className="truncate">{t.email || "-"}</span>
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Tab>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

// ─── Camp Card Component (shared) ─────────────────────────────────────
function CampCard({
  camp,
  navigatingTo,
  onPress,
  isEnded = false,
}: {
  camp: any;
  navigatingTo: number | null;
  onPress: () => void;
  isEnded?: boolean;
}) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);

    return () => clearInterval(timer);
  }, []);

  const regisStart = camp.startRegisDate ? new Date(camp.startRegisDate) : null;
  const isUpcomingRegis =
    regisStart &&
    isBangkokDateBefore(now, regisStart) &&
    !isEnded &&
    !camp.isRegistered;

  let countdownText = "";

  if (isUpcomingRegis && regisStart) {
    const diffDays = getBangkokDaysUntil(regisStart, now);

    if (diffDays > 1) {
      countdownText = `อีก ${diffDays} วัน`;
    } else {
      countdownText = "เปิดรับสมัครเร็วๆ นี้";
    }
  }

  return (
    <Card
      className={`group relative flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200/70 bg-white shadow-sm transition-all duration-300 hover:shadow-xl ${
        navigatingTo === camp.id
          ? "scale-[0.98] opacity-60"
          : "hover:-translate-y-1"
      } ${isEnded ? "grayscale-[0.35] opacity-90" : ""} ${
        isUpcomingRegis ? "cursor-not-allowed" : ""
      }`}
      isPressable={navigatingTo === null && !isUpcomingRegis}
      onPress={isUpcomingRegis ? undefined : onPress}
    >
      {isUpcomingRegis && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-gray-900/65 p-6 text-center text-white backdrop-blur-[3px]">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/15 backdrop-blur-md ring-1 ring-white/30">
            <Clock className="animate-pulse text-white" size={24} />
          </div>
          <h3 className="mb-1 text-lg font-semibold tracking-tight">
            ยังไม่เปิดรับสมัคร
          </h3>
          <p className="text-xs font-normal text-white/80">{countdownText}</p>
        </div>
      )}

      {navigatingTo === camp.id && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/50 backdrop-blur-sm">
          <div className="h-9 w-9 animate-spin rounded-full border-3 border-[#5d7c6f] border-t-transparent shadow-lg" />
        </div>
      )}

      <div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden bg-gray-100">
        {camp.img_camp_url ? (
          <img
            alt={camp.title}
            className={`h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 ${
              isEnded ? "opacity-80" : ""
            }`}
            src={toThumbnail(camp.img_camp_url)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
            <Flag className="text-[#5d7c6f]/30" size={40} />
          </div>
        )}

        <div className="absolute right-3 top-3 z-10 flex flex-col items-end gap-1.5">
          {isEnded ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-semibold text-white shadow-sm backdrop-blur-md">
              ค่ายจบแล้ว
            </span>
          ) : camp.isRegistered ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-700/90 px-2.5 py-1 text-[10px] font-semibold text-white shadow-sm backdrop-blur-md">
              <CheckCircle2 size={12} /> ลงทะเบียนแล้ว
            </span>
          ) : isUpcomingRegis ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-700/90 px-2.5 py-1 text-[10px] font-semibold text-white shadow-sm backdrop-blur-md">
              <Clock size={12} /> {countdownText}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#5d7c6f]/90 px-2.5 py-1 text-[10px] font-semibold text-white shadow-sm backdrop-blur-md">
              เปิดรับสมัคร
            </span>
          )}
        </div>
      </div>

      <CardBody className="flex flex-1 flex-col justify-between gap-3 p-4 sm:p-5">
        <div className="space-y-2">
          <h3 className="line-clamp-2 min-h-[2.75rem] text-base font-bold leading-snug text-gray-800 transition-colors group-hover:text-[#5d7c6f]">
            {camp.title}
          </h3>

          <div className="space-y-1.5 pt-1 text-xs text-gray-600">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#5d7c6f]/10">
                <MapPin className="text-[#5d7c6f]" size={12} />
              </div>
              <span className="truncate font-normal">
                {camp.location || "ไม่ระบุสถานที่"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#5d7c6f]/10">
                <Calendar className="text-[#5d7c6f]" size={12} />
              </div>
              <span className="truncate font-normal">
                {formatDate(camp.rawStartDate, camp.rawEndDate)}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-auto pt-2">
          <div className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#5d7c6f] px-4 py-2.5 text-xs font-medium text-white shadow-sm transition-all group-hover:bg-[#4d695e] sm:text-sm">
            <span>{isEnded ? "ดูย้อนหลัง" : "ดูความคืบหน้า"}</span>
            {isEnded ? <History size={14} /> : <ChevronRight size={14} />}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
// ─── ProfileSetupModal ──────────────────────────────────────────────
function ProfileSetupModal({
  studentName,
  studentId,
  initialTel = "",
  onSaved,
}: {
  studentName: string;
  studentId: number;
  initialTel?: string;
  onSaved: (profile: ParentProfile) => void;
}) {
  const [form, setForm] = useState({
    firstname: "",
    lastname: "",
    tel: initialTel,
  });
  const [saving, setSaving] = useState(false);
  const [fieldError, setFieldError] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState("");
  const [success, setSuccess] = useState(false);
  const submitInFlightRef = useRef(false);

  const validate = () => {
    const errors: Record<string, string> = {};

    if (!form.firstname.trim()) errors.firstname = "กรุณากรอกชื่อ";
    if (!form.lastname.trim()) errors.lastname = "กรุณากรอกนามสกุล";
    if (!form.tel.trim()) {
      errors.tel = "กรุณากรอกเบอร์โทร";
    } else {
      const digits = form.tel.replace(/\D/g, "");

      if (digits.length !== 10) errors.tel = "เบอร์โทรต้องเป็น 10 หลัก";
    }

    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitInFlightRef.current) return;
    setApiError("");
    const errors = validate();

    setFieldError(errors);
    if (Object.keys(errors).length > 0) return;

    submitInFlightRef.current = true;
    setSaving(true);
    try {
      const res = await fetch("/api/parent/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        setApiError(data.error || "เกิดข้อผิดพลาด");

        return;
      }
      setSuccess(true);
      setTimeout(() => onSaved(data.parent), 1200);
    } catch {
      setApiError("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      submitInFlightRef.current = false;
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-[#5d7c6f] px-6 pt-8 pb-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center">
              <UserCircle2 size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold">ยินดีต้อนรับ</h2>
              <p className="text-sm opacity-80">กรุณากรอกข้อมูลผู้ปกครอง</p>
            </div>
          </div>
          <div className="mt-3 bg-white/10 rounded-xl p-3 text-sm">
            <p className="opacity-80 text-xs mb-0.5">นักเรียน</p>
            <p className="font-semibold">{studentName}</p>
            <p className="text-xs opacity-70">รหัสนักเรียน: {studentId}</p>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {success ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center">
                <CheckCircle2 className="text-[#5d7c6f]" size={32} />
              </div>
              <p className="font-bold text-gray-800">บันทึกข้อมูลสำเร็จ!</p>
              <p className="text-sm text-gray-500">กำลังพาไปยังหน้าหลัก...</p>
            </div>
          ) : (
            <form className="space-y-4 pt-2" onSubmit={handleSubmit}>
              {/* Firstname */}
              <div>
                <label
                  className="block text-sm font-medium text-gray-700 mb-1"
                  htmlFor="parent-profile-firstname"
                >
                  ชื่อผู้ปกครอง <span className="text-red-500">*</span>
                </label>
                <input
                  className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all
                    ${
                      fieldError.firstname
                        ? "border-red-400 bg-red-50 focus:ring-2 focus:ring-red-200"
                        : "border-gray-200 bg-gray-50 focus:border-[#5d7c6f] focus:ring-2 focus:ring-[#5d7c6f]/20"
                    }`}
                  placeholder="เช่น สมชาย"
                  type="text"
                  id="parent-profile-firstname"
                  value={form.firstname}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, firstname: e.target.value }))
                  }
                />
                {fieldError.firstname && (
                  <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                    <AlertCircle size={12} /> {fieldError.firstname}
                  </p>
                )}
              </div>

              {/* Lastname */}
              <div>
                <label
                  className="block text-sm font-medium text-gray-700 mb-1"
                  htmlFor="parent-profile-lastname"
                >
                  นามสกุลผู้ปกครอง <span className="text-red-500">*</span>
                </label>
                <input
                  className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all
                    ${
                      fieldError.lastname
                        ? "border-red-400 bg-red-50 focus:ring-2 focus:ring-red-200"
                        : "border-gray-200 bg-gray-50 focus:border-[#5d7c6f] focus:ring-2 focus:ring-[#5d7c6f]/20"
                    }`}
                  placeholder="เช่น ใจดี"
                  type="text"
                  id="parent-profile-lastname"
                  value={form.lastname}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, lastname: e.target.value }))
                  }
                />
                {fieldError.lastname && (
                  <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                    <AlertCircle size={12} /> {fieldError.lastname}
                  </p>
                )}
              </div>

              {/* Tel */}
              <div>
                <label
                  className="block text-sm font-medium text-gray-700 mb-1"
                  htmlFor="parent-profile-tel"
                >
                  เบอร์โทรศัพท์ <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Phone
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                    size={16}
                  />
                  <input
                    className={`w-full pl-10 pr-4 py-3 rounded-xl border text-sm outline-none transition-all
                      ${
                        fieldError.tel
                          ? "border-red-400 bg-red-50 focus:ring-2 focus:ring-red-200"
                          : "border-gray-200 bg-gray-50 focus:border-[#5d7c6f] focus:ring-2 focus:ring-[#5d7c6f]/20"
                      }`}
                    maxLength={10}
                    placeholder="0xxxxxxxxx"
                    type="tel"
                    id="parent-profile-tel"
                    value={form.tel}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, tel: e.target.value }))
                    }
                  />
                </div>
                {fieldError.tel && (
                  <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                    <AlertCircle size={12} /> {fieldError.tel}
                  </p>
                )}
              </div>

              {apiError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2 text-red-600 text-sm">
                  <AlertCircle size={16} />
                  {apiError}
                </div>
              )}

              <button
                className="w-full bg-[#5d7c6f] hover:bg-[#4a6659] text-white font-semibold py-3.5 rounded-xl transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
                disabled={saving}
                type="submit"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    กำลังบันทึก...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    บันทึกข้อมูล
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
