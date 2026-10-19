"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, Select, SelectItem } from "@heroui/react";
import {
  AlertTriangle,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ClipboardCheck,
  ClipboardList,
  HeartPulse,
  HelpCircle,
  GraduationCap,
  MessageSquareText,
  MapPin,
  Route,
  Smile,
  Sparkles,
  Target,
  Tent,
  Users,
} from "lucide-react";

import adminService from "@/app/service/adminService";
import { BANGKOK_TIME_ZONE } from "@/lib/bangkok-date";

const emptyQualityOverview = {
  evaluatedCamps: 0,
  averageHealth: null,
  averageSurveyScore: null,
  averageMissionCompletion: null,
  averageResponseRate: null,
  continueCount: 0,
  improveCount: 0,
  reviewCount: 0,
  insufficientCount: 0,
};

const emptyCampOverview = {
  activeCamps: 0,
  upcomingCamps: 0,
  completedCamps: 0,
  campsWithoutStations: 0,
  focusCamps: [],
};

const emptySystemCounts = {
  totalTeachers: 0,
  totalClassrooms: 0,
  totalStudents: 0,
  totalCamps: 0,
};

const recommendationStyles = {
  CONTINUE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  IMPROVE: "bg-amber-50 text-amber-700 border-amber-200",
  REVIEW: "bg-rose-50 text-rose-700 border-rose-200",
  INSUFFICIENT: "bg-slate-50 text-slate-600 border-slate-200",
};

function formatPercent(value) {
  return value === null || value === undefined ? "—" : `${value}%`;
}

function MetricCard({ icon: Icon, label, value, note, tone }) {
  return (
    <Card className="rounded-2xl border border-gray-100 bg-white shadow-sm">
      <CardBody className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-gray-500">{label}</p>
            <p className="mt-2 text-3xl font-bold text-gray-850">
              {formatPercent(value)}
            </p>
            <p className="mt-1 text-xs text-gray-400">{note}</p>
          </div>
          <span className={`rounded-2xl p-3 ${tone}`}>
            <Icon size={22} />
          </span>
        </div>
      </CardBody>
    </Card>
  );
}

function ScoreBar({ label, value }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="text-gray-500">{label}</span>
        <span className="font-semibold text-gray-700">
          {formatPercent(value)}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full bg-[#5d7c6f] transition-all"
          style={{ width: `${Math.max(0, Math.min(value || 0, 100))}%` }}
        />
      </div>
    </div>
  );
}

