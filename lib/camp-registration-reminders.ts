// แจ้งเตือน push ถึงนักเรียนที่ยังไม่ลงทะเบียน: วันเปิดรับสมัคร และวันสุดท้ายของการรับสมัคร
// เรียกจาก cron รายวัน (/api/cron/camp-reminders, 07:00 เวลาไทย)
//
// กันส่งซ้ำด้วยตาราง camp_email_reminder: บันทึกแถว status "SENT" ต่อ
// (ค่าย, นักเรียน, วันที่เป้าหมาย, ชนิด) ก่อนส่ง ระบบอีเมลแตะเฉพาะแถว PENDING/FAILED
// และชนิดที่เปิดใช้ในหน้าตั้งค่า จึงไม่กระทบกัน (โควตาอีเมลนับจาก camp_email_daily_run)
import { prisma } from "@/lib/db";
import { getBangkokDateKey } from "@/lib/bangkok-date";
import {
  addDateKeyDays,
  formatThaiDateKey,
  getRegistrationState,
} from "@/lib/camp-registration";
import { activeCampStudentWhere } from "@/lib/active-camp-student";
import {
  isWebPushConfigured,
  sendStudentPushNotifications,
} from "@/lib/web-push";

export const REGISTRATION_OPEN_PUSH = "PUSH_REGIS_OPEN";
export const REGISTRATION_LAST_DAY_PUSH = "PUSH_REGIS_LAST_DAY";

type DueReminder = {
  type: typeof REGISTRATION_OPEN_PUSH | typeof REGISTRATION_LAST_DAY_PUSH;
  dateKey: string;
  title: string;
  body: string;
};

export function dueRegistrationReminders(
  camp: Parameters<typeof getRegistrationState>[0] & { name: string },
  now: Date = new Date(),
): DueReminder[] {
  const todayKey = getBangkokDateKey(now);
  const state = getRegistrationState(camp, now);

  if (state.status !== "open") return [];

  // ส่งเฉพาะช่วงรับสมัคร ไม่ใช่ช่วงที่ลงได้เพราะเป็นวันค่าย
  const campStartKey = camp.start_date
    ? getBangkokDateKey(camp.start_date)
    : null;

  if (campStartKey && todayKey >= campStartKey) return [];

  const regisStartKey = camp.start_regis_date
    ? getBangkokDateKey(camp.start_regis_date)
    : null;
  const lastDay = state.lastDay;
  const lastText = lastDay
    ? lastDay === todayKey
      ? "วันนี้วันเดียวเท่านั้น"
      : `ถึง ${formatThaiDateKey(lastDay)}`
    : "";

  if (regisStartKey === todayKey) {
    return [
      {
        type: REGISTRATION_OPEN_PUSH,
        dateKey: todayKey,
        title: "เปิดรับสมัครค่ายแล้ว",
        body: `${camp.name}\nกดลงทะเบียนได้${lastText}`,
      },
    ];
  }

  // วันสุดท้ายก่อนค่ายเริ่ม (ถ้าช่วงรับสมัครต่อกับวันค่าย = วันก่อนเริ่มค่าย)
  const regisEndKey = camp.end_regis_date
    ? getBangkokDateKey(camp.end_regis_date)
    : null;
  const dayBeforeCamp = campStartKey ? addDateKeyDays(campStartKey, -1) : null;
  const preCampLastDay =
    regisEndKey && dayBeforeCamp
      ? regisEndKey < dayBeforeCamp
        ? regisEndKey
        : dayBeforeCamp
      : (regisEndKey ?? dayBeforeCamp);

  if (preCampLastDay === todayKey) {
    const continuesOnCampDay = lastDay !== null && lastDay > todayKey;

    return [
      {
        type: REGISTRATION_LAST_DAY_PUSH,
        // key ตามวันสุดท้าย: ถ้าครูขยายเวลา จะเตือนอีกครั้งตามวันใหม่
        dateKey: todayKey,
        title: continuesOnCampDay
          ? "พรุ่งนี้ค่ายเริ่มแล้ว"
          : "วันนี้วันสุดท้ายของการรับสมัคร",
        body: `${camp.name}\nคุณยังไม่ได้ลงทะเบียน กดเพื่อลงทะเบียน`,
      },
    ];
  }

  return [];
}

export async function runRegistrationPushReminders(now: Date = new Date()) {
  if (!isWebPushConfigured()) return { skipped: "web push not configured" };

  const todayKey = getBangkokDateKey(now);
  const camps = await prisma.camp.findMany({
    where: {
      deletedAt: null,
      status: "OPEN",
      start_date: { gt: new Date(`${todayKey}T00:00:00.000Z`) },
      start_regis_date: {
        lte: new Date(`${addDateKeyDays(todayKey, 1)}T00:00:00.000Z`),
      },
    },
    select: {
      camp_id: true,
      public_id: true,
      name: true,
      status: true,
      start_regis_date: true,
      end_regis_date: true,
      start_date: true,
      end_date: true,
    },
  });
  const summary: Record<string, { type: string; sent: number }[]> = {};

  for (const camp of camps) {
    for (const reminder of dueRegistrationReminders(camp, now)) {
      const students = await prisma.students.findMany({
        where: {
          ...activeCampStudentWhere(camp.camp_id),
          NOT: {
            student_enrollment: {
              some: { camp_camp_id: camp.camp_id, enrolled_at: { not: null } },
            },
          },
        },
        select: { students_id: true, firstname: true, lastname: true },
      });

      if (students.length === 0) continue;

      const already = await prisma.camp_email_reminder.findMany({
        where: {
          camp_camp_id: camp.camp_id,
          reminder_type: reminder.type,
          camp_start_date_key: reminder.dateKey,
        },
        select: { recipient_key: true },
      });
      const alreadyKeys = new Set(already.map((row) => row.recipient_key));
      const pending = students.filter(
        (student) => !alreadyKeys.has(`student:${student.students_id}`),
      );

      if (pending.length === 0) continue;

      await prisma.camp_email_reminder.createMany({
        data: pending.map((student) => ({
          camp_camp_id: camp.camp_id,
          recipient_key: `student:${student.students_id}`,
          recipient_email: "",
          recipient_name: `${student.firstname} ${student.lastname}`.slice(
            0,
            255,
          ),
          camp_start_date_key: reminder.dateKey,
          reminder_type: reminder.type,
          status: "SENT",
          sent_at: now,
        })),
        skipDuplicates: true,
      });

      const result = await sendStudentPushNotifications(
        pending.map((student) => student.students_id),
        {
          title: reminder.title,
          body: reminder.body,
          url: `/student/dashboard/camp/${camp.public_id}`,
          tag: `camp-registration-${camp.camp_id}`,
        },
        { topic: `regis-${camp.camp_id}` },
      );

      (summary[camp.camp_id] ??= []).push({
        type: reminder.type,
        sent: result.sent,
      });
    }
  }

  return summary;
}
