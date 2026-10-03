"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardBody } from "@heroui/card";
import { Tab, Tabs } from "@heroui/tabs";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";
import {
  MapPin,
  Calendar,
  Flag,
  CheckCircle2,
  History,
  Sparkles,
  AlertCircle,
  Camera,
  Clock,
  Users,
  Bus,
  LogOut,
  RefreshCw,
  ChevronRight,
  BellRing,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "react-hot-toast";

import StudentDashboardSkeleton from "./components/StudentDashboardSkeleton";

import {
  BANGKOK_TIME_ZONE,
  getBangkokDaysUntil,
  isBangkokDateBefore,
} from "@/lib/bangkok-date";
import { boardStudentBusWithRetry } from "@/lib/student-bus-board";
import {
  STUDENT_BUS_SYNC_REQUESTED_EVENT,
  dispatchStudentBusActionCompleted,
} from "@/lib/student-bus-notification-events";
import { FoodAllergySelector } from "@/components/profile/FoodAllergySelector";

// Utility to format date (with optional range)
const formatDate = (start: string, end?: string) => {
  if (!start) return "";
  const s = new Date(start).toLocaleDateString("th-TH", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: BANGKOK_TIME_ZONE,
  });

  if (!end || start === end) return s;
  const e = new Date(end).toLocaleDateString("th-TH", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: BANGKOK_TIME_ZONE,
  });

  return `${s} - ${e}`;
};

const formatBusCheckedAt = (value?: string | null) => {
  if (!value) return "";

  return new Date(value).toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: BANGKOK_TIME_ZONE,
  });
};

const getBusSeatSideLabel = (label: string, seatIndex?: number | null) => {
  const seatLetter = label.trim().charAt(0).toUpperCase();

  if (seatLetter === "A" || seatLetter === "D") return "ติดหน้าต่าง";
  if (seatLetter === "B" || seatLetter === "C") return "ทางเดิน";

  return seatIndex === 0 || seatIndex === 3 ? "ติดหน้าต่าง" : "ทางเดิน";
};

const formatBusSeat = (assignment: any) => {
  const position = assignment?.student?.position;

  if (!position) return "ยังไม่ได้จัด";

  const floorLabel =
    assignment.bus?.floorCount > 1 && position.floorNumber
      ? `${
          position.floorNumber === 1
            ? "ชั้นล่าง"
            : position.floorNumber === 2
              ? "ชั้นบน"
              : `ชั้น ${position.floorNumber}`
        } · `
      : "";

  if (assignment.bus?.layoutTemplateId) {
    return `${floorLabel}${position.label}`;
  }

  return `${floorLabel}${position.label} · ${getBusSeatSideLabel(position.label, position.seatIndex)}`;
};

