"use client";

import type { ReactNode } from "react";

import { useState, useEffect, useMemo, Suspense } from "react";
import {
  useParams,
  useSearchParams,
  useRouter,
  usePathname,
} from "next/navigation";
import {
  Award,
  BookOpen,
  Bus,
  ClipboardList,
  ChevronDown,
  Users,
  Tent,
  ChevronLeft,
  ChevronRight,
  FileText,
  LayoutDashboard,
  MapPin,
  Shirt,
  Target,
  TrendingUp,
  UserCheck,
  X,
  type LucideIcon,
} from "lucide-react";

import { HeadteacherNavbar } from "@/components/Headteacher";
import { StatusModalProvider } from "@/components/StatusModalProvider";
import {
  CLEAN_CAMP_PATH,
  getCleanCampPath,
  readActiveCampId,
  rememberActiveCampId,
} from "@/lib/client-active-camp";

const teacherMenuItems = [
  { id: "homeroom", label: "นักเรียนประจำชั้น", icon: Users },
  { id: "camp", label: "ค่ายที่เกี่ยวข้อง", icon: Tent },
];

type SidebarMenuItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  group?: string;
  access?: "owner" | "ownerOrHomeroom";
  disabled?: boolean;
};

const campMenuItems: SidebarMenuItem[] = [
  {
    id: "overview",
    label: "ภาพรวมค่าย",
    icon: LayoutDashboard,
    group: "ภาพรวม",
  },
  {
    id: "students",
    label: "ข้อมูลนักเรียน",
    icon: BookOpen,
    group: "ผู้เข้าร่วม",
  },
  {
    id: "tracking",
    label: "ติดตามนักเรียน",
    icon: Users,
    group: "ผู้เข้าร่วม",
  },
  {
    id: "location",
    label: "ติดตามตำแหน่ง",
    icon: MapPin,
    group: "ผู้เข้าร่วม",
  },
  {
    id: "shirts",
    label: "รายการจองเสื้อ",
    icon: Shirt,
    group: "ผู้เข้าร่วม",
    access: "ownerOrHomeroom",
  },
  {
    id: "attendance",
    label: "เช็คชื่อนักเรียน",
    icon: UserCheck,
    group: "เช็คชื่อ",
  },
  {
    id: "bus",
    label: "เช็คชื่อขึ้นรถ",
    icon: Bus,
    group: "เช็คชื่อ",
    access: "ownerOrHomeroom",
  },
  {
    id: "bases",
    label: "ฐานกิจกรรม",
    icon: Target,
    group: "กิจกรรม",
    access: "owner",
  },
  {
    id: "compare",
    label: "เปรียบเทียบคะแนน",
    icon: TrendingUp,
    group: "กิจกรรม",
    access: "owner",
  },
  {
    id: "documents",
    label: "เอกสารข้อเสนอโครงการ",
    icon: FileText,
    group: "เอกสาร",
    access: "owner",
  },
  {
    id: "summary-documents",
    label: "เอกสารสรุป",
    icon: FileText,
    group: "เอกสาร",
    access: "owner",
  },
  {
    id: "survey",
    label: "แบบสอบถาม",
    icon: ClipboardList,
    group: "แบบสอบถาม",
    access: "owner",
  },
  {
    id: "certificate",
    label: "ตั้งค่าเกียรติบัตร",
    icon: Award,
    group: "ตั้งค่า",
    access: "owner",
  },
];

type CampAccess = {
  isOwner: boolean;
  isHomeroomTeacher: boolean;
  isBusTeacher: boolean;
  hasTransport: boolean;
};

function getCampIdFromPath(pathname: string) {
  return pathname.match(/^\/headteacher\/dashboard\/camp\/(\d+)/)?.[1] ?? null;
}

