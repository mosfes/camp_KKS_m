"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Chip } from "@heroui/chip";
import {
  Plus,
  Target,
  Search,
  Pencil,
  Trash2,
  CheckCircle2,
  Clock,
  Layers,
  LayoutGrid,
  LayoutList,
  MessageSquare,
  Camera,
  Video,
  QrCode,
  FileCheck,
  BarChart3,
  ArrowRight,
  Sparkles,
  HelpCircle,
} from "lucide-react";

import CreateBaseModal from "../../CreateBaseModal";
import EditBaseModal from "../../EditBaseModal";
import CampBreadcrumb from "../../CampBreadcrumb";

import { useStatusModal } from "@/components/StatusModalProvider";
import {
  getCleanBasePath,
  rememberActiveBaseId,
} from "@/lib/client-active-camp";

interface MissionSummary {
  mission_id: number;
  title: string | null;
  type: string;
}

interface Station {
  station_id: number;
  name: string;
  description: string | null;
  mission?: MissionSummary[];
  _count?: {
    mission: number;
  };
}

interface CampData {
  camp_id: number;
  name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  station: Station[];
  isOwner: boolean;
}

type FilterType = "all" | "has_missions" | "no_missions";
type SortType = "default" | "name_asc" | "name_desc" | "missions_desc";
type ViewMode = "grid" | "list";

// Helper for Mission Type Badges
function getMissionTypeMeta(type: string) {
  switch (type) {
    case "QUESTION_ANSWERING":
      return {
        label: "ถาม-ตอบ",
        icon: MessageSquare,
        color: "bg-amber-50 text-amber-700 border-amber-200",
      };
    case "PHOTO_SUBMISSION":
      return {
        label: "ถ่ายภาพ",
        icon: Camera,
        color: "bg-blue-50 text-blue-700 border-blue-200",
      };
    case "VIDEO_SUBMISSION":
      return {
        label: "วิดีโอ",
        icon: Video,
        color: "bg-purple-50 text-purple-700 border-purple-200",
      };
    case "QR_CODE_SCANNING":
      return {
        label: "สแกน QR",
        icon: QrCode,
        color: "bg-emerald-50 text-emerald-700 border-emerald-200",
      };
    case "MULTIPLE_CHOICE_QUIZ":
      return {
        label: "แบบทดสอบ (Quiz)",
        icon: FileCheck,
        color: "bg-indigo-50 text-indigo-700 border-indigo-200",
      };
    case "PRE_TEST":
      return {
        label: "Pre-test",
        icon: BarChart3,
        color: "bg-teal-50 text-teal-700 border-teal-200",
      };
    case "POST_TEST":
      return {
        label: "Post-test",
        icon: BarChart3,
        color: "bg-teal-50 text-teal-700 border-teal-200",
      };
    default:
      return {
        label: "ภารกิจ",
        icon: HelpCircle,
        color: "bg-gray-50 text-gray-700 border-gray-200",
      };
  }
}

