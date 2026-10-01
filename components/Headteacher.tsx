"use client";
import { Navbar, NavbarBrand, NavbarContent, NavbarItem } from "@heroui/navbar";
import { Avatar } from "@heroui/avatar";
import {
  GraduationCap,
  LogOut,
  Settings,
  Menu,
  UserCircle,
} from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useClerk } from "@clerk/nextjs";

export function HeadteacherNavbar({
  onMenuClick,
}: {
  onMenuClick?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { signOut } = useClerk();

  const [teacher, setTeacher] = useState<{
    firstname: string;
    lastname: string;
    email: string;
    role: string;
    profile_image_url: string | null;
    roles?: string[];
  } | null>(null);

  const [isNavigating, setIsNavigating] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("กำลังโหลดข้อมูล...");
  const [mounted, setMounted] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // เมื่อเปลี่ยนหน้า ให้ปิด overlay โหลด
  useEffect(() => {
    setIsNavigating(false);
  }, [pathname]);

  useEffect(() => {
    if (!isProfileMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!profileMenuRef.current?.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsProfileMenuOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isProfileMenuOpen]);

  // ดึงข้อมูลครูจาก session cookie
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setTeacher(data);
      })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    setLoadingMessage("กำลังออกจากระบบ...");
    setIsNavigating(true);
    try {
      // clear cookie ของเรา + signOut จาก Clerk พร้อมกัน
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (e) {
      console.error("Logout API error:", e);
    }
    await signOut({ redirectUrl: "/" });
    window.location.href = "/";
  };

  const displayName = teacher
    ? `${teacher.firstname} ${teacher.lastname}`
    : "...";
  const displayEmail = teacher?.email ?? "";
  const initials = teacher
    ? `${teacher.firstname[0]}${teacher.lastname[0]}`
    : "?";

  return (
    <>
      <Navbar
        className="relative z-30 overflow-visible border-b border-gray-200 bg-white"
        height="64px"
        maxWidth="full"
      >
        {/* LEFT */}
        <NavbarBrand className="gap-3">
          {onMenuClick && (
            <button
              className="md:hidden p-1 -ml-1 text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
              onClick={onMenuClick}
            >
              <Menu size={24} />
            </button>
          )}
          <button
            aria-label="กลับไปหน้าแรก"
            className="flex items-center gap-3 rounded-lg text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5d7c6f] focus-visible:ring-offset-2"
            type="button"
            onClick={() =>
              router.push(
                pathname.startsWith("/admin")
                  ? "/admin_add_user"
                  : "/headteacher/dashboard",
              )
            }
          >
            <div className="w-10 h-10 rounded-full bg-[#5d7c6f] flex items-center justify-center text-white">
              <GraduationCap size={20} />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="font-semibold text-sm">KKS Camp</span>
              <span className="text-xs text-gray-500">ระบบจัดการค่าย</span>
            </div>
          </button>
        </NavbarBrand>

        {/* RIGHT */}
        <NavbarContent className="gap-3" justify="end">
          <NavbarItem className="relative">
            <div ref={profileMenuRef} className="relative">
              <button
                aria-expanded={isProfileMenuOpen}
                aria-haspopup="menu"
                aria-label="เปิดเมนูโปรไฟล์"
                className="flex h-auto min-w-0 items-center gap-2 rounded-full bg-transparent p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5d7c6f] focus-visible:ring-offset-2"
                id="headteacher-profile-menu-trigger"
                type="button"
                onClick={() => setIsProfileMenuOpen((open) => !open)}
              >
                {mounted &&
                  (teacher?.roles ?? (teacher?.role ? [teacher.role] : [])).map(
                    (r) => (
                      <span
                        key={r}
                        className={`hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                          r === "ADMIN"
                            ? "bg-[#f7f2fa] text-[#8e6ba8] border-[#e9dff2]"
                            : "bg-[#eff2f0] text-[#5d7c6f] border-[#dbe6e1]"
                        }`}
                      >
                        {r === "ADMIN"
                          ? "ผู้ดูแลระบบ"
                          : r === "HEADTEACHER"
                            ? "ครูหัวหน้าค่าย"
                            : r === "TEACHER"
                              ? "ครูประจำชั้น"
                              : r}
                      </span>
                    ),
                  )}
                <Avatar
                  className="bg-[#5d7c6f] text-white transition-transform"
                  name={initials}
                  size="sm"
                  src={teacher?.profile_image_url || undefined}
                />
              </button>

              {isProfileMenuOpen && (
                <div
                  aria-label="Profile Actions"
                  className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-72 overflow-hidden rounded-xl border border-gray-200 bg-white p-1 shadow-xl"
                  role="menu"
                >
                  <div className="border-b border-gray-100 px-3 py-3">
                    <p className="font-semibold">{displayName}</p>
                    <p className="truncate text-xs text-gray-500">
                      {displayEmail}
                    </p>
                  </div>

                  {/* ── โปรไฟล์ของฉัน ── */}
                  <button
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                    role="menuitem"
                    type="button"
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      setLoadingMessage("กำลังโหลดข้อมูล...");
                      setIsNavigating(true);
                      const isAdmin =
                        teacher?.roles?.includes("ADMIN") ||
                        teacher?.role === "ADMIN";

                      router.push(
                        isAdmin
                          ? "/admin_add_user/profile"
                          : "/headteacher/profile",
                      );
                    }}
                  >
                    <UserCircle size={16} />
                    โปรไฟล์ของฉัน
                  </button>

                  {teacher?.roles?.includes("ADMIN") ||
                  teacher?.role === "ADMIN" ? (
                    <>
                      {!pathname.startsWith("/admin_add_user") ? (
                        <button
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                          role="menuitem"
                          type="button"
                          onClick={() => {
                            setIsProfileMenuOpen(false);
                            setLoadingMessage("กำลังโหลดข้อมูล...");
                            setIsNavigating(true);
                            router.push("/admin_add_user");
                          }}
                        >
                          <Settings size={16} />
                          หน้าหลักผู้ดูแลระบบ
                        </button>
                      ) : null}
                      {!pathname.startsWith("/headteacher") ? (
                        <button
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                          role="menuitem"
                          type="button"
                          onClick={() => {
                            setIsProfileMenuOpen(false);
                            setLoadingMessage("กำลังโหลดข้อมูล...");
                            setIsNavigating(true);
                            router.push("/headteacher/dashboard");
                          }}
                        >
                          <GraduationCap size={16} />
                          เข้าสู่โหมดครู
                        </button>
                      ) : null}
                    </>
                  ) : !pathname.startsWith("/headteacher") ? (
                    <button
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                      role="menuitem"
                      type="button"
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        setLoadingMessage("กำลังโหลดข้อมูล...");
                        setIsNavigating(true);
                        router.push("/headteacher/dashboard");
                      }}
                    >
                      <Settings size={16} />
                      หน้าหลัก
                    </button>
                  ) : null}

                  <button
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                    role="menuitem"
                    type="button"
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      void handleLogout();
                    }}
                  >
                    <LogOut size={16} />
                    ออกจากระบบ
                  </button>
                </div>
              )}
            </div>
          </NavbarItem>
        </NavbarContent>
      </Navbar>

      {/* Loading Overlay for Navigation */}
      {isNavigating && (
        <div className="fixed inset-0 z-[9999] bg-white/50 backdrop-blur-sm flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
            <div className="w-10 h-10 border-4 border-[#5d7c6f] border-t-transparent rounded-full animate-spin" />
            <p className="text-[#5d7c6f] font-medium text-sm">
              {loadingMessage}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
