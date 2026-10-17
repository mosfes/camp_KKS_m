"use client";

import { Navbar, NavbarBrand, NavbarContent, NavbarItem } from "@heroui/navbar";
import { Avatar } from "@heroui/avatar";
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownSection,
  DropdownTrigger,
} from "@heroui/dropdown";
import {
  Check,
  GraduationCap,
  LogOut,
  Menu,
  UserCircle,
  UsersRound,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import LoadingSpinner from "@/components/LoadingSpinner";

interface ParentStudent {
  students_id: number;
  public_id: string;
  prefix_name: string | null;
  firstname: string;
  lastname: string;
  profile_image_url?: string | null;
}

interface ParentProfile {
  firstname: string;
  lastname: string;
  email?: string | null;
}

export function ParentNavbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const childId = pathname.match(/^\/parent\/children\/([^/]+)(?:\/|$)/)?.[1];
  const [students, setStudents] = useState<ParentStudent[]>([]);
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
    const refreshFamily = () => {
      void Promise.all([
        fetch("/api/parent/profile", { cache: "no-store" }),
        fetch("/api/parent/students", { cache: "no-store" }),
      ])
        .then(async ([parentResponse, studentsResponse]) => {
          if (parentResponse.ok) {
            const data = await parentResponse.json();
            setParent(data.parent ?? null);
          }
          if (studentsResponse.ok) {
            const data = await studentsResponse.json();
            setStudents(data.students ?? []);
          }
        })
        .catch(() => {});
    };
    refreshFamily();
    window.addEventListener("parent-students-updated", refreshFamily);
    return () =>
      window.removeEventListener("parent-students-updated", refreshFamily);
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
  const displayParentName =
    parentName === "ผู้ปกครอง" ? parentName : `คุณ${parentName}`;
  const initials =
    parent && parent.firstname !== "รอระบุ"
      ? `${parent.firstname[0]}${parent.lastname[0]}`
      : "ผป";
  const activeStudent = students.find((item) => item.public_id === childId || String(item.students_id) === childId);

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
            onClick={() => navigate("/parent/family")}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#5d7c6f] text-white">
              <GraduationCap size={20} />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold text-black">KKS Camp</span>
              <span className="text-xs text-gray-500">ข้อมูลบุตรหลาน</span>
            </div>
          </button>
        </NavbarBrand>

        <NavbarContent className="gap-3" justify="end">
          <NavbarItem>
            {mounted ? (
              <Dropdown placement="bottom-end">
                <DropdownTrigger>
                  <button
                    aria-label="เปิดเมนูโปรไฟล์ผู้ปกครอง"
                    className="flex items-center gap-2 rounded-xl p-1 transition hover:bg-[#edf3ef] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5d7c6f] focus-visible:ring-offset-2"
                    type="button"
                  >
                    {parent && (
                      <span className="hidden max-w-40 truncate text-sm font-medium text-gray-700 sm:inline">
                        {displayParentName}
                      </span>
                    )}
                    <span className="hidden items-center rounded-full border border-[#b8d0c8] bg-[#e8f0ee] px-2.5 py-0.5 text-xs font-medium text-[#3d6357] sm:inline-flex">
                      ผู้ปกครอง
                    </span>
                    <Avatar
                      className="bg-[#5d7c6f] text-white transition-transform"
                      name={initials}
                      size="sm"
                    />
                  </button>
                </DropdownTrigger>

                <DropdownMenu aria-label="เมนูผู้ปกครอง" variant="flat">
                  <DropdownItem
                    key="profile-summary"
                    className="h-14 gap-2 border-b border-gray-100"
                    isReadOnly
                  >
                    <div>
                      <p className="font-semibold">{displayParentName}</p>
                      <p className="max-w-64 truncate text-xs text-gray-500">
                        {parent?.email ||
                          `ผู้ปกครอง · ${students.length} คนในบัญชี`}
                      </p>
                    </div>
                  </DropdownItem>
                  <DropdownItem
                    key="profile"
                    startContent={<UserCircle size={16} />}
                    onPress={() => navigate("/parent/profile")}
                  >
                    โปรไฟล์ของฉัน
                  </DropdownItem>
                  <DropdownItem
                    key="family"
                    startContent={<UsersRound size={16} />}
                    onPress={() => navigate("/parent/family")}
                  >
                    ลูกทั้งหมด
                  </DropdownItem>
                  <DropdownSection showDivider title="เลือกดูข้อมูลบุตร">
                    {students.length === 0
                      ? [
                          <DropdownItem key="student-loading" isDisabled>
                            กำลังโหลดรายชื่อ...
                          </DropdownItem>,
                        ]
                      : students.map((linkedStudent) => {
                          const isCurrent =
                            linkedStudent.public_id === childId || String(linkedStudent.students_id) === childId;
                          return (
                            <DropdownItem
                              key={`student-${linkedStudent.students_id}`}
                              className={
                                isCurrent ? "bg-[#edf3ef] text-[#365f4f]" : ""
                              }
                              endContent={
                                isCurrent ? <Check size={16} /> : undefined
                              }
                              startContent={
                                linkedStudent.profile_image_url ? (
                                  <img
                                    alt=""
                                    className="h-7 w-7 rounded-full object-cover"
                                    src={linkedStudent.profile_image_url}
                                  />
                                ) : (
                                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#e8f0ee] text-[#5d7c6f]">
                                    <GraduationCap size={15} />
                                  </span>
                                )
                              }
                              onPress={() =>
                                navigate(
                                  `/parent/children/${linkedStudent.public_id}`,
                                )
                              }
                            >
                              <span className="max-w-56 truncate">
                                {linkedStudent.prefix_name ?? ""}
                                {linkedStudent.firstname}{" "}
                                {linkedStudent.lastname}
                              </span>
                            </DropdownItem>
                          );
                        })}
                  </DropdownSection>
                  <DropdownItem
                    key="student"
                    isDisabled={!activeStudent}
                    startContent={<GraduationCap size={16} />}
                    onPress={() =>
                      navigate(activeStudent ? `/parent/children/${activeStudent.public_id}/profile` : "/parent/family")
                    }
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
