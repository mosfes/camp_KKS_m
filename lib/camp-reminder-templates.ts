import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import {
  reminderContentSchema,
  upgradeLegacyReminder,
  type ReminderPresetContent,
} from "@/lib/camp-reminder-config";

export type CustomReminderTemplate = {
  id: number;
  content: ReminderPresetContent;
};

export async function listCustomReminderTemplates(): Promise<
  CustomReminderTemplate[]
> {
  const rows = await prisma.camp_email_reminder_template.findMany({
    orderBy: { template_id: "asc" },
    select: { template_id: true, content: true },
  });

  // Skip rows that no longer match the current shape instead of failing the
  // whole settings page.
  return rows.flatMap((row) => {
    const parsed = reminderContentSchema.safeParse(
      upgradeLegacyReminder(row.content),
    );

    return parsed.success
      ? [{ id: row.template_id, content: parsed.data }]
      : [];
  });
}

export async function createCustomReminderTemplate(
  content: ReminderPresetContent,
  teacherId: number | null,
): Promise<CustomReminderTemplate> {
  const row = await prisma.camp_email_reminder_template.create({
    data: {
      content: content as unknown as Prisma.InputJsonValue,
      created_by_teacher_id: teacherId,
    },
    select: { template_id: true },
  });

  return { id: row.template_id, content };
}

/** Returns false when the template does not exist. */
export async function updateCustomReminderTemplate(
  id: number,
  content: ReminderPresetContent,
): Promise<boolean> {
  const result = await prisma.camp_email_reminder_template.updateMany({
    where: { template_id: id },
    data: { content: content as unknown as Prisma.InputJsonValue },
  });

  return result.count === 1;
}

export async function deleteCustomReminderTemplate(id: number) {
  await prisma.camp_email_reminder_template.deleteMany({
    where: { template_id: id },
  });
}
