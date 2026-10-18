"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Button } from "@heroui/button";
import { Progress } from "@heroui/progress";
import { Tabs, Tab } from "@heroui/tabs";
import {
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Circle,
  Clock3,
  GraduationCap,
  Mail,
  MapPin,
  Phone,
  Route,
  Target,
  UserRound,
} from "lucide-react";

import { ParentNavbar } from "@/components/ParentNavbar";
import { toThumbnail } from "@/lib/cloudinary-url";

const CampLocationTracker = dynamic(
  () => import("@/components/camp-location/CampLocationTracker"),
  { ssr: false },
);

type Mission = {
  mission_id: number;
  title: string | null;
  description: string | null;
  type: string;
  status: string | null;
};
type Station = {
  station_id: number;
  name: string;
  description: string | null;
  mission: Mission[];
};
type Activity = {
  id: string;
  type: "MISSION" | "ATTENDANCE" | "BUS";
  title: string;
  detail: string;
  status: string;
  occurredAt: string;
};
type Contact = {
  teachers_id: number;
  prefix_name: string | null;
  firstname: string;
  lastname: string;
  tel: string;
  email: string;
  role: string;
};
export type CampDetail = {
  id: number;
  publicId: string;
  studentId: number;
  title: string;
  description: string;
  location: string;
  startDate: string;
  endDate: string;
  hasTransport: boolean;
  img_camp_url: string;
  enrolledAt: string;
  shirtSize: string | null;
  studentSharingEnabled: boolean;
  station: Station[];
  camp_daily_schedule: {
    daily_schedule_id: number;
    day: number;
    time_slots: {
      time_slot_id: number;
      startTime: string;
      endTime: string;
      activity: string;
    }[];
  }[];
  contacts: Contact[];
  activities: Activity[];
  summary: {
    totalMissions: number;
    completedMissions: number;
    progressPercent: number;
    attendanceCount: number;
    latestActivityAt: string | null;
  };
};

function dateTime(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  });
}
function teacherName(contact: Contact) {
  return `${contact.prefix_name ?? ""}${contact.firstname} ${contact.lastname}`;
}

