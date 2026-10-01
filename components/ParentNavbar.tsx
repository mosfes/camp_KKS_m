"use client";

import { Navbar, NavbarBrand, NavbarContent, NavbarItem } from "@heroui/navbar";
import { Avatar } from "@heroui/avatar";
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from "@heroui/dropdown";
import { GraduationCap, LogOut, Menu, Settings } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import LoadingSpinner from "@/components/LoadingSpinner";

interface ParentStudent {
  students_id: number;
  prefix_name: string | null;
  firstname: string;
  lastname: string;
}

interface ParentProfile {
  firstname: string;
  lastname: string;
}

export function ParentNavbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const [student, setStudent] = useState<ParentStudent | null>(null);
  const [parent, setParent] = useState<ParentProfile | null>(null);
  const [mounted, setMounted] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("กำลังโหลดข้อมูล...");
  const navigationInFlightRef = useRef(false);
  const logoutInFlightRef = useRef(false);
  const navigationUnlockTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    navigationInFlightRef.current = false;
    if (navigationUnlockTimerRef.current !== null) {
      window.clearTimeout(navigationUnlockTimerRef.current);
      navigationUnlockTimerRef.current = null;
    }
    setIsNavigating(false);
  }, [pathname]);

  useEffect(
    () => () => {
      if (navigationUnlockTimerRef.current !== null) {
        window.clearTimeout(navigationUnlockTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    fetch("/api/auth/parent/me")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data?.student) setStudent(data.student);
        if (data?.parentProfile) setParent(data.parentProfile);
      })
      .catch(() => {});
  }, []);

  const navigate = (url: string, message = "กำลังโหลดข้อมูล...") => {
    if (pathname === url || navigationInFlightRef.current) return;
    navigationInFlightRef.current = true;
    setLoadingMessage(message);
    setIsNavigating(true);
    router.push(url);
    navigationUnlockTimerRef.current = window.setTimeout(() => {
      navigationInFlightRef.current = false;
      setIsNavigating(false);
    }, 5000);
  };

  const handleLogout = async () => {
    if (logoutInFlightRef.current) return;
    logoutInFlightRef.current = true;
    setLoadingMessage("กำลังออกจากระบบ...");
    setIsNavigating(true);
    try {
      await fetch("/api/auth/parent/logout", { method: "POST" });
    } catch {
      // Redirect even if the network request is interrupted.
    }
    window.location.href = "/login";
  };

  const parentName =
    parent && parent.firstname !== "รอระบุ"
      ? `${parent.firstname} ${parent.lastname}`
      : "ผู้ปกครอง";
  const initials =
    parent && parent.firstname !== "รอระบุ"
      ? `${parent.firstname[0]}${parent.lastname[0]}`
      : "ผป";
  const childName = student
    ? `${student.prefix_name ?? ""}${student.firstname} ${student.lastname}`
    : "บุตรหลาน";

  return (
    <>
      <Navbar
        className="border-b border-gray-200 bg-white"
        classNames={{
          wrapper: "mx-auto max-w-6xl px-4 sm:px-6 lg:px-8",
        }}
        height="64px"
        maxWidth="full"
      >
        <NavbarBrand className="gap-3">
          {onMenuClick && (
            <button
              aria-label="เปิดเมนู"
              className="-ml-1 rounded-md p-1 text-gray-600 transition-colors hover:bg-gray-100 md:hidden"
              type="button"
              onClick={onMenuClick}
            >
              <Menu size={24} />
            </button>
          )}
          <button
            aria-label="กลับหน้าหลักผู้ปกครอง"
            className="flex cursor-pointer items-center gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5d7c6f] focus-visible:ring-offset-2"
            type="button"
            onClick={() => navigate("/parent/dashboard")}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#5d7c6f] text-white">
              <GraduationCap size={20} />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold text-black">KKS Camp</span>
              <span className="text-xs text-gray-500">ค่ายของบุตร</span>
            </div>
          </button>
        </NavbarBrand>

        <NavbarContent className="gap-3" justify="end">
          <NavbarItem>
            {mounted ? (
              <Dropdown placement="bottom-end">
                <DropdownTrigger>
                  <div className="flex cursor-pointer items-center gap-2">
                    {parent && (
                      <div className="hidden items-center gap-2 sm:flex">
                        <span className="max-w-48 truncate text-sm font-medium text-gray-700">
                          คุณ{parentName}
                        </span>
                        <span className="inline-flex items-center rounded-full border border-[#b8d0c8] bg-[#e8f0ee] px-2.5 py-0.5 text-xs font-medium text-[#3d6357]">
                          ผู้ปกครอง
                        </span>
                      </div>
                    )}
                    <Avatar
                      aria-label={`เปิดเมนูผู้ปกครอง ${parentName}`}
                      as="button"
                      className="bg-[#5d7c6f] text-white transition-transform"
                      name={initials}
                      size="sm"
                    />
                  </div>
                </DropdownTrigger>

                <DropdownMenu aria-label="Profile Actions" variant="flat">
                  <DropdownItem key="profile-summary" className="h-14 gap-2">
                    <div>
                      <p className="font-semibold">{parentName}</p>
                      <p className="max-w-64 truncate text-xs text-gray-500">
                        ดูแล: {childName}
                      </p>
                    </div>
                  </DropdownItem>
                  <DropdownItem
                    key="profile"
                    startContent={<Settings size={16} />}
                    onClick={() => navigate("/parent/profile")}
                  >
                    ตั้งค่าโปรไฟล์
                  </DropdownItem>
                  <DropdownItem
                    key="student"
                    startContent={<GraduationCap size={16} />}
                    onClick={() => navigate("/parent/student")}
                  >
                    ข้อมูลบุตร
                  </DropdownItem>
                  <DropdownItem
                    key="logout"
                    color="danger"
                    startContent={<LogOut size={16} />}
                    onClick={() => void handleLogout()}
                  >
                    ออกจากระบบ
                  </DropdownItem>
                </DropdownMenu>
              </Dropdown>
            ) : (
              <Avatar className="bg-gray-200" size="sm" />
            )}
          </NavbarItem>
        </NavbarContent>
      </Navbar>

      {isNavigating &&
        mounted &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white/50 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-gray-100 bg-white p-6 shadow-lg">
              <LoadingSpinner />
              <p className="text-sm font-medium text-[#5d7c6f]">
                {loadingMessage}
              </p>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
