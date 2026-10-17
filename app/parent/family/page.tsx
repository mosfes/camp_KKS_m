"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { ParentNavbar } from "@/components/ParentNavbar";
import {
  ParentStudentPicker,
  type LinkedStudent,
} from "../dashboard/ParentStudentPicker";

export default function ParentFamilyDashboard() {
  const router = useRouter();
  const [students, setStudents] = useState<LinkedStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refreshStudents = useCallback(async () => {
    const response = await fetch("/api/parent/students", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "ไม่สามารถโหลดรายชื่อบุตรหลานได้");
    }
    setStudents(data.students);
  }, []);

  useEffect(() => {
    void refreshStudents()
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : "เกิดข้อผิดพลาด"),
      )
      .finally(() => setLoading(false));
  }, [refreshStudents]);

  return (
    <div className="min-h-screen bg-[#f5f5f2]">
      <ParentNavbar />
      {loading ? (
        <main
          aria-live="polite"
          className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8"
        >
          <div className="h-44 animate-pulse rounded-[2rem] bg-[#dce9de]" />
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1].map((item) => (
              <div
                key={item}
                className="h-64 animate-pulse rounded-3xl bg-white"
              />
            ))}
          </div>
        </main>
      ) : error ? (
        <main className="mx-auto max-w-6xl px-4 py-10 text-center text-sm text-red-600 sm:px-6 lg:px-8">
          {error}
        </main>
      ) : (
        <ParentStudentPicker
          students={students}
          onSelect={async (studentId) => {
            router.push(`/parent/children/${studentId}`);
          }}
          onLinked={refreshStudents}
        />
      )}
    </div>
  );
}