export default function StudentDashboard({
  initialCamps,
  initialStudent,
  initialBusAssignments,
  initialDataLoaded,
}: {
  initialCamps: any[];
  initialStudent: any;
  initialBusAssignments: any[];
  initialDataLoaded: boolean;
}) {
  const router = useRouter();
  const hasInitialDataRef = useRef(initialDataLoaded);
  const [camps, setCamps] = useState(initialCamps);
  const [loading, setLoading] = useState(!initialDataLoaded);
  const [student, setStudent] = useState<any>(initialStudent);
  const [busAssignments, setBusAssignments] = useState<any[]>(
    initialBusAssignments,
  );
  const [refreshingBus, setRefreshingBus] = useState(false);
  const [busRefreshCooldown, setBusRefreshCooldown] = useState(0);
  const [boardingCampId, setBoardingCampId] = useState<number | null>(null);
  const [alightingCampId, setAlightingCampId] = useState<number | null>(null);
  const [pendingBoardingAssignment, setPendingBoardingAssignment] =
    useState<any>(null);
  const [navigatingTo, setNavigatingTo] = useState<number | null>(null);
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [showProfileModal, setShowProfileModal] = useState(
    Boolean(initialStudent && !initialStudent.nickname?.trim()),
  );
  const [profileData, setProfileData] = useState({
    nickname: initialStudent?.nickname || "",
    food_allergy: initialStudent?.food_allergy || "",
    profile_image_url: (initialStudent?.profile_image_url || null) as
      | string
      | null,
  });
  const needsFastBusPolling = busAssignments.some(
    (assignment) =>
      assignment.configured &&
      assignment.student?.participationStatus === "ACTIVE" &&
      Boolean(assignment.student?.reminder),
  );

  useEffect(() => {
    if (busRefreshCooldown <= 0) return;

    const timer = window.setInterval(() => {
      setBusRefreshCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [busRefreshCooldown]);

  const goToCamp = (campId: number) => {
    if (navigatingTo !== null) return;
    setNavigatingTo(campId);
    router.push(`/student/dashboard/camp/${campId}`);
  };

  const goToBus = (campId: number) => {
    if (
      navigatingTo !== null ||
      boardingCampId !== null ||
      alightingCampId !== null
    )
      return;
    setNavigatingTo(campId);
    router.push(`/student/dashboard/camp/${campId}/bus`);
  };

  const refreshBusAssignments = useCallback(async () => {
    try {
      const response = await fetch("/api/student/bus", { cache: "no-store" });

      if (!response.ok) return;

      const busData = await response.json();

      setBusAssignments(
        Array.isArray(busData.assignments) ? busData.assignments : [],
      );
    } catch {
      // background polling fails silently
    }
  }, []);

  const handleManualRefreshBus = async () => {
    if (refreshingBus || busRefreshCooldown > 0) return;

    setRefreshingBus(true);

    try {
      const response = await fetch("/api/student/bus?manual=1", {
        cache: "no-store",
      });

      if (!response.ok) {
        if (response.status === 429) {
          const errData = await response.json().catch(() => ({}));

          throw new Error(errData.error || "คุณรีเฟรชถี่เกินไป กรุณารอสักครู่");
        }
        throw new Error("โหลดสถานะรถไม่สำเร็จ");
      }

      const busData = await response.json();

      setBusAssignments(
        Array.isArray(busData.assignments) ? busData.assignments : [],
      );

      toast.success("อัปเดตสถานะรถแล้ว");
    } catch (error: any) {
      toast.error(error.message || "ไม่สามารถอัปเดตสถานะรถได้");
    } finally {
      setRefreshingBus(false);
      setBusRefreshCooldown(5);
    }
  };

  const confirmBusBoarding = async (assignment: any) => {
    if (
      boardingCampId !== null ||
      alightingCampId !== null ||
      navigatingTo !== null
    )
      return;

    setBoardingCampId(assignment.campId);

    try {
      const result = await boardStudentBusWithRetry(assignment.campId);

      setBusAssignments((current) =>
        current.map((item) =>
          item.campId === assignment.campId
            ? {
                ...item,
                student: {
                  ...item.student,
                  status: "ON_BUS",
                  isOnBus: true,
                  lastBoardedAt: result.checkedAt || new Date().toISOString(),
                  reminder: null,
                },
              }
            : item,
        ),
      );
      setPendingBoardingAssignment(null);
      dispatchStudentBusActionCompleted(assignment.campId, "board");
      toast.success(result.message || "เช็คชื่อขึ้นรถสำเร็จ");
    } catch (error: any) {
      toast.error(error.message || "เชื่อมต่อระบบไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setBoardingCampId(null);
    }
  };

  const requestBusBoarding = (assignment: any) => {
    if (
      boardingCampId !== null ||
      alightingCampId !== null ||
      navigatingTo !== null
    )
      return;
    setPendingBoardingAssignment(assignment);
  };

  const confirmBusAlighting = async (assignment: any) => {
    if (
      alightingCampId !== null ||
      boardingCampId !== null ||
      navigatingTo !== null ||
      assignment.bus?.status === "TRAVELING"
    )
      return;

    setAlightingCampId(assignment.campId);

    try {
      const response = await fetch(
        `/api/student/camps/${assignment.campId}/bus/alight`,
        { method: "POST" },
      );
      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || "บันทึกลงจากรถไม่สำเร็จ");

        return;
      }

      setBusAssignments((current) =>
        current.map((item) =>
          item.campId === assignment.campId
            ? {
                ...item,
                student: {
                  ...item.student,
                  status: "OFF_BUS",
                  isOnBus: false,
                  reminder: null,
                },
              }
            : item,
        ),
      );
      dispatchStudentBusActionCompleted(assignment.campId, "alight");
      toast.success(result.message || "บันทึกว่าลงจากรถแล้ว");
    } catch {
      toast.error("เชื่อมต่อระบบไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setAlightingCampId(null);
    }
  };

  useEffect(() => {
    window.scrollTo(0, 0);
    if (hasInitialDataRef.current) {
      hasInitialDataRef.current = false;

      return;
    }

    async function fetchData() {
      try {
        // /api/auth/student/me คืนข้อมูลนักเรียน + classroom ครบ
        // ใช้เป็น source เดียว แทนการ fetch /api/student/profile แยก
        const [campsRes, studentRes, busRes] = await Promise.all([
          fetch("/api/student/camps"),
          fetch("/api/auth/student/me"),
          fetch("/api/student/bus", { cache: "no-store" }),
        ]);

        if (campsRes.ok) {
          setCamps(await campsRes.json());
        }
        if (studentRes.ok) {
          const studentData = await studentRes.json();

          setStudent(studentData);

          // ใช้ข้อมูลเดิมสำหรับ profile modal — ไม่ต้อง fetch ซ้ำ
          if (!studentData.nickname?.trim()) {
            setProfileData({
              nickname: studentData.nickname || "",
              food_allergy: studentData.food_allergy || "",
              profile_image_url: studentData.profile_image_url || null,
            });
            setShowProfileModal(true);
          }
        }
        if (busRes.ok) {
          const busData = await busRes.json();

          setBusAssignments(
            Array.isArray(busData.assignments) ? busData.assignments : [],
          );
        }
      } catch (error) {
        console.error("Failed to fetch data", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  useEffect(() => {
    // ป้องกัน request ซ้อน — ถ้า request ก่อนหน้ายังไม่เสร็จ ให้ข้ามรอบนี้ไป
    let isPolling = false;

    const poll = async () => {
      if (isPolling || document.visibilityState !== "visible") return;
      isPolling = true;
      try {
        await refreshBusAssignments();
      } finally {
        isPolling = false;
      }
    };

    const timer = window.setInterval(
      poll,
      needsFastBusPolling ? 15_000 : 60_000,
    );

    // fetch ทันทีเมื่อ user กลับมาที่ tab (แทนที่จะรอ interval ถัดไป)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void poll();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener(STUDENT_BUS_SYNC_REQUESTED_EVENT, poll);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener(STUDENT_BUS_SYNC_REQUESTED_EVENT, poll);
    };
  }, [needsFastBusPolling, refreshBusAssignments]);

  const onProfileSaved = () => {
    setShowProfileModal(false);
  };

  const currentDate = new Date();
  const availableCamps = camps
    .filter((c: any) => !c.isRegistered && !c.hasEnrollment && !c.isEnded)
    .sort((a: any, b: any) => {
      const aIsUpcoming = a.startRegisDate
        ? isBangkokDateBefore(currentDate, a.startRegisDate)
        : false;
      const bIsUpcoming = b.startRegisDate
        ? isBangkokDateBefore(currentDate, b.startRegisDate)
        : false;

      if (aIsUpcoming && !bIsUpcoming) return 1;
      if (!aIsUpcoming && bIsUpcoming) return -1;

      return 0;
    });
  const myCamps = camps.filter(
    (c: any) => (c.isRegistered || c.hasEnrollment) && !c.isEnded,
  );
  let endedCamps = camps.filter(
    (c: any) => c.isEnded && (c.isRegistered || c.hasEnrollment || c.hasSurvey),
  );

  if (selectedYear !== "all") {
    endedCamps = endedCamps.filter(
      (c: any) => c.academicYear?.toString() === selectedYear,
    );
  }

  const defaultCampTab = availableCamps.length > 0 ? "available" : "mycamps";

  const uniqueYears = Array.from(
    new Set(camps.map((c: any) => c.academicYear).filter(Boolean)),
  ).sort((a: any, b: any) => b - a);

  if (loading) return <StudentDashboardSkeleton />;

  return (
    <div className="min-h-screen bg-[#f5f5f2]">
      {/* Profile Completion Overlay */}
      {showProfileModal && (
        <StudentProfileSetupModal
          initialData={profileData}
          onSaved={onProfileSaved}
        />
      )}

      <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-8">
        {/* Greeting Card */}
        <div className="relative bg-gradient-to-br from-[#5d7c6f] via-[#4d6a5f] to-[#365045] rounded-3xl p-6 sm:p-8 text-white shadow-lg overflow-hidden">
          {/* Decorative shapes */}
          <div className="absolute -top-24 -right-24 w-72 h-72 bg-white/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 w-56 h-56 bg-black/15 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner shrink-0">
                  <Sparkles className="text-white animate-pulse" size={24} />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">
                    สวัสดีน้อง{student?.nickname || student?.firstname || "ๆ"}
                  </h1>
                  <p className="text-white/85 text-xs sm:text-sm font-normal flex items-center gap-1.5 mt-0.5">
                    ยินดีต้อนรับเข้าสู่ระบบค่าย KKS Camp
                  </p>
                </div>
              </div>

              {/* Student Info Badges */}
              {student && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <div className="bg-white/15 backdrop-blur-md border border-white/20 px-3 py-1.5 rounded-xl flex items-center gap-2 shadow-sm text-xs sm:text-sm">
                    <History className="text-white/80" size={13} />
                    <span className="text-white/80 text-xs">รหัสนักเรียน:</span>
                    <span className="font-semibold">{student.students_id}</span>
                  </div>

                  {student.classroom?.grade_label && (
                    <div className="bg-white/15 backdrop-blur-md border border-white/20 px-3 py-1.5 rounded-xl flex items-center gap-2 shadow-sm text-xs sm:text-sm font-semibold">
                      <Flag className="text-white/80" size={13} />
                      <span>
                        {student.classroom.grade_label}/
                        {student.classroom.class_name}
                      </span>
                    </div>
                  )}

                  {student.classroom?.homeroom_teacher && (
                    <div className="bg-white/15 backdrop-blur-md border border-white/20 px-3 py-1.5 rounded-xl flex items-center gap-2 shadow-sm text-xs sm:text-sm">
                      <Users className="text-white/80" size={13} />
                      <span>ครู{student.classroom.homeroom_teacher}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Quick Status Stats on Desktop */}
            <div className="hidden lg:flex items-center gap-3 bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-4 shrink-0">
              <div className="text-center px-3 border-r border-white/20">
                <p className="text-2xl font-bold">{myCamps.length}</p>
                <p className="text-[11px] text-white/80">ค่ายของฉัน</p>
              </div>
              <div className="text-center px-3 border-r border-white/20">
                <p className="text-2xl font-bold">{availableCamps.length}</p>
                <p className="text-[11px] text-white/80">เปิดรับสมัคร</p>
              </div>
              <div className="text-center px-3">
                <p className="text-2xl font-bold">{endedCamps.length}</p>
                <p className="text-[11px] text-white/80">ประวัติค่าย</p>
              </div>
            </div>
          </div>
        </div>

        {/* Transportation Section */}
        {busAssignments.length > 0 && (
          <section
            aria-labelledby="student-transport-heading"
            className="space-y-3"
          >
            <div className="flex items-center justify-between gap-2 px-1">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#e8f0ee] text-[#3d6357]">
                  <Bus size={18} />
                </div>
                <div>
                  <h2
                    className="text-base font-semibold text-gray-900"
                    id="student-transport-heading"
                  >
                    การเดินทางของฉัน
                  </h2>
                  <p className="text-xs text-gray-500">
                    ตรวจสอบสถานะรถและที่นั่ง พร้อมยืนยันขึ้นรถ/ลงจากรถ
                  </p>
                </div>
              </div>
              <button
                aria-label={
                  busRefreshCooldown > 0
                    ? `กรุณารอ ${busRefreshCooldown} วินาที`
                    : "รีเฟรชสถานะรถ"
                }
                className={`flex h-9 items-center justify-center rounded-xl text-[#3d6357] transition hover:bg-[#e8f0ee] disabled:cursor-not-allowed disabled:opacity-60 ${
                  busRefreshCooldown > 0 ? "px-2.5 gap-1.5" : "w-9 shrink-0"
                }`}
                disabled={refreshingBus || busRefreshCooldown > 0}
                title={
                  busRefreshCooldown > 0
                    ? `กรุณารอ ${busRefreshCooldown} วินาทีก่อนรีเฟรชใหม่`
                    : "รีเฟรชสถานะรถ"
                }
                type="button"
                onClick={() => void handleManualRefreshBus()}
              >
                <RefreshCw
                  className={refreshingBus ? "animate-spin" : undefined}
                  size={16}
                />
                {busRefreshCooldown > 0 && (
                  <span className="text-xs font-semibold tabular-nums">
                    {busRefreshCooldown}s
                  </span>
                )}
              </button>
            </div>

            <div
              className={`grid gap-4 ${
                busAssignments.length === 1
                  ? "grid-cols-1"
                  : "grid-cols-1 md:grid-cols-2"
              }`}
            >
              {busAssignments.map((assignment: any) => {
                const isOnBus = Boolean(assignment.student?.isOnBus);
                const isParticipating =
                  assignment.student?.participationStatus !== "NOT_TRAVELING";
                const isTraveling = assignment.bus?.status === "TRAVELING";
                const position = assignment.student?.position;
                const reminder = assignment.student?.reminder;
                const busStatusLabel = !assignment.configured
                  ? "รอจัดรถ"
                  : isTraveling
                    ? "กำลังเดินทาง"
                    : "รถจอด";
                const studentStatusLabel = !assignment.configured
                  ? "ยังไม่ได้จัดรถ"
                  : !isParticipating
                    ? "ไม่ร่วมเดินทางต่อในค่ายนี้"
                    : isOnBus
                      ? `อยู่บนรถแล้ว${assignment.student.lastBoardedAt ? ` · ${formatBusCheckedAt(assignment.student.lastBoardedAt)} น.` : ""}`
                      : position
                        ? "พร้อมเช็กชื่อ"
                        : "รอจัดที่นั่ง";

                return (
                  <div
                    key={assignment.campId}
                    className="w-full rounded-2xl border border-gray-200/80 bg-white p-5 text-left shadow-xs hover:border-[#5d7c6f]/40 hover:shadow-md transition-all cursor-pointer group"
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (
                        boardingCampId === null &&
                        alightingCampId === null &&
                        navigatingTo === null
                      ) {
                        goToBus(assignment.campId);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        goToBus(assignment.campId);
                      }
                    }}
                  >
                    {/* Top Row: Camp & Bus Info + Status Badges */}
                    <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-gray-100">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-[#5d7c6f]">
                          {assignment.campName}
                        </p>
                        <h3 className="truncate text-base sm:text-lg font-bold text-gray-900 mt-0.5 group-hover:text-[#5d7c6f] transition-colors flex items-center gap-1.5">
                          <span>
                            {assignment.configured
                              ? assignment.bus.name
                              : "รอข้อมูลรถจากครู"}
                          </span>
                          <ChevronRight
                            className="opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-[#5d7c6f] shrink-0"
                            size={16}
                          />
                        </h3>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            isTraveling
                              ? "bg-amber-100 text-amber-800"
                              : assignment.configured
                                ? "bg-gray-100 text-gray-700"
                                : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {busStatusLabel}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            isOnBus
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {studentStatusLabel}
                        </span>
                      </div>
                    </div>

                    {reminder && !isTraveling && (
                      <div
                        aria-live="polite"
                        className={`mt-3 flex items-start gap-2.5 rounded-xl border px-3 py-2.5 ${
                          reminder.action === "alight"
                            ? "border-amber-200 bg-amber-50 text-amber-900"
                            : "border-[#b8d0c8] bg-[#edf6f1] text-[#285343]"
                        }`}
                      >
                        <BellRing className="mt-0.5 shrink-0" size={16} />
                        <div className="min-w-0">
                          <p className="text-xs font-bold">
                            ครูประจำรถแจ้งเตือน
                          </p>
                          <p className="mt-0.5 text-xs leading-relaxed opacity-80">
                            {reminder.message}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Bottom Row: Seat Info + Primary Action Button */}
                    <div className="pt-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3.5">
                      {/* Left: Seat Details */}
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-[#e8f0ee] text-[#3d6357] flex items-center justify-center shrink-0">
                          <Bus size={16} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold text-gray-400">
                            ที่นั่งของคุณ
                          </p>
                          <p className="text-xs sm:text-sm font-bold text-gray-800 truncate">
                            {assignment.configured
                              ? position
                                ? formatBusSeat(assignment)
                                : "ยังไม่ได้จัดที่นั่ง"
                              : "กรุณาติดต่อครูผู้ดูแล"}
                          </p>
                        </div>
                      </div>

                      {/* Right: Board / Alight Button */}
                      {!isOnBus &&
                      isParticipating &&
                      assignment.configured &&
                      !isTraveling &&
                      position ? (
                        <button
                          aria-label={`ยืนยันขึ้นรถ ${assignment.bus.name}`}
                          className="inline-flex items-center justify-center gap-1.5 h-10 px-5 rounded-xl bg-[#5d7c6f] text-xs sm:text-sm font-bold text-white shadow-xs hover:bg-[#4f6d61] active:scale-95 transition-all disabled:cursor-wait disabled:opacity-60 shrink-0"
                          disabled={
                            boardingCampId !== null ||
                            alightingCampId !== null ||
                            navigatingTo !== null
                          }
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            requestBusBoarding(assignment);
                          }}
                        >
                          <CheckCircle2 size={15} />
                          <span>
                            {boardingCampId === assignment.campId
                              ? "กำลังยืนยัน..."
                              : "ยืนยันขึ้นรถ"}
                          </span>
                        </button>
                      ) : isOnBus && assignment.configured && !isTraveling ? (
                        <button
                          aria-label={`ลงจากรถ ${assignment.bus.name}`}
                          className="inline-flex items-center justify-center gap-1.5 h-10 px-5 rounded-xl bg-amber-100 text-xs sm:text-sm font-bold text-amber-900 shadow-xs hover:bg-amber-200 active:scale-95 transition-all disabled:cursor-not-allowed disabled:opacity-60 shrink-0"
                          disabled={
                            isTraveling ||
                            alightingCampId !== null ||
                            boardingCampId !== null ||
                            navigatingTo !== null
                          }
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void confirmBusAlighting(assignment);
                          }}
                        >
                          <LogOut size={15} />
                          <span>
                            {alightingCampId === assignment.campId
                              ? "กำลังลง..."
                              : "ลงจากรถ"}
                          </span>
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <Modal
          isDismissable={boardingCampId === null}
          isOpen={pendingBoardingAssignment !== null}
          placement="center"
          size="sm"
          onOpenChange={(open) => {
            if (!open && boardingCampId === null) {
              setPendingBoardingAssignment(null);
            }
          }}
        >
          <ModalContent>
            <ModalHeader className="text-base font-semibold text-gray-900">
              ยืนยันขึ้นรถ
            </ModalHeader>
            <ModalBody className="gap-3">
              {pendingBoardingAssignment && (
                <>
                  <div className="rounded-2xl bg-[#f1f7f4] p-4">
                    <p className="text-xs text-[#5d7c6f]">
                      {pendingBoardingAssignment.campName}
                    </p>
                    <p className="mt-1 text-base font-medium text-gray-900">
                      {pendingBoardingAssignment.bus.name}
                    </p>
                    <p className="mt-2 text-sm text-gray-600">
                      ที่นั่ง {formatBusSeat(pendingBoardingAssignment)}
                    </p>
                  </div>
                  <p className="text-xs leading-relaxed text-gray-500">
                    เมื่อกดยืนยัน ระบบจะบันทึกว่าคุณอยู่บนรถคันนี้
                  </p>
                </>
              )}
            </ModalBody>
            <ModalFooter className="gap-2">
              <button
                className="min-h-10 flex-1 rounded-xl px-3 text-sm font-medium text-gray-600 transition hover:bg-gray-100 disabled:opacity-60"
                disabled={boardingCampId !== null}
                type="button"
                onClick={() => setPendingBoardingAssignment(null)}
              >
                ยกเลิก
              </button>
              <button
                className="min-h-10 flex-1 rounded-xl bg-[#5d7c6f] px-3 text-sm font-semibold text-white transition hover:bg-[#4f6d61] disabled:cursor-wait disabled:opacity-60"
                disabled={boardingCampId !== null}
                type="button"
                onClick={() => {
                  if (pendingBoardingAssignment) {
                    void confirmBusBoarding(pendingBoardingAssignment);
                  }
                }}
              >
                {boardingCampId !== null ? "กำลังยืนยัน..." : "ยืนยันขึ้นรถ"}
              </button>
            </ModalFooter>
          </ModalContent>
        </Modal>

        {/* Camp Tabs Section */}
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
            defaultSelectedKey={defaultCampTab}
            variant="underlined"
          >
            {/* ----- Tab 1: Available ----- */}
            <Tab
              key="available"
              title={
                <div className="flex items-center gap-2 whitespace-nowrap">
                  <span>ค่ายที่เปิดรับสมัคร</span>
                  {availableCamps.length > 0 && (
                    <span className="bg-[#e8f0ee] text-[#3d6357] text-xs font-semibold px-2 py-0.5 rounded-full">
                      {availableCamps.length}
                    </span>
                  )}
                </div>
              }
            >
              <div className="pt-4">
                {availableCamps.length === 0 ? (
                  <div className="text-center bg-white rounded-3xl border border-gray-100 p-12 shadow-sm">
                    <Flag className="mx-auto mb-3 text-gray-300" size={40} />
                    <h3 className="text-base font-semibold text-gray-700">
                      ไม่มีค่ายที่เปิดรับสมัครในขณะนี้
                    </h3>
                    <p className="text-xs text-gray-400 mt-1">
                      โปรดติดตามประกาศค่ายใหม่จากทางโรงเรียน
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {availableCamps.map((camp: any, index: number) => (
                      <CampCard
                        key={camp.id}
                        camp={camp}
                        navigatingTo={navigatingTo}
                        priority={index === 0 && defaultCampTab === "available"}
                        onPress={() => goToCamp(camp.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </Tab>

            {/* ----- Tab 2: My Camps ----- */}
            <Tab
              key="mycamps"
              title={
                <div className="flex items-center gap-2 whitespace-nowrap">
                  <span>ค่ายของฉัน</span>
                  {myCamps.length > 0 && (
                    <span className="bg-[#e8f0ee] text-[#3d6357] text-xs font-semibold px-2 py-0.5 rounded-full">
                      {myCamps.length}
                    </span>
                  )}
                </div>
              }
            >
              <div className="pt-4">
                {myCamps.length === 0 ? (
                  <div className="text-center bg-white rounded-3xl border border-gray-100 p-12 shadow-sm">
                    <Flag className="mx-auto mb-3 text-gray-300" size={40} />
                    <h3 className="text-base font-semibold text-gray-700">
                      คุณยังไม่ได้ลงทะเบียนค่ายใดๆ
                    </h3>
                    <p className="text-xs text-gray-400 mt-1">
                      เลือกดูค่ายที่สนใจในแท็บ &quot;ค่ายที่เปิดรับสมัคร&quot;
                      ได้เลย
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {myCamps.map((camp: any, index: number) => (
                      <CampCard
                        key={camp.id}
                        camp={camp}
                        navigatingTo={navigatingTo}
                        priority={index === 0 && defaultCampTab === "mycamps"}
                        onPress={() => goToCamp(camp.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </Tab>

            {/* ----- Tab 3: Ended ----- */}
            <Tab
              key="ended"
              title={
                <div className="flex items-center gap-2 whitespace-nowrap">
                  <span>ประวัติค่าย</span>
                  {endedCamps.length > 0 && (
                    <span className="bg-gray-100 text-gray-500 text-xs font-semibold px-2 py-0.5 rounded-full">
                      {endedCamps.length}
                    </span>
                  )}
                </div>
              }
            >
              <div className="pt-4 space-y-4">
                {uniqueYears.length > 0 && (
                  <div className="flex flex-wrap gap-2 pb-1">
                    <button
                      className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border ${
                        selectedYear === "all"
                          ? "bg-[#5d7c6f] text-white border-[#5d7c6f] shadow-sm"
                          : "bg-white text-gray-600 border-gray-200 hover:border-[#5d7c6f]/50 hover:text-[#5d7c6f]"
                      }`}
                      onClick={() => setSelectedYear("all")}
                    >
                      ทั้งหมด
                    </button>
                    {uniqueYears.map((year: any) => (
                      <button
                        key={year}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border ${
                          selectedYear === year.toString()
                            ? "bg-[#5d7c6f] text-white border-[#5d7c6f] shadow-sm"
                            : "bg-white text-gray-600 border-gray-200 hover:border-[#5d7c6f]/50 hover:text-[#5d7c6f]"
                        }`}
                        onClick={() => setSelectedYear(year.toString())}
                      >
                        ปี {(year + 543).toString()}
                      </button>
                    ))}
                  </div>
                )}

                {endedCamps.length === 0 ? (
                  <div className="text-center bg-white rounded-3xl border border-gray-100 p-12 shadow-sm">
                    <History className="mx-auto mb-3 text-gray-300" size={40} />
                    <h3 className="text-base font-semibold text-gray-700">
                      {selectedYear === "all"
                        ? "ยังไม่มีประวัติค่ายที่เข้าร่วม"
                        : `ไม่มีค่ายในปีการศึกษา ${(parseInt(selectedYear) + 543).toString()}`}
                    </h3>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
          </Tabs>
        </div>
      </div>
    </div>
  );
}

// ─── CampCard Component ──────────────────────────────────────────
function CampCard({
  camp,
  navigatingTo,
  onPress,
  isEnded = false,
  priority = false,
}: any) {
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
      countdownText = "เปิดรับสมัครวันนี้";
    }
  }

  return (
    <Card
      className={`border border-gray-200/70 shadow-sm hover:shadow-xl transition-all duration-300 bg-white rounded-2xl overflow-hidden group flex flex-col h-full ${
        navigatingTo === camp.id
          ? "scale-[0.98] opacity-60"
          : "hover:-translate-y-1"
      } ${
        isEnded ? "grayscale-[0.35] opacity-90" : ""
      } ${isUpcomingRegis ? "cursor-not-allowed" : ""}`}
      isPressable={navigatingTo === null && !isUpcomingRegis}
      onPress={isUpcomingRegis ? undefined : onPress}
    >
      {isUpcomingRegis && (
        <div className="absolute inset-0 z-20 bg-gray-900/65 backdrop-blur-[3px] flex flex-col items-center justify-center text-white p-6 text-center">
          <div className="w-12 h-12 bg-white/15 backdrop-blur-md rounded-full flex items-center justify-center mb-3 ring-1 ring-white/30">
            <Clock className="text-white animate-pulse" size={24} />
          </div>
          <h3 className="font-semibold text-lg mb-1 tracking-tight">
            ยังไม่เปิดรับสมัคร
          </h3>
          <p className="text-xs font-normal text-white/80">{countdownText}</p>
        </div>
      )}

      {navigatingTo === camp.id && (
        <div className="absolute inset-0 flex items-center justify-center z-30 bg-white/50 backdrop-blur-sm">
          <div className="w-9 h-9 border-3 border-[#5d7c6f] border-t-transparent rounded-full animate-spin shadow-lg" />
        </div>
      )}

      {/* Cover Image */}
      <div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden bg-gray-100">
        {camp.img_camp_url ? (
          <Image
            fill
            alt={camp.title}
            className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${isEnded ? "opacity-80" : ""}`}
            fetchPriority={priority ? "high" : "auto"}
            priority={priority}
            sizes="(max-width: 767px) 100vw, (max-width: 1023px) 50vw, 33vw"
            src={camp.img_camp_url}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
            <Flag className="text-[#5d7c6f]/30" size={40} />
          </div>
        )}

        {/* Status Chip Overlay on top right */}
        <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5 z-10">
          {isEnded ? (
            <span className="inline-flex items-center gap-1 bg-black/60 backdrop-blur-md text-white text-[10px] font-semibold px-2.5 py-1 rounded-full shadow-sm">
              ค่ายจบแล้ว
            </span>
          ) : camp.isRegistered ? (
            <span className="inline-flex items-center gap-1 bg-emerald-700/90 backdrop-blur-md text-white text-[10px] font-semibold px-2.5 py-1 rounded-full shadow-sm">
              <CheckCircle2 size={12} /> ลงทะเบียนแล้ว
            </span>
          ) : isUpcomingRegis ? (
            <span className="inline-flex items-center gap-1 bg-amber-700/90 backdrop-blur-md text-white text-[10px] font-semibold px-2.5 py-1 rounded-full shadow-sm">
              <Clock size={12} /> {countdownText}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 bg-[#5d7c6f]/90 backdrop-blur-md text-white text-[10px] font-semibold px-2.5 py-1 rounded-full shadow-sm">
              เปิดรับสมัคร
            </span>
          )}
        </div>
      </div>

      {/* Card Content */}
      <CardBody className="flex flex-1 flex-col justify-between gap-3 p-4 sm:p-5">
        <div className="space-y-2">
          <h3 className="font-bold text-base text-gray-800 line-clamp-2 leading-snug group-hover:text-[#5d7c6f] transition-colors min-h-[2.75rem]">
            {camp.title}
          </h3>

          <div className="space-y-1.5 pt-1 text-xs text-gray-600">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-[#5d7c6f]/10 flex items-center justify-center shrink-0">
                <MapPin className="text-[#5d7c6f]" size={12} />
              </div>
              <span className="truncate font-normal">
                {camp.location || "ไม่ระบุสถานที่"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-[#5d7c6f]/10 flex items-center justify-center shrink-0">
                <Calendar className="text-[#5d7c6f]" size={12} />
              </div>
              <span className="truncate font-normal">
                {formatDate(camp.rawStartDate, camp.rawEndDate)}
              </span>
            </div>
          </div>
        </div>

        <div className="pt-2 mt-auto">
          <div className="w-full bg-[#5d7c6f] text-white font-medium py-2.5 px-4 rounded-xl flex items-center justify-center gap-1.5 shadow-sm group-hover:bg-[#4d695e] transition-all text-xs sm:text-sm">
            <span>{isEnded ? "ดูย้อนหลัง" : "ดูรายละเอียดค่าย"}</span>
            {isEnded ? <History size={14} /> : <ChevronRight size={14} />}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

// ─── StudentProfileSetupModal ──────────────────────────────────────
function StudentProfileSetupModal({
  initialData,
  onSaved,
}: {
  initialData: any;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(initialData);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [pendingImageUrl, setPendingImageUrl] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState("");
  const [success, setSuccess] = useState(false);
  const submitInFlightRef = useRef(false);

  const validate = () => {
    const errors: Record<string, string> = {};

    if (!form.nickname?.trim())
      errors.nickname = "กรุณากรอกชื่อเล่นก่อนดำเนินการต่อ";
    if (!form.food_allergy?.trim())
      errors.food_allergy = "กรุณาเลือกข้อมูลการแพ้อาหาร หรือเลือกไม่แพ้อาหาร";

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
      const res = await fetch("/api/student/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: form.nickname?.trim() || null,
          food_allergy: form.food_allergy.trim(),
          profile_image_url: pendingImageUrl || form.profile_image_url || null,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setApiError(data.error || "เกิดข้อผิดพลาด");

        return;
      }
      if (previewImage) URL.revokeObjectURL(previewImage);
      setSuccess(true);
      setTimeout(() => onSaved(), 1200);
    } catch {
      setApiError("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      submitInFlightRef.current = false;
      setSaving(false);
    }
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setApiError("กรุณาเลือกไฟล์รูปภาพเท่านั้น");

      return;
    }

    const objectUrl = URL.createObjectURL(file);

    setPreviewImage(objectUrl);
    setApiError("");
    setUploadingImage(true);
    setUploadProgress(0);

    try {
      const { uploadStudentProfileImage } = await import(
        "@/lib/student-profile-upload"
      );
      const uploaded = await uploadStudentProfileImage(file, (p) => {
        setUploadProgress(p);
      });

      setPendingImageUrl(uploaded.url);
      setUploadProgress(100);
    } catch (error: any) {
      const { getFriendlyUploadErrorMessage } = await import(
        "@/lib/student-profile-upload"
      );

      URL.revokeObjectURL(objectUrl);
      setPreviewImage(null);
      setApiError(getFriendlyUploadErrorMessage(error));
    } finally {
      setUploadingImage(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden my-auto">
        <div className="bg-[#5d7c6f] px-6 pt-8 pb-6 text-white text-center">
          <div className="flex flex-col items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
              <Sparkles className="text-white" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-semibold">มาทำความรู้จักกันอีกนิด</h2>
            </div>
          </div>
        </div>

        <div className="px-6 py-5">
          {success ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center">
                <CheckCircle2 className="text-[#5d7c6f]" size={32} />
              </div>
              <p className="font-medium text-gray-800 text-lg">
                บันทึกข้อมูลสำเร็จ!
              </p>
              <p className="text-sm text-gray-500">
                ยินดีที่ได้รู้จักนะ กำลังพาเข้าสู่ระบบ...
              </p>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label
                  className="block text-sm font-medium text-gray-700 mb-1"
                  htmlFor="student-profile-image"
                >
                  รูปโปรไฟล์{" "}
                  <span className="text-xs text-gray-400">(ถ้ามี)</span>
                </label>
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-full overflow-hidden bg-[#5d7c6f]/10 border border-gray-200 flex items-center justify-center text-[#5d7c6f] relative shrink-0">
                    {previewImage || form.profile_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        alt="ตัวอย่างรูปโปรไฟล์"
                        className="w-full h-full object-cover"
                        src={previewImage || form.profile_image_url}
                      />
                    ) : (
                      <Camera size={22} />
                    )}

                    {uploadingImage && (
                      <div className="absolute inset-0 bg-black/65 backdrop-blur-xs flex flex-col items-center justify-center text-white z-10">
                        <span className="text-xs font-bold font-mono text-emerald-300">
                          {uploadProgress}%
                        </span>
                      </div>
                    )}
                  </div>
                  <label className="cursor-pointer px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2">
                    {uploadingImage ? (
                      <span className="flex items-center gap-1.5 font-medium text-[#5d7c6f]">
                        <div className="w-3.5 h-3.5 border-2 border-[#5d7c6f] border-t-transparent rounded-full animate-spin" />
                        <span>กำลังอัปโหลด... {uploadProgress}%</span>
                      </span>
                    ) : (
                      "เลือกรูปภาพ"
                    )}
                    <input
                      accept="image/*"
                      className="hidden"
                      disabled={uploadingImage}
                      id="student-profile-image"
                      type="file"
                      onChange={handleImageChange}
                    />
                  </label>
                  <span className="text-xs text-gray-400">ข้ามได้</span>
                </div>
              </div>

              <div>
                <label
                  className="block text-sm font-medium text-gray-700 mb-1"
                  htmlFor="student-food-allergy"
                >
                  การแพ้อาหาร <span className="text-red-500">*</span>
                </label>
                <FoodAllergySelector
                  className="mt-2"
                  error={fieldError.food_allergy}
                  id="student-food-allergy"
                  value={form.food_allergy || ""}
                  onChange={(value) =>
                    setForm((f: any) => ({
                      ...f,
                      food_allergy: value,
                    }))
                  }
                />
                {fieldError.food_allergy && (
                  <p className="text-red-500 text-xs mt-1">
                    {fieldError.food_allergy}
                  </p>
                )}
              </div>

              <div>
                <label
                  className="block text-sm font-medium text-gray-700 mb-1"
                  htmlFor="student-nickname"
                >
                  ชื่อเล่น <span className="text-red-500">*</span>
                </label>
                <input
                  className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all
                    ${
                      fieldError.nickname
                        ? "border-red-400 bg-red-50 focus:ring-2 focus:ring-red-200"
                        : "border-gray-200 bg-gray-50 focus:border-[#5d7c6f] focus:ring-2 focus:ring-[#5d7c6f]/20"
                    }`}
                  id="student-nickname"
                  maxLength={50}
                  placeholder="กรอกชื่อเล่นที่อยากให้เพื่อน ๆ เรียก"
                  type="text"
                  value={form.nickname || ""}
                  onChange={(e) =>
                    setForm((f: any) => ({ ...f, nickname: e.target.value }))
                  }
                />
                {fieldError.nickname && (
                  <p className="text-red-500 text-xs mt-1">
                    {fieldError.nickname}
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
                className="w-full bg-[#5d7c6f] hover:bg-[#4a6659] text-white font-medium py-3.5 rounded-xl transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm shadow-md"
                disabled={saving || uploadingImage}
                type="submit"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    กำลังบันทึก...
                  </>
                ) : (
                  <>บันทึกชื่อเล่น</>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
