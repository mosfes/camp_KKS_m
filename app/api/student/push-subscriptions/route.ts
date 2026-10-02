import { createHash } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { requireStudent } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getWebPushPublicKey, isWebPushConfigured } from "@/lib/web-push";

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(4096),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    auth: z.string().min(1).max(255),
    p256dh: z.string().min(1).max(255),
  }),
});

const deleteSchema = z.object({
  endpoint: z.string().url().max(4096),
});

function endpointHash(endpoint: string) {
  return createHash("sha256").update(endpoint).digest("hex");
}

function hasValidOrigin(request: Request) {
  const origin = request.headers.get("origin");

  if (!origin) return true;

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function GET() {
  const { error: authError } = await requireStudent();

  if (authError) return authError;

  const vapidPublicKey = getWebPushPublicKey();

  return NextResponse.json(
    {
      configured: isWebPushConfigured(),
      vapidPublicKey,
      error: vapidPublicKey
        ? null
        : "การตั้งค่า Web Push ไม่ถูกต้อง กรุณาตรวจสอบ VAPID key pair",
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(request: Request) {
  const { student, error: authError } = await requireStudent();

  if (authError) return authError;
  if (!hasValidOrigin(request)) {
    return NextResponse.json({ error: "Origin ไม่ถูกต้อง" }, { status: 403 });
  }
  if (!isWebPushConfigured()) {
    return NextResponse.json(
      { error: "การตั้งค่า Web Push ไม่ถูกต้อง กรุณาตรวจสอบ VAPID key pair" },
      { status: 503 },
    );
  }

  const parsed = subscriptionSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsed.success) {
    return NextResponse.json(
      { error: "ข้อมูลการสมัครรับแจ้งเตือนไม่ถูกต้อง" },
      { status: 400 },
    );
  }

  const hash = endpointHash(parsed.data.endpoint);

  await prisma.student_push_subscription.upsert({
    where: { endpoint_hash: hash },
    create: {
      student_students_id: Number(student.students_id),
      endpoint_hash: hash,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
      user_agent: request.headers.get("user-agent")?.slice(0, 500) || null,
    },
    update: {
      student_students_id: Number(student.students_id),
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
      user_agent: request.headers.get("user-agent")?.slice(0, 500) || null,
    },
  });

  return NextResponse.json(
    { subscribed: true },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function DELETE(request: Request) {
  const { student, error: authError } = await requireStudent();

  if (authError) return authError;
  if (!hasValidOrigin(request)) {
    return NextResponse.json({ error: "Origin ไม่ถูกต้อง" }, { status: 403 });
  }

  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { error: "ข้อมูลการแจ้งเตือนไม่ถูกต้อง" },
      { status: 400 },
    );
  }

  await prisma.student_push_subscription.deleteMany({
    where: {
      student_students_id: Number(student.students_id),
      endpoint_hash: endpointHash(parsed.data.endpoint),
    },
  });

  return NextResponse.json(
    { subscribed: false },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
