"use client";

import {
  Bell,
  BellRing,
  Bus,
  Check,
  ChevronRight,
  Smartphone,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  enableStudentWebPush,
  isIosDevice,
  isStandalonePwa,
  registerPwaServiceWorker,
  supportsWebPush,
  syncExistingStudentPushSubscription,
} from "@/lib/client-web-push";

type StudentNotification = {
  id: string;
  action: "board" | "alight";
  title: string;
  message: string;
  sentAt: string;
  active: boolean;
  campId: number;
  campName: string;
  busId: number;
  busName: string;
};

type NotificationPermissionState = NotificationPermission | "unsupported";
type PushAvailability = "available" | "ios-install-required" | "unsupported";

const POLL_INTERVAL_MS = 10_000;
const MAX_STORED_IDS = 100;

function parseStoredIds(value: string | null) {
  if (!value) return new Set<string>();

  try {
    const parsed = JSON.parse(value);

    return new Set<string>(
      Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === "string")
        : [],
    );
  } catch {
    return new Set<string>();
  }
}

function storeIds(key: string, ids: Set<string>) {
  const values = Array.from(ids).slice(-MAX_STORED_IDS);

  window.localStorage.setItem(key, JSON.stringify(values));
}

function formatNotificationTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString("th-TH", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  });
}

async function showDeviceNotification(notification: StudentNotification) {
  if (
    typeof window === "undefined" ||
    !("Notification" in window) ||
    Notification.permission !== "granted"
  ) {
    return;
  }

  const url = `/student/dashboard/camp/${notification.campId}/bus`;
  const options: NotificationOptions = {
    body: `${notification.message}\n${notification.campName} · ${notification.busName}`,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: `student-bus-reminder-${notification.id}`,
    data: { url },
  };

  try {
    if ("serviceWorker" in navigator) {
      const registration = await registerPwaServiceWorker();

      if (!registration) return;

      await registration.showNotification(notification.title, options);

      return;
    }

    new Notification(notification.title, options);
  } catch {
    // The in-app alert remains available when the browser blocks device alerts.
  }
}