function SkeletonBlock({ className }: { className: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-lg bg-gray-200 ${className}`}
    />
  );
}

function BasesPageSkeleton() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header skeleton */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <SkeletonBlock className="h-8 w-48" />
          <SkeletonBlock className="h-4 w-72" />
        </div>
        <SkeletonBlock className="h-11 w-40 rounded-xl" />
      </div>

      {/* KPI Cards skeleton */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
          >
            <div className="mb-3 flex items-center justify-between">
              <SkeletonBlock className="h-8 w-8 rounded-xl" />
              <SkeletonBlock className="h-4 w-12" />
            </div>
            <SkeletonBlock className="mb-1 h-7 w-16" />
            <SkeletonBlock className="h-3.5 w-24" />
          </div>
        ))}
      </div>

      {/* Control bar skeleton */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SkeletonBlock className="h-11 w-full max-w-md rounded-xl" />
        <div className="flex gap-2">
          <SkeletonBlock className="h-10 w-28 rounded-xl" />
          <SkeletonBlock className="h-10 w-20 rounded-xl" />
        </div>
      </div>

      {/* Cards skeleton */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm space-y-4"
          >
            <div className="flex items-center justify-between">
              <SkeletonBlock className="h-6 w-16 rounded-lg" />
              <SkeletonBlock className="h-6 w-24 rounded-full" />
            </div>
            <div className="space-y-2">
              <SkeletonBlock className="h-6 w-3/4" />
              <SkeletonBlock className="h-4 w-full" />
              <SkeletonBlock className="h-4 w-2/3" />
            </div>
            <div className="pt-2 border-t border-gray-100 flex justify-between items-center">
              <SkeletonBlock className="h-4 w-20" />
              <SkeletonBlock className="h-8 w-24 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function BasesPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const campId = Number(params.id);

  const { showError, showSuccess, showConfirm, setIsLoading } =
    useStatusModal();

  const [camp, setCamp] = useState<CampData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);

  // Filters & Views
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterType>("all");
  const [sortBy, setSortBy] = useState<SortType>("default");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  const fetchCamp = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/camps/${campId}?view=bases`);

      if (response.ok) {
        const data = await response.json();

        setCamp(data);
      } else {
        showError("ข้อผิดพลาด", "ไม่สามารถดึงข้อมูลฐานกิจกรรมได้");
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error fetching camp bases:", error);
      showError("ข้อผิดพลาด", "เกิดข้อผิดพลาดในการโหลดข้อมูล");
    } finally {
      setLoading(false);
    }
  }, [campId, showError]);

  useEffect(() => {
    void fetchCamp();
  }, [fetchCamp]);

  // Station counts & metrics
  const stations = useMemo(() => camp?.station || [], [camp]);

  const totalStations = stations.length;

  const totalMissions = useMemo(() => {
    return stations.reduce((sum, st) => {
      const count = st.mission?.length ?? st._count?.mission ?? 0;

      return sum + count;
    }, 0);
  }, [stations]);

  const activeStationsCount = useMemo(() => {
    return stations.filter(
      (st) => (st.mission?.length ?? st._count?.mission ?? 0) > 0,
    ).length;
  }, [stations]);

  const inactiveStationsCount = totalStations - activeStationsCount;

  // Filter & Search & Sort logic
  const filteredStations = useMemo(() => {
    let list = [...stations];

    // Search query
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();

      list = list.filter(
        (st) =>
          st.name.toLowerCase().includes(query) ||
          (st.description && st.description.toLowerCase().includes(query)) ||
          st.mission?.some(
            (m) => m.title && m.title.toLowerCase().includes(query),
          ),
      );
    }

    // Filter status
    if (filterStatus === "has_missions") {
      list = list.filter(
        (st) => (st.mission?.length ?? st._count?.mission ?? 0) > 0,
      );
    } else if (filterStatus === "no_missions") {
      list = list.filter(
        (st) => (st.mission?.length ?? st._count?.mission ?? 0) === 0,
      );
    }

    // Sorting
    if (sortBy === "name_asc") {
      list.sort((a, b) => a.name.localeCompare(b.name, "th"));
    } else if (sortBy === "name_desc") {
      list.sort((a, b) => b.name.localeCompare(a.name, "th"));
    } else if (sortBy === "missions_desc") {
      list.sort((a, b) => {
        const countA = a.mission?.length ?? a._count?.mission ?? 0;
        const countB = b.mission?.length ?? b._count?.mission ?? 0;

        return countB - countA;
      });
    } else {
      // default: by station_id asc
      list.sort((a, b) => a.station_id - b.station_id);
    }

    return list;
  }, [stations, searchQuery, filterStatus, sortBy]);

  // Delete Station Handler
  const handleDeleteStation = (station: Station, e: React.MouseEvent) => {
    e.stopPropagation();
    showConfirm(
      "ยืนยันการลบฐานกิจกรรม",
      `คุณต้องการลบฐาน "${station.name}" หรือไม่? ภารกิจและข้อมูลคำตอบทั้งหมดภายในฐานนี้จะถูกลบไปด้วย`,
      async () => {
        try {
          setIsLoading(true);
          const response = await fetch(`/api/stations/${station.station_id}`, {
            method: "DELETE",
          });

          if (!response.ok) {
            throw new Error("Failed to delete station");
          }

          showSuccess("สำเร็จ", "ลบฐานกิจกรรมเรียบร้อยแล้ว");
          fetchCamp();
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error("Error deleting station:", error);
          showError("ข้อผิดพลาด", "ไม่สามารถลบฐานกิจกรรมได้");
        } finally {
          setIsLoading(false);
        }
      },
      "ลบฐานกิจกรรม",
    );
  };

  // Edit Station Handler
  const handleOpenEdit = (station: Station, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedStation(station);
    setIsEditOpen(true);
  };

  const openStationMissions = (stationId: number) => {
    rememberActiveBaseId(stationId);
    router.push(getCleanBasePath());
  };

  const handleStationCardKeyDown = (
    stationId: number,
    e: React.KeyboardEvent<HTMLDivElement>,
  ) => {
    if (e.target !== e.currentTarget) return;

    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openStationMissions(stationId);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f2] px-4 pb-24 pt-8 sm:px-8">
      {loading ? (
        <BasesPageSkeleton />
      ) : (
        <div className="mx-auto max-w-7xl space-y-6">
          {/* Breadcrumb Navigation */}
          <CampBreadcrumb
            campId={campId}
            campName={camp?.name}
            currentPage="ฐานกิจกรรม"
          />

          {/* Page Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <Target className="shrink-0 text-[#6b857a]" size={20} />
                <h1 className="text-lg font-bold text-gray-900">ฐานกิจกรรม</h1>
                <Chip
                  className="border border-[#6b857a]/20 bg-[#6b857a]/10 font-medium text-[#6b857a]"
                  size="sm"
                  variant="flat"
                >
                  {totalStations} ฐาน
                </Chip>
              </div>
              <p className="mt-1 text-sm text-gray-500 font-normal">
                จัดการฐานกิจกรรมและภารกิจการเรียนรู้ของค่าย
              </p>
            </div>

            {camp?.isOwner && (
              <Button
                className="h-10 bg-[#6b857a] px-4 font-medium text-white shadow-sm transition-all hover:bg-[#5a7268] active:scale-95 shrink-0"
                radius="lg"
                size="sm"
                startContent={<Plus size={18} />}
                onPress={() => setIsCreateOpen(true)}
              >
                สร้างฐานกิจกรรม
              </Button>
            )}
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            {/* Card 1: Total Bases */}
            <div className="group relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:shadow-md hover:border-[#6b857a]/30">
              <div className="flex items-center justify-between mb-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f0f4f2] text-[#6b857a]">
                  <Target size={20} />
                </div>
                <span className="text-[11px] font-normal text-gray-400">
                  ฐานทั้งหมด
                </span>
              </div>
              <div className="text-2xl font-semibold text-gray-900">
                {totalStations}
              </div>
              <p className="mt-0.5 text-xs text-gray-500">ฐานทั้งหมดในค่าย</p>
            </div>

            {/* Card 2: Total Missions */}
            <div className="group relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:shadow-md hover:border-[#6b857a]/30">
              <div className="flex items-center justify-between mb-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                  <Layers size={20} />
                </div>
                <span className="text-[11px] font-normal text-gray-400">
                  ภารกิจทั้งหมด
                </span>
              </div>
              <div className="text-2xl font-semibold text-gray-900">
                {totalMissions}
              </div>
              <p className="mt-0.5 text-xs text-gray-500">รวมทุกฐานกิจกรรม</p>
            </div>

            {/* Card 3: Ready Stations */}
            <div className="group relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:shadow-md hover:border-[#6b857a]/30">
              <div className="flex items-center justify-between mb-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <CheckCircle2 size={20} />
                </div>
                <span className="text-[11px] font-normal text-gray-400">
                  มีภารกิจแล้ว
                </span>
              </div>
              <div className="text-2xl font-semibold text-emerald-700">
                {activeStationsCount}
              </div>
              <p className="mt-0.5 text-xs text-gray-500">พร้อมจัดกิจกรรม</p>
            </div>

            {/* Card 4: Stations without missions */}
            <div className="group relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:shadow-md hover:border-[#6b857a]/30">
              <div className="flex items-center justify-between mb-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-500">
                  <Clock size={20} />
                </div>
                <span className="text-[11px] font-normal text-gray-400">
                  ยังไม่มีภารกิจ
                </span>
              </div>
              <div className="text-2xl font-semibold text-gray-700">
                {inactiveStationsCount}
              </div>
              <p className="mt-0.5 text-xs text-gray-500">รอเพิ่มภารกิจ</p>
            </div>
          </div>

          {/* Interactive Toolbar (Search, Filter Tabs, Sort, View Mode) */}
          <div className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Input
                isClearable
                classNames={{
                  inputWrapper:
                    "bg-[#f8faf9] border border-gray-200 hover:border-[#6b857a]/40 focus-within:!border-[#6b857a] rounded-xl h-10",
                  input: "text-sm",
                }}
                placeholder="ค้นหาชื่อฐาน หรือคำอธิบาย..."
                startContent={<Search className="text-gray-400" size={16} />}
                value={searchQuery}
                onClear={() => setSearchQuery("")}
                onValueChange={setSearchQuery}
              />
            </div>

            {/* Filter Chips & Controls */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Filter Tabs */}
              <div className="flex flex-wrap gap-1 rounded-xl bg-[#f8faf9] p-1 border border-gray-200">
                <button
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                    filterStatus === "all"
                      ? "bg-white text-[#6b857a] shadow-xs font-semibold"
                      : "text-gray-500 hover:text-gray-800"
                  }`}
                  type="button"
                  onClick={() => setFilterStatus("all")}
                >
                  ทั้งหมด ({totalStations})
                </button>
                <button
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                    filterStatus === "has_missions"
                      ? "bg-white text-[#6b857a] shadow-xs font-semibold"
                      : "text-gray-500 hover:text-gray-800"
                  }`}
                  type="button"
                  onClick={() => setFilterStatus("has_missions")}
                >
                  มีภารกิจ ({activeStationsCount})
                </button>
                <button
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                    filterStatus === "no_missions"
                      ? "bg-white text-[#6b857a] shadow-xs font-semibold"
                      : "text-gray-500 hover:text-gray-800"
                  }`}
                  type="button"
                  onClick={() => setFilterStatus("no_missions")}
                >
                  ยังไม่มีภารกิจ ({inactiveStationsCount})
                </button>
              </div>

              {/* Sort Selector */}
              <div className="flex items-center gap-1.5">
                <select
                  aria-label="จัดเรียงตาม"
                  className="h-9 rounded-xl border border-gray-200 bg-[#f8faf9] px-3 text-xs font-medium text-gray-700 outline-none transition-colors hover:border-[#6b857a]/40 focus:border-[#6b857a]"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortType)}
                >
                  <option value="default">ลำดับเริ่มต้น (ID)</option>
                  <option value="name_asc">ชื่อฐาน (ก - ฮ)</option>
                  <option value="name_desc">ชื่อฐาน (ฮ - ก)</option>
                  <option value="missions_desc">
                    จำนวนภารกิจ (มาก - น้อย)
                  </option>
                </select>

                {/* View Switcher */}
                <div className="flex rounded-xl bg-[#f8faf9] p-1 border border-gray-200">
                  <button
                    aria-label="มุมมองการ์ด"
                    className={`rounded-lg p-1.5 transition-all ${
                      viewMode === "grid"
                        ? "bg-white text-[#6b857a] shadow-xs"
                        : "text-gray-400 hover:text-gray-700"
                    }`}
                    type="button"
                    onClick={() => setViewMode("grid")}
                  >
                    <LayoutGrid size={16} />
                  </button>
                  <button
                    aria-label="มุมมองตาราง"
                    className={`rounded-lg p-1.5 transition-all ${
                      viewMode === "list"
                        ? "bg-white text-[#6b857a] shadow-xs"
                        : "text-gray-400 hover:text-gray-700"
                    }`}
                    type="button"
                    onClick={() => setViewMode("list")}
                  >
                    <LayoutList size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          {stations.length === 0 ? (
            /* Empty State: No Stations Created */
            <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-gray-200 bg-white p-12 text-center shadow-xs">
              <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-[#f0f4f2] text-[#6b857a]">
                <Target size={40} />
              </div>
              <h2 className="text-lg font-semibold text-gray-800">
                ยังไม่ได้สร้างฐานกิจกรรม
              </h2>
              <p className="mt-2 max-w-md text-sm text-gray-500">
                เริ่มสร้างฐานกิจกรรมสำหรับค่ายนี้ เพื่อมอบหมายภารกิจ คำถาม
                และกิจกรรมการเรียนรู้ให้กับนักเรียน
              </p>
              {camp?.isOwner && (
                <Button
                  className="mt-6 bg-[#6b857a] px-6 font-medium text-white shadow-md shadow-[#6b857a]/20 hover:bg-[#5a7268]"
                  radius="lg"
                  size="lg"
                  startContent={<Plus size={20} />}
                  onPress={() => setIsCreateOpen(true)}
                >
                  เริ่มสร้างฐานกิจกรรมแรก
                </Button>
              )}
            </div>
          ) : filteredStations.length === 0 ? (
            /* Empty State: Filter / Search found no matches */
            <div className="flex flex-col items-center justify-center rounded-3xl border border-gray-100 bg-white p-12 text-center shadow-xs">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                <Search size={32} />
              </div>
              <h2 className="text-lg font-semibold text-gray-800">
                ไม่พบฐานกิจกรรมที่ค้นหา
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                ลองปรับเปลี่ยนคำค้นหา หรือรีเซ็ตตัวกรองเพื่อดูฐานกิจกรรมทั้งหมด
              </p>
              <Button
                className="mt-4 border border-gray-200 bg-gray-50 font-medium text-gray-700 hover:bg-gray-100"
                radius="lg"
                size="sm"
                onPress={() => {
                  setSearchQuery("");
                  setFilterStatus("all");
                }}
              >
                ล้างคำค้นหาและตัวกรอง
              </Button>
            </div>
          ) : viewMode === "grid" ? (
            /* Grid View */
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {filteredStations.map((station, index) => {
                const missionCount =
                  station.mission?.length ?? station._count?.mission ?? 0;
                const stationNum = String(index + 1).padStart(2, "0");

                // Collect distinct mission types in this station
                const missionTypes = Array.from(
                  new Set(station.mission?.map((m) => m.type) || []),
                );

                return (
                  <div
                    key={station.station_id}
                    aria-label={`เปิดฐานกิจกรรม ${station.name}`}
                    className="group relative flex cursor-pointer flex-col justify-between rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-[#6b857a]/40 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6b857a] focus-visible:ring-offset-2"
                    role="button"
                    tabIndex={0}
                    onClick={() => openStationMissions(station.station_id)}
                    onKeyDown={(e) =>
                      handleStationCardKeyDown(station.station_id, e)
                    }
                  >
                    <div>
                      {/* Card Header: Station Index & Action Buttons */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <span className="flex h-7 items-center justify-center rounded-lg bg-[#f0f4f2] px-2.5 text-xs font-medium text-[#6b857a]">
                          #{stationNum}
                        </span>

                        {/* Action buttons (Edit / Delete) for Owner */}
                        {camp?.isOwner && (
                          <div className="flex items-center gap-1">
                            <button
                              aria-label={`แก้ไขฐาน ${station.name}`}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6b857a]"
                              title="แก้ไขฐานกิจกรรม"
                              type="button"
                              onClick={(e) => handleOpenEdit(station, e)}
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              aria-label={`ลบฐาน ${station.name}`}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                              title="ลบฐานกิจกรรม"
                              type="button"
                              onClick={(e) => handleDeleteStation(station, e)}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Station Title & Description */}
                      <div className="space-y-1.5">
                        <h2 className="text-base font-semibold text-gray-800 group-hover:text-[#6b857a] transition-colors line-clamp-1 break-words">
                          {station.name}
                        </h2>
                        <p className="text-xs leading-relaxed text-gray-500 line-clamp-2 break-words font-normal">
                          {station.description || "ไม่มีคำอธิบายเพิ่มเติม"}
                        </p>
                      </div>

                      {/* Mission Types Preview Pills */}
                      <div className="mt-4 pt-3 border-t border-gray-50">
                        <div className="flex flex-wrap gap-1.5">
                          {missionTypes.length > 0 ? (
                            missionTypes.map((type) => {
                              const meta = getMissionTypeMeta(type);
                              const IconComponent = meta.icon;

                              return (
                                <span
                                  key={type}
                                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium ${meta.color}`}
                                >
                                  <IconComponent size={11} />
                                  {meta.label}
                                </span>
                              );
                            })
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-md border border-dashed border-gray-200 bg-gray-50/50 px-2 py-0.5 text-[11px] text-gray-400">
                              <Sparkles size={11} /> ยังไม่มีภารกิจ
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Card Footer: Mission Count & Navigation Button */}
                    <div className="mt-5 flex items-center justify-between border-t border-gray-100 pt-3">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
                        <Layers className="text-[#6b857a]" size={15} />
                        <span>{missionCount} ภารกิจ</span>
                      </div>

                      <Button
                        className="h-8 bg-[#6b857a]/10 px-3 text-xs font-medium text-[#6b857a] hover:bg-[#6b857a] hover:text-white transition-all group-hover:bg-[#6b857a] group-hover:text-white"
                        endContent={
                          <ArrowRight
                            className="transition-transform group-hover:translate-x-0.5"
                            size={14}
                          />
                        }
                        radius="md"
                        size="sm"
                        onPress={() => openStationMissions(station.station_id)}
                      >
                        จัดการภารกิจ
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* List / Table View */
            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-600">
                  <thead className="border-b border-gray-100 bg-[#f8faf9] text-xs font-medium text-gray-500">
                    <tr>
                      <th className="py-3.5 pl-5 pr-3 text-center w-16">
                        ลำดับ
                      </th>
                      <th className="px-4 py-3.5">
                        ชื่อฐานกิจกรรม & รายละเอียด
                      </th>
                      <th className="px-4 py-3.5">ประเภทภารกิจ</th>
                      <th className="px-4 py-3.5 text-center">จำนวนภารกิจ</th>
                      <th className="py-3.5 pl-3 pr-5 text-right">การจัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredStations.map((station, index) => {
                      const missionCount =
                        station.mission?.length ?? station._count?.mission ?? 0;
                      const stationNum = String(index + 1).padStart(2, "0");
                      const missionTypes = Array.from(
                        new Set(station.mission?.map((m) => m.type) || []),
                      );

                      return (
                        <tr
                          key={station.station_id}
                          className="hover:bg-[#f0f4f2]/30 transition-colors"
                        >
                          <td className="py-4 pl-5 pr-3 text-center">
                            <span className="inline-flex h-6 w-7 items-center justify-center rounded-md bg-gray-100 text-xs font-medium text-gray-600">
                              {stationNum}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <div className="font-medium text-gray-900">
                              {station.name}
                            </div>
                            <div className="text-xs text-gray-500 line-clamp-1 max-w-md">
                              {station.description || "ไม่มีคำอธิบาย"}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {missionTypes.length > 0 ? (
                                missionTypes.map((type) => {
                                  const meta = getMissionTypeMeta(type);

                                  return (
                                    <span
                                      key={type}
                                      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium ${meta.color}`}
                                    >
                                      {meta.label}
                                    </span>
                                  );
                                })
                              ) : (
                                <span className="text-xs text-gray-400">
                                  ยังไม่มีภารกิจ
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#f0f4f2] px-2.5 py-0.5 text-xs font-medium text-[#6b857a]">
                              {missionCount}
                            </span>
                          </td>
                          <td className="py-4 pl-3 pr-5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                className="h-8 bg-[#6b857a] text-xs font-medium text-white hover:bg-[#5a7268]"
                                endContent={<ArrowRight size={13} />}
                                radius="lg"
                                size="sm"
                                onPress={() =>
                                  openStationMissions(station.station_id)
                                }
                              >
                                จัดการ
                              </Button>

                              {camp?.isOwner && (
                                <>
                                  <button
                                    aria-label={`แก้ไขฐาน ${station.name}`}
                                    className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6b857a]"
                                    title="แก้ไขฐานกิจกรรม"
                                    type="button"
                                    onClick={(e) => handleOpenEdit(station, e)}
                                  >
                                    <Pencil size={15} />
                                  </button>
                                  <button
                                    aria-label={`ลบฐาน ${station.name}`}
                                    className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                                    title="ลบฐานกิจกรรม"
                                    type="button"
                                    onClick={(e) =>
                                      handleDeleteStation(station, e)
                                    }
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <CreateBaseModal
        campId={campId}
        isOpen={isCreateOpen}
        onClose={() => {
          setIsCreateOpen(false);
          fetchCamp();
        }}
      />

      <EditBaseModal
        baseData={
          selectedStation
            ? {
                station_id: selectedStation.station_id,
                name: selectedStation.name,
                description: selectedStation.description || "",
              }
            : null
        }
        isOpen={isEditOpen}
        onClose={() => {
          setIsEditOpen(false);
          setSelectedStation(null);
        }}
        onSuccess={() => {
          fetchCamp();
        }}
      />
    </div>
  );
}
