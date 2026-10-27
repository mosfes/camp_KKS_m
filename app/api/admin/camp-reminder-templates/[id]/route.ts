import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth";
import { reminderContentSchema } from "@/lib/camp-reminder-config";
import {
  deleteCustomReminderTemplate,
  updateCustomReminderTemplate,
} from "@/lib/camp-reminder-templates";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

async function templateId(context: Context) {
  const { id } = await context.params;
  const value = Number(id);

  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

export async function PUT(request: Request, context: Context) {
  const { error } = await requireAdmin();

  if (error) return error;

  const id = await templateId(context);

  if (!id) {
    return NextResponse.json({ error: "ไม่พบเท็มเพลต" }, { status: 404 });
  }

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
    const found = await updateCustomReminderTemplate(id, parsed.data);

    if (!found) {
      return NextResponse.json({ error: "ไม่พบเท็มเพลต" }, { status: 404 });
    }

    return NextResponse.json({ template: { id, content: parsed.data } });
  } catch (caught) {
    // eslint-disable-next-line no-console
    console.error("CAMP_REMINDER_TEMPLATE_UPDATE_FAILED", caught);

    return NextResponse.json(
      { error: "บันทึกเท็มเพลตไม่สำเร็จ" },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, context: Context) {
  const { error } = await requireAdmin();

  if (error) return error;

  const id = await templateId(context);

  if (!id) {
    return NextResponse.json({ error: "ไม่พบเท็มเพลต" }, { status: 404 });
  }

  try {
    await deleteCustomReminderTemplate(id);

    return NextResponse.json({ ok: true });
  } catch (caught) {
    // eslint-disable-next-line no-console
    console.error("CAMP_REMINDER_TEMPLATE_DELETE_FAILED", caught);

    return NextResponse.json({ error: "ลบเท็มเพลตไม่สำเร็จ" }, { status: 500 });
  }
}
