import { NextResponse } from "next/server";

import { runCampReminderJob } from "@/lib/camp-reminders";
import { clearEndedCampLocations } from "@/lib/ended-camp-location-cleanup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Vercel Cron entry point. Keep this endpoint private: Vercel sends the
 * CRON_SECRET bearer token configured for the production project.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const authorization = request.headers.get("authorization");

  if (!secret || authorization !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const locationCleanup = await clearEndedCampLocations();
    const summary = await runCampReminderJob();

    return NextResponse.json({ ok: true, ...summary, locationCleanup });
  } catch (error) {
    // Keep the failure visible in Vercel runtime logs for operations.
    // eslint-disable-next-line no-console
    console.error("CAMP_REMINDER_CRON_FAILED", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Camp reminder job failed",
      },
      { status: 500 },
    );
  }
}