function useActiveCampId(pathname: string) {
  const params = useParams<{ id?: string | string[] }>();
  const paramValue = Array.isArray(params.id) ? params.id[0] : params.id;
  const paramCampId =
    paramValue && /^\d+$/.test(paramValue) ? paramValue : null;
  const pathCampId = getCampIdFromPath(pathname);
  const [rememberedCampId, setRememberedCampId] = useState<string | null>(null);
  const routeCampId = pathCampId ?? paramCampId;

  useEffect(() => {
    if (routeCampId) {
      rememberActiveCampId(routeCampId);
      setRememberedCampId(routeCampId);

      return;
    }

    if (pathname.startsWith(`${CLEAN_CAMP_PATH}/`)) {
      setRememberedCampId(readActiveCampId());
    } else {
      setRememberedCampId(null);
    }
  }, [pathname, routeCampId]);

  return routeCampId ?? rememberedCampId;
}

function getCampMenuId(pathname: string, requestedMenu: string | null) {
  if (requestedMenu) return requestedMenu;
  if (pathname.includes("/students")) return "students";
  if (pathname.includes("/project-summary-document"))
    return "summary-documents";
  if (pathname.includes("/project-document")) return "documents";
  if (pathname.includes("/location")) return "location";
  if (pathname.includes("/attendance")) return "attendance";
  if (pathname.includes("/tracking")) return "tracking";
  if (pathname.includes("/bus-checkin")) return "bus";
  if (pathname.includes("/shirts")) return "shirts";
  if (pathname.includes("/bases")) return "bases";
  if (pathname.includes("/base/")) return "bases";
  if (pathname.includes("/survey")) return "survey";
  if (pathname.includes("/score-comparison")) return "compare";
  if (pathname.includes("/certificate")) return "certificate";

  return "overview";
}

function filterCampMenuItems(
  items: SidebarMenuItem[],
  access: CampAccess | null,
) {
  if (!access) return items.filter((item) => item.id !== "bus");

  return items.filter((item) => {
    if (item.id === "bus" && !access.hasTransport) return false;
    if (item.id === "bus") {
      return access.isOwner || access.isHomeroomTeacher || access.isBusTeacher;
    }
    if (item.access === "owner") return access.isOwner;
    if (item.access === "ownerOrHomeroom") {
      return access.isOwner || access.isHomeroomTeacher;
    }

    return true;
  });
}

type SidebarMenuSection = {
  group?: string;
  items: SidebarMenuItem[];
};

const campGroupIcons: Record<string, LucideIcon> = {
  ภาพรวม: LayoutDashboard,
  ผู้เข้าร่วม: Users,
  เช็คชื่อ: UserCheck,
  เอกสาร: FileText,
  กิจกรรม: Target,
  แบบสอบถาม: ClipboardList,
  ตั้งค่า: Award,
};

const defaultOpenSidebarGroups = new Set(["เช็คชื่อ"]);

function groupSidebarMenuItems(items: SidebarMenuItem[]) {
  return items.reduce<SidebarMenuSection[]>((sections, item) => {
    const currentSection = sections[sections.length - 1];

    if (currentSection && currentSection.group === item.group) {
      currentSection.items.push(item);
    } else {
      sections.push({ group: item.group, items: [item] });
    }

    return sections;
  }, []);
}

