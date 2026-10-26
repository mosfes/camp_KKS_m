"use client";

import dynamic from "next/dynamic";

// Each section is its own route state. Load only the code for the selected tab.
const OverviewManager = dynamic(() => import("./components/OverviewManager"));
const TeacherManager = dynamic(() => import("./components/TeacherManager"));
const DocumentDataManager = dynamic(() => import("./components/DocumentDataManager"));
const ClassroomManager = dynamic(() => import("./components/ClassroomManager"));
const StudentManager = dynamic(() => import("./components/StudentManager"));
const CampManager = dynamic(() => import("./components/CampManager"));
const BusLayoutManager = dynamic(() => import("./components/BusLayoutManager"));
const VulgarWordsManager = dynamic(() => import("./components/VulgarWordsManager"));
// โหลดข้อมูลฝั่ง client ทั้งหมดอยู่แล้ว ปิด SSR กัน id ของ HeroUI ไม่ตรงตอน hydrate
const ParentAccessManager = dynamic(
  () => import("./components/ParentAccessManager"),
  { ssr: false },
);

const sectionMap = {
  overview: {
    label: "ภาพรวมระบบ",
    desc: "สรุปข้อมูลทั้งหมดในระบบ",
    Component: OverviewManager,
  },
  teacher: {
    label: "ครู",
    desc: "เพิ่มและจัดการข้อมูลครู",
    Component: TeacherManager,
  },
  documentdata: {
    label: "จัดการข้อมูลเอกสาร",
    desc: "จัดการบุคลากร มาตรฐานการศึกษา และกลยุทธ์โรงเรียน",
    Component: DocumentDataManager,
  },
  classroom: {
    label: "ห้องเรียน",
    desc: "จัดการห้องเรียนและกลุ่ม",
    Component: ClassroomManager,
  },
  student: {
    label: "นักเรียน",
    desc: "จัดการข้อมูลนักเรียน",
    Component: StudentManager,
  },
  parentaccess: {
    label: "สิทธิ์ผู้ปกครอง",
    desc: "ดูว่าใครเข้าถึงข้อมูลนักเรียนได้ และตรวจสอบคำขอยืนยัน",
    Component: ParentAccessManager,
  },
  camp: { label: "ค่าย", desc: "จัดการค่ายและกิจกรรม", Component: CampManager },
  buslayout: {
    label: "ผังรถ",
    desc: "สร้างและเผยแพร่เทมเพลตผังรถให้หัวหน้าค่ายเลือกใช้",
    Component: BusLayoutManager,
  },
  vulgarwords: {
    label: "คลังคำหยาบ",
    desc: "จัดการคำหยาบในระบบ",
    Component: VulgarWordsManager,
  },
};

export default function AdminPageContent({
  tab = "overview",
  initialTeachers = null,
  initialClassrooms = null,
  initialYears = null,
  initialOverview = null,
  initialCamps = null,
}) {
  const section = sectionMap[tab] || sectionMap["overview"];
  const { label, desc, Component } = section;

  return (
    <div className="m-4 md:m-8">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{label}</h1>
          <p className="text-gray-600 text-sm mt-1">{desc}</p>
        </div>
        <div
          id="admin-header-actions"
          className="flex items-center gap-2"
        ></div>
      </div>
      {tab === "teacher" ? (
        <Component initialTeachers={initialTeachers} />
      ) : tab === "classroom" ? (
        <Component initialClassrooms={initialClassrooms} />
      ) : tab === "overview" ? (
        <Component
          initialYears={initialYears}
          initialOverview={initialOverview}
        />
      ) : tab === "camp" ? (
        <Component initialCamps={initialCamps} />
      ) : (
        <Component />
      )}
    </div>
  );
}
