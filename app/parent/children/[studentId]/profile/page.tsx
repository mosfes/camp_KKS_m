"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import {
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Phone,
  Mail,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import { ParentNavbar } from "@/components/ParentNavbar";

type Teacher = {
  prefix_name: string | null;
  firstname: string;
  lastname: string;
  tel: string;
  email: string;
};
type Student = {
  students_id: number;
  prefix_name: string | null;
  firstname: string;
  lastname: string;
  nickname: string | null;
  profile_image_url: string | null;
  birthday: string | null;
  food_allergy: string | null;
  chronic_disease: string | null;
  remark: string | null;
  tel: string | null;
  email: string;
  classroom_students: {
    classroom: {
      grade: string;
      academic_years_years_id: number;
      classroom_types: { name: string };
      teacher: Teacher | null;
      classroom_teacher: { teacher: Teacher }[];
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

function displayTeacher(teacher: Teacher) {
  return `${teacher.prefix_name ?? ""}${teacher.firstname} ${teacher.lastname}`;
}
function formatBirthday(value: string | null) {
  return value
    ? new Date(value).toLocaleDateString("th-TH", {
        dateStyle: "long",
        timeZone: "Asia/Bangkok",
      })
    : "-";
}

export default function ParentStudentPage() {
  const router = useRouter();
  const params = useParams();
  const studentId = Number(params.studentId);
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setStudent(null);
    setError("");
    fetch(`/api/parent/student?studentId=${studentId}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (controller.signal.aborted) return;
        if (!response.ok) throw new Error(data.error);
        if (data.student?.students_id !== studentId)
          throw new Error("ข้อมูลนักเรียนไม่ตรงกับหน้าที่เลือก");
        setStudent(data.student);
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(reason instanceof Error ? reason.message : "เกิดข้อผิดพลาด");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [studentId]);

  const classroom = student?.classroom_students[0]?.classroom;
  const showingStudent = student?.students_id === studentId;
  const teachers = useMemo(() => {
    if (!classroom) return [];
    return [
      classroom.teacher,
      ...classroom.classroom_teacher.map((item) => item.teacher),
    ].filter(Boolean) as Teacher[];
  }, [classroom]);

  return (
    <div className="min-h-screen bg-[#f5f5f2]">
      <ParentNavbar />
      <main className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
        <nav aria-label="เส้นทางหน้า" className="flex flex-wrap items-center gap-2 text-xs text-[#5d7c6f]">
          <button type="button" className="hover:underline" onClick={() => router.push("/parent/family")}>ลูกทั้งหมด</button>
          <ChevronRight size={13} />
          <button type="button" className="font-semibold hover:underline" onClick={() => router.push(`/parent/children/${studentId}`)}>
            {showingStudent && student ? `${student.firstname} ${student.lastname}` : "ข้อมูลบุตร"}
          </button>
          <ChevronRight size={13} />
          <span className="text-gray-500">ข้อมูลนักเรียน</span>
        </nav>
        <div className="flex items-center gap-3">
          <Button
            isIconOnly
            aria-label="กลับหน้าหลัก"
            className="bg-white text-gray-700 shadow-sm"
            radius="lg"
            variant="flat"
            onPress={() => router.push(`/parent/children/${studentId}`)}
          >
            <ChevronLeft size={20} />
          </Button>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#5d7c6f]">
              Student profile
            </p>
            <h1 className="text-2xl font-bold text-gray-800">ข้อมูลนักเรียน</h1>
          </div>
        </div>
        {(loading || (!showingStudent && !error)) && (
          <div className="rounded-3xl bg-white p-10 text-center text-sm text-gray-500 shadow-sm">
            กำลังโหลดข้อมูล...
          </div>
        )}
        {error && (
          <div className="rounded-3xl bg-red-50 p-6 text-center text-sm text-red-600">
            {error}
          </div>
        )}
        {showingStudent && student && (
          <div className="space-y-5">
            <section className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
              <div className="bg-gradient-to-br from-[#4d6c5f] via-[#5d7c6f] to-[#365f4f] p-6 text-white sm:p-8">
                <div className="flex items-center gap-4">
                  {student.profile_image_url ? (
                    <img
                      alt=""
                      className="h-16 w-16 rounded-2xl object-cover"
                      src={student.profile_image_url}
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20">
                      <UserRound size={30} />
                    </div>
                  )}
                  <div>
                    <h2 className="text-xl font-bold">
                      {student.prefix_name ?? ""}
                      {student.firstname} {student.lastname}
                    </h2>
                    <p className="text-sm opacity-85">
                      รหัสนักเรียน {student.students_id}
                      {student.nickname
                        ? ` · ชื่อเล่น ${student.nickname}`
                        : ""}
                    </p>
                  </div>
                </div>
              </div>
              <div className="grid gap-4 p-5 sm:grid-cols-3">
                <Info
                  label="ชั้น"
                  value={
                    classroom
                      ? (gradeLabel[classroom.grade] ?? classroom.grade)
                      : "-"
                  }
                />
                <Info
                  label="ห้อง"
                  value={classroom?.classroom_types.name ?? "-"}
                />
                <Info
                  label="วันเกิด"
                  value={formatBirthday(student.birthday)}
                />
              </div>
            </section>
            <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 font-bold text-gray-800">
                <ShieldCheck className="text-[#5d7c6f]" size={19} />
                ข้อมูลสุขภาพและการติดต่อ
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <Info
                  label="แพ้อาหาร"
                  value={student.food_allergy || "ไม่มีข้อมูล"}
                />
                <Info
                  label="โรคประจำตัว"
                  value={student.chronic_disease || "ไม่มีข้อมูล"}
                />
                <Info label="เบอร์นักเรียน" value={student.tel || "-"} />
                <Info label="อีเมลนักเรียน" value={student.email || "-"} />
                <Info
                  label="หมายเหตุสำคัญ"
                  value={student.remark || "ไม่มีข้อมูล"}
                />
              </div>
              <p className="mt-4 text-xs text-gray-400">
                ข้อมูลนี้เป็นข้อมูลอ่านอย่างเดียว
                หากต้องการแก้ไขกรุณาติดต่อโรงเรียน
              </p>
            </section>
            <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 font-bold text-gray-800">
                <GraduationCap className="text-[#5d7c6f]" size={19} />
                ครูประจำชั้น
              </h2>
              {teachers.length === 0 ? (
                <p className="text-sm text-gray-400">ไม่พบข้อมูลครูประจำชั้น</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {teachers.map((teacher, index) => (
                    <div
                      key={`${teacher.email}-${index}`}
                      className="rounded-2xl bg-[#f5f5f2] p-4"
                    >
                      <p className="font-semibold text-gray-800">
                        {displayTeacher(teacher)}
                      </p>
                      <p className="mb-3 text-xs text-gray-500">ครูประจำชั้น</p>
                      <div className="space-y-2 text-sm">
                        {teacher.tel && (
                          <a
                            className="flex items-center gap-2 text-[#5d7c6f]"
                            href={`tel:${teacher.tel}`}
                          >
                            <Phone size={15} />
                            {teacher.tel}
                          </a>
                        )}
                        {teacher.email && (
                          <a
                            className="flex items-center gap-2 truncate text-[#5d7c6f]"
                            href={`mailto:${teacher.email}`}
                          >
                            <Mail size={15} />
                            {teacher.email}
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[#f5f5f2] p-3">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-gray-700">{value}</p>
    </div>
  );
}
