import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import {
  normalizeCampReminderSettings,
  type CampReminderSettings,
} from "@/lib/camp-reminder-config";

const SETTING_ID = 1;

export async function getCampReminderSettings(): Promise<CampReminderSettings> {
  const row = await prisma.camp_email_reminder_setting.findUnique({
    where: { setting_id: SETTING_ID },
    select: { send_hour: true, reminders: true },
  });

  return normalizeCampReminderSettings(
    row ? { sendHour: row.send_hour, reminders: row.reminders } : null,
  );
}

export async function saveCampReminderSettings(
  settings: CampReminderSettings,
  teacherId: number | null,
) {
  const reminders = settings.reminders as unknown as Prisma.InputJsonValue;

  await prisma.camp_email_reminder_setting.upsert({
    where: { setting_id: SETTING_ID },
    create: {
      setting_id: SETTING_ID,
      send_hour: settings.sendHour,
      reminders,
      updated_by_teacher_id: teacherId,
    },
    update: {
      send_hour: settings.sendHour,
      reminders,
      updated_by_teacher_id: teacherId,
    },
  });
}
