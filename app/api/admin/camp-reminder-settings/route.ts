import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth";
import { getBangkokDateKey } from "@/lib/bangkok-date";
import { campReminderSettingsSchema } from "@/lib/camp-reminder-config";
import { getCampReminderProgress } from "@/lib/camp-reminders";
import { listCustomReminderTemplates } from "@/lib/camp-reminder-templates";
import {
  getCampReminderSettings,
  saveCampReminderSettings,
} from "@/lib/camp-reminder-settings";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

function failure(error: unknown) {
  // eslint-disable-next-line no-console
  console.error("CAMP_REMINDER_SETTINGS_FAILED", error);

  const missingTable =
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "P2021";

  return NextResponse.json(
    {
      error: missingTable
        ? "ยังไม่ได้สร้างตารางของระบบอีเมล กรุณารัน npm run db:migrate:deploy"
        : "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์",
    },
    { status: 500 },
  );
}

async function recentRuns() {
  const runs = await prisma.camp_email_daily_run.findMany({
    orderBy: { date_key: "desc" },
    take: 7,
    select: {
      date_key: true,
      sent_count: true,
      failed_count: true,
      uncertain_count: true,
      last_finished_at: true,
    },
  });

  return runs.map((run) => ({
    dateKey: run.date_key,
    sent: run.sent_count,
    failed: run.failed_count,
    uncertain: run.uncertain_count,
    lastFinishedAt: run.last_finished_at,
  }));
}

export async function GET() {
  const { error } = await requireAdmin();

  if (error) return error;

  try {
    const [settings, runs, camps, templates] = await Promise.all([
      getCampReminderSettings(),
      recentRuns(),
      getCampReminderProgress(),
      listCustomReminderTemplates(),
    ]);

    return NextResponse.json({
      settings,
      runs,
      camps,
      templates,
      today: getBangkokDateKey(),
    });
  } catch (caught) {
    return failure(caught);
  }
}

export async function PUT(request: Request) {
  const { teacher, error } = await requireAdmin();

  if (error || !teacher) return error;

  const body = await request.json().catch(() => null);
  const parsed = campReminderSettingsSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message || "ข้อมูลการตั้งค่าไม่ถูกต้อง",
      },
      { status: 400 },
    );
  }

  try {
    await saveCampReminderSettings(parsed.data, teacher.teachers_id ?? null);
  } catch (caught) {
    return failure(caught);
  }

  return NextResponse.json({ settings: parsed.data });
}
