"use client";

const SERVICE_WORKER_URL = "/notification-sw.js";

type SerializedPushSubscription = {
  endpoint: string;
  expirationTime: number | null;
  keys: {
    auth: string;
    p256dh: string;
  };
};

export function supportsWebPush() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function isIosDevice() {
  if (typeof navigator === "undefined") return false;

  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function isAndroidDevice() {
  if (typeof navigator === "undefined") return false;

  return /Android/i.test(navigator.userAgent);
}

export function isStandalonePwa() {
  if (typeof window === "undefined") return false;

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator &&
      (navigator as Navigator & { standalone?: boolean }).standalone === true)
  );
}

export async function registerPwaServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;

  await navigator.serviceWorker.register(SERVICE_WORKER_URL, {
    scope: "/",
    updateViaCache: "none",
  });

  return navigator.serviceWorker.ready;
}

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    output[index] = rawData.charCodeAt(index);
  }

  return output;
}

function serializeSubscription(
  subscription: PushSubscription,
): SerializedPushSubscription {
  const serialized = subscription.toJSON();

  if (
    !serialized.endpoint ||
    !serialized.keys?.auth ||
    !serialized.keys.p256dh
  ) {
    throw new Error("ข้อมูลการสมัครรับแจ้งเตือนไม่ครบถ้วน");
  }

  return {
    endpoint: serialized.endpoint,
    expirationTime: serialized.expirationTime ?? null,
    keys: {
      auth: serialized.keys.auth,
      p256dh: serialized.keys.p256dh,
    },
  };
}

async function saveSubscription(subscription: PushSubscription) {
  const response = await fetch("/api/student/push-subscriptions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(serializeSubscription(subscription)),
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(result.error || "บันทึกการแจ้งเตือนไม่สำเร็จ");
  }
}

export async function syncExistingStudentPushSubscription() {
  if (!supportsWebPush() || Notification.permission !== "granted") {
    return false;
  }

  const registration = await registerPwaServiceWorker();

  if (!registration) return false;

  const subscription = await registration.pushManager.getSubscription();

  if (!subscription) return false;

  await saveSubscription(subscription);

  return true;
}

export async function enableStudentWebPush() {
  if (!supportsWebPush()) {
    throw new Error("อุปกรณ์หรือเบราว์เซอร์นี้ยังไม่รองรับ Web Push");
  }

  const permission = await Notification.requestPermission();

  if (permission !== "granted") {
    return { permission, subscribed: false } as const;
  }

  const registration = await registerPwaServiceWorker();

  if (!registration) {
    throw new Error("ไม่สามารถเปิด service worker ได้");
  }

  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    const configResponse = await fetch("/api/student/push-subscriptions", {
      cache: "no-store",
    });
    const config = await configResponse.json().catch(() => ({}));

    if (!configResponse.ok || !config.configured || !config.vapidPublicKey) {
      throw new Error(
        config.error || "ระบบ Web Push ยังไม่ได้ตั้งค่าคีย์สำหรับการแจ้งเตือน",
      );
    }

    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(config.vapidPublicKey),
    });
  }

  await saveSubscription(subscription);

  return { permission, subscribed: true } as const;
}

export async function disconnectCurrentStudentPushSubscription() {
  if (!("serviceWorker" in navigator)) return;

  const registration = await navigator.serviceWorker.getRegistration("/");
  const subscription = await registration?.pushManager.getSubscription();

  if (!subscription) return;

  await fetch("/api/student/push-subscriptions", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  }).catch(() => {});
}
