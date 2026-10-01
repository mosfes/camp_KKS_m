import webPush from "web-push";

import { getBusReminderContent } from "@/lib/camp-bus-reminder";
import { prisma } from "@/lib/db";

type BusPushInput = {
  action: "board" | "alight";
  busName: string;
  campId: number;
  campName: string;
  eventId: number;
  studentIds: number[];
};

type WebPushConfig = {
  publicKey: string;
  privateKey: string;
  subject: string;
};

function getWebPushConfig(): WebPushConfig | null {
  const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim();
  const subject =
    process.env.WEB_PUSH_VAPID_SUBJECT?.trim() ||
    process.env.CAMP_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (
    !publicKey ||
    !privateKey ||
    !subject ||
    (!subject.startsWith("mailto:") && !subject.startsWith("https://"))
  ) {
    return null;
  }

  return { publicKey, privateKey, subject };
}

export function isWebPushConfigured() {
  return getWebPushConfig() !== null;
}

export function getWebPushPublicKey() {
  return getWebPushConfig()?.publicKey ?? null;
}

export function createStudentBusPushPayload(input: BusPushInput) {
  const eventType = input.action === "board" ? "REMIND_BOARD" : "REMIND_ALIGHT";
  const content = getBusReminderContent(eventType);

  if (!content) throw new Error("Unsupported bus reminder action");

  return {
    title: content.title,
    body: `${content.message}\n${input.campName} · ${input.busName}`,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: `student-bus-reminder-${input.eventId}`,
    url: `/student/dashboard/camp/${input.campId}/bus`,
  };
}

export async function sendStudentBusPushNotifications(input: BusPushInput) {
  const config = getWebPushConfig();

  if (!config || input.studentIds.length === 0) {
    return { attempted: 0, sent: 0 };
  }

  webPush.setVapidDetails(config.subject, config.publicKey, config.privateKey);

  const subscriptions = await prisma.student_push_subscription.findMany({
    where: {
      student_students_id: { in: Array.from(new Set(input.studentIds)) },
    },
    select: {
      endpoint_hash: true,
      endpoint: true,
      p256dh: true,
      auth: true,
    },
  });
  const payload = JSON.stringify(createStudentBusPushPayload(input));
  const expiredEndpointHashes: string[] = [];
  let sent = 0;

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webPush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          payload,
          {
            TTL: 30 * 60,
            urgency: "high",
            topic: `bus-${input.eventId}`,
          },
        );
        sent += 1;
      } catch (error) {
        const statusCode =
          typeof error === "object" && error && "statusCode" in error
            ? Number(error.statusCode)
            : null;

        if (statusCode === 404 || statusCode === 410) {
          expiredEndpointHashes.push(subscription.endpoint_hash);
        } else {
          // eslint-disable-next-line no-console
          console.error("[student web push] delivery failed", { statusCode });
        }
      }
    }),
  );

  if (expiredEndpointHashes.length > 0) {
    await prisma.student_push_subscription.deleteMany({
      where: { endpoint_hash: { in: expiredEndpointHashes } },
    });
  }

  return { attempted: subscriptions.length, sent };
}
