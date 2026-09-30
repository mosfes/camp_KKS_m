"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Button } from "@heroui/button";
import { Plus, Target, Pencil, Trash2, Eye, CheckCircle2 } from "lucide-react";

import CampBreadcrumb from "../../../CampBreadcrumb";

import CreateMissionModal from "./CreateMissionModal";
import EditMissionModal from "./EditMissionModal";
import MonitorMissionModal from "./MonitorMissionModal";
import BaseDetailSkeleton from "./BaseDetailSkeleton";

import { useStatusModal } from "@/components/StatusModalProvider";
import { getCleanCampPath } from "@/lib/client-active-camp";

export default function BaseDetailPage() {
  const params = useParams();
  const { baseId } = params;

  const [base, setBase] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { showError, showSuccess, showConfirm, setIsLoading } =
    useStatusModal();
  const [isCreateMissionModalOpen, setIsCreateMissionModalOpen] =
    useState(false);
  const [isEditMissionModalOpen, setIsEditMissionModalOpen] = useState(false);
  const [selectedMission, setSelectedMission] = useState<any>(null);

  const [isMonitorModalOpen, setIsMonitorModalOpen] = useState(false);
  const [monitorMissionData, setMonitorMissionData] = useState<any>(null);

  useEffect(() => {
    if (baseId) {
      fetchBaseDetail();
    }
  }, [baseId]);

  const fetchBaseDetail = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/stations/${baseId}`);

      if (!response.ok) throw new Error("Failed to fetch base");
      const data = await response.json();

      setBase(data);
    } catch (error) {
      console.error("Error:", error);
      showError("Error", "Failed to load base details");
    } finally {
      setLoading(false);
    }
  };

  const handleEditMission = (mission: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedMission(mission);
    setIsEditMissionModalOpen(true);
  };

  const openMissionMonitor = (mission: any) => {
    setMonitorMissionData(mission);
    setIsMonitorModalOpen(true);
  };

  const handleMonitorMission = (mission: any, e: React.MouseEvent) => {
    e.stopPropagation();
    openMissionMonitor(mission);
  };

  const handleMissionCardKeyDown = (
    mission: any,
    e: React.KeyboardEvent<HTMLDivElement>,
  ) => {
    if (e.target !== e.currentTarget) return;

    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openMissionMonitor(mission);
    }
  };

  const handleDeleteMission = (missionId: number, e: React.MouseEvent) => {
    e.stopPropagation();

    showConfirm(
      "ยืนยันการลบ",
      "คุณแน่ใจหรือไม่ว่าต้องการลบภารกิจนี้? การดำเนินการนี้ไม่สามารถย้อนกลับได้",
      async () => {
        try {
          setIsLoading(true);
          const response = await fetch(`/api/missions/${missionId}`, {
            method: "DELETE",
          });

          if (!response.ok) {
            throw new Error("Failed to delete mission");
          }

          showSuccess("สำเร็จ", "ลบภารกิจเรียบร้อยแล้ว");
          fetchBaseDetail();
        } catch (error) {
          console.error("Error deleting mission:", error);
          showError("ข้อผิดพลาด", "ไม่สามารถลบภารกิจได้");
        } finally {
          setIsLoading(false);
        }
      },
      "ลบภารกิจ",
    );
  };

  if (loading) {
    return <BaseDetailSkeleton />;
  }

  if (!base) return null;

  const enrolledStudentCount = base.participantCount ?? 0;

  return (
    <div className="min-h-screen bg-[#f5f5f2]">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Breadcrumb Navigation */}
        <CampBreadcrumb
          className="mb-6"
          items={[
            {
              label: base.camp?.name
                ? `ค่าย: ${base.camp.name}`
                : "รายละเอียดค่าย",
              href: getCleanCampPath(),
            },
            {
              label: "ฐานกิจกรรม",
              href: getCleanCampPath("bases"),
            },
            {
              label: base.name || "รายละเอียดฐาน",
            },
          ]}
        />

        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-xl font-bold text-gray-900 mb-2 break-words">
              {base.name}
            </h1>
            <p className="text-gray-600 break-words whitespace-pre-wrap">
              {base.description || "ไม่มีคำอธิบาย"}
            </p>
          </div>
        </div>

        {/* Missions Section */}
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2">
              <Target className="text-[#6b857a]" size={24} />
              <h2 className="text-xl font-semibold text-gray-900">ภารกิจ</h2>
            </div>
            <Button
              className="bg-[#6b857a] text-white"
              startContent={<Plus size={18} />}
              onPress={() => setIsCreateMissionModalOpen(true)}
            >
              สร้างภารกิจ
            </Button>
          </div>

          {base.mission && base.mission.length > 0 ? (
            <div className="space-y-4">
              {base.mission.map((mission: any) => {
                const submittedCount = mission._count?.mission_result ?? 0;

                return (
                  <div
                    key={mission.mission_id}
                    aria-label={`เปิดดูภารกิจ ${
                      mission.title || "ภารกิจไม่มีชื่อ"
                    }`}
                    className="mb-2 cursor-pointer rounded-xl border border-gray-100 bg-gray-50 p-4 transition-all hover:border-[#6b857a]/40 hover:bg-white hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6b857a] focus-visible:ring-offset-2"
                    role="button"
                    tabIndex={0}
                    onClick={() => openMissionMonitor(mission)}
                    onKeyDown={(e) => handleMissionCardKeyDown(mission, e)}
                  >
                    {/* Header row: title + badge + action buttons */}
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex flex-wrap items-center gap-2 min-w-0">
                        <span className="font-medium text-gray-900 break-words">
                          {mission.title?.replace(
                            /\s*\((ก่อนเรียน|หลังเรียน)\)\s*/g,
                            "",
                          ) || "ภารกิจไม่มีชื่อ"}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-600 shrink-0">
                          {mission.type === "MULTIPLE_CHOICE_QUIZ"
                            ? "แบบเลือกตอบ"
                            : mission.type === "QUESTION_ANSWERING"
                              ? "ตอบคำถาม"
                              : mission.type === "PHOTO_SUBMISSION"
                                ? "ส่งรูปภาพ"
                                : mission.type === "QR_CODE_SCANNING"
                                  ? "สแกน QR Code"
                                  : mission.type === "PRE_TEST"
                                    ? "แบบทดสอบก่อนเรียน"
                                    : mission.type === "POST_TEST"
                                      ? "แบบทดสอบหลังเรียน"
                                      : mission.type?.replace(/_/g, " ")}
                        </span>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          isIconOnly
                          aria-label={`ดูภารกิจ ${mission.title || "ภารกิจไม่มีชื่อ"}`}
                          className="text-gray-400 hover:text-green-500"
                          size="sm"
                          variant="light"
                          onClick={(e) => handleMonitorMission(mission, e)}
                        >
                          <Eye size={18} />
                        </Button>
                        <Button
                          isIconOnly
                          aria-label={`แก้ไขภารกิจ ${mission.title || "ภารกิจไม่มีชื่อ"}`}
                          className="text-gray-400 hover:text-blue-500"
                          size="sm"
                          variant="light"
                          onClick={(e) => handleEditMission(mission, e)}
                        >
                          <Pencil size={18} />
                        </Button>
                        <Button
                          isIconOnly
                          aria-label={`ลบภารกิจ ${mission.title || "ภารกิจไม่มีชื่อ"}`}
                          className="text-[#E84A5F] opacity-70 hover:opacity-100 hover:bg-[#E84A5F]/10 hover:text-[#FF847C]"
                          size="sm"
                          variant="light"
                          onClick={(e) =>
                            handleDeleteMission(mission.mission_id, e)
                          }
                        >
                          <Trash2 size={18} />
                        </Button>
                      </div>
                    </div>

                    {/* Description + questions — full width */}
                    <p className="text-sm text-gray-600 mb-1 break-words">
                      {mission.description}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-3 text-xs font-medium">
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-green-700 border border-green-100">
                        <CheckCircle2 size={14} />
                        ส่งแล้ว {submittedCount} / {enrolledStudentCount} คน
                      </span>
                    </div>
                    {(mission.type === "QUESTION_ANSWERING" ||
                      mission.type === "PHOTO_SUBMISSION") &&
                      mission.mission_question?.[0] && (
                        <div className="mt-2 bg-[#6b857a]/5 p-2 rounded-lg border border-[#6b857a]/10 w-full">
                          <p className="text-sm text-[#6b857a] font-medium break-words">
                            <span className="mr-2">คำถาม:</span>
                            {mission.mission_question[0].question_text}
                          </p>
                        </div>
                      )}
                    {(mission.type === "MULTIPLE_CHOICE_QUIZ" ||
                      mission.type === "PRE_TEST" ||
                      mission.type === "POST_TEST") &&
                      mission.mission_question &&
                      mission.mission_question.length > 0 && (
                        <div className="mt-2 space-y-1 w-full">
                          {mission.mission_question.map(
                            (q: any, idx: number) => (
                              <div
                                key={q.question_id}
                                className="bg-[#6b857a]/5 p-2 rounded-lg border border-[#6b857a]/10 w-full"
                              >
                                <p className="text-sm text-[#6b857a] font-medium break-words">
                                  <span className="mr-2 font-medium">
                                    {idx + 1}.
                                  </span>
                                  {q.question_text}
                                </p>
                              </div>
                            ),
                          )}
                        </div>
                      )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Target className="text-gray-400" size={24} />
              </div>
              <p className="text-gray-500 mb-4">ยังไม่ได้สร้างภารกิจในฐานนี้</p>
              <Button
                className="bg-[#6b857a] text-white"
                startContent={<Plus size={18} />}
                onPress={() => setIsCreateMissionModalOpen(true)}
              >
                เริ่มสร้างภารกิจแรก
              </Button>
            </div>
          )}
        </div>

        <CreateMissionModal
          baseId={Number(baseId)}
          isOpen={isCreateMissionModalOpen}
          onClose={() => setIsCreateMissionModalOpen(false)}
          onMissionCreated={fetchBaseDetail}
        />
        <EditMissionModal
          isOpen={isEditMissionModalOpen}
          missionData={selectedMission}
          onClose={() => setIsEditMissionModalOpen(false)}
          onSuccess={fetchBaseDetail}
        />
        <MonitorMissionModal
          isOpen={isMonitorModalOpen}
          missionData={monitorMissionData}
          onClose={() => setIsMonitorModalOpen(false)}
        />
      </div>
    </div>
  );
}
