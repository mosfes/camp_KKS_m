"use client";
import { GraduationCap, LogOut, Settings } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createPortal } from "react-dom";

import LoadingSpinner from "@/components/LoadingSpinner";
import { StudentDeferredEnhancements } from "@/components/student/StudentDeferredEnhancements";
import { disconnectCurrentStudentPushSubscription } from "@/lib/client-web-push";

export type StudentNavbarStudent = {
  students_id: number;
  firstname: string;
  lastname: string;
  nickname: string | null;
  email: string;
  profile_image_url: string | null;
};

export function AppNavbar({
  initialStudent,
}: {
  initialStudent: StudentNavbarStudent | null;
}) {
  const router = useRouter();
  const [navigating, setNavigating] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const student = initialStudent;

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await disconnectCurrentStudentPushSubscription();
      await fetch("/api/auth/student/logout", { method: "POST" });
    } catch {}
    window.location.href = "/";
  };

  const displayName = student
    ? `${student.firstname} ${student.lastname}`
    : "...";
  const displayNickname = student?.nickname ?? null;
  const displayEmail = student?.email ?? "";
  const initials = student
    ? `${student.firstname[0]}${student.lastname[0]}`
    : "?";

  return (
    <>
      <nav className="h-16 border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#5d7c6f] text-white">
              <GraduationCap size={20} />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold text-black">KKS Camp</span>
              <span className="text-xs text-gray-500">ค่ายของฉัน</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <StudentDeferredEnhancements
              studentId={student?.students_id ?? null}
            />

            <details className="group relative">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl p-1 outline-none focus-visible:ring-2 focus-visible:ring-[#5d7c6f] [&::-webkit-details-marker]:hidden">
                {student && (
                  <div className="hidden items-center gap-2 sm:flex">
                    {displayNickname && (
                      <span className="text-sm font-medium text-gray-700">
                        น้อง{displayNickname}
                      </span>
                    )}
                    <span className="inline-flex items-center rounded-full border border-[#b8d0c8] bg-[#e8f0ee] px-2.5 py-0.5 text-xs font-medium text-[#3d6357]">
                      นักเรียน
                    </span>
                  </div>
                )}

                {student?.profile_image_url ? (
                  <Image
                    alt="โปรไฟล์"
                    className="h-8 w-8 rounded-full border-2 border-[#5d7c6f]/30 object-cover"
                    height={32}
                    src={student.profile_image_url}
                    width={32}
                  />
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#5d7c6f] text-xs font-medium text-white">
                    {initials}
                  </span>
                )}
              </summary>

              <div className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-gray-200 bg-white p-2 shadow-xl">
                <div className="border-b border-gray-100 px-3 py-2.5">
                  <p className="font-semibold text-gray-800">
                    {displayNickname ? `น้อง${displayNickname}` : displayName}
                  </p>
                  <p className="truncate text-xs text-gray-500">
                    {displayEmail}
                  </p>
                </div>
                <button
                  className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-60"
                  disabled={navigating}
                  type="button"
                  onClick={() => {
                    if (navigating) return;
                    setNavigating(true);
                    router.push("/student/profile");
                  }}
                >
                  {navigating ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
                  ) : (
                    <Settings size={16} />
                  )}
                  ตั้งค่าโปรไฟล์
                </button>
                <button
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-red-600 hover:bg-red-50"
                  type="button"
                  onClick={() => void handleLogout()}
                >
                  <LogOut size={16} />
                  ออกจากระบบ
                </button>
              </div>
            </details>
          </div>
        </div>
      </nav>
      {isLoggingOut &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white/50 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-gray-100 bg-white p-6 shadow-lg">
              <LoadingSpinner />
              <p className="text-[#5d7c6f] font-medium text-sm">
                กำลังออกจากระบบ...
              </p>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
