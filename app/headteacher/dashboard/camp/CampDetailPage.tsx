"use client";

import { useState, useEffect, useMemo } from "react";
import {
  useRouter,
  useParams,
  usePathname,
  useSearchParams,
} from "next/navigation";
import Image from "next/image";
import {
  ChevronUp,
  ChevronDown,
  MapPin,
  Calendar,
  Clock,
  Shirt,
  Award,
  BarChart3,
  Plus,
  Target,
  Pencil,
  Trash2,
  ClipboardList,
  Users,
  GraduationCap,
  UserCheck,
  TrendingUp,
  BookOpen,
  FileText,
  Bus,
} from "lucide-react";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";

import EditCampModal from "./EditCampModal";
import EditCertificateModal from "./EditCertificateModal";
import CreateBaseModal from "./CreateBaseModal";
import EditBaseModal from "./EditBaseModal";
import CreateSurveyModal from "./CreateSurveyModal";
import SurveyResultsModal from "./SurveyResultsModal";
import TrackingModal from "./TrackingModal";
import ShirtTrackingModal from "./ShirtTrackingModal";
import AttendanceModal from "./AttendanceModal";
import CampBreadcrumb from "./CampBreadcrumb";
import BusManagementModal from "./BusManagementModal";
import PrePostTestModal from "./PrePostTestModal";

import { useStatusModal } from "@/components/StatusModalProvider";
import {
  BANGKOK_TIME_ZONE,
  formatCampScheduleDate,
  getCampScheduleSlotState,
  isCampScheduleDayToday,
} from "@/lib/bangkok-date";
import {
  getCleanBasePath,
  getCleanCampPath,
  rememberActiveBaseId,
} from "@/lib/client-active-camp";

interface TimeSlot {
  startTime: string;
  endTime: string;
  activity: string;
}

interface DaySchedule {
  day: number;
  timeSlots: TimeSlot[];
}

interface CampDetail {
  camp_id: number;
  name: string;
  location: string;
  start_date: string;
  end_date: string;
  start_regis_date: string;
  end_regis_date: string;
  description: string;
  grade_level: string;
  grades?: string[];
  gradeDisplay?: string;
  gradeDisplayList?: { type: string; grades: string[] }[];
  has_shirt: boolean;
  has_transport?: boolean;
  start_shirt_date?: string;
  end_shirt_date?: string;
  img_shirt_url?: string;
  img_camp_url?: string;
  img_certificate_url?: string;
  cert_name_x?: number;
  cert_name_y?: number;
  cert_font_size?: number;
  cert_font_color?: string;
  cert_show_number?: boolean;
  cert_number_start?: number | null;
  cert_number_end?: number | null;
  cert_number_x?: number | null;
  cert_number_y?: number | null;
  cert_number_size?: number | null;
  cert_number_color?: string | null;
  cert_number_prefix?: string | null;
  cert_number_is_thai?: boolean;
  daily_schedule: any;
  status: string;
  plan_type?: any;
  camp_classroom?: any[];
  _count?: {
    student_enrollment: number;
  };
  plan_type_name?: string;
  station?: any[];
  isOwner?: boolean;
  isHomeroomTeacher?: boolean;
  isBusTeacher?: boolean;
  created_by_teacher_id?: number;
  location_sharing_enabled?: boolean;
  destination_name?: string | null;
  destination_address?: string | null;
  destination_latitude?: number | null;
  destination_longitude?: number | null;
  total_eligible_students?: number;
  enrolled_student_count?: number;
  total_mission_count?: number;
  certificate_candidate_count?: number;
  student_enrollment?: any[];
}

