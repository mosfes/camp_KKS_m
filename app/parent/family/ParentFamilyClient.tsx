"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  ParentStudentPicker,
  type LinkedStudent,
  type ParentLinkRequest,
} from "../dashboard/ParentStudentPicker";

import { ParentNavbar } from "@/components/ParentNavbar";

export default function ParentFamilyClient({
  initialStudents,
  initialRequests,
}: {
  initialStudents: LinkedStudent[];
  initialRequests: ParentLinkRequest[];
}) {
  const router = useRouter();
  const [students, setStudents] = useState<LinkedStudent[]>(initialStudents);
  const [requests, setRequests] = useState<ParentLinkRequest[]>(initialRequests);

  const refreshStudents = useCallback(async () => {
    const response = await fetch("/api/parent/students", { cache: "no-store" });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "ไม่สามารถโหลดรายชื่อบุตรหลานได้");
    }
    setStudents(data.students);
    setRequests(data.requests ?? []);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible")
        void refreshStudents().catch(() => {});
    }, 60_000);
    const onVisible = () => {
      if (document.visibilityState === "visible")
        void refreshStudents().catch(() => {});
    };

    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refreshStudents]);

  return (
    <div className="min-h-screen bg-[#f5f5f2]">
      <ParentNavbar />
      <ParentStudentPicker
        requests={requests}
        students={students}
        onRefresh={refreshStudents}
        onSelect={async (studentId) => {
          router.push(`/parent/children/${studentId}`);
        }}
      />
    </div>
  );
}
