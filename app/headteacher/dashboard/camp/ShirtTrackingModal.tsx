"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Pagination,
  Avatar,
  Tooltip,
} from "@heroui/react";
import { Search, Shirt, FileSpreadsheet, FileText } from "lucide-react";

import CampBreadcrumb from "./CampBreadcrumb";

import { useStatusModal } from "@/components/StatusModalProvider";
import DocumentPreviewModal, {
  fetchPreviewPdf,
} from "@/components/documents/DocumentPreviewModal";

interface StudentShirt {
  enrollmentId: number;
  studentId: number;
  name: string;
  nickname: string | null;
  profileImageUrl: string | null;
  initials: string;
  classroom: string;
  shirtSize: string | null;
  enrolledAt: string;
}

export interface ShirtTrackingData {
  campId?: number;
  campName?: string;
  hasShirt: boolean;
  summary: Record<string, number>;
  totalShirts: number;
  totalStudents: number;
  students: StudentShirt[];
}

interface ShirtTrackingModalProps {
  isOpen: boolean;
  onClose: () => void;
  campId: number;
  campName: string;
  pageMode?: boolean;
  initialData?: ShirtTrackingData | null;
}

function ShirtSkeletonBlock({ className }: { className: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-lg bg-[#e7eee9] ${className}`}
    />
  );
}

function ShirtTrackingSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="กำลังโหลดข้อมูลการจองเสื้อ"
      className="space-y-6"
      role="status"
    >
      <span className="sr-only">กำลังโหลดข้อมูลการจองเสื้อ...</span>

      <div className="rounded-2xl border border-[#d1e0d9] bg-[#f0f4f2]/50 p-5">
        <div className="mb-3 flex items-center gap-2">
          <ShirtSkeletonBlock className="h-4 w-4 rounded-full" />
          <ShirtSkeletonBlock className="h-3.5 w-44" />
        </div>
        <div className="flex flex-wrap gap-3">
          {Array.from({ length: 4 }, (_, index) => (
            <ShirtSkeletonBlock key={index} className="h-9 w-24 rounded-xl" />
          ))}
        </div>
      </div>

      <ShirtSkeletonBlock className="h-11 w-full rounded-xl" />

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="divide-y divide-gray-100">
          {Array.from({ length: 5 }, (_, index) => (
            <div
              key={index}
              className="flex items-center justify-between gap-4 p-4"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <ShirtSkeletonBlock className="h-10 w-10 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-2">
                  <ShirtSkeletonBlock className="h-3.5 w-2/5" />
                  <ShirtSkeletonBlock className="h-2.5 w-1/3" />
                </div>
              </div>
              <ShirtSkeletonBlock className="h-7 w-24 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ShirtTrackingModal({
  isOpen,
  onClose,
  campId,
  campName,
  pageMode = false,
  initialData,
}: ShirtTrackingModalProps) {
  const { showSuccess, showError } = useStatusModal();
  const initialDataPending = useRef(Boolean(initialData));
  const [loading, setLoading] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [data, setData] = useState<ShirtTrackingData | null>(
    initialData || null,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  useEffect(() => {
    if (isOpen && campId) {
      if (initialDataPending.current) {
        initialDataPending.current = false;
      } else {
        fetchShirtData();
      }
      setSearchQuery("");
      setPage(1);
    }
  }, [isOpen, campId]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery]);

  const fetchShirtData = async () => {
    try {
      setLoading(true);
      setData(null);
      const res = await fetch(`/api/camps/${campId}/shirts`);

      if (res.ok) {
        setData(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch shirt data:", err);
    } finally {
      setLoading(false);
    }
  };

  const effectiveCampName = campName || data?.campName || "";

  const handleExportExcel = async () => {
    if (!data || !data.hasShirt || data.students.length === 0) return;
    try {
      setIsExportingExcel(true);
      const { exportShirtsToExcel } = await import("@/lib/export-shirts-excel");

      exportShirtsToExcel({
        campName: effectiveCampName,
        summary: data.summary,
        totalShirts: data.totalShirts,
        totalStudents: data.totalStudents,
        students: data.students,
      });
      showSuccess("ส่งออกสำเร็จ", "ดาวน์โหลดไฟล์ Excel (.xlsx) เรียบร้อยแล้ว");
    } catch (err) {
      console.error("Failed to export Excel:", err);
      showError("เกิดข้อผิดพลาด", "ไม่สามารถส่งออกไฟล์ Excel ได้");
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleExportPdf = () => {
    if (!data || !data.hasShirt || data.students.length === 0) return;
    setPdfPreviewOpen(true);
  };

  const cleanCampName = (effectiveCampName || "camp").replace(
    /[/\\?%*:|"<>]/g,
    "-",
  );

  const filteredStudents = data?.students.filter((student) => {
    const query = searchQuery.trim().toLowerCase();

    return (
      student.name.toLowerCase().includes(query) ||
      student.nickname?.toLowerCase().includes(query) ||
      String(student.studentId).includes(query)
    );
  });

  const pages = Math.ceil((filteredStudents?.length || 0) / ITEMS_PER_PAGE);

  const paginatedStudents = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;

    return filteredStudents?.slice(start, end);
  }, [page, filteredStudents]);

  return (
    <>
      <Modal
        backdrop="blur"
        classNames={{
          base: pageMode
            ? "!m-0 !h-full !min-h-0 !max-h-none w-full !max-w-none rounded-none bg-[#f5f5f2] shadow-none"
            : "bg-white rounded-3xl shadow-xl",
          backdrop: pageMode ? "hidden" : "bg-black/40 backdrop-blur-sm",
          wrapper: pageMode ? "camp-page-modal items-start p-0" : undefined,
        }}
        hideCloseButton={pageMode}
        isDismissable={!pageMode}
        isOpen={isOpen}
        scrollBehavior="inside"
        size="2xl"
        onOpenChange={onClose}
      >
        <ModalContent
          className={
            pageMode
              ? "!m-0 !h-full !min-h-0 !max-h-none !rounded-none !bg-[#f5f5f2] !shadow-none overflow-y-auto"
              : undefined
          }
        >
          {() => (
            <>
              <ModalHeader
                className={`relative flex flex-col gap-1 px-6 ${
                  pageMode
                    ? "mx-auto w-full max-w-7xl border-0 pb-6 pt-8 sm:px-8"
                    : "p-6 pb-2"
                }`}
              >
                {pageMode && (
                  <CampBreadcrumb
                    campId={campId}
                    campName={effectiveCampName}
                    className="mb-6"
                    currentPage="รายการจองเสื้อ"
                  />
                )}

                <div className="flex items-center gap-3">
                  {pageMode ? (
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#eaf1ee] text-[#5d7c6f] shadow-xs">
                      <Shirt size={22} />
                    </div>
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f0f4f2] text-[#6b857a]">
                      <Shirt size={20} />
                    </div>
                  )}
                  <div className="min-w-0">
                    <h2 className="text-xl font-bold leading-tight text-gray-900">
                      รายการจองเสื้อ
                    </h2>
                    {effectiveCampName && (
                      <p className="mt-0.5 max-w-[280px] sm:max-w-md md:max-w-lg truncate text-sm font-normal text-gray-500">
                        {effectiveCampName}
                      </p>
                    )}
                  </div>
                </div>
              </ModalHeader>

              <ModalBody
                className={
                  pageMode
                    ? "mx-auto block w-full max-w-7xl overflow-visible bg-[#f5f5f2] px-4 pb-10 pt-0 sm:px-8"
                    : "px-6 py-6"
                }
              >
                {loading ? (
                  <ShirtTrackingSkeleton />
                ) : data && !data.hasShirt ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-gray-500">
                    <Shirt className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="font-medium text-lg text-gray-700">
                      ค่ายนี้ไม่ได้เปิดให้จองเสื้อ
                    </p>
                    <p className="text-sm mt-1">
                      คุณสามารถเปิดการจองเสื้อได้ในหน้าแก้ไขข้อมูลค่าย
                    </p>
                  </div>
                ) : data ? (
                  <div className="space-y-5">
                    {/* Summary Section */}
                    <div className="bg-[#f0f4f2]/50 rounded-2xl p-5 border border-[#d1e0d9]">
                      <h3 className="text-sm font-semibold text-[#5d7c6f] mb-3 flex items-center gap-2">
                        <Shirt size={16} /> สรุปยอดจองเสื้อ (รวม{" "}
                        {data.totalShirts} ตัว)
                      </h3>

                      {data.totalShirts === 0 ? (
                        <div className="bg-white border border-[#d1e0d9] p-4 rounded-xl text-center">
                          <p className="text-sm font-medium text-gray-600">
                            ยังไม่มีผู้จองเสื้อ
                          </p>
                          {data.totalStudents > 0 && (
                            <p className="text-xs text-gray-400 mt-1">
                              (รอนักเรียนระบุไซส์ {data.totalStudents} คน)
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-3">
                          {Object.entries(data.summary).map(([size, count]) => (
                            <div
                              key={size}
                              className={`bg-white border px-4 py-2 rounded-xl flex items-center justify-between min-w-[100px] shadow-xs ${
                                size === "รอระบุไซส์"
                                  ? "border-gray-200"
                                  : "border-[#d1e0d9]"
                              }`}
                            >
                              <span
                                className={`font-medium ${size === "รอระบุไซส์" ? "text-gray-500" : "text-gray-700"}`}
                              >
                                {size}
                              </span>
                              <span
                                className={`font-bold ml-3 ${size === "รอระบุไซส์" ? "text-gray-600" : "text-[#6b857a]"}`}
                              >
                                {count}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Toolbar Section: Search & Export Actions */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                      {/* Search Input */}
                      <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                          <Search size={18} />
                        </div>
                        <input
                          className="block w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl leading-5 bg-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#5d7c6f]/30 focus:border-[#5d7c6f] shadow-xs transition-all"
                          placeholder="ค้นหาชื่อ ชื่อเล่น หรือรหัสนักเรียน..."
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                      </div>

                      {/* Export Action Buttons */}
                      <div className="flex items-center gap-2 shrink-0">
                        <Tooltip
                          closeDelay={0}
                          content="ดาวน์โหลดตารางสรุปและรายชื่อในรูปแบบ Excel (.xlsx)"
                          placement="top"
                        >
                          <Button
                            aria-label="ส่งออกไฟล์ Excel"
                            className="flex-1 sm:flex-initial h-10 flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white hover:bg-emerald-50/70 hover:border-emerald-300 text-gray-700 hover:text-emerald-800 px-3.5 text-xs sm:text-sm font-medium shadow-xs transition-all active:scale-[0.98] disabled:opacity-40"
                            isDisabled={
                              loading || !data || data.students.length === 0
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
                          content="ดาวน์โหลดรายงานสรุปและรายชื่อพร้อมพิมพ์ (.pdf)"
                          placement="top"
                        >
                          <Button
                            aria-label="ส่งออกไฟล์ PDF"
                            className="flex-1 sm:flex-initial h-10 flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white hover:bg-rose-50/70 hover:border-rose-300 text-gray-700 hover:text-rose-800 px-3.5 text-xs sm:text-sm font-medium shadow-xs transition-all active:scale-[0.98] disabled:opacity-40"
                            isDisabled={
                              loading || !data || data.students.length === 0
                            }
                            onPress={handleExportPdf}
                          >
                            <FileText className="h-4 w-4 text-rose-600 shrink-0" />
                            <span>ส่งออก PDF</span>
                          </Button>
                        </Tooltip>
                      </div>
                    </div>

                    {/* Student List Section */}
                    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                      {paginatedStudents && paginatedStudents.length > 0 ? (
                        <div className="divide-y divide-gray-100">
                          {paginatedStudents.map((student, index) => (
                            <div
                              key={student.studentId}
                              className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-gray-50/80"
                            >
                              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                                <span className="w-5 shrink-0 text-center text-xs font-semibold text-gray-400">
                                  {(page - 1) * ITEMS_PER_PAGE + index + 1}
                                </span>
                                <Avatar
                                  className="h-10 w-10 shrink-0 bg-[#e8f0ee] text-[#3d6357]"
                                  imgProps={{
                                    alt: `รูปโปรไฟล์ของ ${student.name}`,
                                  }}
                                  name={student.initials}
                                  src={student.profileImageUrl || undefined}
                                />
                                <div className="min-w-0">
                                  <h4 className="font-medium text-gray-900">
                                    {student.name}
                                  </h4>
                                  <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-gray-500 font-light">
                                    <span>
                                      ชื่อเล่น: {student.nickname || "-"}
                                    </span>
                                    <span aria-hidden="true">·</span>
                                    <span>
                                      รหัสนักเรียน {student.studentId}
                                    </span>
                                    <span aria-hidden="true">·</span>
                                    <span>{student.classroom}</span>
                                  </p>
                                </div>
                              </div>
                              <div className="flex shrink-0 flex-col items-end gap-1">
                                {student.shirtSize ? (
                                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-sm font-bold border border-green-200">
                                    ไซส์ {student.shirtSize}
                                  </span>
                                ) : (
                                  <span className="px-3 py-1 bg-gray-100 text-gray-500 rounded-lg text-sm font-medium border border-gray-200">
                                    รอระบุไซส์
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-12 text-center">
                          <Shirt className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                          <p className="text-gray-500 font-medium text-sm">
                            ไม่พบรายชื่อนักเรียน
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Pagination */}
                    {pages > 1 && (
                      <div className="flex justify-center mt-4 pb-2">
                        <Pagination
                          classNames={{
                            cursor: "bg-[#5d7c6f] text-white font-bold",
                          }}
                          page={page}
                          total={pages}
                          onChange={setPage}
                        />
                      </div>
                    )}
                  </div>
                ) : null}
              </ModalBody>

              {!pageMode && (
                <ModalFooter className="border-t border-gray-100 p-6 pt-2">
                  <Button
                    className="bg-gray-100 px-6 font-medium text-gray-700 hover:bg-gray-200"
                    onPress={onClose}
                  >
                    ปิดหน้าต่าง
                  </Button>
                </ModalFooter>
              )}
            </>
          )}
        </ModalContent>
      </Modal>
      <DocumentPreviewModal
        fileName={`รายการจองเสื้อ_${cleanCampName}_${new Date().toISOString().slice(0, 10)}.pdf`}
        isOpen={pdfPreviewOpen}
        loadPdf={async () => ({
          blob: (await fetchPreviewPdf(`/api/camps/${campId}/shirts/pdf`)).blob,
        })}
        title="รายการจองเสื้อ"
        onClose={() => setPdfPreviewOpen(false)}
      />
    </>
  );
}