function CampSkeletonBlock({ className }: { className: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-lg bg-gray-200 ${className}`}
    />
  );
}

function CampOverviewSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="กำลังโหลดข้อมูลค่าย"
      className="min-h-screen bg-[#f5f5f2]"
    >
      <div className="max-w-[1240px] mx-auto px-3 pt-3 pb-1">
        <div className="flex items-center gap-0.5 mb-3">
          <CampSkeletonBlock className="h-3.5 w-3.5 rounded-full" />
          <CampSkeletonBlock className="h-3 w-28" />
        </div>

        <div className="relative min-h-[220px] rounded-[1.5rem] bg-[#dfe8e3] p-5 md:p-6 flex flex-col justify-end overflow-hidden">
          <CampSkeletonBlock className="h-3 w-16 bg-white/60" />
          <CampSkeletonBlock className="h-6 w-1/2 max-w-sm mt-2 bg-white/70" />
          <div className="flex flex-col sm:flex-row gap-4 mt-4">
            <CampSkeletonBlock className="h-4 w-32 bg-white/60" />
            <CampSkeletonBlock className="h-4 w-40 bg-white/60" />
          </div>
        </div>
      </div>

      <div className="max-w-[1240px] mx-auto px-3 py-5">
        <div className="grid grid-cols-3 gap-3 mb-6">
          {Array.from({ length: 3 }, (_, index) => (
            <div
              key={index}
              className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm"
            >
              <CampSkeletonBlock className="h-7 w-16 mx-auto" />
              <CampSkeletonBlock className="h-2.5 w-8 mx-auto mt-2" />
              <CampSkeletonBlock className="h-3 w-20 mx-auto mt-2" />
            </div>
          ))}
        </div>

        <div className="mb-6">
          <CampSkeletonBlock className="h-5 w-24 mb-3" />
          <CampSkeletonBlock className="h-3 w-48 mb-3" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => (
              <div
                key={index}
                className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm"
              >
                <CampSkeletonBlock className="h-6 w-6 rounded-full mx-auto" />
                <CampSkeletonBlock className="h-3 w-28 mx-auto mt-3" />
              </div>
            ))}
          </div>
        </div>

        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            className="bg-white rounded-xl shadow-sm overflow-hidden mb-6"
          >
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
              <CampSkeletonBlock className="h-8 w-8 rounded-lg" />
              <CampSkeletonBlock className="h-4 w-24" />
            </div>
            <div className="px-4 py-4 space-y-3">
              <CampSkeletonBlock className="h-3 w-40" />
              <CampSkeletonBlock className="h-3 w-64 max-w-full" />
              <CampSkeletonBlock className="h-3 w-52 max-w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CampDetailPage() {
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
  const params = useParams();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const campId = params?.id;
  const isEdit = searchParams.get("edit");
  const campMenu = searchParams.get("menu");
  const showOverviewManagementCards: boolean = false;

  const [camp, setCamp] = useState<CampDetail | null>(null);
  const { showError, showSuccess, showConfirm, setIsLoading } =
    useStatusModal();
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editModalTargetSection, setEditModalTargetSection] = useState<
    "info" | "schedule" | "shirt" | "all"
  >("all");

  const handleOpenEditModal = (
    section: "info" | "schedule" | "shirt" | "all" = "all",
  ) => {
    setEditModalTargetSection(section);
    setIsEditModalOpen(true);
  };
  const [isEditCertificateModalOpen, setIsEditCertificateModalOpen] =
    useState(false);
  const [isCreateBaseModalOpen, setIsCreateBaseModalOpen] = useState(false);
  const [isEditBaseModalOpen, setIsEditBaseModalOpen] = useState(false);
  const [selectedBase, setSelectedBase] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [navigatingToBase, setNavigatingToBase] = useState<number | null>(null);

  // Survey state
  const [survey, setSurvey] = useState<any>(null);
  const [isCreateSurveyModalOpen, setIsCreateSurveyModalOpen] = useState(false);
  const [isEditSurveyModalOpen, setIsEditSurveyModalOpen] = useState(false);
  const [surveyLoading, setSurveyLoading] = useState(false);
  const [isSurveyResultsModalOpen, setIsSurveyResultsModalOpen] =
    useState(false);
  const [isTrackingModalOpen, setIsTrackingModalOpen] = useState(false);
  const [isShirtModalOpen, setIsShirtModalOpen] = useState(false);
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
  const [isBusModalOpen, setIsBusModalOpen] = useState(false);
  const [isPrePostTestModalOpen, setIsPrePostTestModalOpen] = useState(false);
  const [isStudentsLoading, setIsStudentsLoading] = useState(false);
  const [shirtCount, setShirtCount] = useState<number | null>(null);
  const [isShirtOpen, setIsShirtOpen] = useState(true);
  const [isScheduleOpen, setIsScheduleOpen] = useState(true);
  const [scheduleNow, setScheduleNow] = useState(() => new Date());
  const [isInfoOpen, setIsInfoOpen] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const shirtImages = useMemo(() => {
    if (!camp?.img_shirt_url) return [];
    try {
      const parsed = JSON.parse(camp.img_shirt_url);

      return Array.isArray(parsed)
        ? parsed.filter((url: any) => url)
        : [camp.img_shirt_url];
    } catch (e) {
      return [camp.img_shirt_url];
    }
  }, [camp?.img_shirt_url]);

  useEffect(() => {
    window.scrollTo(0, 0); // เลื่อนขึ้นไปบนสุดทุกครั้งที่เข้าหน้าค่าย
    if (campId) {
      fetchCampDetail();
      fetchSurvey();
      fetchShirtCount();
    }
    if (isEdit === "true") {
      setIsEditModalOpen(true);
      // Clean up the URL to remove the query param so it doesn't re-trigger on refresh
      router.replace(getCleanCampPath());
    }
  }, [campId, isEdit]);

  useEffect(() => {
    const intervalId = window.setInterval(
      () => setScheduleNow(new Date()),
      30_000,
    );

    return () => window.clearInterval(intervalId);
  }, []);

  const clearCampMenu = () => {
    const nextParams = new URLSearchParams(searchParams.toString());

    nextParams.delete("menu");
    const query = nextParams.toString();

    router.replace(`${pathname}${query ? `?${query}` : ""}`, {
      scroll: false,
    });
  };

  useEffect(() => {
    if (!camp || loading || !campMenu) return;

    if (campMenu === "tracking") {
      setIsTrackingModalOpen(true);
    } else if (campMenu === "attendance") {
      setIsAttendanceModalOpen(true);
    } else if (campMenu === "bus" && camp.has_transport) {
      setIsBusModalOpen(true);
    } else if (campMenu === "shirts" && camp.has_shirt) {
      setIsShirtModalOpen(true);
    } else if (campMenu === "base" && camp.isOwner) {
      setIsCreateBaseModalOpen(true);
    } else if (campMenu === "survey" && camp.isOwner && !surveyLoading) {
      if (survey) {
        setIsSurveyResultsModalOpen(true);
      } else {
        setIsCreateSurveyModalOpen(true);
      }
    } else if (campMenu === "compare" && camp.isOwner) {
      setIsPrePostTestModalOpen(true);
    } else if (campMenu === "certificate" && camp.isOwner) {
      setIsEditCertificateModalOpen(true);
    }
  }, [camp, campMenu, loading, survey, surveyLoading]);

  const fetchShirtCount = async () => {
    try {
      const res = await fetch(`/api/camps/${campId}/shirts`);

      if (res.ok) {
        const data = await res.json();

        setShirtCount(data.totalShirts ?? 0);
      }
    } catch {
      setShirtCount(null);
    }
  };

  const fetchSurvey = async () => {
    setSurveyLoading(true);
    try {
      const res = await fetch(`/api/surveys?campId=${campId}`);

      if (!res.ok) {
        setSurvey(null);

        return;
      }
      const data = await res.json();

      // data may be `null` if the survey is not found but returns 200
      setSurvey(data && !data.error ? data : null);
    } catch (err) {
      console.error("Error fetching survey:", err);
    } finally {
      setSurveyLoading(false);
    }
  };

  const handleDeleteSurvey = () => {
    showConfirm(
      "ยืนยันการลบ",
      "คุณแน่ใจหรือไม่ว่าต้องการลบแบบสอบถามนี้? ข้อมูลคำตอบทั้งหมดจะถูกลบด้วย",
      async () => {
        try {
          setIsLoading(true);
          const res = await fetch(`/api/surveys?campId=${campId}`, {
            method: "DELETE",
          });

          if (!res.ok) throw new Error();
          showSuccess("สำเร็จ", "ลบแบบสอบถามเรียบร้อยแล้ว");
          setSurvey(null);
        } catch {
          showError("ข้อผิดพลาด", "ไม่สามารถลบแบบสอบถามได้");
        } finally {
          setIsLoading(false);
        }
      },
      "ลบแบบสอบถาม",
    );
  };

  const fetchCampDetail = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/camps/${campId}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        console.error("Failed to fetch camp detail, status:", response.status);
        setCamp(null);

        return;
      }

      const data = await response.json();

      // ดึง grade_level และ plan_type จาก camp_classroom
      const gradesSet = new Set<string>();
      let planTypeName = "MSEC"; // default

      if (data.camp_classroom && data.camp_classroom.length > 0) {
        data.camp_classroom.forEach((cc: any) => {
          if (cc.classroom?.grade) {
            gradesSet.add(cc.classroom.grade);
          }
        });

        const firstClassroom = data.camp_classroom[0].classroom;

        if (firstClassroom) {
          planTypeName = firstClassroom.classroom_types?.name || "MSEC";
        }
      }

      // ถ้าไม่มีจาก classroom ให้ลองดูจาก plan_type
      if ((!planTypeName || planTypeName === "MSEC") && data.plan_type) {
        planTypeName = data.plan_type.name || "MSEC";
      }

      // ดึง daily_schedule จาก camp_daily_schedule
      let dailySchedule = [];

      if (data.camp_daily_schedule && data.camp_daily_schedule.length > 0) {
        dailySchedule = data.camp_daily_schedule
          .sort((a: any, b: any) => a.day - b.day)
          .map((schedule: any) => ({
            day: schedule.day,
            timeSlots: schedule.time_slots.map((slot: any) => ({
              startTime: slot.startTime || slot.start_time,
              endTime: slot.endTime || slot.end_time,
              activity: slot.activity,
            })),
          }));
      }

      data.grade_level = Array.from(gradesSet).join(",");
      data.plan_type_name = planTypeName;
      data.daily_schedule = dailySchedule;

      setCamp(data);
    } catch (error) {
      console.error("Error fetching camp detail:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditBase = (base: any, e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigatingToBase !== null) return;
    setSelectedBase(base);
    setIsEditBaseModalOpen(true);
  };

  const handleDeleteBase = (baseId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigatingToBase !== null) return;

    showConfirm(
      "ยืนยันการลบ",
      "คุณแน่ใจหรือไม่ว่าต้องการลบฐานกิจกรรมนี้? ข้อมูลภารกิจทั้งหมดในฐานนี้จะถูกลบไปด้วย",
      async () => {
        try {
          setIsLoading(true);
          const response = await fetch(`/api/stations/${baseId}`, {
            method: "DELETE",
          });

          if (!response.ok) {
            throw new Error("Failed to delete base");
          }

          showSuccess("สำเร็จ", "ลบฐานกิจกรรมเรียบร้อยแล้ว");
          fetchCampDetail();
        } catch (error) {
          console.error("Error deleting base:", error);
          showError("ข้อผิดพลาด", "ไม่สามารถลบฐานกิจกรรมได้");
        } finally {
          setIsLoading(false);
        }
      },
      "ลบฐานกิจกรรม",
    );
  };

  const handleDeleteCamp = () => {
    showConfirm(
      "ยืนยันการลบค่าย",
      "คุณแน่ใจหรือไม่ว่าต้องการลบค่ายนี้? ข้อมูลทั้งหมดที่เกี่ยวข้องจะถูกลบและไม่สามารถกู้คืนได้",
      async () => {
        try {
          setIsLoading(true);
          const response = await fetch(`/api/camps/${campId}`, {
            method: "DELETE",
          });

          if (!response.ok) {
            throw new Error("Failed to delete camp");
          }

          showSuccess("สำเร็จ", "ลบค่ายเรียบร้อยแล้ว");
          router.push("/headteacher/dashboard");
        } catch (error) {
          console.error("Error deleting camp:", error);
          showError("ข้อผิดพลาด", "ไม่สามารถลบค่ายได้");
        } finally {
          setIsLoading(false);
        }
      },
      "ลบค่าย",
    );
  };

  const handleEditSubmit = async (formData: any) => {
    try {
      setIsEditing(true);

      let img_shirt_url = formData.shirtImage || "";
      let img_camp_url = formData.campImage || "";

      // Upload new shirt images if files were picked
      let finalShirtUrls: (string | null)[] = [];

      try {
        const parsed = JSON.parse(
          formData.shirtImages ? JSON.stringify(formData.shirtImages) : "[]",
        );

        finalShirtUrls = Array.isArray(parsed)
          ? parsed.filter((url: any) => url != null)
          : [formData.shirtImages];
      } catch (e) {
        finalShirtUrls = [formData.shirtImages];
      }

      if (formData.shirtImageFiles && Array.isArray(formData.shirtImageFiles)) {
        for (let i = 0; i < formData.shirtImageFiles.length; i++) {
          const file = formData.shirtImageFiles[i];

          if (file) {
            try {
              const compressedFile = await compressImage(file);
              const uploadForm = new FormData();

              uploadForm.append("file", compressedFile);
              const uploadRes = await fetch("/api/upload", {
                method: "POST",
                body: uploadForm,
              });

              if (uploadRes.ok) {
                const uploadData = await uploadRes.json();

                finalShirtUrls[i] = uploadData.url;
              }
            } catch (uploadErr) {
              console.error("Error during shirt upload:", uploadErr);
            }
          }
        }
      }
      img_shirt_url = JSON.stringify(finalShirtUrls);

      // Upload new camp image if a file was picked
      if (formData.campImageFile) {
        try {
          const compressedFile = await compressImage(formData.campImageFile);
          const uploadForm = new FormData();

          uploadForm.append("file", compressedFile);
          const uploadRes = await fetch("/api/upload", {
            method: "POST",
            body: uploadForm,
          });

          if (uploadRes.ok) {
            const uploadData = await uploadRes.json();

            img_camp_url = uploadData.url;
          } else {
            showError("อัปโหลดรูปล้มเหลว", "ไม่สามารถอัปโหลดรูปปกค่ายได้");
          }
        } catch (uploadErr) {
          console.error("Error during camp image upload:", uploadErr);
        }
      }

      const response = await fetch(`/api/camps/${campId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          img_shirt_url,
          img_camp_url,
          cert_name_x: formData.certNameX,
          cert_name_y: formData.certNameY,
          cert_font_size: formData.certFontSize,
        }),
      });

      if (!response.ok) throw new Error("Failed to update camp");

      await fetchCampDetail();
      setIsEditModalOpen(false);
      showSuccess("สำเร็จ", "อัปเดตข้อมูลค่ายเรียบร้อยแล้ว");
    } catch (error) {
      console.error("Error updating camp:", error);
      showError("Error", "Failed to update camp");
    } finally {
      setIsEditing(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);

    return date.toLocaleDateString("th-TH", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: BANGKOK_TIME_ZONE,
    });
  };

  const formatTime = (time: string) => {
    // ... existing formatTime
    if (!time) return "";

    return time.slice(0, 5); // แสดงแค่ HH:MM
  };

  if (loading) {
    return <CampOverviewSkeleton />;
  }

  if (!camp) {
    // ... existing not found state
    return (
      <div className="min-h-screen bg-[#f5f5f2] flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 text-lg">ไม่พบข้อมูลค่าย</p>
          <Button
            className="mt-4 bg-[#6b857a] text-white"
            onPress={() => router.push("/headteacher/dashboard")}
          >
            กลับไปยังหน้าหลัก
          </Button>
        </div>
      </div>
    );
  }

  const currentScheduleSlot = camp.daily_schedule
    ?.flatMap((day: any) =>
      (day.timeSlots || []).map((slot: any) => ({ day: day.day, slot })),
    )
    .find(
      ({ day, slot }: any) =>
        getCampScheduleSlotState(
          camp.start_date,
          day,
          slot.startTime,
          slot.endTime,
          scheduleNow,
        ) === "current",
    );

  // const totalActivities = ...

  return (
    <div className="min-h-screen bg-[#f5f5f2]">
      {/* Header Banner */}
      <div className="max-w-[1240px] mx-auto px-3 pt-3 pb-1 z-10">
        <CampBreadcrumb
          className="mb-3"
          currentPage={camp.name ? `ค่าย: ${camp.name}` : "รายละเอียดค่าย"}
        />

        <div
          className="relative w-full rounded-[1.5rem] overflow-hidden min-h-[220px] flex flex-col justify-end p-5 md:p-6 shadow-sm border border-gray-100"
          style={
            !camp.img_camp_url
              ? { background: "linear-gradient(to right, #6b857a, #8ea69b)" }
              : undefined
          }
        >
          {camp.img_camp_url && (
            <Image
              fill
              alt="Camp Cover"
              className="object-cover z-0"
              src={camp.img_camp_url}
            />
          )}
          {/* Dark overlay and Blur for readability */}
          <div className="absolute inset-0 bg-black/30 backdrop-blur-[3px] z-0" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent z-0" />

          <div className="relative z-10 w-full flex flex-col gap-2">
            {/* Title */}
            <h1 className="text-lg md:text-xl font-bold text-white mb-1">
              {camp.name}
            </h1>

            {/* Bottom Row */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 text-gray-200 text-xs md:text-sm font-medium">
                <div className="flex items-center gap-2">
                  <MapPin className="text-[#00C48C]" size={18} />
                  <span>{camp.location}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="text-[#00C48C]" size={18} />
                  <span>
                    {formatDate(camp.start_date)} – {formatDate(camp.end_date)}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                {camp.isOwner && (
                  <>
                    <Button
                      isIconOnly
                      className="bg-[#4a0d0d] text-white border border-[#ff847c]/10 hover:bg-[#5c1616] transition-colors h-10 w-10 rounded-lg"
                      onPress={handleDeleteCamp}
                    >
                      <Trash2 size={18} />
                    </Button>
                    <Button
                      className="bg-white text-[#1a3a32] font-bold hover:bg-gray-100 transition-colors h-10 px-3 sm:px-5 rounded-lg shadow-sm"
                      startContent={
                        <Pencil className="text-[#1a3a32]" size={16} />
                      }
                      onPress={() => handleOpenEditModal("all")}
                    >
                      <span className="hidden sm:inline">แก้ไขค่าย</span>
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[1240px] mx-auto px-3 py-5">
        {/* ... existing detailed content ... */}
        {/* Stats Summary */}
        <div
          className={`grid ${camp?.has_shirt ? "grid-cols-3" : "grid-cols-2"} gap-3 mb-6`}
        >
          {/* Participants Card */}
          <div className="bg-white border border-gray-100 rounded-xl p-3 flex flex-col items-center justify-center shadow-sm hover:shadow-md transition-shadow">
            <p className="text-xl md:text-2xl font-bold text-[#6b857a] mb-0.5">
              {camp?.enrolled_student_count ?? 0}
              {Math.max(
                camp?.enrolled_student_count ?? 0,
                camp?.total_eligible_students ?? 0,
              ) > 0 && (
                <>
                  <span className="text-lg text-gray-300 mx-1">/</span>
                  <span className="text-lg text-gray-400">
                    {Math.max(
                      camp?.enrolled_student_count ?? 0,
                      camp?.total_eligible_students ?? 0,
                    )}
                  </span>
                </>
              )}
            </p>
            <p className="text-gray-400 text-[9px] font-medium mb-1">คน</p>
            <p className="text-[#1a3a32] font-semibold text-xs">ผู้เข้าร่วม</p>
          </div>

          {/* Missions Card */}
          <div className="bg-white border border-gray-100 rounded-xl p-3 flex flex-col items-center justify-center shadow-sm hover:shadow-md transition-shadow">
            <p className="text-xl md:text-2xl font-bold text-[#6b857a] mb-0.5">
              {camp?.total_mission_count ?? 0}
            </p>
            <p className="text-gray-400 text-[9px] font-medium mb-1">ภารกิจ</p>
            <p className="text-[#1a3a32] font-semibold text-xs">
              ภารกิจทั้งหมด
            </p>
          </div>

          {/* Shirt Reservations Card */}
          {camp?.has_shirt && (
            <div className="bg-white border border-gray-100 rounded-xl p-3 flex flex-col items-center justify-center shadow-sm hover:shadow-md transition-shadow">
              <p className="text-xl md:text-2xl font-bold text-[#6b857a] mb-0.5">
                {shirtCount ?? 0}
              </p>
              <p className="text-gray-400 text-[9px] font-medium mb-1">คน</p>
              <p className="text-[#1a3a32] font-semibold text-xs">จองเสื้อ</p>
            </div>
          )}
        </div>

        {/* Quick Actions are now provided by the camp Sidebar. */}
        {camp
          ? false && (
              <div className="mb-8">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {camp?.isOwner && (
                    <button
                      className="bg-white hover:bg-[#f0f4f2] border-gray-100 hover:border-[#6b857a] rounded-2xl p-6 transition-all flex flex-col items-center justify-center gap-3 group border shadow-sm cursor-pointer"
                      onClick={() =>
                        router.push(getCleanCampPath("project-document"))
                      }
                    >
                      <div className="text-[#6b857a] group-hover:scale-110 transition-transform">
                        <FileText size={32} />
                      </div>
                      <span className="font-semibold text-sm text-center text-gray-700">
                        เอกสาร
                        <br />
                        โครงการ
                      </span>
                    </button>
                  )}
                  {camp?.isOwner && (
                    <button
                      className="bg-white hover:bg-[#f0f4f2] border-gray-100 hover:border-[#6b857a] rounded-2xl p-6 transition-all flex flex-col items-center justify-center gap-3 group border shadow-sm cursor-pointer"
                      onClick={() => setIsCreateBaseModalOpen(true)}
                    >
                      <div className="text-[#6b857a] group-hover:scale-110 transition-transform">
                        <Target size={32} />
                      </div>
                      <span className="font-semibold text-sm text-center text-gray-700">
                        สร้าง
                        <br />
                        ฐานกิจกรรม
                      </span>
                    </button>
                  )}

                  {camp?.isOwner && (
                    <button
                      className={`rounded-2xl p-6 transition-all flex flex-col items-center justify-center gap-3 group border shadow-sm bg-white hover:bg-[#f0f4f2] border-gray-100 hover:border-[#6b857a] cursor-pointer`}
                      onClick={() =>
                        survey !== null
                          ? setIsSurveyResultsModalOpen(true)
                          : setIsCreateSurveyModalOpen(true)
                      }
                    >
                      <div
                        className={`text-[#6b857a] group-hover:scale-110 transition-transform`}
                      >
                        {survey !== null ? (
                          <BarChart3 size={32} />
                        ) : (
                          <ClipboardList size={32} />
                        )}
                      </div>
                      <span
                        className={`font-semibold text-sm text-center text-gray-700`}
                      >
                        {survey !== null ? (
                          <>
                            ดูผลการ
                            <br />
                            ตอบกลับ
                          </>
                        ) : (
                          <>
                            สร้าง
                            <br />
                            แบบสอบถาม
                          </>
                        )}
                      </span>
                    </button>
                  )}

                  {camp?.has_transport &&
                    (camp?.isOwner || camp?.isHomeroomTeacher) && (
                      <button
                        className={`bg-white rounded-2xl p-6 transition-all flex flex-col items-center justify-center gap-3 border shadow-sm ${
                          camp?.has_shirt
                            ? "hover:bg-[#f0f4f2] border-gray-100 hover:border-[#6b857a] group cursor-pointer"
                            : "opacity-50 cursor-not-allowed border-gray-100 bg-gray-50"
                        }`}
                        disabled={!camp?.has_shirt}
                        onClick={() => setIsShirtModalOpen(true)}
                      >
                        <div
                          className={`text-[#6b857a] ${
                            camp?.has_shirt
                              ? "group-hover:scale-110 transition-transform"
                              : ""
                          }`}
                        >
                          <Shirt size={32} />
                        </div>
                        <span className="font-semibold text-sm text-center text-gray-700">
                          รายการ
                          <br />
                          จองเสื้อ
                        </span>
                      </button>
                    )}

                  {camp?.isOwner && (
                    <button
                      className="bg-white hover:bg-[#f0f4f2] border-gray-100 hover:border-[#6b857a] rounded-2xl p-6 transition-all flex flex-col items-center justify-center gap-3 group border shadow-sm cursor-pointer"
                      onClick={() => setIsPrePostTestModalOpen(true)}
                    >
                      <div className="text-[#6b857a] group-hover:scale-110 transition-transform">
                        <TrendingUp size={32} />
                      </div>
                      <span className="font-semibold text-sm text-center text-gray-700">
                        เปรียบเทียบ
                        <br />
                        คะแนน
                      </span>
                    </button>
                  )}

                  <button
                    className="bg-white hover:bg-[#f0f4f2] border-gray-100 hover:border-[#6b857a] rounded-2xl p-6 transition-all flex flex-col items-center justify-center gap-3 group border shadow-sm cursor-pointer"
                    onClick={() => setIsTrackingModalOpen(true)}
                  >
                    <div className="text-[#6b857a] group-hover:scale-110 transition-transform">
                      <Users size={32} />
                    </div>
                    <span className="font-semibold text-sm text-center text-gray-700">
                      ติดตาม
                      <br />
                      นักเรียน
                    </span>
                  </button>

                  <button
                    className="bg-white hover:bg-[#f0f4f2] border-gray-100 hover:border-[#6b857a] rounded-2xl p-6 transition-all flex flex-col items-center justify-center gap-3 group border shadow-sm cursor-pointer"
                    onClick={() => router.push(getCleanCampPath("attendance"))}
                  >
                    <div className="text-[#6b857a] group-hover:scale-110 transition-transform">
                      <UserCheck size={32} />
                    </div>
                    <span className="font-semibold text-sm text-center text-gray-700">
                      เช็คชื่อ
                      <br />
                      นักเรียน
                    </span>
                  </button>

                  {(camp?.isOwner ||
                    camp?.isHomeroomTeacher ||
                    camp?.isBusTeacher) && (
                    <button
                      className="bg-white hover:bg-[#f0f4f2] border-gray-100 hover:border-[#6b857a] rounded-2xl p-6 transition-all flex flex-col items-center justify-center gap-3 group border shadow-sm cursor-pointer"
                      onClick={() =>
                        router.push(getCleanCampPath("bus-checkin"))
                      }
                    >
                      <div className="text-[#6b857a] group-hover:scale-110 transition-transform">
                        <Bus size={32} />
                      </div>
                      <span className="font-semibold text-sm text-center text-gray-700">
                        เช็คชื่อ
                        <br />
                        ขึ้นรถ
                      </span>
                    </button>
                  )}

                  {camp?.isOwner && (
                    <button
                      className="bg-white hover:bg-[#f0f4f2] border-gray-100 hover:border-[#6b857a] rounded-2xl p-6 transition-all flex flex-col items-center justify-center gap-3 group border shadow-sm cursor-pointer"
                      onClick={() => setIsEditCertificateModalOpen(true)}
                    >
                      <div className="text-[#6b857a] group-hover:scale-110 transition-transform">
                        <Award size={32} />
                      </div>
                      <span className="font-semibold text-sm text-center text-gray-700">
                        ตั้งค่า
                        <br />
                        เกียรติบัตร
                      </span>
                    </button>
                  )}

                  <button
                    className="bg-white hover:bg-[#f0f4f2] border-gray-100 hover:border-[#6b857a] rounded-2xl p-6 transition-all flex flex-col items-center justify-center gap-3 group border shadow-sm cursor-pointer"
                    disabled={isStudentsLoading}
                    onClick={() => {
                      setIsStudentsLoading(true);
                      router.push(getCleanCampPath("students"));
                    }}
                  >
                    <div className="text-[#6b857a] group-hover:scale-110 transition-transform flex items-center justify-center w-[32px] h-[32px]">
                      {isStudentsLoading ? (
                        <div className="w-8 h-8 border-3 border-[#6b857a] border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <BookOpen size={32} />
                      )}
                    </div>
                    <span className="font-semibold text-sm text-center text-gray-700">
                      ข้อมูล
                      <br />
                      นักเรียน
                    </span>
                  </button>
                </div>
              </div>
            )
          : null}

        {/* Quick Actions */}
        <div className="mb-6">
          <div className="mb-3">
            <h3 className="text-base font-semibold text-gray-900">เมนูด่วน</h3>
            <p className="text-xs text-gray-500">
              งานที่ใช้บ่อยระหว่างดำเนินค่าย
            </p>
          </div>
          <div
            className={`grid ${
              camp?.has_transport &&
              (camp.isOwner || camp.isHomeroomTeacher || camp.isBusTeacher)
                ? "grid-cols-3"
                : "grid-cols-2"
            } gap-2 sm:gap-3`}
          >
            <button
              className="group flex min-h-[8rem] cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-gray-100 bg-white p-2 shadow-sm transition-all hover:border-[#6b857a] hover:bg-[#f0f4f2] sm:gap-2 sm:p-4"
              onClick={() => router.push(getCleanCampPath("students"))}
            >
              <BookOpen
                className="h-6 w-6 text-[#6b857a] transition-transform group-hover:scale-110 sm:h-8 sm:w-8"
                size={32}
              />
              <span className="text-center text-xs font-semibold leading-tight text-gray-700 sm:text-sm">
                ข้อมูลนักเรียน
              </span>
            </button>

            {camp?.has_transport &&
              (camp.isOwner || camp.isHomeroomTeacher || camp.isBusTeacher) && (
                <button
                  className="group flex min-h-[8rem] cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-gray-100 bg-white p-2 shadow-sm transition-all hover:border-[#6b857a] hover:bg-[#f0f4f2] sm:gap-2 sm:p-4"
                  onClick={() => router.push(getCleanCampPath("bus-checkin"))}
                >
                  <Bus
                    className="h-6 w-6 text-[#6b857a] transition-transform group-hover:scale-110 sm:h-8 sm:w-8"
                    size={32}
                  />
                  <span className="text-center text-xs font-semibold leading-tight text-gray-700 sm:text-sm">
                    เช็คชื่อขึ้นรถ
                  </span>
                </button>
              )}

            <button
              className="group flex min-h-[8rem] cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-gray-100 bg-white p-2 shadow-sm transition-all hover:border-[#6b857a] hover:bg-[#f0f4f2] sm:gap-2 sm:p-4"
              onClick={() => router.push(getCleanCampPath("tracking"))}
            >
              <Users
                className="h-6 w-6 text-[#6b857a] transition-transform group-hover:scale-110 sm:h-8 sm:w-8"
                size={32}
              />
              <span className="text-center text-xs font-semibold leading-tight text-gray-700 sm:text-sm">
                ติดตามนักเรียน
              </span>
            </button>
          </div>
        </div>

        {/* Camp Information - Collapsible */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
          {/* Header - clickable toggle */}
          <div
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer"
            onClick={() => setIsInfoOpen((prev) => !prev)}
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#f0f4f2] flex items-center justify-center flex-shrink-0">
                <MapPin className="text-[#6b857a]" size={16} />
              </div>
              <h3 className="text-sm font-semibold text-gray-900">
                ข้อมูลค่าย
              </h3>
            </div>
            <div className="flex items-center gap-2">
              {camp?.isOwner && (
                <button
                  type="button"
                  className="flex items-center gap-1.5 p-2 sm:px-3 sm:py-1.5 rounded-lg text-xs font-semibold text-[#6b857a] bg-[#f0f4f2] hover:bg-[#6b857a] hover:text-white transition-all shadow-sm cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenEditModal("info");
                  }}
                  title="แก้ไขข้อมูลค่าย"
                >
                  <Pencil size={14} />
                  <span className="hidden sm:inline">แก้ไขข้อมูล</span>
                </button>
              )}
              <div className="text-gray-400 transition-transform duration-200">
                {isInfoOpen ? (
                  <ChevronUp size={18} />
                ) : (
                  <ChevronDown size={18} />
                )}
              </div>
            </div>
          </div>

          {/* Collapsible Body */}
          {isInfoOpen && (
            <div className="border-t border-gray-100 px-4 py-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 space-y-3 text-sm">
                  <div>
                    <div className="flex items-center gap-2 mb-2 font-medium text-gray-500">
                      <GraduationCap size={16} />
                      <span>ระดับชั้นที่เปิดรับ</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {camp.grades && camp.grades.length > 0 ? (
                        camp.grades.map((grade: string) => (
                          <Chip
                            key={grade}
                            className="bg-[#f0f4f2] text-[#5d7c6f] border border-[#d1e0d9]"
                            size="sm"
                            variant="flat"
                          >
                            {grade}
                          </Chip>
                        ))
                      ) : camp.grade_level ? (
                        camp.grade_level.split(",").map((grade: string) => (
                          <Chip
                            key={grade}
                            className="bg-[#f0f4f2] text-[#5d7c6f] border border-[#d1e0d9]"
                            size="sm"
                            variant="flat"
                          >
                            {grade.replace("Level_", "ม.")}
                          </Chip>
                        ))
                      ) : (
                        <span className="text-gray-400">ไม่ได้ระบุ</span>
                      )}
                    </div>
                  </div>

                  <div className="pt-2">
                    <p className="text-gray-500 mb-2 font-medium">
                      ประเภทห้องเรียน/แผนการเรียน
                    </p>
                    {camp.gradeDisplayList &&
                    camp.gradeDisplayList.length > 0 ? (
                      <div className="flex flex-wrap gap-2.5">
                        {camp.gradeDisplayList.map(
                          (item: { type: string; grades: string[] }) => (
                            <div
                              key={item.type}
                              className="flex flex-col sm:flex-row sm:items-center bg-white border border-[#e4ebe8] rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                            >
                              <div className="bg-[#f0f4f2] px-3 py-1.5 sm:py-2 border-b sm:border-b-0 sm:border-r border-[#e4ebe8]">
                                <span className="text-[#3d5248] font-semibold text-sm">
                                  {item.type}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-1.5 px-3 py-2">
                                {item.grades.map((g) => (
                                  <span
                                    key={g}
                                    className="bg-white text-[#6b857a] text-xs font-medium px-2 py-0.5 rounded-md border border-[#e4ebe8]"
                                  >
                                    {g}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ),
                        )}
                      </div>
                    ) : (
                      <p className="font-medium text-gray-900 leading-relaxed bg-gray-50 px-3 py-2 rounded-lg inline-block border border-gray-100">
                        {camp.gradeDisplay ||
                          camp.plan_type_name ||
                          "ไม่ได้ระบุ"}
                      </p>
                    )}
                  </div>

                  <div>
                    <p className="text-gray-500 mb-1">ช่วงเวลาเปิดรับสมัคร</p>
                    <p className="font-medium text-gray-900">
                      {camp.start_regis_date
                        ? formatDate(camp.start_regis_date)
                        : "N/A"}{" "}
                      -{" "}
                      {camp.end_regis_date
                        ? formatDate(camp.end_regis_date)
                        : "N/A"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Shirt Reservations - Collapsible */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
          {/* Header - clickable toggle */}
          <div
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer"
            onClick={() => setIsShirtOpen((prev) => !prev)}
          >
            <div className="flex items-center gap-2 flex-wrap">
              <div className="w-8 h-8 rounded-lg bg-[#f0f4f2] flex items-center justify-center flex-shrink-0">
                <Shirt className="text-[#6b857a]" size={16} />
              </div>
              <h3 className="text-sm font-semibold text-gray-900">
                การจองและจัดการเสื้อ
              </h3>
              {camp.has_shirt ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                  เปิดรับจอง
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block" />
                  ปิดรับจอง
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {camp?.isOwner && (
                <button
                  type="button"
                  className="flex items-center gap-1.5 p-2 sm:px-3 sm:py-1.5 rounded-lg text-xs font-semibold text-[#6b857a] bg-[#f0f4f2] hover:bg-[#6b857a] hover:text-white transition-all shadow-sm cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenEditModal("shirt");
                  }}
                  title="แก้ไขเสื้อค่าย"
                >
                  <Pencil size={14} />
                  <span className="hidden sm:inline">แก้ไขเสื้อค่าย</span>
                </button>
              )}
              <div className="text-gray-400 transition-transform duration-200">
                {isShirtOpen ? (
                  <ChevronUp size={18} />
                ) : (
                  <ChevronDown size={18} />
                )}
              </div>
            </div>
          </div>

          {/* Collapsible Body */}
          {isShirtOpen && (
            <div className="border-t border-gray-100 px-4 py-4">
              {camp.has_shirt ? (
                <div className="flex flex-col md:flex-row gap-4">
                  {/* Left: Status + Date */}
                  <div className="flex-1 space-y-4">
                    <div>
                      <p className="text-xs font-medium text-gray-400 mb-1">
                        ช่วงเวลาจอง
                      </p>
                      <p className="text-sm font-medium text-gray-700">
                        {camp.start_shirt_date && camp.end_shirt_date
                          ? `${formatDate(camp.start_shirt_date)} – ${formatDate(camp.end_shirt_date)}`
                          : "ไม่มีข้อมูล"}
                      </p>
                    </div>

                    {/* Show Shirt Images */}
                    {shirtImages.length > 0 && (
                      <div className="pt-1">
                        <p className="text-xs font-medium text-gray-400 mb-2">
                          ตัวอย่างเสื้อ
                        </p>
                        <div className="flex flex-wrap gap-3">
                          {shirtImages.map((img, idx) => (
                            <div
                              key={idx}
                              className="relative w-24 h-24 rounded-xl overflow-hidden border border-gray-100 shadow-sm bg-gray-50 flex items-center justify-center cursor-pointer"
                              onClick={() => setSelectedImage(img)}
                            >
                              <Image
                                fill
                                alt={`Shirt ${idx + 1}`}
                                className="object-cover hover:scale-110 transition-transform duration-300"
                                src={img}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right: Count + Button */}
                  {(camp.isOwner || camp.isHomeroomTeacher) && (
                    <div className="flex-shrink-0 w-full md:w-56 bg-white border border-gray-100 rounded-2xl p-5 flex flex-col justify-between shadow-sm">
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-xs font-medium text-gray-500">
                            ยอดการจองทั้งหมด
                          </p>
                          <div className="w-8 h-8 bg-[#f0f4f2] rounded-lg flex items-center justify-center">
                            <Shirt className="text-[#6b857a]" size={16} />
                          </div>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <p className="text-3xl font-extrabold text-gray-900">
                            {shirtCount !== null ? shirtCount : "—"}
                          </p>
                          <span className="text-sm font-medium text-gray-500">
                            ตัว
                          </span>
                        </div>
                      </div>

                      <button
                        className="w-full mt-4 flex items-center justify-center gap-2 text-xs font-semibold text-[#6b857a] bg-white border-2 border-[#6b857a] hover:bg-[#6b857a] hover:text-white rounded-lg py-2 px-3 transition-all"
                        onClick={() => setIsShirtModalOpen(true)}
                      >
                        ดูรายการทั้งหมด
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            d="M9 5l7 7-7 7"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                          />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 py-3 px-3 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="flex items-center gap-3">
                    <svg
                      className="w-5 h-5 text-gray-300 flex-shrink-0"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        clipRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        fillRule="evenodd"
                      />
                    </svg>
                    <p className="text-sm text-gray-500 font-medium">
                      ค่ายนี้ไม่ได้เปิดจองเสื้อ
                    </p>
                  </div>
                  {camp?.isOwner && (
                    <button
                      type="button"
                      className="text-xs font-semibold text-[#6b857a] bg-white border border-[#6b857a] hover:bg-[#6b857a] hover:text-white px-3 py-1.5 rounded-lg transition-all shadow-sm cursor-pointer"
                      onClick={() => handleOpenEditModal("shirt")}
                    >
                      + เปิดให้จองเสื้อค่าย
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Complete Schedule - Collapsible */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
          {/* Header - clickable toggle */}
          <div
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer"
            onClick={() => setIsScheduleOpen((prev) => !prev)}
          >
            <div className="flex items-center gap-2 flex-wrap">
              <div className="w-8 h-8 rounded-lg bg-[#f0f4f2] flex items-center justify-center flex-shrink-0">
                <Clock className="text-[#6b857a]" size={16} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900 text-left">
                  กำหนดการค่าย
                </h3>
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                {camp.daily_schedule?.length || 0} วัน
              </span>
              {currentScheduleSlot && (
                <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                  ตอนนี้: {currentScheduleSlot.slot.activity}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {camp?.isOwner && (
                <button
                  type="button"
                  className="flex items-center gap-1.5 p-2 sm:px-3 sm:py-1.5 rounded-lg text-xs font-semibold text-[#6b857a] bg-[#f0f4f2] hover:bg-[#6b857a] hover:text-white transition-all shadow-sm cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenEditModal("schedule");
                  }}
                  title="แก้ไขกำหนดการ"
                >
                  <Pencil size={14} />
                  <span className="hidden sm:inline">แก้ไขกำหนดการ</span>
                </button>
              )}
              <div className="text-gray-400 transition-transform duration-200">
                {isScheduleOpen ? (
                  <ChevronUp size={18} />
                ) : (
                  <ChevronDown size={18} />
                )}
              </div>
            </div>
          </div>

          {/* Collapsible Body */}
          {isScheduleOpen && (
            <div className="border-t border-gray-100 px-4 py-4 space-y-4">
              {camp.daily_schedule?.map((day: any, dayIndex: number) => {
                const isToday = isCampScheduleDayToday(
                  camp.start_date,
                  day.day,
                  scheduleNow,
                );

                return (
                  <div
                    key={dayIndex}
                    className={
                      isToday
                        ? "rounded-xl border border-emerald-200 bg-emerald-50/30 p-3"
                        : ""
                    }
                  >
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-semibold text-gray-700">
                        {day.day}
                      </div>
                      <h4 className="font-semibold text-gray-900">
                        วันที่ {day.day}
                      </h4>
                      {camp.start_date && (
                        <span className="text-xs text-gray-500 font-normal">
                          ({formatCampScheduleDate(camp.start_date, day.day)})
                        </span>
                      )}
                      {isToday && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                          วันนี้
                        </span>
                      )}
                    </div>

                    <div className="space-y-2 ml-10">
                      {day.timeSlots.map((slot: any, slotIndex: number) => {
                        const isCurrent =
                          getCampScheduleSlotState(
                            camp.start_date,
                            day.day,
                            slot.startTime,
                            slot.endTime,
                            scheduleNow,
                          ) === "current";

                        return (
                          <div
                            key={slotIndex}
                            aria-current={isCurrent ? "step" : undefined}
                            className={`flex flex-col items-stretch gap-2 rounded-lg p-3 transition-colors sm:flex-row sm:items-center sm:gap-3 ${
                              isCurrent
                                ? "bg-emerald-100 ring-1 ring-inset ring-emerald-300"
                                : "bg-gray-50 hover:bg-gray-100"
                            }`}
                          >
                            <div className="flex w-full flex-wrap items-center gap-2 text-gray-600 sm:w-auto sm:min-w-[120px] sm:flex-shrink-0">
                              <Clock size={16} />
                              <span className="text-xs font-medium">
                                {formatTime(slot.startTime)} -{" "}
                                {formatTime(slot.endTime)}
                              </span>
                              {isCurrent && (
                                <span className="flex items-center gap-1 whitespace-nowrap rounded-full bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white md:hidden">
                                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                                  กำลังดำเนินการ
                                </span>
                              )}
                            </div>
                            <div className="min-w-0 flex-1 md:flex md:items-center md:gap-2">
                              <p className="text-gray-900 font-medium">
                                {slot.activity}
                              </p>
                              {isCurrent && (
                                <span className="hidden items-center gap-1 whitespace-nowrap rounded-full bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white md:inline-flex">
                                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                                  กำลังดำเนินการ
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {(!camp.daily_schedule || camp.daily_schedule.length === 0) && (
                <div className="text-center py-6 text-gray-500">
                  <p className="mb-2">ไม่มีข้อมูลกำหนดการ</p>
                  {camp?.isOwner && (
                    <button
                      type="button"
                      className="text-xs font-semibold text-[#6b857a] bg-[#f0f4f2] hover:bg-[#6b857a] hover:text-white px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                      onClick={() => handleOpenEditModal("schedule")}
                    >
                      + เพิ่มกำหนดการ
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Activities and survey management remain available from the camp sidebar. */}
        {showOverviewManagementCards && camp?.isOwner && (
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="font-semibold text-gray-900 text-lg">
                  ฐานกิจกรรม
                </h3>
                <p className="text-sm text-gray-500">
                  จัดการฐานกิจกรรมและภารกิจ
                </p>
              </div>

              {camp.isOwner && (
                <Button
                  className="bg-[#6b857a] text-white"
                  isDisabled={navigatingToBase !== null}
                  onPress={() => {
                    if (navigatingToBase !== null) return;
                    setIsCreateBaseModalOpen(true);
                  }}
                >
                  สร้างฐานกิจกรรม
                </Button>
              )}
            </div>

            {camp.station && camp.station.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {camp.station.map((station: any) => (
                  <div
                    key={station.station_id}
                    className="p-4 rounded-xl border-2 border-gray-100 hover:border-[#6b857a] hover:bg-[#6b857a]/5 transition-all cursor-pointer group"
                    onClick={() => {
                      if (navigatingToBase !== null) return;
                      setNavigatingToBase(station.station_id);
                      rememberActiveBaseId(station.station_id);
                      router.push(getCleanBasePath());
                    }}
                  >
                    {navigatingToBase === station.station_id && (
                      <div className="absolute inset-0 flex items-center justify-center z-20 bg-white/60 rounded-xl">
                        <div className="w-8 h-8 border-3 border-[#6b857a] border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                    <div className="flex items-start justify-between mb-2">
                      <div className="p-2 bg-white rounded-lg border border-gray-100 group-hover:border-[#6b857a]/20">
                        <Target className="text-[#6b857a]" size={24} />
                      </div>
                      {/* ซ่อนปุ่มแก้ไข/ลบฐาน ถ้าไม่ใช่เจ้าของ */}
                      {camp.isOwner && (
                        <div className="flex gap-1">
                          <Button
                            isIconOnly
                            className="text-gray-400 hover:text-blue-500"
                            isDisabled={navigatingToBase !== null}
                            size="sm"
                            variant="light"
                            onClick={(e) => handleEditBase(station, e)}
                          >
                            <Pencil size={18} />
                          </Button>
                          <Button
                            isIconOnly
                            className="text-[#E84A5F] opacity-70 hover:opacity-100 hover:bg-[#E84A5F]/10 hover:text-[#FF847C]"
                            isDisabled={navigatingToBase !== null}
                            size="sm"
                            variant="light"
                            onClick={(e) =>
                              handleDeleteBase(station.station_id, e)
                            }
                          >
                            <Trash2 size={18} />
                          </Button>
                        </div>
                      )}
                    </div>
                    <h4 className="font-semibold text-gray-900 mb-1 line-clamp-2 break-words">
                      {station.name}
                    </h4>
                    <p className="text-sm text-gray-500 line-clamp-2 break-words">
                      {station.description || "ไม่มีคำอธิบาย"}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="text-center">
                  <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Target className="text-gray-400" size={32} />
                  </div>
                  <p className="text-gray-500 mb-4">ยังไม่ได้สร้างฐานกิจกรรม</p>
                  {camp.isOwner && (
                    <Button
                      className="bg-[#6b857a] text-white"
                      size="lg"
                      startContent={<Plus size={18} />}
                      onPress={() => setIsCreateBaseModalOpen(true)}
                    >
                      เริ่มสร้างฐานกิจกรรม
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {showOverviewManagementCards && camp?.isOwner && (
          <div className="bg-white rounded-2xl p-6 shadow-sm mt-8">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="font-semibold text-gray-900 text-lg">
                  แบบสอบถาม
                </h3>
                <p className="text-sm text-gray-500">
                  นักเรียนต้องทำแบบสอบถามก่อนดาวน์โหลดประกาศนียบัตร
                </p>
              </div>
              {camp.isOwner && !survey && (
                <Button
                  className="bg-[#6b857a] text-white justify-center px-8 py-4 "
                  onPress={() => setIsCreateSurveyModalOpen(true)}
                >
                  สร้างแบบสอบถาม
                </Button>
              )}
            </div>

            {surveyLoading ? (
              <div className="flex justify-center py-8">
                <div className="w-8 h-8 border-4 border-[#6b857a] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : survey ? (
              <div className="w-full">
                <div
                  className="p-4 rounded-xl border-2 border-gray-100 hover:border-[#6b857a] hover:bg-[#6b857a]/5 transition-all group cursor-pointer"
                  onClick={() => setIsSurveyResultsModalOpen(true)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="p-2 bg-white rounded-lg border border-gray-100 group-hover:border-[#6b857a]/20">
                      <ClipboardList className="text-[#6b857a]" size={24} />
                    </div>
                    {camp.isOwner && (
                      <div className="flex gap-1">
                        <Button
                          isIconOnly
                          className="text-gray-400 hover:text-blue-500"
                          size="sm"
                          variant="light"
                          onClick={() => setIsEditSurveyModalOpen(true)}
                        >
                          <Pencil size={18} />
                        </Button>
                        <Button
                          isIconOnly
                          className="text-[#E84A5F] opacity-70 hover:opacity-100 hover:bg-[#E84A5F]/10 hover:text-[#FF847C]"
                          size="sm"
                          variant="light"
                          onClick={handleDeleteSurvey}
                        >
                          <Trash2 size={18} />
                        </Button>
                      </div>
                    )}
                  </div>
                  <h4 className="font-semibold text-gray-900 mb-1">
                    {survey.title}
                  </h4>
                  <p className="text-sm text-gray-500 line-clamp-2">
                    {survey.description || "ไม่มีคำอธิบาย"}
                  </p>
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <ClipboardList size={14} />
                        <span>{survey.survey_question?.length || 0} คำถาม</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-[#6b857a] font-medium">
                        <Users size={14} />
                        <span>
                          {survey._count?.survey_response || 0} การตอบกลับ
                        </span>
                      </div>
                    </div>
                    <Button
                      className="bg-indigo-50 text-indigo-600 font-medium"
                      size="sm"
                      startContent={<BarChart3 size={14} />}
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsSurveyResultsModalOpen(true);
                      }}
                    >
                      ดูผลประเมิน
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="text-center">
                  <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <ClipboardList className="text-gray-400" size={32} />
                  </div>
                  <p className="text-gray-500 mb-4">ยังไม่ได้สร้างแบบสอบถาม</p>
                  {camp.isOwner && (
                    <Button
                      className="bg-[#6b857a] text-white"
                      size="lg"
                      startContent={<Plus size={24} />}
                      onPress={() => setIsCreateSurveyModalOpen(true)}
                    >
                      เริ่มสร้างแบบสอบถาม
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <EditCampModal
        campData={camp}
        targetSection={editModalTargetSection}
        isLoading={isEditing}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSubmit={handleEditSubmit}
      />

      <EditCertificateModal
        campData={camp}
        isOpen={isEditCertificateModalOpen}
        onClose={() => {
          setIsEditCertificateModalOpen(false);
          clearCampMenu();
        }}
        onSuccess={fetchCampDetail}
      />

      <CreateBaseModal
        campId={Number(campId)}
        isOpen={isCreateBaseModalOpen}
        onClose={() => {
          setIsCreateBaseModalOpen(false);
          clearCampMenu();
        }}
      />

      <EditBaseModal
        baseData={selectedBase}
        isOpen={isEditBaseModalOpen}
        onClose={() => {
          setIsEditBaseModalOpen(false);
          clearCampMenu();
        }}
        onSuccess={fetchCampDetail}
      />

      <CreateSurveyModal
        campId={Number(campId)}
        isOpen={isCreateSurveyModalOpen}
        teacherId={camp?.created_by_teacher_id || 0}
        onClose={() => {
          setIsCreateSurveyModalOpen(false);
          clearCampMenu();
        }}
        onSurveyCreated={fetchSurvey}
      />

      <CreateSurveyModal
        campId={Number(campId)}
        initialData={survey}
        isOpen={isEditSurveyModalOpen}
        teacherId={camp?.created_by_teacher_id || 0}
        onClose={() => {
          setIsEditSurveyModalOpen(false);
          clearCampMenu();
        }}
        onSurveyCreated={fetchSurvey}
      />

      <SurveyResultsModal
        campId={Number(campId)}
        isOpen={isSurveyResultsModalOpen}
        onClose={() => {
          setIsSurveyResultsModalOpen(false);
          clearCampMenu();
        }}
      />

      <TrackingModal
        campId={Number(campId)}
        campName={camp?.name || ""}
        isOpen={isTrackingModalOpen}
        locationTrackingEnabled={Boolean(camp?.location_sharing_enabled)}
        view="progress"
        onClose={() => {
          setIsTrackingModalOpen(false);
          clearCampMenu();
        }}
      />

      {camp && (
        <ShirtTrackingModal
          campId={camp.camp_id}
          campName={camp.name}
          isOpen={isShirtModalOpen}
          onClose={() => {
            setIsShirtModalOpen(false);
            clearCampMenu();
          }}
        />
      )}

      {camp && (
        <AttendanceModal
          campId={camp.camp_id}
          campName={camp.name}
          isOpen={isAttendanceModalOpen}
          onClose={() => {
            setIsAttendanceModalOpen(false);
            clearCampMenu();
          }}
        />
      )}
      {camp && (
        <BusManagementModal
          campId={camp.camp_id}
          campName={camp.name}
          isOpen={isBusModalOpen}
          onClose={() => {
            setIsBusModalOpen(false);
            clearCampMenu();
          }}
        />
      )}
      <PrePostTestModal
        campId={Number(campId)}
        isOpen={isPrePostTestModalOpen}
        onClose={() => {
          setIsPrePostTestModalOpen(false);
          clearCampMenu();
        }}
      />

      {selectedImage && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full h-full flex items-center justify-center">
            <button
              className="absolute top-4 right-4 bg-black/50 text-white rounded-full p-2 hover:bg-black/70 transition-colors z-10"
              onClick={() => setSelectedImage(null)}
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  d="M6 18L18 6M6 6l12 12"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                />
              </svg>
            </button>
            <img
              alt="Expanded view"
              className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
              src={selectedImage}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}
