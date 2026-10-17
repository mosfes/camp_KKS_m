"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams, usePathname } from "next/navigation";
import useSWR from "swr";
import { Card, CardBody } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Button } from "@heroui/button";
import { Select, SelectItem } from "@heroui/react";
import { Pagination } from "@heroui/pagination";
import {
  MapPin,
  Calendar,
  ChevronRight,
  ImageOff,
  Tent,
  GraduationCap,
  Users,
  Trash2,
  Pencil,
  HeartPulse,
  ShieldAlert,
  Info,
  Search,
  Sparkles,
  Flag,
  Bus,
  CheckCircle2,
  LogOut,
  RefreshCw,
  BellRing,
  ChevronDown,
} from "lucide-react";
import { useRouter } from "next/navigation";

import CreateCampModal from "./CreateCampModal";
import SelectProjectTypeModal from "./SelectProjectTypeModal";
import EditCampModal from "./camp/EditCampModal";
import EnrollmentModal from "./EnrollmentModal";
import HomeroomStudentModal from "./HomeroomStudentModal";

import { toThumbnail } from "@/lib/cloudinary-url";
import { getCleanCampPath, rememberActiveCampId } from "@/lib/client-active-camp";

/* ---------- Default SVG Component ---------- */
function DefaultCampImage() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-[#f5f5f2] text-[#9c9488]">
      <ImageOff size={48} />
      <span className="mt-2 text-sm">ไม่มีรูปภาพ</span>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div
      aria-label="กำลังโหลดข้อมูลค่าย"
      aria-live="polite"
      className="min-h-full bg-[#f5f5f2]"
      role="status"
    >
      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* Greeting skeleton */}
        <div className="mb-8 rounded-3xl bg-white p-6 shadow-sm sm:p-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-64 rounded-lg bg-gray-200 sm:h-10 sm:w-80" />
            <div className="h-4 w-full max-w-2xl rounded bg-gray-200" />
            <div className="flex flex-wrap gap-2">
              <div className="h-8 w-32 rounded-full bg-gray-200" />
              <div className="h-8 w-36 rounded-full bg-gray-200" />
              <div className="h-8 w-40 rounded-full bg-gray-200" />
            </div>
          </div>
        </div>

        {/* Camp heading skeleton */}
        <div className="mb-6 flex flex-col gap-4 rounded-2xl bg-[#f6f2ea] px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="animate-pulse space-y-2">
            <div className="h-7 w-36 rounded bg-gray-300" />
            <div className="h-4 w-64 rounded bg-gray-200" />
          </div>
          <div className="h-10 w-32 animate-pulse rounded-full bg-gray-300" />
        </div>

        {/* Filters skeleton */}
        <div className="mb-6 flex flex-wrap justify-end gap-2">
          {["w-44", "w-40", "w-52"].map((width) => (
            <div
              key={width}
              className={`h-8 ${width} animate-pulse rounded-lg bg-white shadow-sm`}
            />
          ))}
        </div>

        {/* Camp cards skeleton */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div
              key={index}
              className="overflow-hidden rounded-2xl bg-white shadow-sm"
            >
              <div className="h-48 animate-pulse bg-gray-200" />
              <div className="animate-pulse space-y-4 p-4 sm:p-6">
                <div className="flex gap-2">
                  <div className="h-6 w-20 rounded-full bg-gray-200" />
                  <div className="h-6 w-28 rounded-full bg-gray-200" />
                </div>
                <div className="space-y-2">
                  <div className="h-5 w-4/5 rounded bg-gray-200" />
                  <div className="h-4 w-full rounded bg-gray-200" />
                  <div className="h-4 w-3/4 rounded bg-gray-200" />
                </div>
                <div className="h-4 w-2/3 rounded bg-gray-200" />
                <div className="h-4 w-4/5 rounded bg-gray-200" />
                <div className="border-t border-gray-100 pt-4">
                  <div className="h-4 w-full rounded bg-gray-200" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ... imports
import { useStatusModal } from "@/components/StatusModalProvider";
import {
  BANGKOK_TIME_ZONE,
  getBangkokDateKey,
  isBangkokDateBefore,
  isBangkokDateInRange,
} from "@/lib/bangkok-date";

async function readResponseBody(response: Response) {
  const responseText = await response.text();

  if (!responseText) return null;

  try {
    return JSON.parse(responseText);
  } catch {
    return { error: responseText, message: responseText, _invalidJson: true };
  }
}

async function uploadImageDirect(file: File) {
  const signatureResponse = await fetch("/api/upload/signature", {
    method: "POST",
  });
  const signatureData = await readResponseBody(signatureResponse);

  if (!signatureResponse.ok) {
    throw new Error(signatureData?.error || "ไม่สามารถเตรียมการอัปโหลดรูปได้");
  }

  const formData = new FormData();

  formData.append("file", file, "camp-image.jpg");
  formData.append("api_key", signatureData.apiKey);
  formData.append("timestamp", String(signatureData.timestamp));
  formData.append("folder", signatureData.folder);
  formData.append("signature", signatureData.signature);

  const uploadResponse = await fetch(
    `https://api.cloudinary.com/v1_1/${signatureData.cloudName}/image/upload`,
    {
      method: "POST",
      body: formData,
    },
  );
  const uploadData = await readResponseBody(uploadResponse);

  if (!uploadResponse.ok || !uploadData?.secure_url) {
    throw new Error(uploadData?.error?.message || "อัปโหลดรูปไม่สำเร็จ");
  }

  return {
    url: uploadData.secure_url,
    public_id: uploadData.public_id,
  };
}

const fetcher = async (url: string) => {
  const response = await fetch(url);
  const data = await readResponseBody(response);

  if (!response.ok) {
    throw new Error(
      data?.error ||
        data?._error ||
        data?.message ||
        `Request failed (${response.status})`,
    );
  }

  if (data?._invalidJson) {
    throw new Error(`API ${url} ส่งข้อมูลกลับมาในรูปแบบที่ไม่ถูกต้อง`);
  }

  return data;
};

interface TeacherBusPosition {
  label: string;
  seatIndex: number;
  floorNumber: number;
}

interface TeacherBusShortcut {
  assignmentId: number;
  campId: number;
  campName: string;
  configured: true;
  bus: {
    busId: number;
    name: string;
    registrationPlate: string | null;
    status: "PARKED" | "TRAVELING";
    floorCount: number;
    studentCounts: {
      total: number;
      onBus: number;
      offBus: number;
    };
    reminders: Array<{
      action: "board" | "alight";
      sentAt: string;
    }>;
  };
  teacher: {
    status: "ON_BUS" | "OFF_BUS";
    isOnBus: boolean;
    lastBoardedAt: string | null;
    position: TeacherBusPosition | null;
  };
}

interface TeacherBusResponse {
  assignments: TeacherBusShortcut[];
}

const formatTeacherBusCheckedAt = (value?: string | null) => {
  if (!value) return "";

  return new Date(value).toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: BANGKOK_TIME_ZONE,
  });
};

