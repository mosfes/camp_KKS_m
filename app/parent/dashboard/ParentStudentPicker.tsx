"use client";

import { useState } from "react";
import { ChevronRight, GraduationCap, Plus, UserRound } from "lucide-react";

export type LinkedStudent = {
  students_id: number;
  prefix_name: string | null;
  firstname: string;
  lastname: string;
  nickname: string | null;
  profile_image_url: string | null;
  classroom_students: {
    classroom: { grade: string; classroom_types: { name: string } };
  }[];
};

const gradeLabel: Record<string, string> = {
  Level_1: "ม.1",
  Level_2: "ม.2",
  Level_3: "ม.3",
  Level_4: "ม.4",
  Level_5: "ม.5",
  Level_6: "ม.6",
};

export function ParentStudentPicker({
  students,
  compact = false,
  onSelect,
  onLinked,
}: {
  students: LinkedStudent[];
  compact?: boolean;
  onSelect: (studentId: number) => Promise<void>;
  onLinked: () => Promise<void>;
}) {
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function linkStudent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/parent/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: studentId.trim(), password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "เชื่อมบัญชีไม่สำเร็จ");
      setStudentId("");
      setPassword("");
      setShowLinkForm(false);
      await onLinked();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "เชื่อมบัญชีไม่สำเร็จ",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className={
        compact
          ? "rounded-3xl border border-gray-100 bg-white p-5 shadow-sm"
          : "mx-auto max-w-6xl p-4 sm:p-6 lg:p-8"
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1
            className={
              compact
                ? "text-lg font-bold text-gray-800"
                : "text-2xl font-bold text-gray-800"
            }
          >
            {compact ? "บุตรหลานในบัญชี" : "เลือกนักเรียนที่ต้องการดู"}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {compact
              ? "เพิ่มบัญชีผู้ปกครองของนักเรียนอีกคนได้ที่นี่"
              : "เลือกการ์ดเพื่อดูข้อมูลและค่ายของนักเรียนคนนั้น"}
          </p>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded-xl border border-[#5d7c6f] px-4 py-2.5 text-sm font-semibold text-[#5d7c6f] transition hover:bg-[#e8f0ee]"
          type="button"
          onClick={() => {
            setError("");
            setShowLinkForm((value) => !value);
          }}
        >
          <Plus size={17} /> เพิ่มบุตรหลาน
        </button>
      </div>

      {!compact && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {students.map((student) => {
            const classroom = student.classroom_students[0]?.classroom;
            return (
              <button
                key={student.students_id}
                className="group flex min-h-44 items-start gap-4 rounded-3xl border border-gray-100 bg-white p-5 text-left shadow-sm transition hover:border-[#5d7c6f] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5d7c6f] disabled:opacity-60"
                disabled={busy}
                type="button"
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    await onSelect(student.students_id);
                  } catch (reason) {
                    setError(
                      reason instanceof Error
                        ? reason.message
                        : "เลือกนักเรียนไม่สำเร็จ",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {student.profile_image_url ? (
                  <img
                    alt=""
                    className="h-14 w-14 shrink-0 rounded-2xl object-cover"
                    src={student.profile_image_url}
                  />
                ) : (
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#e8f0ee] text-[#5d7c6f]">
                    <UserRound size={27} />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-bold text-gray-800">
                    {student.prefix_name ?? ""}
                    {student.firstname} {student.lastname}
                  </span>
                  {student.nickname && (
                    <span className="mt-0.5 block text-sm text-gray-500">
                      ชื่อเล่น {student.nickname}
                    </span>
                  )}
                  <span className="mt-3 block text-xs text-gray-500">
                    รหัสนักเรียน {student.students_id}
                  </span>
                  <span className="mt-1 flex items-center gap-1.5 text-xs text-[#5d7c6f]">
                    <GraduationCap size={15} />
                    {classroom
                      ? `${gradeLabel[classroom.grade] ?? classroom.grade}/${classroom.classroom_types.name}`
                      : "ยังไม่มีข้อมูลห้องเรียน"}
                  </span>
                  <span className="mt-4 flex items-center gap-1 text-sm font-semibold text-[#5d7c6f]">
                    ดูรายละเอียด <ChevronRight size={16} />
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {showLinkForm && (
        <form
          className="mt-5 max-w-xl space-y-3 rounded-2xl bg-[#f5f5f2] p-4"
          onSubmit={linkStudent}
        >
          <p className="text-sm font-semibold text-gray-700">
            เชื่อมบัญชีผู้ปกครองของนักเรียนอีกคน
          </p>
          <p className="text-xs text-gray-500">
            ใช้รหัสนักเรียนและรหัสผ่านผู้ปกครองที่เปลี่ยนจากรหัสเริ่มต้นแล้ว
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              aria-label="รหัสนักเรียนที่ต้องการเพิ่ม"
              autoComplete="off"
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#5d7c6f]"
              inputMode="numeric"
              placeholder="รหัสนักเรียน"
              required
              value={studentId}
              onChange={(event) => setStudentId(event.target.value)}
            />
            <input
              aria-label="รหัสผ่านผู้ปกครองของนักเรียนที่ต้องการเพิ่ม"
              autoComplete="current-password"
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#5d7c6f]"
              placeholder="รหัสผ่านผู้ปกครอง"
              required
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <button
            className="rounded-xl bg-[#5d7c6f] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            disabled={busy}
            type="submit"
          >
            {busy ? "กำลังเชื่อมบัญชี..." : "เชื่อมบัญชี"}
          </button>
        </form>
      )}
      {error && (
        <p aria-live="polite" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}
    </section>
  );
}