function SidebarNav({
  menuItems,
  collapsed,
  isCampContext,
  activeMenu,
  activeTab,
  onNavigate,
  mobile = false,
}: {
  menuItems: SidebarMenuItem[];
  collapsed: boolean;
  isCampContext: boolean;
  activeMenu: string;
  activeTab: string;
  onNavigate: (id: string) => void;
  mobile?: boolean;
}) {
  const activeKey = isCampContext ? activeMenu : activeTab;
  const menuSignature = menuItems.map(({ id }) => id).join("|");
  const sections = useMemo(
    () => groupSidebarMenuItems(menuItems),
    [menuSignature, menuItems],
  );
  const activeGroup = sections.find((section) =>
    section.items.some((item) => item.id === activeKey),
  )?.group;
  const [collapsedGroups, setCollapsedGroups] = useState<
    Record<string, boolean>
  >({});

  useEffect(() => {
    setCollapsedGroups((current) => {
      const next = { ...current };

      sections.forEach((section) => {
        if (section.group && section.items.length > 1) {
          next[section.group] =
            section.group !== activeGroup &&
            !defaultOpenSidebarGroups.has(section.group);
        }
      });

      return next;
    });
  }, [activeGroup, menuSignature, sections]);

  const renderMenuItem = (item: SidebarMenuItem, nested = false) => {
    const isActive = activeKey === item.id;
    const Icon = item.icon;
    const isDisabled = Boolean(item.disabled);

    return (
      <button
        key={item.id}
        aria-current={isActive ? "page" : undefined}
        aria-disabled={isDisabled || undefined}
        className={`
          flex items-center gap-3 w-full text-left transition-all duration-150
          ${
            nested
              ? "rounded-lg px-3 py-2 text-[13px] font-normal"
              : `rounded-xl px-3 ${mobile ? "py-3" : "py-2.5"} text-sm font-normal`
          }
          ${collapsed ? "justify-center" : ""}
          ${
            isDisabled
              ? "cursor-not-allowed text-gray-300"
              : isActive
                ? nested
                  ? "bg-[#eef4f0] text-[#5d7c6f]"
                  : "bg-[#5d7c6f] text-white shadow-sm"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
          }
        `}
        disabled={isDisabled}
        title={collapsed ? item.label : undefined}
        type="button"
        onClick={() => {
          if (!isDisabled) onNavigate(item.id);
        }}
      >
        {(!nested || collapsed) && (
          <Icon className="shrink-0" size={mobile ? 20 : 18} />
        )}
        {!collapsed && <span className="truncate">{item.label}</span>}
      </button>
    );
  };

  return (
    <>
      {sections.map((section, index) => {
        const isCollapsible = Boolean(
          section.group && section.items.length > 1,
        );
        const isGroupCollapsed = section.group
          ? (collapsedGroups[section.group] ?? false)
          : false;
        const GroupIcon = section.group
          ? (campGroupIcons[section.group] ?? section.items[0].icon)
          : null;

        if (!section.group || !isCollapsible || collapsed) {
          return (
            <div
              key={section.group ?? `ungrouped-${index}`}
              className="contents"
            >
              {section.items.map((item) => renderMenuItem(item))}
            </div>
          );
        }

        return (
          <div key={section.group} className="mb-1 last:mb-0">
            <button
              aria-expanded={!isGroupCollapsed}
              className={`flex items-center gap-3 w-full rounded-xl px-3 ${
                mobile ? "py-3" : "py-2.5"
              } text-left text-sm font-normal transition-colors ${
                activeGroup === section.group
                  ? "text-[#5d7c6f]"
                  : "text-gray-600"
              } hover:bg-gray-100 hover:text-gray-900`}
              type="button"
              onClick={() =>
                setCollapsedGroups((current) => ({
                  ...current,
                  [section.group!]: !isGroupCollapsed,
                }))
              }
            >
              {GroupIcon && (
                <GroupIcon className="shrink-0" size={mobile ? 20 : 18} />
              )}
              <span className="truncate">{section.group}</span>
              <ChevronDown
                className={`ml-auto shrink-0 transition-transform duration-200 ${
                  isGroupCollapsed ? "-rotate-90" : ""
                }`}
                size={16}
              />
            </button>

            {!isGroupCollapsed && (
              <div className="relative ml-5 mt-1 mb-2 space-y-1 border-l border-[#dbe6e1] pl-3">
                {section.items.map((item) => renderMenuItem(item, true))}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

/* ── Sidebar (Desktop only) ─────────────────────────────────── */
function TeacherSidebar({
  collapsed,
  setCollapsed,
  menuItems,
}: {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  menuItems: SidebarMenuItem[];
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const activeTab = searchParams.get("tab") || "camp";
  const campId = useActiveCampId(pathname);
  const isCampContext = Boolean(campId);
  const activeMenu = getCampMenuId(pathname, searchParams.get("menu"));

  const handleNavigate = (id: string) => {
    if (!isCampContext || !campId) {
      router.push(`/headteacher/dashboard?tab=${id}`);

      return;
    }

    const campPageRoutes: Record<string, string> = {
      attendance: "attendance",
      tracking: "tracking",
      location: "location",
      bus: "bus-checkin",
      shirts: "shirts",
      bases: "bases",
      survey: "survey",
      compare: "score-comparison",
      certificate: "certificate",
      "summary-documents": "project-summary-document",
    };

    if (id === "students") {
      router.push(getCleanCampPath("students"));
    } else if (id === "documents") {
      router.push(getCleanCampPath("project-document"));
    } else if (id === "summary-documents") {
      router.push(getCleanCampPath("project-summary-document"));
    } else if (id === "overview") {
      router.push(getCleanCampPath());
    } else if (campPageRoutes[id]) {
      router.push(getCleanCampPath(campPageRoutes[id]));
    } else {
      router.push(`${getCleanCampPath()}?menu=${id}`);
    }
  };

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
          <button
            aria-label="กลับหน้าค่ายที่เกี่ยวข้อง"
            className="flex items-center gap-2 rounded-lg text-left transition-colors hover:text-[#5d7c6f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6b857a]"
            type="button"
            onClick={() => router.push("/headteacher/dashboard?tab=camp")}
          >
            <div className="w-7 h-7 rounded-lg bg-[#5d7c6f] flex items-center justify-center">
              <LayoutDashboard className="text-white" size={14} />
            </div>
            <span className="text-sm font-semibold text-gray-700">เมนูครู</span>
          </button>
        )}
        <button
          aria-label="Toggle sidebar"
          className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors shrink-0"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="sidebar-scrollbar flex flex-col gap-1 p-2 flex-1 overflow-y-auto">
        <SidebarNav
          activeMenu={activeMenu}
          activeTab={activeTab}
          collapsed={collapsed}
          isCampContext={isCampContext}
          menuItems={menuItems}
          onNavigate={handleNavigate}
        />
      </nav>

      {!collapsed && (
        <div className="px-4 py-3 border-t border-gray-100">
          <p className="text-xs text-gray-400 text-center">ระบบจัดการค่าย</p>
        </div>
      )}
    </aside>
  );
}

/* ── Mobile Sidebar Drawer ───────────────────────────────── */
function MobileSidebar({
  isOpen,
  setIsOpen,
  menuItems,
}: {
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  menuItems: SidebarMenuItem[];
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const activeTab = searchParams.get("tab") || "camp";
  const campId = useActiveCampId(pathname);
  const isCampContext = Boolean(campId);
  const activeMenu = getCampMenuId(pathname, searchParams.get("menu"));

  const handleNavigate = (id: string) => {
    if (!isCampContext || !campId) {
      router.push(`/headteacher/dashboard?tab=${id}`);
      setIsOpen(false);

      return;
    }

    const campPageRoutes: Record<string, string> = {
      attendance: "attendance",
      tracking: "tracking",
      location: "location",
      bus: "bus-checkin",
      shirts: "shirts",
      bases: "bases",
      survey: "survey",
      compare: "score-comparison",
      certificate: "certificate",
      "summary-documents": "project-summary-document",
    };

    if (id === "students") {
      router.push(getCleanCampPath("students"));
    } else if (id === "documents") {
      router.push(getCleanCampPath("project-document"));
    } else if (id === "summary-documents") {
      router.push(getCleanCampPath("project-summary-document"));
    } else if (id === "overview") {
      router.push(getCleanCampPath());
    } else if (campPageRoutes[id]) {
      router.push(getCleanCampPath(campPageRoutes[id]));
    } else {
      router.push(`${getCleanCampPath()}?menu=${id}`);
    }

    setIsOpen(false);
  };

  return (
    <div
      className={`md:hidden fixed inset-0 z-[9999] transition-all duration-300 ease-in-out ${
        isOpen ? "visible" : "invisible delay-300"
      }`}
    >
      {/* Overlay */}
      <button
        aria-label="ปิดเมนูครู"
        className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ease-in-out ${
          isOpen ? "opacity-100" : "opacity-0"
        }`}
        type="button"
        onClick={() => setIsOpen(false)}
      />

      {/* Drawer */}
      <aside
        className={`absolute top-0 left-0 w-64 max-w-[80%] bg-white h-full flex flex-col shadow-xl transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
          <button
            aria-label="กลับหน้าค่ายที่เกี่ยวข้อง"
            className="flex items-center gap-2 rounded-lg text-left transition-colors hover:text-[#5d7c6f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6b857a]"
            type="button"
            onClick={() => {
              router.push("/headteacher/dashboard?tab=camp");
              setIsOpen(false);
            }}
          >
            <div className="w-8 h-8 rounded-lg bg-[#5d7c6f] flex items-center justify-center">
              <LayoutDashboard className="text-white" size={16} />
            </div>
            <span className="text-sm font-semibold text-gray-700">เมนูครู</span>
          </button>
          <button
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            onClick={() => setIsOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        <nav className="sidebar-scrollbar flex flex-col gap-1 p-3 flex-1 overflow-y-auto">
          <SidebarNav
            mobile
            activeMenu={activeMenu}
            activeTab={activeTab}
            collapsed={false}
            isCampContext={isCampContext}
            menuItems={menuItems}
            onNavigate={handleNavigate}
          />
        </nav>
      </aside>
    </div>
  );
}

/* ── Auto-redirect to default tab ───────────────────────────── */
function TabDefaultRedirect() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // redirect เฉพาะเมื่ออยู่ที่หน้า /headteacher/dashboard เท่านั้น
    // ไม่ redirect เมื่ออยู่ใน subpage เช่น /headteacher/dashboard/camp/[id]
    if (pathname === "/headteacher/dashboard" && !searchParams.get("tab")) {
      router.replace("/headteacher/dashboard?tab=camp");
    } else if (
      pathname === "/headteacher/dashboard" &&
      searchParams.get("tab") === "overview"
    ) {
      router.replace("/headteacher/dashboard?tab=camp");
    }
  }, [searchParams, router, pathname]);

  return null;
}

/* ── Root Layout ────────────────────────────────────────────── */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [campAccess, setCampAccess] = useState<CampAccess | null>(null);
  const pathname = usePathname();
  const campId = useActiveCampId(pathname);

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--teacher-sidebar-width",
      collapsed ? "4rem" : "14rem",
    );

    return () => {
      document.documentElement.style.removeProperty("--teacher-sidebar-width");
    };
  }, [collapsed]);

  useEffect(() => {
    if (!campId) {
      setCampAccess(null);

      return;
    }

    let cancelled = false;

    fetch(`/api/camps/${campId}/access`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled) {
          setCampAccess(
            data
              ? {
                  isOwner: Boolean(data.isOwner),
                  isHomeroomTeacher: Boolean(data.isHomeroomTeacher),
                  isBusTeacher: Boolean(data.isBusTeacher),
                  hasTransport: Boolean(data.hasTransport),
                }
              : null,
          );
        }
      })
      .catch(() => {
        if (!cancelled) setCampAccess(null);
      });

    return () => {
      cancelled = true;
    };
  }, [campId]);

  const menuItems = campId
    ? filterCampMenuItems(campMenuItems, campAccess)
    : teacherMenuItems;

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
            <TeacherSidebar
              collapsed={collapsed}
              menuItems={menuItems}
              setCollapsed={setCollapsed}
            />
          </Suspense>

          {/* Page Content */}
          <main className="min-h-0 flex-1 min-w-0 bg-[#f5f5f2]">
            {children}
          </main>
        </div>

        {/* Mobile Sidebar */}
        <Suspense fallback={null}>
          <MobileSidebar
            isOpen={mobileOpen}
            menuItems={menuItems}
            setIsOpen={setMobileOpen}
          />
        </Suspense>

        {/* Auto-redirect to default tab */}
        <Suspense fallback={null}>
          <TabDefaultRedirect />
        </Suspense>
      </div>
    </StatusModalProvider>
  );
}
