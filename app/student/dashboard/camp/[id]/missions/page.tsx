"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "react-hot-toast";

import StudentMissionsSkeleton from "./components/StudentMissionsSkeleton";

import { isBangkokDateBefore } from "@/lib/bangkok-date";

// Helper to calculate progress
function calculateProgress(station: any) {
  if (!station.mission || station.mission.length === 0) return 0;

  // Mock logic: assume some are completed for demo or use real data if available
  // Since we don't have mission_result populated yet, we'll return 0 or random for demo?
  // Let's return 0 for now as specified in "Not started" logic
  return 0; // Placeholder
}

function getMissionCount(station: any) {
  return station.mission?.length || 0;
}

export default function StudentMissionsPage() {
  const params = useParams();
  const router = useRouter();
  const { id } = params;

  const [camp, setCamp] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [navigatingTo, setNavigatingTo] = useState<number | null>(null);

  const goToStation = (stationId: number) => {
    if (navigatingTo !== null) return;
    setNavigatingTo(stationId);
    router.push(`/student/dashboard/camp/${id}/missions/${stationId}`);
  };

  const fetchCamp = async () => {
    try {
      const campRes = await fetch(`/api/student/camps/${id}/missions`, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      });

      if (campRes.ok) {
        const found = await campRes.json();

        if (found) {
          if (!found.isRegistered) {
            toast.error("กรุณาลงทะเบียนเข้าร่วมค่ายก่อนเข้าถึงหน้าภารกิจ");
            router.replace(`/student/dashboard/camp/${id}`);

            return;
          }
          // ตรวจสอบว่าค่ายเริ่มแล้วหรือยัง
          const startDate = found.rawStartDate
            ? new Date(found.rawStartDate)
            : null;

          if (startDate && isBangkokDateBefore(new Date(), startDate)) {
            toast.error("ค่ายยังไม่เริ่ม ไม่สามารถทำภารกิจได้");
            router.replace(`/student/dashboard/camp/${id}`);

            return;
          }
          setCamp(found);
        } else {
          toast.error("ไม่พบค่าย");
        }
      } else if (campRes.status === 403) {
        const errorData = await campRes.json().catch(() => null);

        toast.error(errorData?.error || "ค่ายยังไม่เริ่ม ไม่สามารถทำภารกิจได้");
        router.replace(`/student/dashboard/camp/${id}`);
      }
    } catch (error) {
      console.error("Failed to fetch camp", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    window.scrollTo(0, 0);
    fetchCamp();
  }, [id]);

  if (loading) return <StudentMissionsSkeleton />;
  if (!camp)
    return (
      <div className="p-8 text-center bg-[#f5f5f2] min-h-screen flex items-center justify-center">
        <div className="text-gray-400 font-medium">ไม่พบค่าย</div>
      </div>
    );

  // Derived Metrics
  // For demo, let's mock some progress if the user wants to see the UI "in action"
  // But initially it should be 0.
  const totalMissions =
    camp.station?.reduce(
      (acc: number, s: any) => acc + (s.mission?.length || 0),
      0,
    ) || 0;
  const completedOverall =
    camp.station?.reduce((acc: number, s: any) => {
      const stationMissions = s.mission || [];
      const completed = stationMissions.filter((m: any) =>
        camp.missionResults?.some(
          (r: any) =>
            r.mission_mission_id === m.mission_id && r.status === "completed",
        ),
      ).length;

      return acc + completed;
    }, 0) || 0;
  const overallProgress =
    totalMissions > 0
      ? Math.round((completedOverall / totalMissions) * 100)
      : 0;

  return (
    <div className="min-h-screen bg-[#f5f5f2] pb-12">
      {/* Header */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6 flex items-center gap-4">
          <Button
            isIconOnly
            className="bg-transparent text-gray-400 hover:bg-gray-50 min-w-0 w-8 h-8"
            variant="light"
            onPress={() => router.back()}
          >
            <ChevronLeft size={24} />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-[#2D3648] leading-tight">
              ภารกิจค่าย
            </h1>
            <p className="text-xs sm:text-sm text-gray-400 font-medium leading-tight truncate mt-0.5">
              {camp.title}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Overall Progress Card */}
        <div className="bg-[#EEEADF] rounded-3xl p-6 sm:p-8 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <h3 className="text-[#2D3648] font-bold text-lg sm:text-xl">
              ความคืบหน้าโดยรวม
            </h3>
            <div className="text-sm font-semibold text-gray-600 bg-white/60 px-3 py-1 rounded-full w-fit">
              {completedOverall}/{totalMissions} ภารกิจสำเร็จ
            </div>
          </div>

          <div className="flex justify-between items-end mb-2.5">
            <div className="text-4xl sm:text-5xl font-black text-[#2D3648] leading-none">
              {overallProgress}%
            </div>
          </div>

          <div className="w-full h-3.5 bg-gray-300/50 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#5D7C6F] rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-[#2D3648] font-bold text-lg px-1">
            เลือกฐานกิจกรรม
          </h3>

          {/* Stations Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {camp.station?.map((station: any) => {
              const stationMissions = station.mission || [];
              const completedInStation = stationMissions.filter((m: any) =>
                camp.missionResults?.some(
                  (r: any) =>
                    r.mission_mission_id === m.mission_id &&
                    r.status === "completed",
                ),
              ).length;
              const progress =
                stationMissions.length > 0
                  ? Math.round(
                      (completedInStation / stationMissions.length) * 100,
                    )
                  : 0;

              return (
                <button
                  key={station.station_id}
                  className={`w-full bg-white p-5 sm:p-6 rounded-2xl shadow-xs border border-gray-200/80 hover:border-[#5D7C6F]/50 hover:shadow-md transition-all duration-300 cursor-pointer flex items-center gap-4 group text-left ${
                    navigatingTo === station.station_id
                      ? "opacity-60 pointer-events-none"
                      : ""
                  }`}
                  type="button"
                  onClick={() => goToStation(station.station_id)}
                >
                  {/* Icon */}
                  <div className="w-14 h-14 rounded-2xl bg-[#F0FAF5] flex items-center justify-center shrink-0 border border-[#5D7C6F]/15 group-hover:scale-105 transition-transform">
                    <div className="w-8 h-8 rounded-full border-2 border-[#5D7C6F]/30 flex items-center justify-center">
                      <div className="w-3 h-3 rounded-full bg-[#5D7C6F]" />
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1 gap-2">
                      <h4 className="font-bold text-[#2D3648] text-base truncate group-hover:text-[#5D7C6F] transition-colors">
                        {station.name}
                      </h4>
                    </div>

                    <p className="text-[14px] text-gray-400 mb-4 line-clamp-2 break-words">
                      {station.description || "ทำภารกิจในฐานนี้ให้สำเร็จ"}
                    </p>

                    <div className="flex items-center gap-4">
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#5D7C6F] rounded-full transition-all duration-700"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className="text-[13px] font-medium text-gray-400 whitespace-nowrap">
                        {progress}% สำเร็จ
                      </span>
                    </div>
                  </div>

                  <ChevronRight className="text-gray-300 shrink-0" size={24} />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
