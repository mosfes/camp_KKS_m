import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth";
import { reminderContentSchema } from "@/lib/camp-reminder-config";
import { createCustomReminderTemplate } from "@/lib/camp-reminder-templates";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { teacher, error } = await requireAdmin();

  if (error || !teacher) return error;

  const parsed = reminderContentSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "ข้อมูลเท็มเพลตไม่ถูกต้อง" },
      { status: 400 },
    );
  }

  try {
    const template = await createCustomReminderTemplate(
      parsed.data,
      teacher.teachers_id ?? null,
    );

    return NextResponse.json({ template }, { status: 201 });
  } catch (caught) {
    // eslint-disable-next-line no-console
    console.error("CAMP_REMINDER_TEMPLATE_CREATE_FAILED", caught);

    return NextResponse.json(
      { error: "บันทึกเท็มเพลตไม่สำเร็จ" },
      { status: 500 },
    );
  }
}
