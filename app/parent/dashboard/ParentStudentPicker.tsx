"use client";

import { useState } from "react";
import {
  ArrowUpRight,
  GraduationCap,
  Plus,
  UserRound,
  UsersRound,
} from "lucide-react";

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
  onSelect,
  onLinked,
}: {
  students: LinkedStudent[];
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
      window.dispatchEvent(new Event("parent-students-updated"));
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "เชื่อมบัญชีไม่สำเร็จ",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#325b4d] via-[#4e7666] to-[#73927d] px-6 py-8 text-white shadow-[0_16px_40px_-24px_rgba(35,78,59,0.65)] sm:px-9 sm:py-10">
        <div className="pointer-events-none absolute -right-8 -top-24 h-64 w-64 rounded-full border border-white/15 bg-white/5" />
        <div className="relative flex flex-wrap items-center justify-between gap-5">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 text-xs font-semibold text-white/80">
              <UsersRound size={16} /> {students.length} คนในบัญชีผู้ปกครอง
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              บุตรหลานของคุณ
            </h1>
            <p className="mt-1.5 text-sm text-white/85">
              เลือกบุตรหลานเพื่อดูข้อมูล กิจกรรมค่าย และประวัติของแต่ละคน
            </p>
          </div>
          <button
            aria-controls="parent-link-student-form"
            aria-expanded={showLinkForm}
            className="relative inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#365f4f] shadow-sm transition hover:bg-[#edf5ef] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#365f4f]"
            type="button"
            onClick={() => {
              setError("");
              setShowLinkForm((value) => !value);
            }}
          >
            <Plus size={17} /> เพิ่มบุตรหลาน
          </button>
        </div>
      </section>

      {showLinkForm && (
        <form
          id="parent-link-student-form"
          className="mt-6 max-w-xl space-y-3 rounded-2xl border border-[#dfe9e0] bg-white p-5 shadow-sm"
          onSubmit={linkStudent}
        >
          <p className="text-sm font-semibold text-gray-700">
            เชื่อมบัญชีผู้ปกครองของนักเรียนอีกคน
          </p>
          <p className="text-xs text-gray-500">
            ใช้รหัสนักเรียนและรหัสผ่านผู้ปกครองของนักเรียนคนนั้น
            หากยังไม่เคยเปลี่ยนรหัส สามารถใช้รหัสเริ่มต้นได้
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
              autoComplete="off"
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
      <section aria-label="รายชื่อบุตรหลาน" className="mt-7">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#24382e]">เลือกดูข้อมูล</h2>
            <p className="text-sm text-gray-500">
              แตะการ์ดเพื่อเข้าสู่หน้าของบุตรหลาน
            </p>
          </div>
          <span className="text-xs font-medium text-[#5d7c6f]">
            {students.length} คน
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {students.map((student) => {
            const classroom = student.classroom_students[0]?.classroom;
            return (
              <button
                key={student.students_id}
                aria-label={`ดูข้อมูลของ ${student.prefix_name ?? ""}${student.firstname} ${student.lastname}`}
                className="group flex min-h-60 flex-col rounded-[1.75rem] border border-[#e4ebe5] bg-white p-5 text-left shadow-[0_8px_30px_-20px_rgba(26,65,47,0.45)] transition duration-200 hover:-translate-y-1 hover:border-[#91b09b] hover:shadow-[0_18px_35px_-20px_rgba(26,65,47,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5d7c6f] disabled:opacity-60 sm:p-6"
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
                <span className="flex w-full items-start justify-between gap-3">
                  {student.profile_image_url ? (
                    <img
                      alt=""
                      className="h-16 w-16 shrink-0 rounded-2xl object-cover ring-4 ring-[#f1f6f1]"
                      src={student.profile_image_url}
                    />
                  ) : (
                    <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#e8f0ee] text-[#5d7c6f] ring-4 ring-[#f1f6f1]">
                      <UserRound size={29} />
                    </span>
                  )}
                  <span className="rounded-full bg-[#f1f6f1] px-3 py-1 text-xs font-medium text-[#4c6b58]">
                    #{student.students_id}
                  </span>
                </span>
                <span className="mt-5 block min-w-0 text-lg font-bold leading-snug text-[#223a2c] group-hover:text-[#365f4f]">
                  {student.prefix_name ?? ""}
                  {student.firstname} {student.lastname}
                </span>
                <span className="mt-1 block text-sm text-gray-500">
                  {student.nickname
                    ? `ชื่อเล่น ${student.nickname}`
                    : "ข้อมูลนักเรียน"}
                </span>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm text-[#527363]">
                  <GraduationCap size={17} />
                  {classroom
                    ? `${gradeLabel[classroom.grade] ?? classroom.grade}/${classroom.classroom_types.name}`
                    : "ยังไม่มีข้อมูลห้องเรียน"}
                </span>
                <span className="mt-5 flex w-full items-center justify-between border-t border-[#edf1ed] pt-4 text-sm font-semibold text-[#365f4f]">
                  ดูข้อมูลและกิจกรรม
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#edf4ed] transition group-hover:bg-[#dcebdd]">
                    <ArrowUpRight size={17} />
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </main>
  );
}
