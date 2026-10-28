"use client";

import { useState, Suspense } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { HeadteacherNavbar } from "@/components/Headteacher";
import { StatusModalProvider } from "@/components/StatusModalProvider";
import {
  Users,
  BookOpen,
  GraduationCap,
  Tent,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  PieChart,
  X,
  Files,
  BusFront,
  UserRoundCheck,
  MailCheck,
} from "lucide-react";

const menuItems = [
  { id: "overview", label: "ภาพรวม", icon: PieChart },
  { id: "teacher", label: "ครู", icon: Users },
  { id: "documentdata", label: "จัดการข้อมูลเอกสาร", icon: Files },
  { id: "classroom", label: "ห้องเรียน", icon: BookOpen },
  { id: "student", label: "นักเรียน", icon: GraduationCap },
  { id: "parentaccess", label: "สิทธิ์ผู้ปกครอง", icon: UserRoundCheck },
  { id: "camp", label: "ค่าย", icon: Tent },
  { id: "buslayout", label: "ผังรถ", icon: BusFront },
  { id: "campemail", label: "อีเมลแจ้งเตือนค่าย", icon: MailCheck },
  { id: "vulgarwords", label: "คลังคำหยาบ", icon: ShieldAlert },
];

function getActiveTab(pathname, searchParams) {
  if (pathname.startsWith("/admin_add_user/bus-layout")) return "buslayout";
  if (pathname.startsWith("/admin_graduated_students")) return "student";
  return searchParams.get("tab") || "overview";
}

/* ── Sidebar (Desktop only) ─────────────────────────────────── */
function AdminSidebar({ collapsed, setCollapsed }) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const activeTab = getActiveTab(pathname, searchParams);

  return (
    <aside
      className={`
                hidden md:flex flex-col bg-white border-r border-gray-200
                transition-all duration-300 ease-in-out shrink-0
                sticky top-[64px] h-[calc(100vh-64px)]
                ${collapsed ? "w-16" : "w-56"}
            `}
    >
      {/* Header */}
      <div
        className={`flex items-center px-3 py-4 border-b border-gray-100 ${
          collapsed ? "justify-center" : "justify-between"
        }`}
      >
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#5d7c6f] flex items-center justify-center">
              <LayoutDashboard size={14} className="text-white" />
            </div>
            <span className="text-sm font-semibold text-gray-700">
              เมนูผู้ดูแลระบบ
            </span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors shrink-0"
          aria-label="Toggle sidebar"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1 p-2 flex-1">
        {menuItems.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => router.push(`/admin_add_user?tab=${id}`)}
              title={collapsed ? label : undefined}
              className={`
                                flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                                transition-all duration-150 w-full
                                ${collapsed ? "justify-center" : "text-left"}
                                ${
                                  isActive
                                    ? "bg-[#5d7c6f] text-white shadow-sm"
                                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                                }
                            `}
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </button>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="px-4 py-3 border-t border-gray-100">
          <p className="text-xs text-gray-400 text-center">ผู้ดูแลระบบ</p>
        </div>
      )}
    </aside>
  );
}

/* ── Mobile Sidebar Drawer ───────────────────────────────── */
function MobileSidebar({ isOpen, setIsOpen }) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const activeTab = getActiveTab(pathname, searchParams);

  return (
    <div
      className={`md:hidden fixed inset-0 z-[9999] transition-all duration-300 ease-in-out ${
        isOpen ? "visible" : "invisible delay-300"
      }`}
    >
      {/* Overlay */}
      <div
        className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ease-in-out ${
          isOpen ? "opacity-100" : "opacity-0"
        }`}
        onClick={() => setIsOpen(false)}
      />

      {/* Drawer */}
      <aside
        className={`absolute top-0 left-0 w-64 max-w-[80%] bg-white h-full flex flex-col shadow-xl transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#5d7c6f] flex items-center justify-center">
              <LayoutDashboard size={16} className="text-white" />
            </div>
            <span className="text-sm font-semibold text-gray-700">
              เมนูผู้ดูแลระบบ
            </span>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex flex-col gap-1 p-3 flex-1 overflow-y-auto">
          {menuItems.map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => {
                  router.push(`/admin_add_user?tab=${id}`);
                  setIsOpen(false);
                }}
                className={`
                                    flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium
                                    transition-all duration-150 w-full text-left
                                    ${
                                      isActive
                                        ? "bg-[#5d7c6f] text-white shadow-sm"
                                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                                    }
                                `}
              >
                <Icon size={20} className="shrink-0" />
                <span className="truncate">{label}</span>
              </button>
            );
          })}
        </nav>
      </aside>
    </div>
  );
}

/* ── Root Layout ────────────────────────────────────────────── */
export default function AdminLayout({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <StatusModalProvider>
      <div className="min-h-screen bg-[#f5f5f2] flex flex-col">
        <div className="sticky top-0 z-30 w-full">
          <HeadteacherNavbar onMenuClick={() => setMobileOpen(true)} />
        </div>

        <div className="flex flex-1">
          {/* Desktop Sidebar */}
          <Suspense
            fallback={
              <div className="hidden md:block w-56 bg-white border-r border-gray-200 sticky top-[64px] h-[calc(100vh-64px)]" />
            }
          >
            <AdminSidebar collapsed={collapsed} setCollapsed={setCollapsed} />
          </Suspense>

          {/* Page Content */}
          <main className="flex-1 min-w-0">{children}</main>
        </div>

        {/* Mobile Sidebar */}
        <Suspense fallback={null}>
          <MobileSidebar isOpen={mobileOpen} setIsOpen={setMobileOpen} />
        </Suspense>
      </div>
    </StatusModalProvider>
  );
}
