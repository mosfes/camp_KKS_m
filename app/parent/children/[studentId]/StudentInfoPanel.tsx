"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, UserRound } from "lucide-react";

type StudentInfo = {
  students_id: number;
  public_id: string;
  nickname: string | null;
  birthday: string | null;
  food_allergy: string | null;
  chronic_disease: string | null;
  remark: string | null;
  tel: string | null;
  email: string;
  classroom_students: {
    classroom: {
      grade: string;
      classroom_types: { name: string };
    };
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

function formatBirthday(value: string | null) {
  return value
    ? new Date(value).toLocaleDateString("th-TH", {
        dateStyle: "long",
        timeZone: "Asia/Bangkok",
      })
    : "-";
}

/** Read-only student details shown in the "ข้อมูลนักเรียน" tab. */
export default function StudentInfoPanel({ studentId }: { studentId: string }) {
  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    setStudent(null);
    setError("");
    fetch(`/api/parent/student?studentId=${studentId}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json();

        if (controller.signal.aborted) return;
        if (!response.ok) throw new Error(data.error);
        setStudent(data.student);
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error && reason.message
              ? reason.message
              : "ไม่สามารถโหลดข้อมูลนักเรียนได้",
          );
      });

    return () => controller.abort();
  }, [studentId]);

  if (error) {
    return (
      <div className="py-4">
        <div className="rounded-2xl bg-red-50 p-6 text-center text-sm text-red-600">
          {error}
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="py-10 text-center text-sm text-gray-400">
        กำลังโหลดข้อมูล...
      </div>
    );
  }

  const classroom = student.classroom_students[0]?.classroom;

  return (
    <div className="flex flex-col gap-4 py-4">
      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-[#3d6357]">
          <UserRound className="text-[#5d7c6f]" size={18} />
          ข้อมูลทั่วไป
        </h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <Info label="รหัสนักเรียน" value={String(student.students_id)} />
          <Info label="ชื่อเล่น" value={student.nickname || "-"} />
          <Info label="วันเกิด" value={formatBirthday(student.birthday)} />
          <Info
            label="ชั้น"
            value={
              classroom ? (gradeLabel[classroom.grade] ?? classroom.grade) : "-"
            }
          />
          <Info label="ห้อง" value={classroom?.classroom_types.name ?? "-"} />
        </div>
      </section>
      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-[#3d6357]">
          <ShieldCheck className="text-[#5d7c6f]" size={18} />
          ข้อมูลสุขภาพและการติดต่อ
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Info label="แพ้อาหาร" value={student.food_allergy || "ไม่มีข้อมูล"} />
          <Info
            label="โรคประจำตัว"
            value={student.chronic_disease || "ไม่มีข้อมูล"}
          />
          <Info label="เบอร์นักเรียน" value={student.tel || "-"} />
          <Info label="อีเมลนักเรียน" value={student.email || "-"} />
          <Info label="หมายเหตุสำคัญ" value={student.remark || "ไม่มีข้อมูล"} />
        </div>
        <p className="mt-4 text-xs text-gray-400">
          ข้อมูลนี้เป็นข้อมูลอ่านอย่างเดียว หากต้องการแก้ไขกรุณาติดต่อโรงเรียน
        </p>
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#f5f0e7]/60 p-3">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-gray-700">{value}</p>
    </div>
  );
}
