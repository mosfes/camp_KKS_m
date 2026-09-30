"use client";

import { useEffect, useState } from "react";
import {
  Search,
  AlertCircle,
  Users,
  Activity,
  FileText,
  FileSpreadsheet,
  ChevronRight,
  BookOpen,
} from "lucide-react";
import { useParams } from "next/navigation";
import { Input } from "@heroui/input";
import { Chip } from "@heroui/chip";
import { Avatar } from "@heroui/avatar";
import { Pagination } from "@heroui/pagination";
import { Select, SelectItem, Button, Tooltip } from "@heroui/react";

import CampBreadcrumb from "../../CampBreadcrumb";

import BreakdownModal from "./BreakdownModal";

import { exportCampStudentsToExcel } from "@/lib/export-camp-students-excel";
import { useStatusModal } from "@/components/StatusModalProvider";

interface Student {
  grade_snapshot?: string | null;
  classroom_name_snapshot?: string | null;
  student_name_snapshot?: string | null;
  classroom?: {
    grade: string;
    classroom_types?: { name: string };
  } | null;
  student: {
    students_id: number;
    prefix_name: string | null;
    firstname: string;
    lastname: string;
    nickname: string | null;
    profile_image_url: string | null;
    food_allergy: string | null;
    chronic_disease: string | null;
    remark: string | null;
    tel: string | null;
    classroom_students?: {
      classroom?: {
        grade: string;
        classroom_types?: {
          name: string;
        };
      };
    }[];
  };
  certificate?: { certificate_no: number | null }[];
}

interface Summary {
  totalStudents: number;
  allergiesCount: number;
  chronicDiseasesCount: number;
  remarksCount: number;
  allergies: any[];
  chronicDiseases: any[];
  remarks: any[];
}