export function StudentNotificationCenter({
  studentId,
}: {
  studentId: number | null;
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const requestInFlightRef = useRef(false);
  const readIdsRef = useRef<Set<string>>(new Set());
  const announcedIdsRef = useRef<Set<string>>(new Set());
  const initializedStudentRef = useRef<number | null>(null);
  const [notifications, setNotifications] = useState<StudentNotification[]>([]);
  const [readIds, setReadIds] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [popupNotification, setPopupNotification] =
    useState<StudentNotification | null>(null);
  const [permission, setPermission] =
    useState<NotificationPermissionState>("unsupported");
  const [pushAvailability, setPushAvailability] =
    useState<PushAvailability>("unsupported");
  const [isPushSubscribed, setIsPushSubscribed] = useState(false);
  const [isEnablingPush, setIsEnablingPush] = useState(false);
  const [pushMessage, setPushMessage] = useState("");

  const storageKeys = useMemo(() => {
    if (!studentId) return null;

    return {
      read: `kks-student-notifications:${studentId}:read`,
      announced: `kks-student-notifications:${studentId}:announced`,
    };
  }, [studentId]);

  const fetchNotifications = useCallback(async () => {
    if (!studentId || !storageKeys || requestInFlightRef.current) return;

    requestInFlightRef.current = true;

    try {
      const response = await fetch("/api/student/notifications", {
        cache: "no-store",
      });

      if (!response.ok) return;

      const result = await response.json();
      const nextNotifications: StudentNotification[] = Array.isArray(
        result.notifications,
      )
        ? result.notifications
        : [];

      if (initializedStudentRef.current !== studentId) {
        const storedReadValue = window.localStorage.getItem(storageKeys.read);
        const initialReadIds = parseStoredIds(storedReadValue);

        // On a student's first visit, only a currently actionable reminder is
        // unread. Older history remains available without creating a large badge.
        if (storedReadValue === null) {
          nextNotifications.forEach((notification) => {
            if (!notification.active) initialReadIds.add(notification.id);
          });
          storeIds(storageKeys.read, initialReadIds);
        }

        readIdsRef.current = initialReadIds;
        announcedIdsRef.current = parseStoredIds(
          window.localStorage.getItem(storageKeys.announced),
        );
        initializedStudentRef.current = studentId;
        setReadIds(Array.from(initialReadIds));
      }

      setNotifications(nextNotifications);

      const notificationToAnnounce = nextNotifications.find(
        (notification) =>
          notification.active && !announcedIdsRef.current.has(notification.id),
      );

      if (notificationToAnnounce) {
        announcedIdsRef.current.add(notificationToAnnounce.id);
        storeIds(storageKeys.announced, announcedIdsRef.current);
        setPopupNotification(notificationToAnnounce);
        void showDeviceNotification(notificationToAnnounce);
      }
    } catch {
      // Background notification polling must not interrupt the student UI.
    } finally {
      requestInFlightRef.current = false;
    }
  }, [storageKeys, studentId]);

  useEffect(() => {
    if (!studentId) return;

    if (isIosDevice() && !isStandalonePwa()) {
      setPushAvailability("ios-install-required");

      return;
    }

    if (!supportsWebPush()) {
      setPushAvailability("unsupported");

      return;
    }

    setPushAvailability("available");
    setPermission(Notification.permission);

    if (Notification.permission === "granted") {
      void syncExistingStudentPushSubscription()
        .then(setIsPushSubscribed)
        .catch(() => setIsPushSubscribed(false));
    }
  }, [studentId]);

  useEffect(() => {
    if (!studentId) return;

    void fetchNotifications();

    const timer = window.setInterval(() => {
      void fetchNotifications();
    }, POLL_INTERVAL_MS);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void fetchNotifications();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchNotifications, studentId]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const unreadCount = notifications.filter(
    (notification) => !readIds.includes(notification.id),
  ).length;

  const markAllAsRead = useCallback(() => {
    if (!storageKeys || notifications.length === 0) return;

    const nextReadIds = new Set(readIdsRef.current);

    notifications.forEach((notification) => nextReadIds.add(notification.id));
    readIdsRef.current = nextReadIds;
    storeIds(storageKeys.read, nextReadIds);
    setReadIds(Array.from(nextReadIds));
  }, [notifications, storageKeys]);

  const toggleNotifications = () => {
    if (!isOpen) markAllAsRead();
    setIsOpen((current) => !current);
  };

  const openNotification = (notification: StudentNotification) => {
    markAllAsRead();
    setIsOpen(false);
    setPopupNotification(null);
    router.push(`/student/dashboard/camp/${notification.campId}/bus`);
  };

  const enableDeviceNotifications = async () => {
    if (isEnablingPush || pushAvailability !== "available") return;

    setIsEnablingPush(true);
    setPushMessage("");

    try {
      const result = await enableStudentWebPush();

      setPermission(result.permission);
      setIsPushSubscribed(result.subscribed);

      if (result.subscribed) {
        setPushMessage("เปิดการแจ้งเตือนบนอุปกรณ์แล้ว");
      } else if (result.permission === "denied") {
        setPushMessage(
          "เบราว์เซอร์ปิดการแจ้งเตือนไว้ กรุณาเปิดจากการตั้งค่าเว็บไซต์",
        );
      }
    } catch (error) {
      setPermission(
        "Notification" in window ? Notification.permission : "unsupported",
      );
      setPushMessage(
        error instanceof Error
          ? error.message
          : "ไม่สามารถเปิดการแจ้งเตือนบนอุปกรณ์ได้",
      );
    } finally {
      setIsEnablingPush(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={
          unreadCount > 0
            ? `การแจ้งเตือนที่ยังไม่ได้อ่าน ${unreadCount} รายการ`
            : "ดูการแจ้งเตือน"
        }
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-[#496b60] transition-colors hover:bg-[#edf3f0] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5d7c6f] focus-visible:ring-offset-2"
        type="button"
        onClick={toggleNotifications}
      >
        <Bell size={21} strokeWidth={2.2} />
        {unreadCount > 0 && (
          <span className="absolute right-0 top-0 flex min-h-4 min-w-4 items-center justify-center rounded-full border-2 border-white bg-red-500 px-0.5 text-[9px] font-bold leading-none text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          aria-label="รายการแจ้งเตือน"
          className="absolute right-0 top-[calc(100%+0.75rem)] z-[100] w-[min(23rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
          role="dialog"
        >
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3.5">
            <div>
              <h2 className="text-sm font-bold text-gray-900">การแจ้งเตือน</h2>
              <p className="mt-0.5 text-[11px] text-gray-500">
                การแจ้งเตือนขึ้น–ลงรถจากครูประจำรถ
              </p>
            </div>
            {notifications.length > 0 && (
              <span className="flex items-center gap-1 text-[11px] font-medium text-[#4f7567]">
                <Check size={13} /> อ่านแล้ว
              </span>
            )}
          </div>

          {pushAvailability === "ios-install-required" && (
            <div className="flex items-start gap-3 border-b border-gray-100 bg-[#f3f8f5] px-4 py-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[#4f7567] shadow-sm">
                <Smartphone size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold text-gray-800">
                  เพิ่ม KKS Camp ไปที่หน้าจอโฮมก่อน
                </span>
                <span className="mt-0.5 block text-[10px] leading-relaxed text-gray-500">
                  บน iPhone ให้กดปุ่มแชร์ แล้วเลือก “เพิ่มไปยังหน้าจอโฮม”
                  จากนั้นเปิดแอปและกดกระดิ่งอีกครั้ง
                </span>
              </span>
            </div>
          )}

          {pushAvailability === "unsupported" && (
            <div className="border-b border-gray-100 bg-gray-50 px-4 py-2.5 text-[11px] leading-relaxed text-gray-500">
              เบราว์เซอร์นี้ยังไม่รองรับการแจ้งเตือนระบบ แต่ยังดูแจ้งเตือนและรับ
              popup ภายใน KKS Camp ได้
            </div>
          )}

          {pushAvailability === "available" &&
            !isPushSubscribed &&
            permission !== "denied" && (
              <button
                aria-busy={isEnablingPush}
                className="flex w-full items-center gap-3 border-b border-gray-100 bg-[#f3f8f5] px-4 py-3 text-left transition-colors hover:bg-[#e9f3ed]"
                disabled={isEnablingPush}
                type="button"
                onClick={() => void enableDeviceNotifications()}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[#4f7567] shadow-sm">
                  <Smartphone size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold text-gray-800">
                    {isEnablingPush
                      ? "กำลังเปิดการแจ้งเตือน..."
                      : "เปิดแจ้งเตือนบนอุปกรณ์"}
                  </span>
                  <span className="mt-0.5 block text-[10px] leading-relaxed text-gray-500">
                    รับแจ้งเตือนบนหน้าจอเมื่อเบราว์เซอร์รองรับ
                  </span>
                </span>
                <ChevronRight className="text-gray-400" size={16} />
              </button>
            )}

          {pushAvailability === "available" && isPushSubscribed && (
            <div className="flex items-center gap-3 border-b border-gray-100 bg-emerald-50 px-4 py-3 text-emerald-800">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
                <Check size={16} />
              </span>
              <span className="text-xs font-semibold">
                เปิดแจ้งเตือนบนอุปกรณ์แล้ว
              </span>
            </div>
          )}

          {pushAvailability === "available" && permission === "denied" && (
            <div className="border-b border-gray-100 bg-amber-50 px-4 py-3 text-[11px] leading-relaxed text-amber-800">
              เบราว์เซอร์ปิดการแจ้งเตือนไว้ กรุณาอนุญาต KKS Camp
              จากการตั้งค่าเว็บไซต์
            </div>
          )}

          {pushMessage && !isPushSubscribed && permission !== "denied" && (
            <div className="border-b border-gray-100 bg-amber-50 px-4 py-2.5 text-[11px] leading-relaxed text-amber-800">
              {pushMessage}
            </div>
          )}

          {notifications.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-10 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                <Bell size={22} />
              </span>
              <p className="mt-3 text-sm font-semibold text-gray-700">
                ยังไม่มีการแจ้งเตือน
              </p>
              <p className="mt-1 text-xs leading-relaxed text-gray-400">
                เมื่อครูแจ้งให้ขึ้นหรือลงรถ รายการจะแสดงที่นี่
              </p>
            </div>
          ) : (
            <div className="max-h-[min(26rem,65vh)] overflow-y-auto">
              {notifications.map((notification) => (
                <button
                  key={notification.id}
                  className={`flex w-full items-start gap-3 border-b border-gray-100 px-4 py-3.5 text-left transition-colors last:border-b-0 hover:bg-gray-50 ${
                    notification.active ? "bg-[#f4faf7]" : "bg-white"
                  }`}
                  type="button"
                  onClick={() => openNotification(notification)}
                >
                  <span
                    className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                      notification.action === "alight"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-[#deeee6] text-[#3f6b5b]"
                    }`}
                  >
                    <Bus size={17} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-xs font-bold text-gray-900">
                        {notification.title}
                      </span>
                      {notification.active && (
                        <span className="shrink-0 rounded-full bg-red-50 px-1.5 py-0.5 text-[9px] font-bold text-red-600">
                          ใหม่
                        </span>
                      )}
                    </span>
                    <span className="mt-1 line-clamp-2 block text-[11px] leading-relaxed text-gray-600">
                      {notification.message}
                    </span>
                    <span className="mt-1.5 block truncate text-[10px] text-gray-400">
                      {notification.campName} · {notification.busName} ·{" "}
                      {formatNotificationTime(notification.sentAt)} น.
                    </span>
                  </span>
                  <ChevronRight
                    className="mt-2 shrink-0 text-gray-300"
                    size={15}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {popupNotification &&
        createPortal(
          <div
            className="pointer-events-none fixed inset-x-4 z-[9998] flex justify-center"
            style={{ top: "max(1rem, env(safe-area-inset-top))" }}
          >
            <div
              aria-labelledby="student-bus-notification-title"
              aria-live="assertive"
              className="pointer-events-auto w-full max-w-md overflow-hidden rounded-2xl border border-[#b8d4c8] bg-white shadow-2xl"
              role="alertdialog"
            >
              <div
                className={`h-1.5 w-full ${
                  popupNotification.action === "alight"
                    ? "bg-amber-400"
                    : "bg-[#5d7c6f]"
                }`}
              />
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <span
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                      popupNotification.action === "alight"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-[#deeee6] text-[#356050]"
                    }`}
                  >
                    <BellRing size={22} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[#5d7c6f]">
                      ครูประจำรถแจ้งเตือน
                    </p>
                    <h2
                      className="mt-0.5 text-base font-bold text-gray-900"
                      id="student-bus-notification-title"
                    >
                      {popupNotification.title}
                    </h2>
                    <p className="mt-1 text-xs leading-relaxed text-gray-600">
                      {popupNotification.message}
                    </p>
                    <p className="mt-2 truncate text-[11px] text-gray-400">
                      {popupNotification.campName} · {popupNotification.busName}
                    </p>
                  </div>
                  <button
                    aria-label="ปิดการแจ้งเตือน"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                    type="button"
                    onClick={() => setPopupNotification(null)}
                  >
                    <X size={17} />
                  </button>
                </div>
                <button
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#5d7c6f] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#4e6d61]"
                  type="button"
                  onClick={() => openNotification(popupNotification)}
                >
                  ไปที่หน้าเช็กชื่อรถ
                  <ChevronRight size={17} />
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
