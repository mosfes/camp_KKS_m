"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CalendarClock, Users } from "lucide-react";
import { toast } from "react-hot-toast";

import {
  formatThaiDateKey,
  type RegistrationState,
} from "@/lib/camp-registration";
import { getBangkokDateKey } from "@/lib/bangkok-date";

type RegistrationSummary = {
  registration: RegistrationState;
  startRegisDate: string;
  endRegisDate: string;
  startDate: string;
  endDate: string;
  total: number;
  registered: number;
  classrooms: {
    classroomId: number;
    name: string;
    total: number;
    registered: number;
  }[];
  needsAttention: boolean;
  canExtend: boolean;
};

const statusStyle: Record<RegistrationState["status"], string> = {
  open: "bg-green-100 text-green-700",
  not_open: "bg-amber-100 text-amber-700",
  paused: "bg-red-100 text-red-700",
  closed: "bg-gray-200 text-gray-600",
  ended: "bg-gray-100 text-gray-500",
};

const statusText: Record<RegistrationState["status"], string> = {
  open: "เปิดรับสมัคร",
  not_open: "ยังไม่เปิดรับสมัคร",
  paused: "หมดเขตรับสมัคร",
  closed: "ปิดรับลงทะเบียน",
  ended: "ค่ายจบแล้ว",
};

function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);

  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

export default function RegistrationStatusCard({
  campId,
  onChanged,
}: {
  campId: number;
  onChanged?: () => void;
}) {
  const [data, setData] = useState<RegistrationSummary | null>(null);
  const [extending, setExtending] = useState(false);
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/camps/${campId}/registration`, {
        cache: "no-store",
      });

      if (!res.ok) return;
      const json: RegistrationSummary = await res.json();

      setData(json);
      setEndDate((current) => current || addDays(json.startDate, -1));
    } catch {
      // ไม่บล็อกหน้าค่ายถ้าโหลดสถานะไม่ได้
    }
  }, [campId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!data || data.registration.status === "ended") return null;

  const todayKey = getBangkokDateKey();
  const minEnd = todayKey;
  const maxEnd = data.startDate;
  const percent =
    data.total > 0 ? Math.round((data.registered / data.total) * 100) : 0;

  const extend = async () => {
    if (!endDate || endDate < minEnd || endDate > maxEnd) {
      toast.error("กรุณาเลือกวันระหว่างวันนี้ถึงวันเริ่มค่าย");

      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/camps/${campId}/registration`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endDate }),
      });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        toast.error(json?.error || "ขยายเวลาไม่สำเร็จ");

        return;
      }
      toast.success(`ขยายเวลารับสมัครถึง ${formatThaiDateKey(endDate)} แล้ว`);
      setExtending(false);
      await load();
      onChanged?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={`bg-white rounded-xl shadow-sm overflow-hidden mb-6 border ${
        data.needsAttention ? "border-red-200" : "border-transparent"
      }`}
    >
      {data.needsAttention && (
        <div className="flex items-start gap-2 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 shrink-0" size={16} />
          <p>
            หมดเขตรับสมัครแล้ว แต่นักเรียนลงทะเบียนเพียง {data.registered} จาก{" "}
            {data.total} คน ({percent}%)
            นักเรียนที่เหลือจะกดลงทะเบียนไม่ได้จนถึงวันค่าย
            {data.canExtend
              ? " — ขยายเวลารับสมัครได้ด้านล่าง"
              : " — แจ้งเจ้าของค่ายให้ขยายเวลา"}
          </p>
        </div>
      )}

      <div className="px-4 py-3 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="w-8 h-8 rounded-lg bg-[#f0f4f2] flex items-center justify-center flex-shrink-0">
              <Users className="text-[#6b857a]" size={16} />
            </div>
            <h2 className="text-sm font-semibold text-gray-900">
              การลงทะเบียน
            </h2>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyle[data.registration.status]}`}
            >
              {statusText[data.registration.status]}
            </span>
          </div>
          <p className="text-sm text-gray-600">
            ลงแล้ว{" "}
            <span className="font-semibold text-gray-900">
              {data.registered}/{data.total}
            </span>{" "}
            คน ({percent}%)
          </p>
        </div>

        <p className="flex items-center gap-1.5 text-xs text-gray-500">
          <CalendarClock size={14} />
          รับสมัคร {formatThaiDateKey(data.startRegisDate)} –{" "}
          {formatThaiDateKey(data.endRegisDate)} · ลงได้ในวันค่ายด้วย (
          {formatThaiDateKey(data.startDate)} –{" "}
          {formatThaiDateKey(data.endDate)})
        </p>

        <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full bg-[#5d7c6f] transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>

        {data.classrooms.length > 1 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {data.classrooms.map((room) => {
              const roomPercent =
                room.total > 0
                  ? Math.round((room.registered / room.total) * 100)
                  : 0;

              return (
                <div
                  key={room.classroomId}
                  className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"
                >
                  <p className="text-xs font-medium text-gray-700 truncate">
                    {room.name}
                  </p>
                  <p
                    className={`text-sm font-semibold ${roomPercent < 50 ? "text-red-600" : "text-gray-900"}`}
                  >
                    {room.registered}/{room.total}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {data.canExtend &&
          data.registration.status !== "closed" &&
          todayKey <= maxEnd &&
          (extending ? (
            <div className="flex flex-wrap items-end gap-2 rounded-lg bg-[#f0f4f2] p-3">
              <label className="text-xs text-gray-600">
                ปิดรับสมัครวันที่
                <input
                  className="mt-1 block rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                  max={maxEnd}
                  min={minEnd}
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                />
              </label>
              <button
                className="rounded-lg bg-[#5d7c6f] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                disabled={saving}
                type="button"
                onClick={extend}
              >
                {saving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
              <button
                className="rounded-lg px-3 py-2 text-sm text-gray-600"
                type="button"
                onClick={() => setExtending(false)}
              >
                ยกเลิก
              </button>
            </div>
          ) : (
            <button
              className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                data.needsAttention
                  ? "bg-red-600 text-white"
                  : "border border-[#5d7c6f]/30 text-[#5d7c6f]"
              }`}
              type="button"
              onClick={() => setExtending(true)}
            >
              ขยายเวลารับสมัคร
            </button>
          ))}
      </div>
    </div>
  );
}
