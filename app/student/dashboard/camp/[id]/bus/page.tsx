"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import {
  AlertCircle,
  Bus,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  LayoutGrid,
  LogOut,
  MapPin,
  RefreshCw,
  BellRing,
} from "lucide-react";
import { toast } from "react-hot-toast";

import StudentBusCheckinSkeleton from "./components/StudentBusCheckinSkeleton";

import { boardStudentBusWithRetry } from "@/lib/student-bus-board";
import { dispatchStudentBusActionCompleted } from "@/lib/student-bus-notification-events";

function formatCheckedAt(value: string | null) {
  if (!value) return "";

  return new Date(value).toLocaleString("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  });
}

function gradeLabel(grade: string) {
  return grade?.startsWith("Level_")
    ? `ม.${grade.replace("Level_", "")}`
    : grade;
}

function seatSideLabel(label: string, seatIndex: number | null | undefined) {
  const seatLetter = label.trim().charAt(0).toUpperCase();

  if (seatLetter === "A" || seatLetter === "D") return "ติดหน้าต่าง";
  if (seatLetter === "B" || seatLetter === "C") return "ทางเดิน";

  return seatIndex === 0 || seatIndex === 3 ? "ติดหน้าต่าง" : "ทางเดิน";
}

function seatPositionLabel(
  position: {
    label: string;
    seatIndex?: number | null;
    floorNumber?: number | null;
  },
  floorCount: number,
  isFreeformLayout = false,
) {
  const floorName =
    position.floorNumber === 1
      ? "ชั้นล่าง"
      : position.floorNumber === 2
        ? "ชั้นบน"
        : position.floorNumber
          ? `ชั้น ${position.floorNumber}`
          : "";
  const floorLabel = floorCount > 1 && floorName ? `${floorName} · ` : "";

  if (isFreeformLayout) return `${floorLabel}${position.label}`;

  return `${floorLabel}${position.label} · ${seatSideLabel(position.label, position.seatIndex)}`;
}

function StudentFreeformFloorCanvas({ floor }: { floor: any }) {
  if (!floor.canvasColumns || !floor.canvasRows) return null;

  const layoutItems = [
    ...(floor.elements || []),
    ...floor.positions.filter(
      (position: any) => position.x !== null && position.y !== null,
    ),
  ];
  const occupiedLeft = layoutItems.length
    ? Math.min(...layoutItems.map((item: any) => item.x))
    : 0;
  const occupiedRight = layoutItems.length
    ? Math.max(...layoutItems.map((item: any) => item.x + item.width))
    : floor.canvasColumns;
  const occupiedTop = layoutItems.length
    ? Math.min(...layoutItems.map((item: any) => item.y))
    : 0;
  const occupiedBottom = layoutItems.length
    ? Math.max(...layoutItems.map((item: any) => item.y + item.height))
    : floor.canvasRows;
  const displayLeft = Math.max(0, occupiedLeft - 1 / 3);
  const displayRight = Math.min(floor.canvasColumns, occupiedRight + 1 / 3);
  const displayTop = Math.max(0, occupiedTop);
  const displayBottom = Math.min(floor.canvasRows, occupiedBottom + 0.4);
  const displayColumns = Math.max(1, displayRight - displayLeft);
  const displayRows = Math.max(1, displayBottom - displayTop);

  return (
    <div className="relative mx-auto w-full max-w-md overflow-hidden rounded-[2rem] border-[3px] border-[#5f806f] bg-[#fbfcfb] shadow-sm">
      <div className="pointer-events-none mx-[5%] mt-[4%] flex min-h-8 items-center justify-center rounded-xl bg-[#deebe4] px-3 py-1.5 text-center text-[10px] font-bold text-[#365f4f]">
        ด้านหน้ารถ / คนขับ
      </div>
      <div
        className="relative mt-3"
        style={{ aspectRatio: `${displayColumns} / ${displayRows * 0.72}` }}
      >
        {(floor.elements || []).map((element: any) => (
          <div
            key={`element-${element.elementId}`}
            className="absolute flex items-center justify-center overflow-hidden rounded-md border border-gray-200 bg-gray-100/90 px-1 text-center text-[8px] font-semibold text-gray-500"
            style={{
              left: `${((element.x - displayLeft) / displayColumns) * 100}%`,
              top: `${((element.y - displayTop) / displayRows) * 100}%`,
              width: `${(element.width / displayColumns) * 100}%`,
              height: `${(element.height / displayRows) * 100}%`,
              transform: `rotate(${element.rotation}deg)`,
              zIndex: element.zIndex,
            }}
          >
            {element.label}
          </div>
        ))}
        {floor.positions.map((position: any) => {
          if (position.x === null || position.y === null) return null;

          return (
            <div
              key={position.positionId}
              className="absolute p-0.5"
              style={{
                left: `${((position.x - displayLeft) / displayColumns) * 100}%`,
                top: `${((position.y - displayTop) / displayRows) * 100}%`,
                width: `${(position.width / displayColumns) * 100}%`,
                height: `${(position.height / displayRows) * 100}%`,
                transform: `rotate(${position.rotation}deg)`,
                zIndex: 20,
              }}
            >
              <div
                aria-current={position.isOwn ? "true" : undefined}
                className={`flex h-full min-h-8 w-full items-center justify-center rounded-lg border px-1 text-center text-[9px] font-bold ${
                  position.isOwn
                    ? "border-[#5d7c6f] bg-[#bfe8d2] text-[#24523f] ring-2 ring-[#5d7c6f]/25"
                    : "border-gray-200 bg-white text-gray-400"
                }`}
              >
                {position.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function StudentBusCheckinPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busRefreshCooldown, setBusRefreshCooldown] = useState(0);
  const [boarding, setBoarding] = useState(false);
  const [alighting, setAlighting] = useState(false);
  const [pendingBoarding, setPendingBoarding] = useState(false);

  useEffect(() => {
    if (busRefreshCooldown <= 0) return;

    const timer = window.setInterval(() => {
      setBusRefreshCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [busRefreshCooldown]);

  const fetchBusData = useCallback(
    async (notifyError = true, statusOnly = false) => {
      try {
        const url = statusOnly
          ? `/api/student/camps/${id}/bus?statusOnly=1`
          : `/api/student/camps/${id}/bus`;
        const response = await fetch(url, {
          cache: "no-store",
        });
        const result = await response.json();

        if (response.status === 429) {
          throw new Error(result.error || "คุณรีเฟรชถี่เกินไป กรุณารอสักครู่");
        }

        if (response.status === 403) {
          toast.error(result.error || "กรุณาลงทะเบียนเข้าร่วมค่ายก่อน");
          router.replace(`/student/dashboard/camp/${id}`);

          return;
        }

        if (!response.ok)
          throw new Error(result.error || "โหลดข้อมูลรถไม่สำเร็จ");

        if (statusOnly && result.statusOnly) {
          setData((current: any) => {
            if (!current || !current.configured) return current;

            return {
              ...current,
              bus: {
                ...current.bus,
                status: result.busStatus || current.bus.status,
              },
              student: {
                ...current.student,
                status: result.studentStatus || current.student.status,
                participationStatus:
                  result.participationStatus ||
                  current.student.participationStatus,
                isOnBus:
                  result.isOnBus !== undefined
                    ? result.isOnBus
                    : current.student.isOnBus,
                lastBoardedAt:
                  result.lastBoardedAt !== undefined
                    ? result.lastBoardedAt
                    : current.student.lastBoardedAt,
                reminder:
                  result.reminder !== undefined
                    ? result.reminder
                    : current.student.reminder,
              },
            };
          });
        } else {
          setData(result);
        }
      } catch (error: any) {
        if (notifyError) toast.error(error.message || "โหลดข้อมูลรถไม่สำเร็จ");
      } finally {
        setLoading(false);
      }
    },
    [id, router],
  );

  const handleManualRefresh = async () => {
    if (refreshing || busRefreshCooldown > 0) return;

    setRefreshing(true);

    try {
      const response = await fetch(`/api/student/camps/${id}/bus?manual=1`, {
        cache: "no-store",
      });
      const result = await response.json();

      if (response.status === 429) {
        throw new Error(result.error || "คุณรีเฟรชถี่เกินไป กรุณารอสักครู่");
      }

      if (response.status === 403) {
        toast.error(result.error || "กรุณาลงทะเบียนเข้าร่วมค่ายก่อน");
        router.replace(`/student/dashboard/camp/${id}`);

        return;
      }

      if (!response.ok)
        throw new Error(result.error || "โหลดข้อมูลรถไม่สำเร็จ");
      setData(result);
      toast.success("อัปเดตข้อมูลรถแล้ว");
    } catch (error: any) {
      toast.error(error.message || "โหลดข้อมูลรถไม่สำเร็จ");
    } finally {
      setRefreshing(false);
      setBusRefreshCooldown(5);
    }
  };

  useEffect(() => {
    void fetchBusData(true, false);
  }, [fetchBusData]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void fetchBusData(false, true);
      }
    }, 30000);

    return () => window.clearInterval(timer);
  }, [fetchBusData]);

  const boardBus = async () => {
    if (
      boarding ||
      data?.student?.isOnBus ||
      data?.student?.participationStatus === "NOT_TRAVELING" ||
      data?.bus?.status === "TRAVELING"
    ) {
      return;
    }

    setBoarding(true);

    try {
      const result = await boardStudentBusWithRetry(id);

      setData((current: any) => ({
        ...current,
        student: {
          ...current.student,
          isOnBus: true,
          status: "ON_BUS",
          lastBoardedAt: result.checkedAt || current.student.lastBoardedAt,
          reminder: null,
        },
      }));
      setPendingBoarding(false);
      dispatchStudentBusActionCompleted(id, "board");
      toast.success(result.message || "เช็คชื่อขึ้นรถสำเร็จ");
    } catch (error: any) {
      toast.error(error.message || "เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setBoarding(false);
    }
  };

  const alightBus = async () => {
    if (
      alighting ||
      !data?.student?.isOnBus ||
      data?.bus?.status === "TRAVELING"
    ) {
      return;
    }

    setAlighting(true);

    try {
      const response = await fetch(`/api/student/camps/${id}/bus/alight`, {
        method: "POST",
      });
      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || "บันทึกลงจากรถไม่สำเร็จ");

        return;
      }

      setData((current: any) => ({
        ...current,
        student: {
          ...current.student,
          isOnBus: false,
          status: "OFF_BUS",
          reminder: null,
        },
      }));
      dispatchStudentBusActionCompleted(id, "alight");
      toast.success(result.message || "บันทึกว่าลงจากรถแล้ว");
    } catch {
      toast.error("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setAlighting(false);
    }
  };

  if (loading) return <StudentBusCheckinSkeleton />;

  if (!data?.configured) {
    return (
      <div className="min-h-screen bg-[#f5f5f2] pb-12">
        <div className="bg-white border-b border-gray-100">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 sm:py-6 flex items-center gap-3">
            <Button
              isIconOnly
              className="text-gray-500"
              variant="light"
              onPress={() => router.back()}
            >
              <ChevronLeft size={24} />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-[#2D3648]">
                เช็คชื่อขึ้นรถ
              </h1>
              <p className="text-xs text-gray-400">
                {data?.campName || "ค่ายของฉัน"}
              </p>
            </div>
          </div>
        </div>
        <div className="max-w-lg mx-auto px-4 py-12">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 text-center">
            <div className="mx-auto mb-4 w-16 h-16 rounded-2xl bg-[#e8f0ee] text-[#5d7c6f] flex items-center justify-center">
              <Bus size={32} />
            </div>
            <h2 className="text-lg font-bold text-gray-900">
              ยังไม่มีข้อมูลรถ
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-500">
              ครูยังไม่ได้จัดรถหรือที่นั่งสำหรับคุณ
              หากจัดเรียบร้อยแล้วให้กดรีเฟรชอีกครั้ง
            </p>
            <Button
              className="mt-6 bg-[#5d7c6f] text-white font-bold rounded-xl"
              isDisabled={refreshing || busRefreshCooldown > 0}
              isLoading={refreshing}
              startContent={
                busRefreshCooldown <= 0 ? <RefreshCw size={17} /> : undefined
              }
              onPress={() => void handleManualRefresh()}
            >
              {busRefreshCooldown > 0
                ? `รออีก ${busRefreshCooldown} วินาที`
                : "รีเฟรชข้อมูล"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const isOnBus = Boolean(data.student?.isOnBus);
  const isParticipating = data.student?.participationStatus !== "NOT_TRAVELING";
  const isTraveling = data.bus?.status === "TRAVELING";
  const hasSeat = Boolean(data.student?.position);
  const floors = data.bus?.floors || [];
  const isFreeformLayout = Boolean(data.bus?.layoutTemplateId);
  const reminder = data.student?.reminder;

  return (
    <div className="min-h-screen bg-[#f5f5f2] pb-12">
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 sm:py-6 flex items-center gap-3">
          <Button
            isIconOnly
            className="text-gray-500"
            variant="light"
            onPress={() => router.back()}
          >
            <ChevronLeft size={24} />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold text-[#2D3648]">
              เช็คชื่อขึ้นรถ
            </h1>
            <p className="text-xs text-gray-400 truncate">{data.campName}</p>
          </div>
          <Button
            aria-label={
              busRefreshCooldown > 0
                ? `กรุณารอ ${busRefreshCooldown} วินาที`
                : "รีเฟรชข้อมูลรถ"
            }
            className="text-[#5d7c6f] font-medium"
            isDisabled={refreshing || busRefreshCooldown > 0}
            isIconOnly={busRefreshCooldown <= 0}
            isLoading={refreshing}
            title={
              busRefreshCooldown > 0
                ? `กรุณารอ ${busRefreshCooldown} วินาทีก่อนรีเฟรชใหม่`
                : "รีเฟรชข้อมูลรถ"
            }
            variant="light"
            onPress={() => void handleManualRefresh()}
          >
            <RefreshCw size={18} />
            {busRefreshCooldown > 0 && (
              <span className="text-xs font-semibold tabular-nums ml-1">
                {busRefreshCooldown}s
              </span>
            )}
          </Button>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        <section className="rounded-3xl bg-[#5d7c6f] p-6 text-white shadow-lg shadow-[#5d7c6f]/20">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 shrink-0 rounded-2xl bg-white/15 flex items-center justify-center">
              <Bus size={30} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-white/70">รถของคุณ</p>
              <h2 className="mt-1 line-clamp-2 text-lg font-semibold leading-tight">
                {data.bus.name}
              </h2>
            </div>
            <span
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                isTraveling
                  ? "bg-amber-200 text-amber-900"
                  : "bg-white/20 text-white"
              }`}
            >
              {isTraveling ? "กำลังเดินทาง" : "รถจอด"}
            </span>
          </div>
          <div className="mt-5 flex items-center gap-2 text-sm text-white/85">
            <MapPin size={16} />
            <span>
              {gradeLabel(data.bus.classroom.grade)} /{" "}
              {data.bus.classroom.roomName}
            </span>
          </div>
        </section>

        {reminder && !isTraveling && (
          <section
            aria-live="assertive"
            className={`rounded-2xl border p-4 shadow-sm ${
              reminder.action === "alight"
                ? "border-amber-300 bg-amber-50"
                : "border-[#9fc4b5] bg-[#eaf5ef]"
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  reminder.action === "alight"
                    ? "bg-amber-200 text-amber-800"
                    : "bg-[#cce6d9] text-[#285343]"
                }`}
              >
                <BellRing size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-gray-900">
                  ครูประจำรถแจ้งเตือน
                </p>
                <p className="mt-1 text-xs leading-relaxed text-gray-600">
                  {reminder.message}
                </p>
              </div>
            </div>
          </section>
        )}

        <section className="sticky top-0 z-10 -mx-1 rounded-2xl border border-[#d8e5de] bg-[#f7faf8]/95 p-3 shadow-sm backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                  isTraveling
                    ? "bg-amber-100 text-amber-700"
                    : "bg-[#e2eee7] text-[#365f4f]"
                }`}
              >
                {isOnBus ? <LogOut size={18} /> : <Bus size={18} />}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-900">
                  {isOnBus ? "การลงรถ" : "การขึ้นรถ"}
                </p>
                <p className="truncate text-[11px] text-gray-500">
                  {!isParticipating
                    ? "ครูระบุว่าไม่ร่วมเดินทางต่อในค่ายนี้"
                    : isOnBus
                      ? isTraveling
                        ? "รถกำลังเดินทาง"
                        : "รถจอดแล้ว"
                      : isTraveling
                        ? "รถกำลังเดินทาง"
                        : hasSeat
                          ? "พร้อมขึ้นรถ"
                          : "รอจัดที่นั่ง"}
                </p>
              </div>
            </div>
            {!isTraveling && isParticipating && (
              <Button
                className={
                  isOnBus
                    ? "min-h-9 min-w-[104px] shrink-0 bg-amber-100 px-3 text-xs font-medium text-amber-800"
                    : hasSeat
                      ? "min-h-9 min-w-[104px] shrink-0 bg-[#365f4f] px-3 text-xs font-medium text-white"
                      : "min-h-9 min-w-[104px] shrink-0 bg-gray-200 px-3 text-xs font-medium text-gray-400"
                }
                isDisabled={!isOnBus && !hasSeat}
                isLoading={isOnBus ? alighting : boarding}
                size="sm"
                onPress={isOnBus ? alightBus : () => setPendingBoarding(true)}
              >
                {isOnBus ? "ลงจากรถ" : hasSeat ? "ขึ้นรถ" : "รอจัดที่นั่ง"}
              </Button>
            )}
          </div>
        </section>

        <section className="rounded-3xl bg-white border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#e8f0ee] text-[#5d7c6f] flex items-center justify-center">
              <MapPin size={22} />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-600">ที่นั่งของคุณ</p>
              <p className="text-base font-medium text-gray-900">
                {data.student.position
                  ? seatPositionLabel(
                      data.student.position,
                      data.bus.floorCount,
                      isFreeformLayout,
                    )
                  : "ยังไม่ได้ระบุตำแหน่ง"}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#e8f0ee] text-[#5d7c6f]">
              <LayoutGrid size={22} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-600">
                ผังที่นั่งทั้งคัน
              </p>
            </div>
          </div>

          {floors.length > 0 ? (
            <div className="mt-4 space-y-4">
              {floors.map((floor: any) =>
                isFreeformLayout ? (
                  <StudentFreeformFloorCanvas
                    key={floor.floorNumber}
                    floor={floor}
                  />
                ) : (
                  <div
                    key={floor.floorNumber}
                    className="mx-auto max-w-md rounded-2xl border border-[#d8e5de] bg-[#f7faf8] p-3 sm:p-4"
                  >
                    <div className="mb-2 flex items-center justify-between gap-3 text-xs font-semibold text-[#365f4f]">
                      <span>
                        {data.bus.floorCount > 1
                          ? floor.floorNumber === 1
                            ? "ชั้นล่าง"
                            : floor.floorNumber === 2
                              ? "ชั้นบน"
                              : `ชั้น ${floor.floorNumber}`
                          : `ทั้งหมด ${floor.rowCount} แถว`}
                      </span>
                      <span>ด้านหน้ารถ ↑</span>
                    </div>
                    <div className="space-y-1">
                      {Array.from({ length: floor.rowCount }, (_, rowIndex) => {
                        const rowPositions = floor.positions
                          .filter(
                            (position: any) =>
                              position.rowNumber === rowIndex + 1,
                          )
                          .sort((a: any, b: any) => a.seatIndex - b.seatIndex);

                        return (
                          <div
                            key={rowIndex}
                            className="grid grid-cols-[1fr_1fr_0.3fr_1fr_1fr] gap-1"
                          >
                            {rowPositions.map((position: any) => {
                              const colClass =
                                [
                                  "col-start-1",
                                  "col-start-2",
                                  "col-start-4",
                                  "col-start-5",
                                ][position.seatIndex] ?? "";

                              return (
                                <div
                                  key={position.positionId}
                                  aria-current={
                                    position.isOwn ? "true" : undefined
                                  }
                                  className={`flex min-h-9 min-w-0 items-center justify-center rounded-lg border px-1 text-center text-[10px] font-bold ${
                                    position.isOwn
                                      ? "border-[#5d7c6f] bg-[#bfe8d2] text-[#24523f] ring-2 ring-[#5d7c6f]/25"
                                      : "border-gray-200 bg-white text-gray-400"
                                  } ${colClass}`}
                                >
                                  {position.label}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ),
              )}
            </div>
          ) : (
            <p className="mt-4 rounded-xl bg-gray-50 px-3 py-4 text-center text-xs text-gray-500">
              ยังไม่มีข้อมูลผังที่นั่ง
            </p>
          )}

          {!hasSeat && (
            <div className="mt-4 rounded-xl bg-amber-50 px-3 py-3 text-center text-xs text-amber-700">
              ยังไม่ได้จัดที่นั่งให้คุณ
            </div>
          )}
        </section>

        <section
          className={`rounded-3xl border p-5 ${
            isOnBus
              ? "border-green-200 bg-green-50"
              : isTraveling
                ? "border-amber-200 bg-amber-50"
                : "border-[#b8d0c8] bg-[#f1f7f4]"
          }`}
        >
          <div className="flex items-start gap-3">
            {isOnBus ? (
              <CheckCircle2
                className="mt-0.5 shrink-0 text-green-600"
                size={22}
              />
            ) : isTraveling ? (
              <AlertCircle
                className="mt-0.5 shrink-0 text-amber-600"
                size={22}
              />
            ) : (
              <Clock3 className="mt-0.5 shrink-0 text-[#5d7c6f]" size={22} />
            )}
            <div>
              <p className="font-semibold text-gray-900">
                {isOnBus
                  ? isTraveling
                    ? "อยู่บนรถ"
                    : "เช็คชื่อขึ้นรถแล้ว"
                  : isTraveling
                    ? "รถกำลังเดินทาง"
                    : "เมื่อขึ้นรถแล้ว อย่าลืมกดยืนยัน"}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-gray-500">
                {isOnBus
                  ? isTraveling
                    ? "รถกำลังเดินทาง หากลงรถแล้วให้รอรถจอดก่อนกดยืนยัน"
                    : `ยืนยันเมื่อ ${formatCheckedAt(data.student.lastBoardedAt)}`
                  : isTraveling
                    ? "รอให้รถจอดที่จุดถัดไปก่อนจึงจะยืนยันได้"
                    : hasSeat
                      ? "ตรวจสอบที่นั่งของคุณ แล้วกดปุ่มด้านบนหลังนั่งประจำที่เรียบร้อยแล้ว"
                      : "ยังไม่ได้จัดที่นั่งให้คุณ กรุณาติดต่อครูผู้ดูแล"}
              </p>
            </div>
          </div>
        </section>
      </main>

      {pendingBoarding && (
        <div
          aria-labelledby="student-boarding-dialog-title"
          aria-modal="true"
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
          role="dialog"
        >
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl">
            <h2
              className="text-base font-semibold text-gray-900"
              id="student-boarding-dialog-title"
            >
              ยืนยันขึ้นรถ
            </h2>
            <div className="mt-4 rounded-2xl bg-[#f1f7f4] p-4">
              <p className="text-xs text-[#5d7c6f]">{data.bus.name}</p>
              <p className="mt-2 text-sm text-gray-600">
                ที่นั่ง{" "}
                {seatPositionLabel(
                  data.student.position,
                  data.bus.floorCount,
                  isFreeformLayout,
                )}
              </p>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-gray-500">
              เมื่อกดยืนยัน ระบบจะบันทึกว่าคุณอยู่บนรถคันนี้
            </p>
            <div className="mt-5 flex gap-2">
              <button
                className="min-h-10 flex-1 rounded-xl px-3 text-sm font-medium text-gray-600 transition hover:bg-gray-100 disabled:opacity-60"
                disabled={boarding}
                type="button"
                onClick={() => setPendingBoarding(false)}
              >
                ยกเลิก
              </button>
              <button
                className="min-h-10 flex-1 rounded-xl bg-[#365f4f] px-3 text-sm font-semibold text-white transition hover:bg-[#2d5143] disabled:cursor-wait disabled:opacity-60"
                disabled={boarding}
                type="button"
                onClick={boardBus}
              >
                {boarding ? "กำลังยืนยัน..." : "ยืนยันขึ้นรถ"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
