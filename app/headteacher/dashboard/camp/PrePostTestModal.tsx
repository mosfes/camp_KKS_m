import React, { useState, useEffect, useRef, type ReactNode } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/modal";
import { Button } from "@heroui/button";
import { Avatar } from "@heroui/avatar";
import { BarChart2, Search } from "lucide-react";

import CampBreadcrumb from "./CampBreadcrumb";

function SkeletonBlock({ className }: { className: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-lg bg-gray-200 ${className}`}
    />
  );
}

function PrePostTestSkeleton() {
  return (
    <div className="space-y-6">
      {/* Search Bar & Filters Skeleton */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <SkeletonBlock className="h-10 w-full flex-1 rounded-xl" />
        <SkeletonBlock className="h-10 w-full sm:w-56 rounded-xl" />
      </div>

      {/* Station Card Skeletons */}
      {Array.from({ length: 2 }).map((_, cardIdx) => (
        <div
          key={cardIdx}
          className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xs"
        >
          {/* Station Title Header */}
          <div className="border-b border-gray-100 bg-gray-50/50 p-5">
            <SkeletonBlock className="mb-2 h-5 w-36" />
            <SkeletonBlock className="h-3.5 w-60" />
          </div>

          {/* Table Header */}
          <div className="border-b border-gray-100 bg-gray-50/30 px-6 py-3.5">
            <div className="flex items-center justify-between">
              <SkeletonBlock className="h-3.5 w-36" />
              <SkeletonBlock className="h-3.5 w-16" />
              <SkeletonBlock className="h-3.5 w-16" />
              <SkeletonBlock className="h-3.5 w-20" />
            </div>
          </div>

          {/* Table Rows */}
          <div className="divide-y divide-gray-50 px-6">
            {Array.from({ length: 3 }).map((_, rowIdx) => (
              <div
                key={rowIdx}
                className="flex items-center justify-between py-4"
              >
                <SkeletonBlock className="h-10 w-52" />
                <SkeletonBlock className="h-7 w-12 rounded-lg" />
                <SkeletonBlock className="h-7 w-12 rounded-lg" />
                <SkeletonBlock className="h-7 w-16 rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function PrePostTestShell({
  pageMode,
  isOpen,
  onClose,
  children,
}: {
  pageMode: boolean;
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  if (pageMode) {
    return (
      <main className="h-full min-h-0 overflow-y-auto bg-[#f5f5f2]">
        {children}
      </main>
    );
  }

  return (
    <Modal
      backdrop="blur"
      classNames={{
        base: "bg-white rounded-2xl shadow-xl",
        backdrop: "bg-black/50 backdrop-blur-sm",
      }}
      isDismissable={true}
      isOpen={isOpen}
      scrollBehavior="inside"
      size="4xl"
      onOpenChange={onClose}
    >
      <ModalContent>{children}</ModalContent>
    </Modal>
  );
}

export default function PrePostTestModal({
  isOpen,
  onClose,
  campId,
  pageMode = false,
  initialPairs,
}: any) {
  const initialPairsPending = useRef(Boolean(initialPairs));
  const [loading, setLoading] = useState(!initialPairs);
  const [data, setData] = useState<any>(initialPairs || null);
  const [searchQuery, setSearchQuery] = useState("");
  const [scoreFilter, setScoreFilter] = useState("all");

  useEffect(() => {
    if (isOpen && campId) {
      if (initialPairsPending.current) {
        initialPairsPending.current = false;
      } else {
        fetchData();
      }
    }
  }, [isOpen, campId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/camps/${campId}/pre-post-tests`);

      if (!response.ok) throw new Error("Failed to fetch data");
      const result = await response.json();

      setData(result.pairs);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const Header = pageMode ? "header" : ModalHeader;
  const Body = pageMode ? "section" : ModalBody;

  return (
    <PrePostTestShell isOpen={isOpen} pageMode={pageMode} onClose={onClose}>
      <>
        <Header
          className={`relative flex flex-col gap-1 px-6 ${
            pageMode
              ? "mx-auto w-full max-w-6xl border-0 pb-8 pt-8 sm:px-8"
              : "border-b border-gray-100 p-6"
          }`}
        >
          {pageMode && (
            <CampBreadcrumb
              campId={campId}
              className="mb-6"
              currentPage="เปรียบเทียบคะแนน"
            />
          )}

          <div className="flex items-center gap-2 text-[#6b857a]">
            <BarChart2 size={pageMode ? 20 : 24} />
            <h2
              className={`${
                pageMode ? "text-lg leading-tight" : "text-xl"
              } font-bold text-gray-900`}
            >
              เปรียบเทียบคะแนนก่อนเรียน - หลังเรียน
            </h2>
          </div>
          <p className="text-sm font-normal text-gray-500">
            ดูและเปรียบเทียบคะแนนพัฒนาการของนักเรียนในแต่ละฐานกิจกรรม
          </p>
        </Header>

        <Body
          className={
            pageMode
              ? "mx-auto block w-full max-w-6xl space-y-6 overflow-visible bg-[#f5f5f2] px-4 pb-10 pt-0 sm:px-8"
              : "bg-gray-50/50 p-6"
          }
        >
          {loading ? (
            <PrePostTestSkeleton />
          ) : !data || data.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="font-medium text-lg text-gray-900 mb-1">
                ไม่พบข้อมูลแบบทดสอบ
              </p>
              <p>ยังไม่มีการสร้างภารกิจแบบทดสอบก่อนเรียน/หลังเรียน ในค่ายนี้</p>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Search Bar & Filters */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-xl leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#6b857a] focus:border-[#6b857a] sm:text-sm transition-colors"
                    placeholder="ค้นหาชื่อ ชื่อเล่น หรือรหัสนักเรียน..."
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <select
                  className="block w-full sm:w-56 pl-3 pr-8 py-2 border border-gray-200 rounded-xl leading-5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#6b857a] focus:border-[#6b857a] sm:text-sm transition-colors"
                  value={scoreFilter}
                  onChange={(e) => setScoreFilter(e.target.value)}
                >
                  <option value="all">คะแนนหลังเรียนทั้งหมด</option>
                  <option value="70">ดีเยี่ยม (70% ขึ้นไป)</option>
                  <option value="50">ผ่านเกณฑ์ (50% - 69%)</option>
                  <option value="30">ปรับปรุง (30% - 49%)</option>
                  <option value="0">ไม่ผ่าน (ต่ำกว่า 30%)</option>
                </select>
              </div>

              {data.map((pair: any, index: number) => {
                const postTotal = pair.postTest.total || 1;
                const filteredScores = pair.studentScores.filter((s: any) => {
                  if (searchQuery) {
                    const q = searchQuery.toLowerCase();

                    if (
                      !s.studentName.toLowerCase().includes(q) &&
                      !s.studentNickname?.toLowerCase().includes(q) &&
                      !String(s.studentId).includes(q)
                    )
                      return false;
                  }

                  if (scoreFilter !== "all") {
                    if (s.postScore === null) return false;
                    const percent = (s.postScore / postTotal) * 100;

                    if (scoreFilter === "70" && percent < 70) return false;
                    if (scoreFilter === "50" && (percent < 50 || percent >= 70))
                      return false;
                    if (scoreFilter === "30" && (percent < 30 || percent >= 50))
                      return false;
                    if (scoreFilter === "0" && percent >= 30) return false;
                  }

                  return true;
                });

                return (
                  <div
                    key={index}
                    className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm"
                  >
                    <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                      <div>
                        <h3 className="font-bold text-gray-900 text-lg">
                          ฐาน: {pair.stationName}
                        </h3>
                        <p className="text-sm text-gray-500">
                          ก่อนเรียนเต็ม {pair.preTest.total} คะแนน ·
                          หลังเรียนเต็ม {pair.postTest.total} คะแนน
                        </p>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse min-w-[650px]">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-100 text-gray-600 text-sm">
                            <th className="px-6 py-3 font-semibold whitespace-nowrap">
                              นักเรียน
                            </th>
                            <th className="px-6 py-3 font-semibold text-center w-32 whitespace-nowrap">
                              ก่อนเรียน
                            </th>
                            <th className="px-6 py-3 font-semibold text-center w-32 whitespace-nowrap">
                              หลังเรียน
                            </th>
                            <th className="px-6 py-3 font-semibold text-center w-32 whitespace-nowrap">
                              พัฒนาการ
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {filteredScores.length === 0 ? (
                            <tr>
                              <td
                                className="py-8 text-center text-gray-500"
                                colSpan={4}
                              >
                                ไม่พบนักเรียนที่ค้นหา
                              </td>
                            </tr>
                          ) : (
                            filteredScores.map((s: any) => (
                              <tr
                                key={s.studentId}
                                className="hover:bg-gray-50/50 transition-colors"
                              >
                                <td className="px-6 py-3 text-sm text-gray-900">
                                  <div className="flex min-w-[280px] items-center gap-3">
                                    <Avatar
                                      className="h-10 w-10 shrink-0 bg-[#e8f0ee] text-[#3d6357]"
                                      imgProps={{
                                        alt: `รูปโปรไฟล์ของ ${s.studentName}`,
                                      }}
                                      name={s.initials}
                                      src={s.profileImageUrl || undefined}
                                    />
                                    <div className="min-w-0">
                                      <p className="font-medium text-gray-900">
                                        {s.studentName}
                                      </p>
                                      <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-gray-500">
                                        <span>
                                          ชื่อเล่น: {s.studentNickname || "-"}
                                        </span>
                                        <span aria-hidden="true">·</span>
                                        <span>รหัสนักเรียน {s.studentId}</span>
                                      </p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-3 text-sm text-center">
                                  {s.preScore !== null ? (
                                    <span className="inline-block px-2.5 py-1 bg-gray-100 text-gray-700 rounded-lg font-medium min-w-[3rem]">
                                      {s.preScore}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </td>
                                <td className="px-6 py-3 text-sm text-center">
                                  {s.postScore !== null ? (
                                    <span className="inline-block px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-lg font-medium min-w-[3rem]">
                                      {s.postScore}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </td>
                                <td className="px-6 py-3 text-sm text-center">
                                  {s.diff !== null ? (
                                    <div
                                      className={`inline-flex flex-col items-center justify-center px-3 py-1.5 rounded-lg border ${
                                        s.diff > 0
                                          ? "bg-green-50 text-green-700 border-green-200"
                                          : s.diff < 0
                                            ? "bg-red-50 text-red-700 border-red-200"
                                            : "bg-gray-50 text-gray-600 border-gray-200"
                                      }`}
                                    >
                                      <span className="font-bold">
                                        {s.diff > 0 ? `+${s.diff}` : s.diff}
                                      </span>
                                      {pair.postTest.total > 0 && (
                                        <span className="text-[10px] font-medium opacity-80 mt-0.5">
                                          ({s.diff > 0 ? "+" : ""}
                                          {Math.round(
                                            (s.diff / pair.postTest.total) *
                                              100,
                                          )}
                                          %)
                                        </span>
                                      )}
                                    </div>
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
                  </div>
                );
              })}
            </div>
          )}
        </Body>
        {!pageMode && (
          <ModalFooter className="flex justify-end border-t border-gray-100 p-4">
            <Button
              className="bg-gray-100 font-medium text-gray-700 hover:bg-gray-200"
              onPress={onClose}
            >
              ปิดหน้าต่าง
            </Button>
          </ModalFooter>
        )}
      </>
    </PrePostTestShell>
  );
}