const formatTeacherBusSeat = (assignment: TeacherBusShortcut) => {
  const position = assignment.teacher.position;

  if (!position) return "ยังไม่ได้จัดที่นั่ง";

  const floorLabel =
    assignment.bus.floorCount > 1
      ? `${
          position.floorNumber === 1
            ? "ชั้นล่าง"
            : position.floorNumber === 2
              ? "ชั้นบน"
              : `ชั้น ${position.floorNumber}`
        } · `
      : "";
  const seatLetter = position.label.trim().charAt(0).toUpperCase();
  const seatSide =
    seatLetter === "A" || seatLetter === "D"
      ? "ติดหน้าต่าง"
      : seatLetter === "B" || seatLetter === "C"
        ? "ทางเดิน"
        : position.seatIndex === 0 || position.seatIndex === 3
          ? "ติดหน้าต่าง"
          : "ทางเดิน";

  return `${floorLabel}${position.label} · ${seatSide}`;
};

function DashboardContent() {
  const { showSuccess, showError, showConfirm, setIsLoading } =
    useStatusModal();
  const router = useRouter();

  const compressImage = async (file: File) => {
    if (!file || !file.type.startsWith("image/")) return file;
    try {
      const imageCompression = (await import("browser-image-compression"))
        .default;

      return await imageCompression(file, {
        maxSizeMB: 2,
        maxWidthOrHeight: 2000,
        useWebWorker: true,
      });
    } catch (e) {
      console.error("Compression error:", e);

      return file;
    }
  };
  const { data: rawCamps, mutate: mutateCamps } = useSWR("/api/camps", fetcher);
  const { data: teacherInfo } = useSWR("/api/auth/me", fetcher);
  const { data: dbAcademicYears } = useSWR("/api/academic_years", fetcher);
  const { data: homeroomData, isLoading: loadingHomeroom } = useSWR(
    "/api/teacher/homeroom",
    fetcher,
  );
  const { data: teacherBusData, mutate: mutateTeacherBus } =
    useSWR<TeacherBusResponse>("/api/teacher/bus", fetcher, {
      refreshInterval: 15_000,
      revalidateOnFocus: true,
    });

  const academicYears = useMemo(() => {
    if (Array.isArray(dbAcademicYears)) return dbAcademicYears;
    if (Array.isArray(dbAcademicYears?.data)) return dbAcademicYears.data;

    return [];
  }, [dbAcademicYears]);

  const loading = !rawCamps || !teacherInfo || !dbAcademicYears;
  const searchParams = useSearchParams();
  const selectedTab =
    searchParams.get("tab") === "homeroom" ? "homeroom" : "camp";
  const [isSelectTypeOpen, setIsSelectTypeOpen] = useState(false);
  const [isCreateCampOpen, setIsCreateCampOpen] = useState(false);
  const [selectedProjectType, setSelectedProjectType] = useState<string | null>(
    null,
  );
  const [selectedTemplateData, setSelectedTemplateData] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [navigatingTo, setNavigatingTo] = useState<number | null>(null);
  const [changingBusCampId, setChangingBusCampId] = useState<number | null>(
    null,
  );
  const [refreshingBus, setRefreshingBus] = useState(false);
  const [busRefreshCooldown, setBusRefreshCooldown] = useState(0);
  const [expandedReminderCampId, setExpandedReminderCampId] = useState<
    number | null
  >(null);
  const [sendingReminderKey, setSendingReminderKey] = useState<string | null>(
    null,
  );
  const [recentlySentReminderKeys, setRecentlySentReminderKeys] = useState<
    string[]
  >([]);

  const busAssignments = teacherBusData?.assignments ?? [];

  useEffect(() => {
    if (busRefreshCooldown <= 0) return;

    const timer = window.setInterval(() => {
      setBusRefreshCooldown((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [busRefreshCooldown]);

  const handleManualRefreshBus = async () => {
    if (refreshingBus || busRefreshCooldown > 0) return;

    setRefreshingBus(true);

    try {
      const response = await fetch("/api/teacher/bus?manual=1", {
        cache: "no-store",
      });
      const result = await readResponseBody(response);

      if (!response.ok) {
        throw new Error(result?.error || "โหลดสถานะรถไม่สำเร็จ");
      }

      await mutateTeacherBus(result, false);
      showSuccess("สำเร็จ", "อัปเดตสถานะรถแล้ว");
    } catch (error) {
      showError(
        "อัปเดตไม่สำเร็จ",
        error instanceof Error ? error.message : "ไม่สามารถอัปเดตสถานะรถได้",
      );
    } finally {
      setRefreshingBus(false);
      setBusRefreshCooldown(5);
    }
  };

  const changeTeacherBusStatus = async (
    assignment: TeacherBusShortcut,
    action: "board" | "alight",
  ) => {
    if (changingBusCampId !== null) return;

    if (assignment.bus.status === "TRAVELING") {
      showError("รถกำลังเดินทาง", "กรุณารอรถจอดก่อนเปลี่ยนสถานะขึ้นหรือลงรถ");

      return;
    }

    setChangingBusCampId(assignment.campId);

    try {
      const response = await fetch(
        `/api/teacher/camps/${assignment.campId}/bus/${action}`,
        { method: "POST" },
      );
      const result = await readResponseBody(response);

      if (!response.ok) {
        throw new Error(result?.error || "บันทึกสถานะรถไม่สำเร็จ");
      }

      await mutateTeacherBus();
      showSuccess(
        "สำเร็จ",
        result?.message ||
          (action === "board"
            ? "เช็คชื่อขึ้นรถสำเร็จ"
            : "บันทึกว่าลงจากรถแล้ว"),
      );
    } catch (error) {
      await mutateTeacherBus();
      showError(
        "บันทึกไม่สำเร็จ",
        error instanceof Error ? error.message : "ไม่สามารถบันทึกสถานะรถได้",
      );
    } finally {
      setChangingBusCampId(null);
    }
  };

  const requestTeacherBusStatusChange = (assignment: TeacherBusShortcut) => {
    const action = assignment.teacher.isOnBus ? "alight" : "board";
    const actionLabel = action === "board" ? "ขึ้นรถ" : "ลงจากรถ";

    showConfirm(
      `ยืนยัน${actionLabel}`,
      `คุณต้องการยืนยัน${actionLabel} ${assignment.bus.name} ใช่หรือไม่?`,
      () => changeTeacherBusStatus(assignment, action),
      `ยืนยัน${actionLabel}`,
    );
  };

  const sendTeacherBusReminder = async (
    assignment: TeacherBusShortcut,
    action: "board" | "alight",
  ) => {
    const reminderKey = `${assignment.campId}:${action}`;

    if (sendingReminderKey !== null) return;
    setSendingReminderKey(reminderKey);

    try {
      const response = await fetch(
        `/api/teacher/camps/${assignment.campId}/bus/remind`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        },
      );
      const result = await readResponseBody(response);

      if (!response.ok) {
        throw new Error(result?.error || "ส่งการเตือนไม่สำเร็จ");
      }

      setRecentlySentReminderKeys((current) => [
        ...current.filter((key) => key !== reminderKey),
        reminderKey,
      ]);
      window.setTimeout(() => {
        setRecentlySentReminderKeys((current) =>
          current.filter((key) => key !== reminderKey),
        );
      }, 60_000);
      await mutateTeacherBus();
      showSuccess("ส่งการเตือนแล้ว", result.message);
    } catch (error) {
      await mutateTeacherBus();
      showError(
        "ส่งการเตือนไม่สำเร็จ",
        error instanceof Error ? error.message : "กรุณาลองใหม่อีกครั้ง",
      );
    } finally {
      setSendingReminderKey(null);
    }
  };

  const requestTeacherBusReminder = (
    assignment: TeacherBusShortcut,
    action: "board" | "alight",
  ) => {
    const count =
      action === "board"
        ? assignment.bus.studentCounts.offBus
        : assignment.bus.studentCounts.onBus;
    const actionLabel = action === "board" ? "ขึ้นรถ" : "ลงรถ";

    showConfirm(
      `เตือนให้นักเรียนกด${actionLabel}`,
      `ระบบจะแจ้งเฉพาะนักเรียน ${count} คนที่ยังไม่ได้กด${actionLabel} การแจ้งเตือนจะแสดงเป็นเวลา 30 นาที`,
      () => sendTeacherBusReminder(assignment, action),
      `ส่งเตือน ${count} คน`,
    );
  };

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCampData, setEditingCampData] = useState<any>(null);
  const [isEditFetching, setIsEditFetching] = useState(false);

  // Enrollment Modal State
  const [isEnrollmentModalOpen, setIsEnrollmentModalOpen] = useState(false);
  const [enrollmentCampId, setEnrollmentCampId] = useState<number | null>(null);
  const [enrollmentCampName, setEnrollmentCampName] = useState("");

  // Homeroom State
  const [homeroomSearch, setHomeroomSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [homeroomFilter, setHomeroomFilter] = useState("all");
  const [homeroomPage, setHomeroomPage] = useState(1);
  const homeroomItemsPerPage = 10;

  const [campPage, setCampPage] = useState(1);
  const campsPerPage = 6; // 6 looks good on a 3-col grid

  useEffect(() => {
    setHomeroomPage(1);
  }, [homeroomSearch, homeroomFilter]);

  const allHomeroomStudents =
    homeroomData?.students?.filter((s: any) => {
      const searchLower = homeroomSearch.toLowerCase();
      const fullName =
        `${s.prefix || ""}${s.firstname} ${s.lastname}`.toLowerCase();
      const matchesSearch =
        s.id.toString().includes(searchLower) || fullName.includes(searchLower);

      let matchesFilter = true;

      if (homeroomFilter === "allergy") {
        matchesFilter =
          s.foodAllergy && s.foodAllergy !== "-" && s.foodAllergy !== "ไม่มี";
      } else if (homeroomFilter === "disease") {
        matchesFilter =
          s.chronicDisease &&
          s.chronicDisease !== "-" &&
          s.chronicDisease !== "ไม่มี";
      } else if (homeroomFilter === "remark") {
        matchesFilter = s.remark && s.remark !== "-" && s.remark !== "ไม่มี";
      }

      return matchesSearch && matchesFilter;
    }) || [];

  const homeroomTotalPages =
    Math.ceil(allHomeroomStudents.length / homeroomItemsPerPage) || 1;
  const filteredHomeroomStudents = allHomeroomStudents.slice(
    (homeroomPage - 1) * homeroomItemsPerPage,
    homeroomPage * homeroomItemsPerPage,
  );

  const pathname = usePathname();

  // Reset navigatingTo เมื่อ pathname กลับมาที่หน้า dashboard (เช่น กด Back จากหน้าค่าย)
  useEffect(() => {
    if (pathname === "/headteacher/dashboard") {
      setNavigatingTo(null);
    }
  }, [pathname]);

  const goToCampDetail = (campId: number) => {
    if (navigatingTo !== null) return;
    setNavigatingTo(campId);
    rememberActiveCampId(campId);
    router.push(getCleanCampPath());
  };

  const camps = useMemo(() => {
    if (!rawCamps || !Array.isArray(rawCamps)) return [];

    return rawCamps.map((camp: any) => {
      // Determine status label
      let statusLabel = "ยังไม่เริ่ม";
      const start = new Date(camp.start_date);
      const end = new Date(camp.end_date);

      if (isBangkokDateBefore(end)) {
        statusLabel = "เสร็จสิ้น";
      } else if (isBangkokDateInRange(start, end)) {
        statusLabel = "กำลังจัด";
      }

      return {
        id: camp.camp_id,
        title: camp.name,
        description: camp.description,
        status: statusLabel,
        location: camp.location,
        startDate: start.toLocaleDateString("th-TH", {
          day: "numeric",
          month: "short",
          year: "numeric",
          timeZone: BANGKOK_TIME_ZONE,
        }),
        endDate: end.toLocaleDateString("th-TH", {
          day: "numeric",
          month: "short",
          year: "numeric",
          timeZone: BANGKOK_TIME_ZONE,
        }),
        enrolled: camp._count?.student_enrollment || 0,
        totalStudents: Math.max(
          camp._count?.student_enrollment || 0,
          (camp.camp_classroom || []).reduce(
            (sum: number, cc: any) =>
              sum + (cc.classroom?._count?.classroom_students ?? 0),
            0,
          ),
        ),
        image: camp.img_camp_url || null,
        isOwner: camp.isOwner,
        ownerName: camp.created_by
          ? `${camp.created_by.firstname} ${camp.created_by.lastname}`.trim()
          : "",
        grades: camp.grades || [],
        gradeDisplay: camp.gradeDisplay || "",
        academicYear: camp.academicYear || "",
      };
    });
  }, [rawCamps]);

  // Handled by SWR

  useEffect(() => {
    if (academicYears.length > 0) {
      const activeYear = academicYears.find(
        (y: any) =>
          y.status === "แอคทีฟ" ||
          y.status === "Active" ||
          y.status === "ใช้งาน",
      );

      if (activeYear) {
        setCampAcademicYearFilter(activeYear.year.toString());
      }
    }
  }, [academicYears]);

  // Tab is now driven by URL searchParams via sidebar navigation

  const openCreateCampFlow = () => {
    setIsSelectTypeOpen(true);
  };

  const handleProjectTypeSelect = (type: string, templateData: any) => {
    setSelectedProjectType(type);
    setSelectedTemplateData(templateData);
    setIsSelectTypeOpen(false);
    setIsCreateCampOpen(true);
  };

  const handleDeleteCamp = (campId: number, campName: string) => {
    showConfirm(
      "ลบค่าย",
      `คุณต้องการลบค่าย "${campName}" ใช่หรือไม่?\n\nการกระทำนี้ไม่สามารถย้อนกลับได้`,
      async () => {
        try {
          setIsLoading(true);
          const response = await fetch(`/api/camps/${campId}`, {
            method: "DELETE",
          });

          const result = await readResponseBody(response);

          if (response.ok) {
            showSuccess("สำเร็จ", "ลบค่ายสำเร็จ!");
            mutateCamps();
          } else {
            showError("ผลการดำเนินงาน", `ลบค่ายไม่สำเร็จ: ${result.error}`);
          }
        } catch (error) {
          console.error("Error deleting camp:", error);
          showError("ข้อผิดพลาด", "เกิดข้อผิดพลาดในการลบค่าย");
        } finally {
          setIsLoading(false);
        }
      },
      "ลบ",
    );
  };

  // ...

  const handleCreateCampSubmit = async (data: any) => {
    try {
      setIsSubmitting(true);
      console.log("Data being sent:", data); // Debug: ดูข้อมูลที่ส่งไป

      let img_camp_url = "";

      // Upload camp image to Cloudinary if it exists
      if (data.campImageFile) {
        try {
          const compressedFile = await compressImage(data.campImageFile);
          const uploadData = await uploadImageDirect(compressedFile);

          img_camp_url = uploadData.url;
          console.log("Uploaded camp image:", img_camp_url);
        } catch (uploadErr) {
          console.error("Error during upload:", uploadErr);
          showError(
            "อัปโหลดรูปล้มเหลว",
            "เกิดข้อผิดพลาดในการอัปโหลดรูปภาพหน้าปกค่าย",
          );
        }
      }

      // Upload shirt images (up to 3) to Cloudinary
      const shirtUrls: string[] = [];

      if (data.shirtImageFiles && Array.isArray(data.shirtImageFiles)) {
        for (const file of data.shirtImageFiles) {
          if (file) {
            try {
              const compressedFile = await compressImage(file);
              const uploadData = await uploadImageDirect(compressedFile);

              shirtUrls.push(uploadData.url);
            } catch (uploadErr) {
              console.error("Error uploading shirt image:", uploadErr);
            }
          }
        }
      }
      const img_shirt_url = JSON.stringify(shirtUrls);

      // ส่งข้อมูลไปยัง API เพื่อสร้างค่ายใหม่
      const response = await fetch("/api/camps", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: data.name,
          location: data.location,
          campStartDate: data.campStartDate,
          campEndDate: data.campEndDate,
          registrationStartDate: data.registrationStartDate,
          registrationEndDate: data.registrationEndDate,
          shirtStartDate: data.shirtStartDate,
          shirtEndDate: data.shirtEndDate,
          description: data.description || "",
          hasShirt: data.hasShirt,
          hasTransport: data.hasTransport,
          classroom_ids: data.classroom_ids,
          projectType: selectedProjectType,
          gradeLevel: data.gradeLevel,
          classroomType: data.classroomType,
          dailySchedule: data.dailySchedule,
          saveAsTemplate: data.saveAsTemplate,
          templateName: data.templateName,
          img_shirt_url: img_shirt_url,
          img_camp_url: img_camp_url,
          destination: data.destination,
          locationTrackingEnabled: data.locationTrackingEnabled,
        }),
      });

      const result = await readResponseBody(response);

      console.log("API Response:", result); // Debug: ดู response จาก API

      if (response.ok) {
        console.log("Camp created successfully");
        showSuccess("สำเร็จ", "สร้างค่ายสำเร็จ!");
        mutateCamps();
        setIsCreateCampOpen(false); // Close modal on success
        setSelectedProjectType(null);
      } else {
        console.error("Failed to create camp:", result);
        const errorMessage =
          result?.details ||
          result?.error ||
          result?.message ||
          JSON.stringify(result);

        showError("ล้มเหลว", `สร้างค่ายไม่สำเร็จ: ${errorMessage}`);
      }
    } catch (error) {
      console.error("Error creating camp:", error);
      showError("ข้อผิดพลาด", "เกิดข้อผิดพลาดในการสร้างค่าย");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditCampClick = async (campId: number) => {
    try {
      setIsEditFetching(true);
      const response = await fetch(`/api/camps/${campId}`);

      if (!response.ok) throw new Error("Failed to fetch camp data");
      const data = await readResponseBody(response);

      setEditingCampData(data);
      setIsEditModalOpen(true);
    } catch (error) {
      console.error("Error fetching camp for edit:", error);
      showError("ข้อผิดพลาด", "ไม่สามารถดึงข้อมูลค่ายเพื่อแก้ไขได้");
    } finally {
      setIsEditFetching(false);
    }
  };

  const handleEditSubmit = async (formData: any) => {
    try {
      setIsSubmitting(true);

      const isDataUrl = (value: unknown) =>
        typeof value === "string" && value.startsWith("data:");

      let img_shirt_url = isDataUrl(formData.shirtImage)
        ? ""
        : formData.shirtImage || "";
      let img_camp_url = isDataUrl(formData.campImage)
        ? ""
        : formData.campImage || "";

      // Upload new shirt images if files were picked
      let finalShirtUrls: (string | null)[] = [];

      try {
        const parsed = JSON.parse(
          formData.shirtImages ? JSON.stringify(formData.shirtImages) : "[]",
        );

        finalShirtUrls = Array.isArray(parsed)
          ? parsed.map((url) => (isDataUrl(url) ? null : url))
          : [isDataUrl(formData.shirtImages) ? null : formData.shirtImages];
      } catch (e) {
        finalShirtUrls = [
          isDataUrl(formData.shirtImages) ? null : formData.shirtImages,
        ];
      }

      if (formData.shirtImageFiles && Array.isArray(formData.shirtImageFiles)) {
        for (let i = 0; i < formData.shirtImageFiles.length; i++) {
          const file = formData.shirtImageFiles[i];

          if (file) {
            try {
              const compressedFile = await compressImage(file);
              const uploadData = await uploadImageDirect(compressedFile);

              finalShirtUrls[i] = uploadData.url;
            } catch (uploadErr) {
              console.error("Error during shirt upload:", uploadErr);

              throw new Error("อัปโหลดรูปเสื้อไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
            }
          }
        }
      }
      img_shirt_url = JSON.stringify(finalShirtUrls);

      if (formData.campImageFile) {
        try {
          const compressedFile = await compressImage(formData.campImageFile);
          const uploadData = await uploadImageDirect(compressedFile);

          img_camp_url = uploadData.url;
        } catch (uploadErr) {
          console.error("Error during camp image upload:", uploadErr);

          throw new Error("อัปโหลดรูปหน้าปกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
        }
      }

      // Do not spread formData here: it contains base64 preview strings and
      // File objects used only by the modal. Sending those in JSON can exceed
      // Vercel's 4.5 MB Function payload limit.
      const updatePayload = {
        name: formData.name,
        location: formData.location,
        start_date: formData.start_date,
        end_date: formData.end_date,
        start_regis_date: formData.start_regis_date,
        end_regis_date: formData.end_regis_date,
        start_shirt_date: formData.start_shirt_date,
        end_shirt_date: formData.end_shirt_date,
        description: formData.description,
        has_shirt: formData.has_shirt,
        has_transport: formData.has_transport,
        status: formData.status || "OPEN",
        classroom_ids: formData.classroom_ids,
        dailySchedule: formData.dailySchedule,
        destination: formData.destination,
        location_sharing_enabled: formData.location_sharing_enabled,
        location_update_interval: formData.location_update_interval,
        img_shirt_url,
        img_camp_url,
      };

      const response = await fetch(`/api/camps/${editingCampData.camp_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatePayload),
      });

      if (!response.ok) {
        const result = await readResponseBody(response);

        throw new Error(result.error || "Failed to edit camp");
      }

      showSuccess("สำเร็จ", "อัปเดตข้อมูลค่ายเรียบร้อยแล้ว");
      setIsEditModalOpen(false);
      setEditingCampData(null);
      mutateCamps();
    } catch (error: any) {
      console.error("Error editing camp:", error);
      showError("ข้อผิดพลาด", error.message || "ไม่สามารถอัปเดตข้อมูลค่ายได้");
    } finally {
      setIsSubmitting(false);
    }
  };

  const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
    กำลังจัด: {
      bg: "bg-[#5d7c6f]",
      text: "text-white",
    },
    ยังไม่เริ่ม: {
      bg: "bg-[#d4c5b0]",
      text: "text-[#5a4a3a]",
    },
    เสร็จสิ้น: {
      bg: "bg-gray-200",
      text: "text-gray-600",
    },
  };

  const [campStatusFilter, setCampStatusFilter] = useState("all");
  const [campRoleFilter, setCampRoleFilter] = useState("all"); // "all", "owner", "related"
  const [campAcademicYearFilter, setCampAcademicYearFilter] = useState("all");
  const [filtersMounted, setFiltersMounted] = useState(false);

  useEffect(() => {
    setFiltersMounted(true);
  }, []);

  const filteredMyCamps = camps.filter((camp: any) => {
    if (campStatusFilter !== "all" && camp.status !== campStatusFilter)
      return false;
    if (campRoleFilter === "owner" && !camp.isOwner) return false;
    if (campRoleFilter === "related" && camp.isOwner) return false;
    if (
      campAcademicYearFilter !== "all" &&
      camp.academicYear && // ถ้าไม่มีปีการศึกษา (ค่าว่าง) ให้แสดงไปเลย จะได้ไม่หายไปดื้อๆ
      String(camp.academicYear) !== String(campAcademicYearFilter)
    )
      return false;

    return true;
  });

  const campTotalPages = Math.ceil(filteredMyCamps.length / campsPerPage) || 1;
  const paginatedCamps = filteredMyCamps.slice(
    (campPage - 1) * campsPerPage,
    campPage * campsPerPage,
  );

  // Reset camp page when filters change
  useEffect(() => {
    setCampPage(1);
  }, [campStatusFilter, campRoleFilter, campAcademicYearFilter]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="bg-[#f5f5f2] min-h-full">
      {/* Edit-fetch loading overlay */}
      {isEditFetching && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" />
          <div className="relative bg-white rounded-2xl shadow-2xl px-10 py-8 flex flex-col items-center gap-4">
            <div className="w-14 h-14 rounded-full border-4 border-[#6b857a]/20 border-t-[#6b857a] animate-spin" />
            <div className="text-center">
              <p className="font-semibold text-[#2d3748] text-base">
                กำลังโหลดข้อมูลค่าย
              </p>
              <p className="text-sm text-gray-400 mt-0.5">กรุณารอสักครู่...</p>
            </div>
          </div>
        </div>
      )}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Greeting Card (Student Style) */}
        <div className="bg-[#5d7c6f] rounded-3xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden mb-8">
          <div className="relative z-10">
            <h1 className="text-2xl sm:text-3xl font-medium mb-2 flex items-center gap-2">
              สวัสดีคุณครู{teacherInfo?.firstname || "หัวหน้าค่าย"}{" "}
              <Sparkles className="text-white" size={28} />
            </h1>
            <p className="opacity-90 mb-6 text-sm sm:text-base">
              ยินดีต้อนรับเข้าสู่ระบบ KKS Camp |
              จัดการค่ายและติดตามการเรียนรู้ของนักเรียน
            </p>

            <div className="flex flex-wrap gap-2">
              {teacherInfo?.classroomName && (
                <span className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium border border-white/10">
                  <Users size={14} />
                  <span>ประจำชั้น:</span> {teacherInfo.classroomName}
                </span>
              )}
              <span className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium border border-white/10">
                <Tent size={14} />
                <span>สถานะ:</span>{" "}
                {teacherInfo?.classroomName ? "ครูประจำชั้น" : "ครูทั่วไป"}
              </span>
              <span className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium border border-white/10">
                <Calendar size={14} />
                <span>ปีการศึกษา:</span>{" "}
                {Number(getBangkokDateKey().slice(0, 4)) + 543}
              </span>
            </div>
          </div>
          <div className="absolute right-[-20px] bottom-[-20px] opacity-10">
            <Flag size={160} />
          </div>
        </div>

        {/* Teacher transportation shortcuts */}
        {busAssignments.length > 0 && (
          <section
            aria-labelledby="teacher-transport-heading"
            className="mb-8 space-y-3"
          >
            <div className="flex items-center justify-between gap-2 px-1">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#e8f0ee] text-[#3d6357]">
                  <Bus size={18} />
                </div>
                <div>
                  <h2
                    className="text-base font-semibold text-gray-900"
                    id="teacher-transport-heading"
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
                  busRefreshCooldown > 0 ? "gap-1.5 px-2.5" : "w-9 shrink-0"
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
              {busAssignments.map((assignment) => {
                const isOnBus = assignment.teacher.isOnBus;
                const isTraveling = assignment.bus.status === "TRAVELING";
                const position = assignment.teacher.position;
                const isChanging = changingBusCampId === assignment.campId;
                const checkedAt = formatTeacherBusCheckedAt(
                  assignment.teacher.lastBoardedAt,
                );
                const isReminderExpanded =
                  expandedReminderCampId === assignment.campId;
                const { onBus, offBus, total } = assignment.bus.studentCounts;

                return (
                  <div
                    key={assignment.assignmentId}
                    className="w-full rounded-2xl border border-gray-200/80 bg-white p-5 text-left shadow-xs transition-all hover:border-[#5d7c6f]/40 hover:shadow-md"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 pb-4">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-[#5d7c6f]">
                          {assignment.campName}
                        </p>
                        <h3 className="mt-0.5 truncate text-base font-bold text-gray-900 sm:text-lg">
                          {assignment.bus.name}
                        </h3>
                        {assignment.bus.registrationPlate && (
                          <p className="mt-0.5 text-xs text-gray-500">
                            ทะเบียน {assignment.bus.registrationPlate}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            isTraveling
                              ? "bg-amber-100 text-amber-800"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {isTraveling ? "กำลังเดินทาง" : "รถจอด"}
                        </span>
                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                            isOnBus
                              ? "border-emerald-200/60 bg-emerald-50 text-emerald-700"
                              : "border-gray-200 bg-gray-100 text-gray-600"
                          }`}
                        >
                          {isOnBus
                            ? `อยู่บนรถแล้ว${checkedAt ? ` · ${checkedAt} น.` : ""}`
                            : position
                              ? "พร้อมเช็กชื่อ"
                              : "รอจัดที่นั่ง"}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3.5 pt-3.5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#e8f0ee] text-[#3d6357]">
                          <Bus size={16} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold text-gray-400">
                            ที่นั่งของคุณ
                          </p>
                          <p className="truncate text-xs font-bold text-gray-800 sm:text-sm">
                            {formatTeacherBusSeat(assignment)}
                          </p>
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-2">
                        <Button
                          className="font-semibold text-[#3d6357]"
                          size="sm"
                          variant="flat"
                          onPress={() => {
                            rememberActiveCampId(assignment.campId);
                            router.push(getCleanCampPath("bus-checkin"));
                          }}
                        >
                          ดูรายละเอียดรถ
                        </Button>
                        <Button
                          className={
                            isOnBus
                              ? "bg-amber-100 font-bold text-amber-900"
                              : "bg-[#5d7c6f] font-bold text-white"
                          }
                          isDisabled={
                            isTraveling ||
                            changingBusCampId !== null ||
                            (!isOnBus && !position)
                          }
                          isLoading={isChanging}
                          size="sm"
                          startContent={
                            isChanging ? null : isOnBus ? (
                              <LogOut size={15} />
                            ) : (
                              <CheckCircle2 size={15} />
                            )
                          }
                          onPress={() =>
                            requestTeacherBusStatusChange(assignment)
                          }
                        >
                          {isTraveling
                            ? "รถกำลังเดินทาง"
                            : isOnBus
                              ? "ลงจากรถ"
                              : "ยืนยันขึ้นรถ"}
                        </Button>
                      </div>
                    </div>

                    <div className="mt-4 border-t border-gray-100 pt-3">
                      <button
                        aria-expanded={isReminderExpanded}
                        className="flex min-h-10 w-full items-center justify-between gap-3 rounded-xl px-2 text-left text-sm font-semibold text-[#3d6357] transition hover:bg-[#f1f6f4]"
                        disabled={isTraveling || total === 0}
                        type="button"
                        onClick={() =>
                          setExpandedReminderCampId((current) =>
                            current === assignment.campId
                              ? null
                              : assignment.campId,
                          )
                        }
                      >
                        <span className="flex items-center gap-2">
                          <BellRing size={16} />
                          {isTraveling
                            ? "ส่งเตือนได้เมื่อรถจอด"
                            : total === 0
                              ? "ยังไม่มีนักเรียนในรถ"
                              : "เตือนนักเรียน"}
                        </span>
                        {!isTraveling && total > 0 && (
                          <ChevronDown
                            className={`transition-transform ${isReminderExpanded ? "rotate-180" : ""}`}
                            size={16}
                          />
                        )}
                      </button>

                      {isReminderExpanded && !isTraveling && total > 0 && (
                        <div className="mt-2 grid gap-2 rounded-2xl bg-[#f7faf8] p-3 sm:grid-cols-2">
                          <button
                            className="rounded-xl border border-[#cfe0d9] bg-white p-3 text-left transition hover:border-[#5d7c6f] disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={
                              offBus === 0 ||
                              sendingReminderKey !== null ||
                              recentlySentReminderKeys.includes(
                                `${assignment.campId}:board`,
                              )
                            }
                            type="button"
                            onClick={() =>
                              requestTeacherBusReminder(assignment, "board")
                            }
                          >
                            <span className="block text-sm font-bold text-gray-900">
                              เตือนให้กดขึ้นรถ
                            </span>
                            <span className="mt-1 block text-xs text-gray-500">
                              {offBus === 0
                                ? "ขึ้นรถครบแล้ว"
                                : `ยังไม่ยืนยัน ${offBus} จาก ${total} คน`}
                            </span>
                          </button>
                          <button
                            className="rounded-xl border border-amber-200 bg-white p-3 text-left transition hover:border-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={
                              onBus === 0 ||
                              sendingReminderKey !== null ||
                              recentlySentReminderKeys.includes(
                                `${assignment.campId}:alight`,
                              )
                            }
                            type="button"
                            onClick={() =>
                              requestTeacherBusReminder(assignment, "alight")
                            }
                          >
                            <span className="block text-sm font-bold text-gray-900">
                              เตือนให้กดลงรถ
                            </span>
                            <span className="mt-1 block text-xs text-gray-500">
                              {onBus === 0
                                ? "ไม่มีคนอยู่บนรถ"
                                : `อยู่บนรถ ${onBus} จาก ${total} คน`}
                            </span>
                          </button>
                          <p className="text-[11px] leading-relaxed text-gray-500 sm:col-span-2">
                            ระบบส่งเฉพาะคนที่ยังต้องกด และจำกัดการส่งซ้ำทุก 1 นาที
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Homeroom Tab */}
        {selectedTab === "homeroom" && (
          <div className="w-full space-y-6">
            {!homeroomData?.hasHomeroom ? (
              <div className="bg-white rounded-2xl shadow-sm p-12 text-center border border-gray-100 flex flex-col items-center justify-center">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                  <Info className="text-gray-400" size={32} />
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">
                  ไม่พบข้อมูลชั้นเรียนประจำ
                </h3>
                <p className="text-gray-500 max-w-md mx-auto">
                  คุณยังไม่ได้ถูกกำหนดให้เป็นครูประจำชั้นของห้องใดๆ ในระบบ
                  หากต้องการตรวจสอบข้อมูล กรุณาติดต่อผู้ดูแลระบบ (Admin)
                </p>
              </div>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-[#5d7c6f] border border-[#4a6358] rounded-2xl px-6 py-5 shadow-sm">
                  <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      <Users className="text-emerald-100" size={24} />
                      นักเรียนประจำชั้น {homeroomData.classroomName}
                    </h2>
                    <p className="text-sm text-emerald-50/80 mt-1">
                      มีนักเรียนทั้งหมด {homeroomData.students?.length || 0} คน
                    </p>
                  </div>

                  {/* Special Care summary box */}
                  <div className="bg-[#f5f5f2] backdrop-blur-sm px-4 py-3 rounded-xl border border-white/10 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center flex-shrink-0">
                      <HeartPulse className="text-rose-500" size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        ต้องการดูแลเป็นพิเศษ
                      </p>
                      <p className="text-lg font-bold text-rose-600">
                        {homeroomData.students?.filter(
                          (s: any) => s.isSpecialCare,
                        ).length || 0}{" "}
                        คน
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-sm overflow-hidden">
                  <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4 w-full">
                    <h3 className="text-xl font-semibold text-gray-900 w-full sm:w-auto">
                      รายชื่อนักเรียน
                    </h3>
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                      <div className="w-full sm:w-[200px]">
                        <Select
                          aria-label="ตัวกรอง"
                          className="w-full"
                          classNames={{
                            trigger:
                              "bg-white border border-gray-100 text-gray-700 font-medium h-10",
                          }}
                          placeholder="ตัวกรองทั้งหมด"
                          selectedKeys={[homeroomFilter]}
                          size="sm"
                          onChange={(e) => setHomeroomFilter(e.target.value)}
                        >
                          <SelectItem key="all" textValue="แสดงทั้งหมด">
                            แสดงทั้งหมด
                          </SelectItem>
                          <SelectItem key="allergy" textValue="แพ้อาหาร">
                            แพ้อาหาร
                          </SelectItem>
                          <SelectItem key="disease" textValue="โรคประจำตัว">
                            โรคประจำตัว
                          </SelectItem>
                          <SelectItem key="remark" textValue="หมายเหตุอื่นๆ">
                            หมายเหตุอื่นๆ
                          </SelectItem>
                        </Select>
                      </div>
                      <div className="relative w-full sm:w-72">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Search className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                          className="block w-full pl-10 pr-3 h-10 border border-gray-100 rounded-xl leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-[#6b857a] focus:border-[#6b857a] transition-colors text-sm"
                          placeholder="ค้นหาชื่อ, นามสกุล หรือเลขประจำตัว..."
                          type="text"
                          value={homeroomSearch}
                          onChange={(e) => setHomeroomSearch(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[600px]">
                      <thead>
                        <tr className="bg-gray-50 text-gray-600 text-sm border-y border-gray-100">
                          <th className="p-4 font-semibold rounded-tl-lg whitespace-nowrap">
                            ลำดับ
                          </th>
                          <th className="p-4 font-semibold whitespace-nowrap">
                            รหัสนักเรียน
                          </th>
                          <th className="p-4 font-semibold whitespace-nowrap">
                            ชื่อ-นามสกุล
                          </th>
                          <th className="p-4 font-semibold whitespace-nowrap">
                            โรคประจำตัว
                          </th>
                          <th className="p-4 font-semibold whitespace-nowrap">
                            อาหารที่แพ้
                          </th>
                          <th className="p-4 font-semibold rounded-tr-lg whitespace-nowrap">
                            หมายเหตุ
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {loadingHomeroom ? (
                          <tr>
                            <td
                              className="p-8 text-center text-gray-400"
                              colSpan={6}
                            >
                              กำลังโหลดข้อมูล...
                            </td>
                          </tr>
                        ) : filteredHomeroomStudents.length === 0 ? (
                          <tr>
                            <td
                              className="p-12 text-center text-gray-400"
                              colSpan={6}
                            >
                              {homeroomSearch
                                ? "ไม่พบนักเรียนที่ค้นหา"
                                : "ยังไม่มีนักเรียนในห้องนี้"}
                            </td>
                          </tr>
                        ) : (
                          filteredHomeroomStudents.map((student: any) => (
                            <tr
                              key={student.id}
                              className={`border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors ${student.isSpecialCare ? "bg-rose-50/20" : ""}`}
                              onClick={() => setSelectedStudent(student)}
                            >
                              <td className="p-4 text-sm text-gray-600">
                                {allHomeroomStudents.indexOf(student) + 1}
                              </td>
                              <td className="p-4 text-sm text-gray-900 font-medium">
                                {student.id}
                              </td>
                              <td className="p-4 text-gray-900">
                                <div className="flex items-center gap-2">
                                  <span>
                                    {student.prefix}
                                    {student.firstname} {student.lastname}
                                  </span>
                                  {student.isSpecialCare && (
                                    <span title="ต้องการดูแลเป็นพิเศษ">
                                      <ShieldAlert
                                        className="text-rose-500"
                                        size={14}
                                      />
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="p-4">
                                {student.chronicDisease &&
                                student.chronicDisease !== "-" &&
                                student.chronicDisease !== "ไม่มี" ? (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
                                    {student.chronicDisease}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </td>
                              <td className="p-4">
                                {student.foodAllergy &&
                                student.foodAllergy !== "-" &&
                                student.foodAllergy !== "ไม่มี" ? (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 border border-orange-200">
                                    {student.foodAllergy}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </td>
                              <td className="p-4">
                                {student.remark &&
                                student.remark !== "-" &&
                                student.remark !== "ไม่มี" ? (
                                  <span className="text-sm text-blue-700 font-medium">
                                    {student.remark}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {!loadingHomeroom && homeroomTotalPages > 1 && (
                    <div className="flex justify-center items-center mt-6">
                      <Pagination
                        isCompact
                        showControls
                        classNames={{
                          cursor: "bg-[#5d7c6f] text-white font-bold",
                        }}
                        color="default"
                        page={homeroomPage}
                        total={homeroomTotalPages}
                        onChange={setHomeroomPage}
                      />
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {selectedTab === "camp" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-[#f6f2ea] rounded-2xl px-6 py-4">
              <div>
                <h2 className="text-xl font-medium text-[#2d3748]">
                  ค่ายของฉัน
                </h2>
                <p className="text-sm text-gray-500">
                  จัดการและดูแลค่ายกิจกรรมการเรียนรู้ของคุณ
                </p>
              </div>

              <Button
                className="bg-[#6b857a] text-white rounded-full px-5"
                startContent={<span className="text-xl">+</span>}
                onPress={openCreateCampFlow}
              >
                สร้างค่ายใหม่
              </Button>
            </div>

            {/* ===== FILTER ===== */}
            <div className="grid grid-cols-3 sm:flex sm:flex-row sm:justify-end gap-2 w-full mt-4 sm:mt-0">
              {/* Academic Year Filter */}
              <div className="col-span-1 sm:w-[180px] sm:min-w-[180px]">
                {filtersMounted ? (
                  <Select
                    aria-label="Select Academic Year"
                    className="w-full"
                    classNames={{
                      trigger:
                        "bg-white border border-gray-100 text-gray-700 font-medium",
                    }}
                    placeholder="ปีการศึกษา"
                    selectedKeys={[campAcademicYearFilter]}
                    size="sm"
                    onChange={(e) => setCampAcademicYearFilter(e.target.value)}
                  >
                    {[{ year: "all" }, ...academicYears].map((item) => (
                      <SelectItem
                        key={String(item.year)}
                        textValue={
                          item.year === "all"
                            ? "ปีการศึกษา: ทั้งหมด"
                            : `ปีการศึกษา: ${(parseInt(item.year) + 543).toString()}`
                        }
                      >
                        {item.year === "all"
                          ? "ทั้งหมด"
                          : `${parseInt(item.year) + 543}`}
                      </SelectItem>
                    ))}
                  </Select>
                ) : (
                  <div
                    aria-hidden="true"
                    className="h-8 w-full animate-pulse rounded-lg border border-gray-100 bg-white"
                  />
                )}
              </div>

              {/* Status Filter */}
              <div className="col-span-1 sm:w-[160px] sm:min-w-[160px]">
                {filtersMounted ? (
                  <Select
                    aria-label="สถานะ"
                    className="w-full"
                    classNames={{
                      trigger:
                        "bg-white border border-gray-100 text-gray-700 font-medium",
                    }}
                    placeholder="สถานะ"
                    selectedKeys={[campStatusFilter]}
                    size="sm"
                    onChange={(e) => setCampStatusFilter(e.target.value)}
                  >
                    <SelectItem key="all" textValue="สถานะ: ทั้งหมด">
                      สถานะ: ทั้งหมด
                    </SelectItem>
                    <SelectItem key="กำลังจัด" textValue="สถานะ: กำลังจัด">
                      กำลังจัด
                    </SelectItem>
                    <SelectItem
                      key="ยังไม่เริ่ม"
                      textValue="สถานะ: ยังไม่เริ่ม"
                    >
                      ยังไม่เริ่ม
                    </SelectItem>
                    <SelectItem key="เสร็จสิ้น" textValue="สถานะ: เสร็จสิ้น">
                      เสร็จสิ้น
                    </SelectItem>
                  </Select>
                ) : (
                  <div
                    aria-hidden="true"
                    className="h-8 w-full animate-pulse rounded-lg border border-gray-100 bg-white"
                  />
                )}
              </div>

              {/* Role Filter (Dropdown) */}
              <div className="col-span-1 sm:w-[210px] sm:min-w-[210px]">
                {filtersMounted ? (
                  <Select
                    aria-label="ประเภท"
                    className="w-full"
                    classNames={{
                      trigger:
                        "bg-white border border-gray-100 text-gray-700 font-medium",
                    }}
                    placeholder="ประเภท"
                    selectedKeys={[campRoleFilter]}
                    size="sm"
                    onChange={(e) => setCampRoleFilter(e.target.value)}
                  >
                    <SelectItem key="all" textValue="ประเภท: ทั้งหมด">
                      ประเภท: ทั้งหมด
                    </SelectItem>
                    <SelectItem key="owner" textValue="ประเภท: ค่ายที่สร้าง">
                      ค่ายที่สร้าง
                    </SelectItem>
                    <SelectItem
                      key="related"
                      textValue="ประเภท: ค่ายที่เกี่ยวข้อง"
                    >
                      ค่ายที่เกี่ยวข้อง
                    </SelectItem>
                  </Select>
                ) : (
                  <div
                    aria-hidden="true"
                    className="h-8 w-full animate-pulse rounded-lg border border-gray-100 bg-white"
                  />
                )}
              </div>
            </div>

            {filteredMyCamps.length === 0 ? (
              <div className="w-full py-20 text-center text-gray-500">
                ยังไม่มีค่ายในขณะนี้
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {paginatedCamps.map((camp: any) => (
                    <div
                      key={camp.id}
                      className="cursor-pointer"
                      role="button"
                      tabIndex={0}
                      onClick={() => goToCampDetail(camp.id)}
                      onKeyDown={(event) => {
                        if (
                          event.target === event.currentTarget &&
                          (event.key === "Enter" || event.key === " ")
                        ) {
                          event.preventDefault();
                          goToCampDetail(camp.id);
                        }
                      }}
                    >
                      <Card className="overflow-hidden shadow-lg hover:shadow-xl transition-all bg-white relative group h-full">
                        {/* Image */}
                        <div
                          className={`relative h-48 overflow-hidden ${navigatingTo === camp.id ? "opacity-60" : ""}`}
                        >
                          {navigatingTo === camp.id && (
                            <div className="absolute inset-0 flex items-center justify-center z-20 bg-white/40">
                              <div className="w-8 h-8 border-4 border-[#6b857a] border-t-transparent rounded-full animate-spin" />
                            </div>
                          )}
                          {camp.isOwner && (
                            <div className="absolute top-2 right-2 z-10 flex flex-col gap-2">
                              <button
                                className="p-2 bg-[#5d7c6f] text-white rounded-full opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#4a6358] shadow-lg disabled:opacity-30 disabled:cursor-not-allowed"
                                disabled={loading || isSubmitting}
                                title="แก้ไขค่าย"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (loading || isSubmitting) return;
                                  handleEditCampClick(camp.id);
                                }}
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                className="p-2 bg-[#E84A5F] text-white rounded-full opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#FF847C] shadow-lg disabled:opacity-30 disabled:cursor-not-allowed"
                                disabled={loading}
                                title="ลบค่าย"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (loading) return;
                                  handleDeleteCamp(camp.id, camp.title);
                                }}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          )}
                          {camp.image ? (
                            <img
                              alt={camp.title}
                              className="w-full h-full object-cover"
                              src={toThumbnail(camp.image)}
                            />
                          ) : (
                            <DefaultCampImage />
                          )}
                        </div>

                        <CardBody className="flex flex-1 flex-col p-4 sm:p-6">
                          {/* Status + Owner row */}
                          <div className="mb-2 flex h-7 items-center gap-2 overflow-hidden">
                            <Chip
                              className={`
                              shrink-0
                              ${STATUS_STYLES[camp.status]?.bg ?? "bg-gray-100"}
                              ${STATUS_STYLES[camp.status]?.text ?? "text-gray-600"}
                            `}
                              size="sm"
                              variant="shadow"
                            >
                              {camp.status}
                            </Chip>
                            {camp.isOwner ? (
                              <span
                                className="inline-block min-w-0 max-w-[160px] truncate rounded-full border border-[#b8d0c8] bg-[#e8f0ee] px-2 py-0.5 text-xs text-[#3d6357]"
                                title={`เจ้าของค่าย: ${camp.ownerName}`}
                              >
                                เจ้าของ: {camp.ownerName}
                              </span>
                            ) : camp.ownerName ? (
                              <span
                                className="inline-block min-w-0 max-w-[160px] truncate rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                                title={`ผู้สร้าง: ${camp.ownerName}`}
                              >
                                เจ้าของ: {camp.ownerName}
                              </span>
                            ) : null}
                          </div>
                          <div className="mb-3 space-y-1 overflow-hidden">
                            <h3 className="line-clamp-2 h-12 text-base font-medium leading-snug text-[#2d3748] sm:text-lg">
                              {camp.title}
                            </h3>
                            <p className="line-clamp-2 h-[2.875rem] text-sm leading-relaxed text-[#718096]">
                              {camp.description}
                            </p>
                          </div>

                          <div className="mb-3 grid grid-rows-3 gap-1.5 text-sm text-[#718096]">
                            {/* Location */}
                            <div className="flex min-h-6 items-center gap-2">
                              <MapPin className="shrink-0" size={16} />
                              <span className="truncate" title={camp.location}>
                                {camp.location}
                              </span>
                            </div>

                            {/* Grades */}
                            {camp.gradeDisplay ? (
                              <div className="flex min-h-6 items-start gap-2">
                                <GraduationCap
                                  className="mt-0.5 shrink-0"
                                  size={16}
                                />
                                <span
                                  className="line-clamp-1"
                                  title={`ระดับชั้น: ${camp.gradeDisplay}`}
                                >
                                  ระดับชั้น: {camp.gradeDisplay}
                                </span>
                              </div>
                            ) : (
                              <div aria-hidden="true" className="min-h-6" />
                            )}

                            {/* Date */}
                            <div className="flex min-h-6 items-center gap-2">
                              <Calendar className="shrink-0" size={16} />
                              <span className="truncate">
                                {camp.startDate} - {camp.endDate}
                              </span>
                            </div>
                          </div>

                          {/* Footer */}
                          <div
                            className="flex justify-between items-center pt-4 border-t border-[#e2e8f0] mt-auto cursor-pointer hover:bg-gray-50/50 -mx-4 px-4 -mb-4 pb-4 rounded-b-2xl transition-colors"
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              setEnrollmentCampId(camp.id);
                              setEnrollmentCampName(camp.title);
                              setIsEnrollmentModalOpen(true);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                event.stopPropagation();
                                setEnrollmentCampId(camp.id);
                                setEnrollmentCampName(camp.title);
                                setIsEnrollmentModalOpen(true);
                              }
                            }}
                          >
                            <span className="text-[#718096] text-sm">
                              {camp.totalStudents > 0
                                ? `ลงทะเบียนแล้ว ${camp.enrolled}/${camp.totalStudents} คน`
                                : `ลงทะเบียนแล้ว ${camp.enrolled} คน`}
                            </span>
                            <div className="flex items-center gap-1 text-[#5d7c6f] font-medium text-sm">
                              ดูรายละเอียด
                              <ChevronRight size={18} />
                            </div>
                          </div>
                        </CardBody>
                      </Card>
                    </div>
                  ))}
                </div>

                {!loading && campTotalPages > 1 && (
                  <div className="flex justify-center items-center mt-8">
                    <Pagination
                      isCompact
                      showControls
                      classNames={{
                        cursor: "bg-[#5d7c6f] text-white font-bold",
                      }}
                      color="default"
                      page={campPage}
                      total={campTotalPages}
                      onChange={setCampPage}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      <SelectProjectTypeModal
        isOpen={isSelectTypeOpen}
        onClose={() => setIsSelectTypeOpen(false)}
        onSelect={handleProjectTypeSelect}
      />

      <CreateCampModal
        isLoading={isSubmitting}
        isOpen={isCreateCampOpen}
        projectType={selectedProjectType}
        templateData={selectedTemplateData}
        onClose={() => {
          setIsCreateCampOpen(false);
          setSelectedProjectType(null);
          setSelectedTemplateData(null);
        }}
        onSubmit={handleCreateCampSubmit}
      />

      <EnrollmentModal
        campId={enrollmentCampId ?? 0}
        campName={enrollmentCampName}
        isOpen={isEnrollmentModalOpen}
        onClose={() => setIsEnrollmentModalOpen(false)}
      />

      <EditCampModal
        campData={editingCampData}
        isLoading={isSubmitting}
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingCampData(null);
        }}
        onSubmit={handleEditSubmit}
      />

      <HomeroomStudentModal
        isOpen={!!selectedStudent}
        student={selectedStudent}
        onClose={() => setSelectedStudent(null)}
      />
    </div>
  );
}

export default function StudentDashboard() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}
