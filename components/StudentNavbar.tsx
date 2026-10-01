"use client";
import { Navbar, NavbarBrand, NavbarContent, NavbarItem } from "@heroui/navbar";
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@heroui/dropdown";
import { Avatar } from "@heroui/avatar";
import { GraduationCap, LogOut, Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useClerk } from "@clerk/nextjs";

import LoadingSpinner from "@/components/LoadingSpinner";
import { StudentNotificationCenter } from "@/components/student/StudentNotificationCenter";
import { disconnectCurrentStudentPushSubscription } from "@/lib/client-web-push";

export function AppNavbar() {
  const router = useRouter();
  const { signOut } = useClerk();
  const [navigating, setNavigating] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const [student, setStudent] = useState<{
    students_id: number;
    firstname: string;
    lastname: string;
    nickname: string | null;
    email: string;
    profile_image_url: string | null;
  } | null>(null);

  const [mounted, setMounted] = useState(false);

  // ดึงข้อมูลนักเรียนจาก session cookie
  useEffect(() => {
    setMounted(true);
    fetch("/api/auth/student/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setStudent(data);
      })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await disconnectCurrentStudentPushSubscription();
      await fetch("/api/auth/student/logout", { method: "POST" });
    } catch (e) {
      console.error("Student logout API error:", e);
    }
    await signOut({ redirectUrl: "/" });
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
      <Navbar
        className="bg-white border-b border-gray-200"
        classNames={{
          wrapper: "max-w-6xl mx-auto px-4 sm:px-6 lg:px-8",
        }}
        height="64px"
        maxWidth="full"
      >
        {/* LEFT */}
        <NavbarBrand className="gap-3">
          <div className="w-10 h-10 rounded-full bg-[#5d7c6f] flex items-center justify-center text-white">
            <GraduationCap size={20} />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-semibold text-sm text-black">KKS Camp</span>
            <span className="text-xs text-gray-500">ค่ายของฉัน</span>
          </div>
        </NavbarBrand>

        {/* RIGHT */}
        <NavbarContent className="gap-3" justify="end">
          <NavbarItem>
            <StudentNotificationCenter
              studentId={student?.students_id ?? null}
            />
          </NavbarItem>
          <NavbarItem>
            {mounted ? (
              <Dropdown placement="bottom-end">
                <DropdownTrigger>
                  <div
                    suppressHydrationWarning
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    {/* แสดงชื่อเล่น + badge นักเรียน */}
                    {student && (
                      <div className="hidden sm:flex items-center gap-2">
                        {displayNickname && (
                          <span className="text-sm font-medium text-gray-700">
                            น้อง{displayNickname}
                          </span>
                        )}
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#e8f0ee] text-[#3d6357] border border-[#b8d0c8]">
                          นักเรียน
                        </span>
                      </div>
                    )}

                    {/* Avatar — แสดงรูปถ้ามี url */}
                    {student?.profile_image_url ? (
                      <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-[#5d7c6f]/30 flex-shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          alt="โปรไฟล์"
                          className="w-full h-full object-cover"
                          src={student.profile_image_url}
                        />
                      </div>
                    ) : (
                      <Avatar
                        as="button"
                        className="bg-[#5d7c6f] text-white transition-transform"
                        name={initials}
                        size="sm"
                      />
                    )}
                  </div>
                </DropdownTrigger>

                <DropdownMenu aria-label="Profile Actions" variant="flat">
                  <DropdownItem key="profile" className="h-14 gap-2">
                    <div>
                      <p className="font-semibold">
                        {displayNickname
                          ? `น้อง${displayNickname}`
                          : displayName}
                      </p>
                      <p className="text-xs text-gray-500">{displayEmail}</p>
                    </div>
                  </DropdownItem>

                  <DropdownItem
                    key="settings"
                    startContent={
                      navigating ? (
                        <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Settings size={16} />
                      )
                    }
                    onClick={() => {
                      if (navigating) return;
                      setNavigating(true);
                      router.push("/student/profile");
                    }}
                  >
                    ตั้งค่าโปรไฟล์
                  </DropdownItem>

                  <DropdownItem
                    key="logout"
                    color="danger"
                    startContent={<LogOut size={16} />}
                    onClick={handleLogout}
                  >
                    ออกจากระบบ
                  </DropdownItem>
                </DropdownMenu>
              </Dropdown>
            ) : (
              <div className="flex items-center gap-2">
                <Avatar className="bg-gray-200" size="sm" />
              </div>
            )}
          </NavbarItem>
        </NavbarContent>
      </Navbar>
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