function SkeletonBlock({ className }: { className: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-lg bg-gray-200 ${className}`}
    />
  );
}

function StudentPageSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="กำลังโหลดข้อมูลนักเรียน"
      className="max-w-7xl mx-auto px-4 py-8"
    >
      <div className="flex items-center gap-2 mb-8">
        <SkeletonBlock className="h-5 w-5 rounded-lg" />
        <SkeletonBlock className="h-6 w-48" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 mb-8">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="bg-white rounded-xl p-3 md:p-6 shadow-sm border border-gray-100"
          >
            <div className="flex items-center gap-2 mb-3">
              <SkeletonBlock className="h-5 w-5 rounded-full" />
              <SkeletonBlock className="h-3.5 w-24" />
            </div>
            <SkeletonBlock className="h-7 w-16" />
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
          <SkeletonBlock className="h-5 w-32 self-start sm:self-auto" />
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <SkeletonBlock className="h-10 w-full sm:w-[200px]" />
            <SkeletonBlock className="h-10 w-full sm:w-72" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[700px]">
            <div className="grid grid-cols-6 gap-4 bg-gray-50 border-y border-gray-100 p-4">
              {Array.from({ length: 6 }, (_, index) => (
                <SkeletonBlock key={index} className="h-3 w-full" />
              ))}
            </div>
            {Array.from({ length: 6 }, (_, rowIndex) => (
              <div
                key={rowIndex}
                className="grid grid-cols-6 items-center gap-4 border-b border-gray-50 p-4"
              >
                {Array.from({ length: 6 }, (_, cellIndex) => (
                  <SkeletonBlock
                    key={cellIndex}
                    className={cellIndex === 0 ? "h-10 w-48" : "h-3 w-full"}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CampStudentsPage() {
  const { showSuccess, showError } = useStatusModal();
  const params = useParams();
  const campId = params?.id;

  const [students, setStudents] = useState<Student[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [campName, setCampName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [modal, setModal] = useState<{
    open: boolean;
    type: "allergy" | "disease" | "remark";
    title: string;
    count: number;
    accent: string;
  } | null>(null);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const limit = 10;

  useEffect(() => {
    if (campId) {
      fetchStudents();
    }
  }, [campId, page, filter]);

  useEffect(() => {
    // The first effect above already loads the initial empty-search page.
    // Skip this debounce on the initial render to avoid a duplicate request.
    if (!search && !summary) return;

    const delayDebounceFn = setTimeout(() => {
      setPage(1);
      fetchStudents();
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [search]);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      // Only fetch summary on first load — skip on pagination/filter changes
      const needSummary = !summary;
      const res = await fetch(
        `/api/camps/${campId}/students?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&filter=${filter}&summary=${needSummary}`,
      );

      if (res.ok) {
        const data = await res.json();

        setStudents(data.data);
        setTotalPages(data.pagination.totalPages || 1);
        if (!summary) {
          setSummary(data.summary);
        }
        if (data.campName && !campName) {
          setCampName(data.campName);
        }
      }
    } catch (error) {
      console.error("Error fetching students:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = async () => {
    if (!summary || summary.totalStudents === 0) return;
    try {
      setIsExportingExcel(true);
      const res = await fetch(
        `/api/camps/${campId}/students?page=1&limit=10000&search=&filter=all&summary=false`,
      );

      if (!res.ok) throw new Error("ไม่สามารถดึงข้อมูลนักเรียนได้");
      const json = await res.json();
      const allStudents = (json.data || []).map((row: any) => {
        const stu = row.student;
        let classroomStr = "-";

        const historicalClassroom = row.classroom;
        const historicalGrade = row.grade_snapshot || historicalClassroom?.grade;

        if (historicalGrade) {
          const gradeStr = String(historicalGrade).replace("Level_", "");
          const typeStr =
            row.classroom_name_snapshot ||
            historicalClassroom?.classroom_types?.name ||
            "";

          classroomStr = `ม.${gradeStr} ห้อง ${typeStr}`.trim();
        }

        return {
          studentId: stu.students_id,
          name:
            row.student_name_snapshot ||
            `${stu.prefix_name || ""}${stu.firstname} ${stu.lastname}`.trim(),
          nickname: stu.nickname,
          classroom: classroomStr,
          tel: stu.tel,
          foodAllergy: stu.food_allergy,
          chronicDisease: stu.chronic_disease,
          remark: stu.remark,
          certificateNo: row.certificate?.[0]?.certificate_no || null,
        };
      });

      exportCampStudentsToExcel({
        campName: campName || json.campName || "",
        summary: {
          totalStudents: summary.totalStudents,
          allergiesCount: summary.allergiesCount,
          chronicDiseasesCount: summary.chronicDiseasesCount,
          remarksCount: summary.remarksCount,
        },
        students: allStudents,
      });
      showSuccess("ส่งออกสำเร็จ", "ดาวน์โหลดไฟล์ Excel (.xlsx) เรียบร้อยแล้ว");
    } catch (err) {
      console.error("Export Excel error:", err);
      showError("เกิดข้อผิดพลาด", "ไม่สามารถส่งออกไฟล์ Excel ได้");
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleExportPdf = async () => {
    if (!summary || summary.totalStudents === 0) return;
    try {
      setIsExportingPdf(true);
      const res = await fetch(`/api/camps/${campId}/students/pdf`);

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);

        throw new Error(errJson?.error || "ดาวน์โหลดไฟล์ PDF ไม่สำเร็จ");
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");

      a.href = url;
      const cleanCampName = (campName || "camp").replace(/[/\\?%*:|"<>]/g, "-");

      a.download = `ข้อมูลนักเรียน_${cleanCampName}_${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showSuccess("สำเร็จ", "ดาวน์โหลดไฟล์ PDF (.pdf) เรียบร้อยแล้ว");
    } catch (err: any) {
      console.error("Export PDF error:", err);
      showError("เกิดข้อผิดพลาด", err.message || "ไม่สามารถสร้างไฟล์ PDF ได้");
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f2]">
      {loading && <StudentPageSkeleton />}

      <div className={loading ? "hidden" : "max-w-7xl mx-auto px-4 py-8"}>
        <CampBreadcrumb
          campId={campId as string}
          className="mb-6"
          currentPage="ข้อมูลนักเรียนในค่าย"
        />

        <h1 className="flex items-center gap-2 text-lg font-bold text-gray-900 mb-8">
          <BookOpen className="text-[#6b857a]" size={20} />
          <span>ข้อมูลนักเรียนในค่าย</span>
        </h1>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 mb-8">
            <div className="bg-white rounded-xl p-3 md:p-6 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-2 md:mb-3">
                <Users className="text-[#6b857a] w-5 h-5 md:w-6 md:h-6" />
                <h3 className="text-sm font-semibold text-gray-900">
                  นักเรียนทั้งหมด
                </h3>
              </div>
              <p className="text-xl md:text-2xl font-bold text-gray-900 mb-1 md:mb-2">
                {summary.totalStudents}{" "}
                <span className="text-[9px] font-medium text-gray-500">คน</span>
              </p>
            </div>

            {/* Allergy card */}
            <button
              className="bg-white rounded-xl p-3 md:p-6 shadow-sm border border-red-100 text-left group hover:shadow-md hover:border-red-200 transition-all duration-200 cursor-pointer"
              disabled={summary.allergiesCount === 0}
              onClick={() =>
                summary.allergiesCount > 0 &&
                setModal({
                  open: true,
                  type: "allergy",
                  title: "แพ้อาหาร",
                  count: summary.allergiesCount,
                  accent: "red",
                })
              }
            >
              <div className="flex items-center justify-between mb-2 md:mb-3">
                <div className="flex items-center gap-2">
                  <AlertCircle className="text-red-500 w-5 h-5 md:w-6 md:h-6" />
                  <h3 className="text-sm font-semibold text-gray-900">
                    แพ้อาหาร
                  </h3>
                </div>
                {summary.allergiesCount > 0 && (
                  <ChevronRight
                    className="text-gray-300 group-hover:text-red-400 transition-colors"
                    size={16}
                  />
                )}
              </div>
              <p className="text-xl md:text-2xl font-bold text-gray-900">
                {summary.allergiesCount}{" "}
                <span className="text-[9px] font-medium text-gray-500">คน</span>
              </p>
              {summary.allergiesCount > 0 && (
                <p className="text-xs text-red-400 mt-2">กดเพื่อดูรายละเอียด</p>
              )}
            </button>

            {/* Disease card */}
            <button
              className="bg-white rounded-xl p-3 md:p-6 shadow-sm border border-gray-100 text-left group hover:shadow-md hover:border-[#c5d9d0] transition-all duration-200 cursor-pointer"
              disabled={summary.chronicDiseasesCount === 0}
              onClick={() =>
                summary.chronicDiseasesCount > 0 &&
                setModal({
                  open: true,
                  type: "disease",
                  title: "โรคประจำตัว",
                  count: summary.chronicDiseasesCount,
                  accent: "green",
                })
              }
            >
              <div className="flex items-center justify-between mb-2 md:mb-3">
                <div className="flex items-center gap-2">
                  <Activity className="text-[#6b857a] w-5 h-5 md:w-6 md:h-6" />
                  <h3 className="text-sm font-semibold text-gray-900">
                    โรคประจำตัว
                  </h3>
                </div>
                {summary.chronicDiseasesCount > 0 && (
                  <ChevronRight
                    className="text-gray-300 group-hover:text-[#6b857a] transition-colors"
                    size={16}
                  />
                )}
              </div>
              <p className="text-xl md:text-2xl font-bold text-gray-900">
                {summary.chronicDiseasesCount}{" "}
                <span className="text-[9px] font-medium text-gray-500">คน</span>
              </p>
              {summary.chronicDiseasesCount > 0 && (
                <p className="text-xs text-[#6b857a] mt-2">
                  กดเพื่อดูรายละเอียด
                </p>
              )}
            </button>

            {/* Remark card */}
            <button
              className="bg-white rounded-xl p-3 md:p-6 shadow-sm border border-blue-100 text-left group hover:shadow-md hover:border-blue-200 transition-all duration-200 cursor-pointer"
              disabled={summary.remarksCount === 0}
              onClick={() =>
                summary.remarksCount > 0 &&
                setModal({
                  open: true,
                  type: "remark",
                  title: "ข้อมูลอื่นๆ",
                  count: summary.remarksCount,
                  accent: "blue",
                })
              }
            >
              <div className="flex items-center justify-between mb-2 md:mb-3">
                <div className="flex items-center gap-2">
                  <FileText className="text-blue-500 w-5 h-5 md:w-6 md:h-6" />
                  <h3 className="text-sm font-semibold text-gray-900">
                    ข้อมูลอื่นๆ
                  </h3>
                </div>
                {summary.remarksCount > 0 && (
                  <ChevronRight
                    className="text-gray-300 group-hover:text-blue-400 transition-colors"
                    size={16}
                  />
                )}
              </div>
              <p className="text-xl md:text-2xl font-bold text-gray-900">
                {summary.remarksCount}{" "}
                <span className="text-[9px] font-medium text-gray-500">คน</span>
              </p>
              {summary.remarksCount > 0 && (
                <p className="text-xs text-blue-400 mt-2">
                  กดเพื่อดูรายละเอียด
                </p>
              )}
            </button>
          </div>
        )}

        {/* Search & Table Section */}
        <div className="bg-white rounded-2xl p-6 shadow-sm overflow-hidden">
          <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center mb-6 gap-3">
            <h3 className="text-sm font-semibold text-gray-900 shrink-0">
              รายชื่อนักเรียน
            </h3>
            <div className="flex flex-col sm:flex-row flex-wrap lg:flex-nowrap items-stretch sm:items-center gap-2.5">
              <div className="w-full sm:w-[150px]">
                <Select
                  aria-label="ตัวกรอง"
                  className="w-full"
                  classNames={{
                    trigger:
                      "bg-white border border-gray-200 text-gray-700 font-medium h-10 rounded-xl",
                  }}
                  placeholder="ตัวกรองทั้งหมด"
                  selectedKeys={[filter]}
                  size="sm"
                  onChange={(e) => {
                    setFilter(e.target.value);
                    setPage(1);
                  }}
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
              <div className="w-full sm:w-60">
                <Input
                  className="w-full"
                  classNames={{
                    inputWrapper:
                      "h-10 border border-gray-200 bg-white rounded-xl",
                  }}
                  placeholder="ค้นหาชื่อ, ชื่อเล่น หรือรหัส..."
                  size="sm"
                  startContent={<Search className="text-gray-400" size={18} />}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {/* Export Action Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <Tooltip
                  closeDelay={0}
                  content="ดาวน์โหลดข้อมูลนักเรียนเป็นไฟล์ Excel (.xlsx)"
                  placement="top"
                >
                  <Button
                    aria-label="ส่งออกไฟล์ Excel"
                    className="flex-1 sm:flex-initial h-10 flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white hover:bg-emerald-50/70 hover:border-emerald-300 text-gray-700 hover:text-emerald-800 px-3.5 text-xs sm:text-sm font-medium shadow-xs transition-all active:scale-[0.98] disabled:opacity-40"
                    isDisabled={
                      loading || !summary || summary.totalStudents === 0
                    }
                    isLoading={isExportingExcel}
                    onPress={handleExportExcel}
                  >
                    {!isExportingExcel && (
                      <FileSpreadsheet className="h-4 w-4 text-emerald-600 shrink-0" />
                    )}
                    <span>ส่งออก Excel</span>
                  </Button>
                </Tooltip>

                <Tooltip
                  closeDelay={0}
                  content="ดาวน์โหลดรายงานข้อมูลนักเรียนพร้อมพิมพ์ (.pdf)"
                  placement="top"
                >
                  <Button
                    aria-label="ส่งออกไฟล์ PDF"
                    className="flex-1 sm:flex-initial h-10 flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white hover:bg-rose-50/70 hover:border-rose-300 text-gray-700 hover:text-rose-800 px-3.5 text-xs sm:text-sm font-medium shadow-xs transition-all active:scale-[0.98] disabled:opacity-40"
                    isDisabled={
                      loading || !summary || summary.totalStudents === 0
                    }
                    isLoading={isExportingPdf}
                    onPress={handleExportPdf}
                  >
                    {!isExportingPdf && (
                      <FileText className="h-4 w-4 text-rose-600 shrink-0" />
                    )}
                    <span>ส่งออก PDF</span>
                  </Button>
                </Tooltip>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-gray-50 text-gray-600 text-sm border-y border-gray-100">
                  <th className="p-4 font-semibold rounded-tl-lg whitespace-nowrap">
                    นักเรียน
                  </th>
                  <th className="p-4 font-semibold whitespace-nowrap">
                    เบอร์โทร
                  </th>
                  <th className="p-4 font-semibold whitespace-nowrap">
                    แพ้อาหาร
                  </th>
                  <th className="p-4 font-semibold whitespace-nowrap">
                    โรคประจำตัว
                  </th>
                  <th className="p-4 font-semibold whitespace-nowrap">
                    เลขที่เกียรติบัตร
                  </th>
                  <th className="p-4 font-semibold rounded-tr-lg whitespace-nowrap">
                    เงื่อนไขพิเศษ/อื่นๆ
                  </th>
                </tr>
              </thead>
              <tbody>
                {!loading && students.length === 0 ? (
                  <tr>
                    <td className="p-8 text-center text-gray-500" colSpan={6}>
                      ไม่พบข้อมูลนักเรียน
                    </td>
                  </tr>
                ) : (
                  students.map((row, idx) => (
                    <tr
                      key={idx}
                      className="border-b border-gray-50 hover:bg-gray-50 transition-colors text-sm"
                    >
                      <td className="p-4 text-gray-900">
                        <div className="flex min-w-[280px] items-center gap-2.5">
                          <span className="w-5 shrink-0 text-center text-xs font-semibold text-gray-400">
                            {(page - 1) * limit + idx + 1}
                          </span>
                          <Avatar
                            className="h-10 w-10 flex-shrink-0 bg-[#e8f0ee] text-[#3d6357]"
                            imgProps={{
                              alt: `รูปโปรไฟล์ของ ${row.student.firstname} ${row.student.lastname}`,
                            }}
                            name={`${row.student.firstname.charAt(0)}${row.student.lastname.charAt(0)}`}
                            src={row.student.profile_image_url || undefined}
                          />
                          <div className="min-w-0">
                            <p className="whitespace-nowrap font-medium">
                              {row.student.prefix_name || ""}{" "}
                              {row.student.firstname} {row.student.lastname}
                            </p>
                            <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-gray-500">
                              <span>
                                ชื่อเล่น: {row.student.nickname || "-"}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>
                                รหัสนักเรียน {row.student.students_id}
                              </span>
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-gray-600">
                        {row.student.tel || "-"}
                      </td>
                      <td className="p-4">
                        {row.student.food_allergy &&
                        row.student.food_allergy !== "-" &&
                        row.student.food_allergy !== "ไม่มี" ? (
                          <Chip
                            className="bg-red-50 text-red-700 border border-red-100"
                            size="sm"
                          >
                            {row.student.food_allergy}
                          </Chip>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="p-4">
                        {row.student.chronic_disease &&
                        row.student.chronic_disease !== "-" &&
                        row.student.chronic_disease !== "ไม่มี" ? (
                          <Chip
                            className="bg-[#f0f4f2] text-[#5d7c6f] border border-[#d1e0d9]"
                            size="sm"
                          >
                            {row.student.chronic_disease}
                          </Chip>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="p-4 text-gray-900 font-medium">
                        {row.certificate && row.certificate.length > 0 ? (
                          (row.certificate[0].certificate_no ?? "-")
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="p-4">
                        {row.student.remark &&
                        row.student.remark !== "-" &&
                        row.student.remark !== "ไม่มี" ? (
                          <span className="text-blue-700 font-medium">
                            {row.student.remark}
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

          {!loading && totalPages > 1 && (
            <div className="flex justify-center items-center mt-6">
              <Pagination
                isCompact
                showControls
                classNames={{
                  cursor: "bg-[#5d7c6f] text-white font-bold",
                }}
                color="default"
                page={page}
                total={totalPages}
                onChange={setPage}
              />
            </div>
          )}
        </div>
      </div>

      {/* Breakdown Modal */}
      {modal && (
        <BreakdownModal
          accentColor={modal.accent}
          campId={campId!}
          isOpen={modal.open}
          title={modal.title}
          totalCount={modal.count}
          type={modal.type}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