function FeedbackList({ icon: Icon, title, items, emptyText, tone }) {
  return (
    <div className={`rounded-2xl border p-4 ${tone}`}>
      <h4 className="flex items-center gap-2 text-sm font-bold text-gray-800">
        <Icon size={17} /> {title}
      </h4>
      {items.length > 0 ? (
        <ul className="mt-3 space-y-2 text-sm text-gray-600">
          {items.map((item) => (
            <li key={item} className="flex gap-2">
              <span className="mt-1 text-gray-400">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-gray-400">{emptyText}</p>
      )}
    </div>
  );
}

function OperationCard({ icon: Icon, label, value, tone }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div
        className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}
      >
        <Icon size={19} />
      </div>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
      <p className="mt-1 text-xs font-medium text-gray-500">{label}</p>
    </div>
  );
}

function SkeletonBlock({ className = "" }) {
  return <div className={`animate-pulse rounded bg-gray-200 ${className}`} />;
}

export function OverviewSkeleton() {
  return (
    <div
      aria-label="กำลังโหลดภาพรวมระบบ"
      aria-live="polite"
      className="flex w-full flex-col gap-6 pt-1"
      role="status"
    >
      {/* Summary banner */}
      <section className="overflow-hidden rounded-3xl bg-[#365f4f] shadow-sm">
        <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="space-y-4">
            <SkeletonBlock className="h-4 w-32 bg-white/25" />
            <SkeletonBlock className="h-8 w-72 bg-white/25 sm:h-9 sm:w-96" />
            <SkeletonBlock className="h-4 w-full max-w-xl bg-white/20" />
            <div className="flex gap-2">
              <SkeletonBlock className="h-9 w-32 rounded-xl bg-white/20" />
              <SkeletonBlock className="h-9 w-40 rounded-xl bg-white/20" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:w-[430px]">
            {Array.from({ length: 4 }, (_, index) => (
              <div
                key={index}
                className="rounded-2xl border border-white/15 bg-white/10 p-3"
              >
                <SkeletonBlock className="h-5 w-5 rounded-full bg-white/25" />
                <SkeletonBlock className="mt-3 h-8 w-10 bg-white/25" />
                <SkeletonBlock className="mt-2 h-3 w-16 bg-white/20" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quality summary */}
      <section className="rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="space-y-3">
            <SkeletonBlock className="h-4 w-28" />
            <SkeletonBlock className="h-6 w-72" />
            <SkeletonBlock className="h-4 w-full max-w-2xl" />
            <div className="flex gap-2">
              <SkeletonBlock className="h-7 w-28 rounded-full" />
              <SkeletonBlock className="h-7 w-32 rounded-full" />
            </div>
          </div>
          <div className="grid min-w-[280px] grid-cols-3 gap-2">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="rounded-xl bg-gray-100 p-3">
                <SkeletonBlock className="mx-auto h-7 w-8" />
                <SkeletonBlock className="mx-auto mt-2 h-3 w-16" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Upcoming and follow-up cards */}
      <section className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        {Array.from({ length: 2 }, (_, index) => (
          <div
            key={index}
            className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6"
          >
            <SkeletonBlock className="h-4 w-28" />
            <SkeletonBlock className="mt-3 h-6 w-64" />
            <div className="mt-5 space-y-3">
              {Array.from({ length: 2 }, (_, row) => (
                <div
                  key={row}
                  className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 p-3"
                >
                  <div className="flex items-center gap-3">
                    <SkeletonBlock className="h-9 w-9 rounded-xl" />
                    <div className="space-y-2">
                      <SkeletonBlock className="h-4 w-36" />
                      <SkeletonBlock className="h-3 w-24" />
                    </div>
                  </div>
                  <SkeletonBlock className="h-5 w-6" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* System counts */}
      <section>
        <SkeletonBlock className="h-6 w-40" />
        <SkeletonBlock className="mt-2 h-4 w-64" />
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div
              key={index}
              className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
            >
              <SkeletonBlock className="h-10 w-10 rounded-xl" />
              <SkeletonBlock className="mt-3 h-8 w-14" />
              <SkeletonBlock className="mt-2 h-3 w-24" />
            </div>
          ))}
        </div>
      </section>

      {/* Quality metrics */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <SkeletonBlock className="h-4 w-28" />
                <SkeletonBlock className="mt-3 h-9 w-16" />
                <SkeletonBlock className="mt-2 h-3 w-32" />
              </div>
              <SkeletonBlock className="h-11 w-11 rounded-2xl" />
            </div>
          </div>
        ))}
      </section>

      {/* Camp analysis */}
      <section className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
        <div className="border-b border-gray-100 p-5 sm:p-6">
          <SkeletonBlock className="h-6 w-44" />
          <SkeletonBlock className="mt-2 h-4 w-80 max-w-full" />
        </div>
        <div className="space-y-4 p-5 sm:p-6">
          {Array.from({ length: 3 }, (_, index) => (
            <div
              key={index}
              className="flex items-center gap-4 rounded-xl border border-gray-100 p-4"
            >
              <SkeletonBlock className="hidden h-10 w-10 rounded-xl lg:block" />
              <div className="min-w-0 flex-1 space-y-2">
                <SkeletonBlock className="h-4 w-48 max-w-full" />
                <SkeletonBlock className="h-3 w-64 max-w-full" />
              </div>
              <SkeletonBlock className="h-7 w-20 rounded-full" />
              <SkeletonBlock className="h-5 w-5" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default function OverviewManager({
  initialYears = null,
  initialOverview = null,
}) {
  const router = useRouter();
  const firstYear = initialYears?.[0]?.year;
  const initialDataHandled = useRef(false);
  const [academicYears, setAcademicYears] = useState(initialYears || []);
  const [selectedYear, setSelectedYear] = useState(
    firstYear ? String(firstYear) : "",
  );
  const [qualityOverview, setQualityOverview] = useState(
    initialOverview?.qualityOverview || emptyQualityOverview,
  );
  const [campOverview, setCampOverview] = useState(
    initialOverview?.campOverview || emptyCampOverview,
  );
  const [systemCounts, setSystemCounts] = useState(
    initialOverview
      ? {
          totalTeachers: initialOverview.totalTeachers || 0,
          totalClassrooms: initialOverview.totalClassrooms || 0,
          totalStudents: initialOverview.totalStudents || 0,
          totalCamps: initialOverview.totalCamps || 0,
        }
      : emptySystemCounts,
  );
  const [previousQuality, setPreviousQuality] = useState(null);
  const [campInsights, setCampInsights] = useState(
    initialOverview?.campInsights || [],
  );
  const [expandedCamp, setExpandedCamp] = useState(null);
  const [isLoading, setIsLoading] = useState(!initialOverview);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (initialYears) return;
    adminService
      .getAcademicYears()
      .then((years) => {
        const sortedYears = [...years].sort((a, b) => b.year - a.year);

        setAcademicYears(sortedYears);
        if (sortedYears.length > 0) {
          setSelectedYear(String(sortedYears[0].year));
        } else {
          setIsLoading(false);
        }
      })
      .catch(() => setAcademicYears([]));
  }, [initialYears]);

  useEffect(() => {
    if (!selectedYear) return;
    if (
      initialOverview &&
      selectedYear === String(firstYear) &&
      !initialDataHandled.current
    ) {
      initialDataHandled.current = true;
      let active = true;

      adminService
        .getOverviewStats(String(Number(selectedYear) - 1))
        .then((previous) => {
          if (active) setPreviousQuality(previous?.qualityOverview || null);
        });

      return () => {
        active = false;
      };
    }
    let active = true;

    async function loadQualityDashboard() {
      setIsLoading(true);
      const previousYear = String(Number(selectedYear) - 1);
      const [current, previous] = await Promise.all([
        adminService.getOverviewStats(selectedYear),
        adminService.getOverviewStats(previousYear),
      ]);

      if (!active) return;
      setQualityOverview(current?.qualityOverview || emptyQualityOverview);
      setCampOverview(current?.campOverview || emptyCampOverview);
      setSystemCounts({
        totalTeachers: current?.totalTeachers || 0,
        totalClassrooms: current?.totalClassrooms || 0,
        totalStudents: current?.totalStudents || 0,
        totalCamps: current?.totalCamps || 0,
      });
      setCampInsights(current?.campInsights || []);
      setPreviousQuality(previous?.qualityOverview || null);
      setExpandedCamp(null);
      setIsLoading(false);
    }

    loadQualityDashboard();

    return () => {
      active = false;
    };
  }, [selectedYear, firstYear, initialOverview]);

  const healthTrend = useMemo(() => {
    if (
      qualityOverview.averageHealth === null ||
      previousQuality?.averageHealth === null ||
      previousQuality?.averageHealth === undefined
    ) {
      return null;
    }

    return qualityOverview.averageHealth - previousQuality.averageHealth;
  }, [previousQuality, qualityOverview.averageHealth]);

  const formatCampDate = (date) =>
    new Date(date).toLocaleDateString("th-TH", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: BANGKOK_TIME_ZONE,
    });

  const headerActionsNode = mounted
    ? document.getElementById("admin-header-actions")
    : null;
  const headerActions = academicYears.length > 0 && (
    <Select
      disallowEmptySelection
      className="w-40 rounded-xl bg-white shadow-sm"
      label="ปีการศึกษา"
      selectedKeys={new Set([selectedYear])}
      size="sm"
      variant="bordered"
      onSelectionChange={(keys) => setSelectedYear(String(Array.from(keys)[0]))}
    >
      {academicYears.map((year) => (
        <SelectItem
          key={String(year.year)}
          textValue={String(Number(year.year) + 543)}
        >
          {Number(year.year) + 543}
        </SelectItem>
      ))}
    </Select>
  );

  if (isLoading) {
    return (
      <>
        {headerActionsNode &&
          createPortal(
            <div
              aria-hidden="true"
              className="h-10 w-40 animate-pulse rounded-xl bg-gray-200"
            />,
            headerActionsNode,
          )}
        <OverviewSkeleton />
      </>
    );
  }

  return (
    <div className="flex w-full flex-col gap-6 pt-1">
      {headerActionsNode && createPortal(headerActions, headerActionsNode)}

      <section className="relative order-1 overflow-hidden rounded-3xl bg-[#365f4f] text-white shadow-sm">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_84%_18%,#81a98c_0,transparent_26%),radial-gradient(circle_at_72%_85%,#c8ddc7_0,transparent_30%)] opacity-20" />
        <div className="relative grid gap-6 p-5 sm:p-7 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[#c8ddc7]">
              <Route size={15} /> ศูนย์จัดการค่าย
            </p>
            <h2 className="mt-2 text-xl font-bold sm:text-2xl">
              ภาพรวมการดำเนินงานค่าย
            </h2>
            <p className="mt-1 text-sm text-emerald-50/80">
              ติดตามค่ายที่กำลังจัด งานที่ต้องตั้งค่า
              และสถานะของค่ายได้จากจุดเดียว
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                className="inline-flex items-center gap-2 rounded-xl bg-white px-3.5 py-2 text-sm font-semibold text-[#365f4f] transition-colors hover:bg-[#f4efe2]"
                type="button"
                onClick={() => router.push("/admin_add_user?tab=camp")}
              >
                จัดการค่าย <ChevronRight size={16} />
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-3.5 py-2 text-sm font-semibold transition-colors hover:bg-white/20"
                type="button"
                onClick={() => router.push("/admin_add_user?tab=classroom")}
              >
                จัดการห้องเรียน <ChevronRight size={16} />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:w-[430px]">
            <div className="rounded-2xl border border-white/15 bg-white/10 p-3">
              <Tent className="text-[#c8ddc7]" size={17} />
              <p className="mt-2 text-2xl font-bold">
                {campOverview.activeCamps}
              </p>
              <p className="text-[11px] text-emerald-50/75">กำลังจัด</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 p-3">
              <CalendarDays className="text-[#c8ddc7]" size={17} />
              <p className="mt-2 text-2xl font-bold">
                {campOverview.upcomingCamps}
              </p>
              <p className="text-[11px] text-emerald-50/75">ค่ายที่รอเริ่ม</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 p-3">
              <CheckCircle2 className="text-[#c8ddc7]" size={17} />
              <p className="mt-2 text-2xl font-bold">
                {campOverview.completedCamps}
              </p>
              <p className="text-[11px] text-emerald-50/75">ค่ายที่เสร็จสิ้น</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 p-3">
              <ClipboardList className="text-[#c8ddc7]" size={17} />
              <p className="mt-2 text-2xl font-bold">
                {campOverview.campsWithoutStations}
              </p>
              <p className="text-[11px] text-emerald-50/75">ยังไม่มีฐาน</p>
            </div>
          </div>
        </div>
      </section>

      <section className="relative order-4 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-[#527363]">
              <Sparkles size={15} /> คุณภาพค่าย
            </p>
            <h2 className="mt-1.5 text-lg font-bold text-gray-800 sm:text-xl">
              ค่ายไหนควรจัดต่อ และควรปรับอะไร
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              วิเคราะห์คะแนนทุกข้อในแบบประเมินร่วมกับผลการทำภารกิจ
              ส่วนจำนวนผู้ตอบใช้บอกความน่าเชื่อถือของผล
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full bg-[#eff4f0] px-3 py-1.5 text-xs font-semibold text-[#527363]">
                ประเมินได้ {qualityOverview.evaluatedCamps} ค่าย
              </span>
              <span className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-500">
                ข้อมูลไม่พอ {qualityOverview.insufficientCount} ค่าย
              </span>
              {healthTrend !== null && (
                <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
                  เทียบปีก่อน {healthTrend > 0 ? "+" : ""}
                  {healthTrend} จุด
                </span>
              )}
            </div>
          </div>

          <div className="grid min-w-[280px] grid-cols-3 gap-2">
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 text-center">
              <p className="text-xl font-bold text-emerald-700">
                {qualityOverview.continueCount}
              </p>
              <p className="mt-1 text-[11px] text-emerald-600">ควรจัดต่อ</p>
            </div>
            <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3 text-center">
              <p className="text-xl font-bold text-amber-700">
                {qualityOverview.improveCount}
              </p>
              <p className="mt-1 text-[11px] text-amber-600">ควรปรับปรุง</p>
            </div>
            <div className="rounded-xl border border-rose-100 bg-rose-50/60 p-3 text-center">
              <p className="text-xl font-bold text-rose-700">
                {qualityOverview.reviewCount}
              </p>
              <p className="mt-1 text-[11px] text-rose-600">ควรทบทวน</p>
            </div>
          </div>
        </div>
      </section>

      <section className="order-2 grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        <Card className="rounded-3xl border border-gray-100 bg-[#f7faf7] shadow-sm xl:order-2">
          <CardBody className="p-5 sm:p-6">
            <p className="text-xs font-bold uppercase tracking-wider text-[#527363]">
              งานที่ต้องติดตาม
            </p>
            <h3 className="mt-1 text-lg font-bold text-gray-800">
              เตรียมค่ายให้พร้อมก่อนเริ่มงาน
            </h3>
            <div className="mt-5 space-y-3">
              <button
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-[#e4ede5] bg-white p-3 text-left transition-colors hover:border-[#bad0bf]"
                type="button"
                onClick={() => router.push("/admin_add_user?tab=camp")}
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e8f1e9] text-[#527363]">
                    <ClipboardList size={18} />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-gray-700">
                      ตั้งค่าฐานกิจกรรม
                    </span>
                    <span className="mt-0.5 block text-xs text-gray-400">
                      ค่ายที่ยังไม่มีฐาน
                    </span>
                  </span>
                </span>
                <span className="text-lg font-bold text-[#527363]">
                  {campOverview.campsWithoutStations}
                </span>
              </button>
              <button
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-[#e4ede5] bg-white p-3 text-left transition-colors hover:border-[#bad0bf]"
                type="button"
                onClick={() => router.push("/admin_add_user?tab=camp")}
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eaf2ed] text-[#416b5a]">
                    <CalendarDays size={18} />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-gray-700">
                      ค่ายที่กำลังจะเริ่ม
                    </span>
                    <span className="mt-0.5 block text-xs text-gray-400">
                      ตรวจสอบกำหนดการและผู้เข้าร่วม
                    </span>
                  </span>
                </span>
                <span className="text-lg font-bold text-[#416b5a]">
                  {campOverview.upcomingCamps}
                </span>
              </button>
            </div>
          </CardBody>
        </Card>

        <Card className="rounded-3xl border border-gray-100 bg-white shadow-sm xl:order-1">
          <CardBody className="p-5 sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[#527363]">
                  ค่ายที่กำลังจะมาถึง
                </p>
                <h3 className="mt-1 text-lg font-bold text-gray-800">
                  กำหนดการที่ควรทราบ
                </h3>
              </div>
              <CalendarDays className="text-[#5d7c6f]" size={22} />
            </div>
            {campOverview.focusCamps.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {campOverview.focusCamps.map((camp) => (
                  <button
                    key={camp.camp_id}
                    className="flex w-full items-center justify-between gap-3 rounded-xl px-2 py-3 text-left transition-colors hover:bg-[#f7faf8] first:pt-0 last:pb-0"
                    type="button"
                    onClick={() => router.push("/admin_add_user?tab=camp")}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-gray-800">
                        {camp.name}
                      </span>
                      <span className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
                        <CalendarDays size={13} />{" "}
                        {formatCampDate(camp.start_date)}
                        <span>·</span>
                        <MapPin size={13} />
                        <span className="truncate">{camp.location}</span>
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-base font-bold text-[#416b5a]">
                        {camp._count.student_enrollment}
                      </span>
                      <span className="block text-[11px] text-gray-400">
                        ผู้ลงทะเบียน
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="py-10 text-center text-sm text-gray-400">
                ยังไม่มีค่ายที่กำลังจะจัด
              </div>
            )}
          </CardBody>
        </Card>
      </section>

      <section className="order-3">
        <div className="mb-3">
          <h3 className="text-lg font-bold text-gray-850">สรุปข้อมูลในระบบ</h3>
          <p className="mt-1 text-sm text-gray-500">
            จำนวนข้อมูลหลักตามปีการศึกษาที่เลือก
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <OperationCard
            icon={Users}
            label="ครูทั้งหมด"
            tone="bg-violet-50 text-violet-700"
            value={systemCounts.totalTeachers}
          />
          <OperationCard
            icon={BookOpen}
            label="ห้องเรียนทั้งหมด"
            tone="bg-cyan-50 text-cyan-700"
            value={systemCounts.totalClassrooms}
          />
          <OperationCard
            icon={GraduationCap}
            label="นักเรียนทั้งหมด"
            tone="bg-blue-50 text-blue-700"
            value={systemCounts.totalStudents}
          />
          <OperationCard
            icon={Tent}
            label="ค่ายกิจกรรมทั้งหมด"
            tone="bg-orange-50 text-orange-700"
            value={systemCounts.totalCamps}
          />
        </div>
      </section>

      <section className="order-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          icon={HeartPulse}
          label="สุขภาพค่ายเฉลี่ย"
          note="คะแนนรวมจากตัวชี้วัดที่มีข้อมูล"
          tone="bg-emerald-50 text-emerald-700"
          value={qualityOverview.averageHealth}
        />
        <MetricCard
          icon={Smile}
          label="คะแนนแบบประเมิน"
          note="เฉลี่ยจากคำถามแบบสเกลทั้งหมด"
          tone="bg-amber-50 text-amber-700"
          value={qualityOverview.averageSurveyScore}
        />
        <MetricCard
          icon={Target}
          label="ทำภารกิจสำเร็จ"
          note="ผลภารกิจที่มีสถานะสำเร็จ"
          tone="bg-blue-50 text-blue-700"
          value={qualityOverview.averageMissionCompletion}
        />
        <MetricCard
          icon={MessageSquareText}
          label="การตอบแบบประเมิน"
          note="ใช้ประเมินความน่าเชื่อถือของผล"
          tone="bg-violet-50 text-violet-700"
          value={qualityOverview.averageResponseRate}
        />
      </section>

      <section className="order-6 overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-100 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-850">
              ผลวิเคราะห์รายค่าย
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              กดที่ค่ายเพื่อดูจุดเด่นและสิ่งที่นักเรียนอยากให้ปรับปรุง
            </p>
          </div>
          <button
            className="flex items-center gap-1 text-sm font-semibold text-[#527363]"
            type="button"
            onClick={() => router.push("/admin_add_user?tab=camp")}
          >
            จัดการค่าย <ChevronRight size={16} />
          </button>
        </div>

        {campInsights.length === 0 ? (
          <div className="px-6 py-16 text-center text-gray-400">
            ยังไม่มีค่ายในปีการศึกษานี้
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {campInsights.map((camp, index) => {
              const isExpanded = expandedCamp === camp.campId;

              return (
                <article key={camp.campId}>
                  <button
                    className="grid w-full gap-4 p-5 text-left transition-colors hover:bg-[#f8faf8] lg:grid-cols-[48px_minmax(190px,1fr)_110px_110px_210px_28px] lg:items-center"
                    type="button"
                    onClick={() =>
                      setExpandedCamp(isExpanded ? null : camp.campId)
                    }
                  >
                    <span className="hidden h-10 w-10 items-center justify-center rounded-xl bg-[#eff4f0] font-bold text-[#527363] lg:flex">
                      {index + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-bold text-gray-800">
                        {camp.name}
                      </span>
                      <span className="mt-1 block text-xs text-gray-400">
                        ผู้ตอบ {camp.responseCount} คน · อัตราตอบ{" "}
                        {camp.responseRate}%
                      </span>
                    </span>
                    <span>
                      <span className="block text-xs text-gray-400">
                        สุขภาพค่าย
                      </span>
                      <span className="mt-1 block text-xl font-bold text-gray-800">
                        {formatPercent(camp.healthScore)}
                      </span>
                    </span>
                    <span>
                      <span className="block text-xs text-gray-400">
                        แบบประเมิน
                      </span>
                      <span className="mt-1 block text-xl font-bold text-gray-800">
                        {formatPercent(camp.surveyScore)}
                      </span>
                    </span>
                    <span
                      className={`w-fit rounded-full border px-3 py-1.5 text-xs font-bold ${
                        recommendationStyles[camp.recommendation.key]
                      }`}
                    >
                      {camp.recommendation.label}
                    </span>
                    {isExpanded ? (
                      <ChevronUp size={18} />
                    ) : (
                      <ChevronDown size={18} />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="border-t border-gray-100 bg-[#fbfcfb] p-5 sm:p-6">
                      {!camp.dataSufficient && (
                        <div className="mb-5 flex gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                          <HelpCircle className="shrink-0" size={19} />
                          <p>
                            ยังไม่สรุปว่าควรจัดต่อหรือไม่
                            เพราะต้องมีผู้ตอบอย่างน้อย 3 คน อัตราตอบอย่างน้อย
                            30% และมีคำถามแบบสเกล
                          </p>
                        </div>
                      )}
                      <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
                        <div className="space-y-4 rounded-2xl border border-gray-100 bg-white p-4">
                          <ScoreBar
                            label="คะแนนแบบประเมินทั้งหมด"
                            value={camp.surveyScore}
                          />
                          <ScoreBar
                            label="การทำภารกิจสำเร็จ"
                            value={camp.missionCompletion}
                          />
                          <ScoreBar
                            label="อยากให้จัดอีก"
                            value={camp.recommendationScore}
                          />
                          <ScoreBar
                            label="อัตราตอบแบบประเมิน"
                            value={camp.responseRate}
                          />
                          {camp.recommendationScore === null && (
                            <p className="text-xs text-amber-600">
                              ยังไม่มีคำถามที่สื่อถึง “อยากให้จัดอีกหรือไม่”
                            </p>
                          )}
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <FeedbackList
                            emptyText="ยังไม่มีข้อความชื่นชม"
                            icon={CheckCircle2}
                            items={camp.feedback.strengths}
                            title="สิ่งที่นักเรียนชอบ"
                            tone="border-emerald-100 bg-emerald-50/50"
                          />
                          <FeedbackList
                            emptyText="ยังไม่มีข้อเสนอแนะเพิ่มเติม"
                            icon={AlertTriangle}
                            items={camp.feedback.improvements}
                            title="สิ่งที่ควรปรับปรุง"
                            tone="border-amber-100 bg-amber-50/50"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="order-7 rounded-2xl border border-[#dfe9e1] bg-[#f7faf7] p-5 text-sm text-gray-600">
        <h3 className="flex items-center gap-2 font-bold text-gray-800">
          <ClipboardCheck size={18} className="text-[#527363]" /> เกณฑ์การแนะนำ
        </h3>
        <p className="mt-2 leading-6">
          สุขภาพค่ายคำนวณจากคะแนนคำถามแบบสเกลทั้งหมดในแบบประเมิน 70%
          และการทำภารกิจสำเร็จ 30% ส่วนอัตราตอบใช้วัดความน่าเชื่อถือของข้อมูล
          ไม่ได้นำมาปั่นคะแนน — 80 คะแนนขึ้นไป “ควรจัดต่อ”, 60–79
          “จัดต่อแต่ควรปรับปรุง” และต่ำกว่า 60 “ควรทบทวน”
        </p>
      </section>
    </div>
  );
}