export default function ParentCampProgressClient({
  camp,
  studentName,
  studentPublicId,
}: {
  camp: CampDetail;
  studentName: string;
  studentPublicId: string;
}) {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#f5f5f2]">
      <ParentNavbar />
      <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
        <nav aria-label="เส้นทางหน้า" className="flex flex-wrap items-center gap-2 text-xs text-[#5d7c6f]">
          <button type="button" className="hover:underline" onClick={() => router.push("/parent/family")}>บุตรทั้งหมด</button>
          <ChevronRight size={13} />
          <button type="button" className="font-semibold hover:underline" onClick={() => router.push(studentPublicId ? `/parent/children/${studentPublicId}` : "/parent/family")}>{studentName}</button>
          <ChevronRight size={13} />
          <span className="text-gray-500">รายละเอียดค่าย</span>
        </nav>
        <div className="flex items-center gap-3">
          <Button
            isIconOnly
            aria-label="กลับหน้าหลัก"
            className="bg-white text-gray-700 shadow-sm"
            radius="lg"
            variant="flat"
            onPress={() => router.push(studentPublicId ? `/parent/children/${studentPublicId}` : "/parent/family")}
          >
            <ChevronLeft size={20} />
          </Button>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#5d7c6f]">
              Camp progress report
            </p>
            <h1 className="truncate text-xl font-bold leading-tight text-gray-800">
              {camp.title}
            </h1>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="h-28 w-full shrink-0 overflow-hidden rounded-2xl bg-gray-100 sm:h-24 sm:w-36">
              {camp.img_camp_url ? (
                <img
                  alt=""
                  className="h-full w-full object-cover"
                  decoding="async"
                  fetchPriority="high"
                  height={112}
                  src={toThumbnail(camp.img_camp_url, 480)}
                  width={380}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-[#5d7c6f]/30">
                  <Target size={38} />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold text-[#3d6357]">{camp.title}</h2>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-500">
                <MapPin className="text-[#5d7c6f]" size={15} />
                {camp.location}
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-400">
                <Calendar size={14} />
                {camp.startDate} – {camp.endDate}
              </p>
            </div>
            <div className="rounded-2xl bg-[#f5f5f2] px-5 py-3 text-center">
              <p className="text-3xl font-black text-[#5d7c6f]">
                {camp.summary.progressPercent}%
              </p>
              <p className="text-[11px] text-gray-400">ความคืบหน้า</p>
            </div>
          </div>
        </div>

        <Tabs
          aria-label="ข้อมูลค่าย"
          classNames={{
            tabList: "w-full rounded-none border-b border-divider",
            cursor: "w-full bg-[#5d7c6f]",
            tab: "max-w-none px-2",
            tabContent: "group-data-[selected=true]:text-[#5d7c6f]",
          }}
          defaultSelectedKey="activity"
          variant="underlined"
        >
          <Tab
            key="activity"
            title={
              <span className="flex items-center gap-1.5">
                <Target size={15} />
                กิจกรรม
              </span>
            }
          >
            <ActivityPanel camp={camp} studentName={studentName} />
          </Tab>
          <Tab
            key="location"
            title={
              <span className="flex items-center gap-1.5">
                <MapPin size={15} />
                ตำแหน่ง
              </span>
            }
          >
            <div className="py-4">
              <CampLocationTracker campId={camp.id} studentId={camp.studentId} viewer="parent" />
            </div>
          </Tab>
          <Tab
            key="schedule"
            title={
              <span className="flex items-center gap-1.5">
                <Calendar size={15} />
                กำหนดการ
              </span>
            }
          >
            <SchedulePanel schedules={camp.camp_daily_schedule} />
          </Tab>
          <Tab
            key="contacts"
            title={
              <span className="flex items-center gap-1.5">
                <GraduationCap size={15} />
                ติดต่อครู
              </span>
            }
          >
            <ContactsPanel contacts={camp.contacts} />
          </Tab>
        </Tabs>
      </main>
    </div>
  );
}

function ActivityPanel({
  camp,
  studentName,
}: {
  camp: CampDetail;
  studentName: string;
}) {
  const [isActivityExpanded, setIsActivityExpanded] = useState(true);
  const [activityPage, setActivityPage] = useState(1);
  const activitiesPerPage = 5;
  const totalActivityPages = Math.max(
    1,
    Math.ceil(camp.activities.length / activitiesPerPage),
  );
  const currentActivityPage = Math.min(activityPage, totalActivityPages);
  const activityStartIndex = (currentActivityPage - 1) * activitiesPerPage;
  const visibleActivities = camp.activities.slice(
    activityStartIndex,
    activityStartIndex + activitiesPerPage,
  );

  return (
    <div className="space-y-5 py-4">
      <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-gray-500">
              สรุปความคืบหน้าของ {studentName || "บุตร"}
            </p>
            <p className="mt-1 text-4xl font-black text-[#3d6357]">
              {camp.summary.completedMissions}
              <span className="ml-1 text-lg font-semibold text-gray-400">
                / {camp.summary.totalMissions} ภารกิจ
              </span>
            </p>
          </div>
          <div className="rounded-2xl bg-[#f5f5f2] px-3 py-2 text-center">
            <p className="text-lg font-bold text-[#5d7c6f]">
              {camp.summary.attendanceCount}
            </p>
            <p className="text-[10px] text-gray-400">ครั้งที่เช็กชื่อ</p>
          </div>
        </div>
        <Progress
          className="h-3"
          classNames={{ indicator: "bg-[#5d7c6f]", track: "bg-gray-100" }}
          value={camp.summary.progressPercent}
        />
      </div>

      <div className="space-y-4">
        <h3 className="flex items-center gap-2 px-1 text-sm font-bold text-gray-700">
          <Target className="text-[#5d7c6f]" size={17} />
          รายละเอียดรายฐาน
        </h3>
        {camp.station.map((station) => {
          const completed = station.mission.filter(
            (mission) => mission.status === "completed",
          ).length;
          const progress = station.mission.length
            ? Math.round((completed / station.mission.length) * 100)
            : 0;
          return (
            <div
              key={station.station_id}
              className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm"
            >
              <div className="flex items-center gap-3 bg-gray-50/50 p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#5d7c6f]/10 text-[#5d7c6f]">
                  <Target size={21} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between gap-2">
                    <h4 className="truncate font-bold text-gray-800">
                      {station.name}
                    </h4>
                    <span className="text-xs font-black text-[#5d7c6f]">
                      {progress}%
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">
                    {completed} จาก {station.mission.length} ภารกิจเสร็จสิ้น
                  </p>
                </div>
              </div>
              <div className="grid gap-2 p-5 sm:grid-cols-2">
                {station.mission.length === 0 ? (
                  <p className="text-xs text-gray-400">ไม่มีภารกิจย่อย</p>
                ) : (
                  station.mission.map((mission) => (
                    <div
                      key={mission.mission_id}
                      className={`flex items-center gap-3 rounded-2xl border p-3 ${mission.status === "completed" ? "border-green-100 bg-green-50/30" : "border-gray-100"}`}
                    >
                      <div
                        className={
                          mission.status === "completed"
                            ? "text-green-500"
                            : "text-gray-200"
                        }
                      >
                        {mission.status === "completed" ? (
                          <CheckCircle2 size={18} />
                        ) : (
                          <Circle size={18} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p
                          className={`truncate text-xs font-bold ${mission.status === "completed" ? "text-[#3d6357]" : "text-gray-400"}`}
                        >
                          {mission.title || "ภารกิจ"}
                        </p>
                        <p className="text-[10px] text-gray-400">
                          {mission.status === "completed"
                            ? "เสร็จเรียบร้อย"
                            : "ยังไม่ได้ทำ"}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="h-1 bg-gray-50">
                <div
                  className="h-full bg-[#5d7c6f]"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="space-y-4 pb-8">
        <div className="flex items-center justify-between gap-3 px-1">
          <h3 className="flex items-center gap-2 text-sm font-bold text-gray-700">
            <Clock3 className="text-[#5d7c6f]" size={17} />
            กิจกรรมล่าสุด
            {camp.activities.length > 0 && (
              <span className="rounded-full bg-[#e8f0ee] px-2 py-0.5 text-[10px] font-semibold text-[#3d6357]">
                {camp.activities.length}
              </span>
            )}
          </h3>
          <button
            aria-controls="parent-recent-activities"
            aria-expanded={isActivityExpanded}
            className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-[#5d7c6f] transition hover:bg-[#e8f0ee]"
            type="button"
            onClick={() => setIsActivityExpanded((expanded) => !expanded)}
          >
            {isActivityExpanded ? "ย่อ" : "แสดงกิจกรรม"}
            {isActivityExpanded ? (
              <ChevronUp size={15} />
            ) : (
              <ChevronDown size={15} />
            )}
          </button>
        </div>
        {isActivityExpanded && (
          <div id="parent-recent-activities">
            {camp.activities.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-gray-200 bg-white p-10 text-center text-sm text-gray-400">
                ยังไม่มีกิจกรรมบันทึก
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative space-y-3 before:absolute before:bottom-3 before:left-[19px] before:top-3 before:w-px before:bg-[#d9e5e0]">
                  {visibleActivities.map((activity) => (
                    <div key={activity.id} className="relative flex gap-3">
                      <div className="z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e8f0ee] text-[#5d7c6f]">
                        {activity.type === "MISSION" ? (
                          <Target size={17} />
                        ) : activity.type === "BUS" ? (
                          <Route size={17} />
                        ) : (
                          <CheckCircle2 size={17} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
                        <div className="flex flex-wrap items-start justify-between gap-1">
                          <p className="text-sm font-semibold text-gray-800">
                            {activity.title}
                          </p>
                          <span className="text-[10px] text-gray-400">
                            {dateTime(activity.occurredAt)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-gray-500">
                          {activity.detail}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {totalActivityPages > 1 && (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-white px-3 py-2.5 shadow-sm sm:px-4">
                    <p className="text-[11px] text-gray-400">
                      แสดง {activityStartIndex + 1}–
                      {Math.min(
                        activityStartIndex + activitiesPerPage,
                        camp.activities.length,
                      )}{" "}
                      จาก {camp.activities.length} รายการ
                    </p>
                    <div className="flex items-center gap-1.5">
                      <button
                        aria-label="กิจกรรมหน้าก่อนหน้า"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:border-[#5d7c6f]/40 hover:bg-[#e8f0ee] hover:text-[#3d6357] disabled:cursor-not-allowed disabled:opacity-35"
                        disabled={currentActivityPage === 1}
                        type="button"
                        onClick={() =>
                          setActivityPage((page) => Math.max(1, page - 1))
                        }
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <span className="min-w-20 text-center text-xs font-semibold text-gray-600">
                        หน้า {currentActivityPage} จาก {totalActivityPages}
                      </span>
                      <button
                        aria-label="กิจกรรมหน้าถัดไป"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:border-[#5d7c6f]/40 hover:bg-[#e8f0ee] hover:text-[#3d6357] disabled:cursor-not-allowed disabled:opacity-35"
                        disabled={currentActivityPage === totalActivityPages}
                        type="button"
                        onClick={() =>
                          setActivityPage((page) =>
                            Math.min(totalActivityPages, page + 1),
                          )
                        }
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SchedulePanel({
  schedules,
}: {
  schedules: CampDetail["camp_daily_schedule"];
}) {
  return (
    <div className="space-y-4 py-4 pb-8">
      {schedules.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-gray-200 bg-white p-10 text-center text-sm text-gray-400">
          ยังไม่มีข้อมูลกำหนดการ
        </div>
      ) : (
        schedules.map((schedule) => (
          <section
            key={schedule.daily_schedule_id}
            className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm"
          >
            <h3 className="mb-4 font-bold text-[#3d6357]">
              วันที่ {schedule.day}
            </h3>
            <div className="space-y-2">
              {schedule.time_slots.map((slot) => (
                <div
                  key={slot.time_slot_id}
                  className="flex gap-3 rounded-2xl bg-[#f5f5f2] p-3"
                >
                  <span className="w-24 shrink-0 text-xs font-semibold text-[#5d7c6f]">
                    {slot.startTime}–{slot.endTime}
                  </span>
                  <span className="text-sm text-gray-700">{slot.activity}</span>
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function ContactsPanel({ contacts }: { contacts: Contact[] }) {
  return (
    <div className="space-y-4 py-4 pb-8">
      <div className="rounded-2xl bg-blue-50 p-4 text-xs leading-5 text-blue-800">
        ติดต่อครูตามบทบาทที่แสดงด้านล่าง
        หากเป็นเหตุฉุกเฉินให้โทรแจ้งโรงเรียนควบคู่กัน
      </div>
      {contacts.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-gray-200 bg-white p-10 text-center text-sm text-gray-400">
          ยังไม่มีข้อมูลผู้ติดต่อค่าย
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {contacts.map((contact) => (
            <div
              key={contact.teachers_id}
              className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm"
            >
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#5d7c6f]/10 text-[#5d7c6f]">
                  <UserRound size={20} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-[#3d6357]">
                    {teacherName(contact)}
                  </p>
                  <p className="text-xs text-gray-400">{contact.role}</p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                {contact.tel && (
                  <a
                    className="flex items-center gap-2 rounded-xl bg-[#f5f5f2] p-3 text-gray-700"
                    href={`tel:${contact.tel}`}
                  >
                    <Phone className="text-[#5d7c6f]" size={16} />
                    {contact.tel}
                  </a>
                )}
                {contact.email && (
                  <a
                    className="flex items-center gap-2 truncate rounded-xl bg-[#f5f5f2] p-3 text-gray-700"
                    href={`mailto:${contact.email}`}
                  >
                    <Mail className="shrink-0 text-[#5d7c6f]" size={16} />
                    <span className="truncate">{contact.email}</span>
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
