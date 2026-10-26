"use client";

import { Download, Share, SquarePlus, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import {
  KKS_PWA_INSTALLED_EVENT,
  isAndroidDevice,
  isIosDevice,
  isStandalonePwa,
} from "@/lib/client-web-push";

const DISMISSED_AT_KEY = "kks:install-banner-dismissed-at";
const DISMISS_DURATION_MS = 30 * 60 * 1000;
// Refreshed every time the installed app is opened, so an uninstalled app
// stops suppressing the banner after a while.
const INSTALLED_AT_KEY = "kks:pwa-installed-at";
const INSTALLED_MEMORY_MS = 30 * 24 * 60 * 60 * 1000;

type InstallPlatform = "ios" | "android";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isRecent(key: string, durationMs: number) {
  try {
    const timestamp = Number(window.localStorage.getItem(key));

    return Number.isFinite(timestamp) && Date.now() - timestamp < durationMs;
  } catch {
    return false;
  }
}

function rememberNow(key: string) {
  try {
    window.localStorage.setItem(key, String(Date.now()));
  } catch {
    // Without storage the banner falls back to showing on the next visit.
  }
}

export function InstallAppBanner() {
  const pathname = usePathname();
  const [platform, setPlatform] = useState<InstallPlatform | null>(null);
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const [showIosSteps, setShowIosSteps] = useState(false);

  useEffect(() => {
    if (isStandalonePwa()) {
      rememberNow(INSTALLED_AT_KEY);

      return;
    }
    if (
      isRecent(INSTALLED_AT_KEY, INSTALLED_MEMORY_MS) ||
      isRecent(DISMISSED_AT_KEY, DISMISS_DURATION_MS)
    ) {
      return;
    }

    if (isIosDevice()) setPlatform("ios");
    else if (isAndroidDevice()) setPlatform("android");

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    const hide = () => {
      rememberNow(INSTALLED_AT_KEY);
      setInstallEvent(null);
      setPlatform(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", hide);
    window.addEventListener(KKS_PWA_INSTALLED_EVENT, hide);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", hide);
      window.removeEventListener(KKS_PWA_INSTALLED_EVENT, hide);
    };
  }, []);

  if (!platform || pathname === "/install") return null;

  const dismiss = () => {
    rememberNow(DISMISSED_AT_KEY);
    setPlatform(null);
  };

  const installOnAndroid = async () => {
    if (!installEvent || isInstalling) return;

    setIsInstalling(true);

    try {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;

      setInstallEvent(null);
      if (choice.outcome === "accepted") {
        rememberNow(INSTALLED_AT_KEY);
        setPlatform(null);
      }
    } catch {
      setInstallEvent(null);
    } finally {
      setIsInstalling(false);
    }
  };

  const actionClassName =
    "flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-[#5d7c6f] px-3.5 text-xs font-bold text-white transition-colors hover:bg-[#4e6d61] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5d7c6f] focus-visible:ring-offset-2 aria-disabled:cursor-wait aria-disabled:opacity-60";

  return (
    <div
      aria-label="ติดตั้ง KKS Camp"
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center px-3 pt-[calc(0.75rem+env(safe-area-inset-top))]"
      role="dialog"
    >
      <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-gray-100 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.18)]">
        <div className="flex items-center gap-3 p-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e8f0ed] text-[#426a5b]">
            <SquarePlus aria-hidden="true" size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold leading-tight text-gray-900">
              ติดตั้งแอป KKS Camp
            </p>
            <p className="mt-0.5 text-xs leading-tight text-gray-500">
              เปิดจากหน้าจอโฮมและรับการแจ้งเตือนได้สะดวกขึ้น
            </p>
          </div>

          {platform === "android" ? (
            <a
              aria-disabled={isInstalling}
              className={actionClassName}
              href="/install"
              onClick={(event) => {
                if (isInstalling) {
                  event.preventDefault();
                } else if (installEvent) {
                  event.preventDefault();
                  void installOnAndroid();
                }
              }}
            >
              <Download aria-hidden="true" size={14} />
              {isInstalling ? "กำลังเปิด..." : "ติดตั้ง"}
            </a>
          ) : (
            <button
              aria-expanded={showIosSteps}
              className={actionClassName}
              type="button"
              onClick={() => setShowIosSteps((value) => !value)}
            >
              วิธีติดตั้ง
            </button>
          )}

          <button
            aria-label="ปิดหน้าต่างติดตั้ง"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5d7c6f]"
            type="button"
            onClick={dismiss}
          >
            <X aria-hidden="true" size={18} />
          </button>
        </div>

        {platform === "ios" && showIosSteps && (
          <ol className="mx-3 mb-3 list-inside list-decimal space-y-1 rounded-xl bg-[#f5f8f6] px-3 py-2.5 text-xs leading-5 text-gray-700">
            <li>
              กดปุ่มแชร์
              <Share
                aria-hidden="true"
                className="mx-1 inline text-[#3979c3]"
                size={14}
              />
              ที่แถบเมนูของ Safari
            </li>
            <li>เลื่อนลงแล้วเลือก “เพิ่มไปยังหน้าจอโฮม”</li>
            <li>กด “เพิ่ม” แล้วเปิด KKS Camp จากหน้าจอโฮม</li>
          </ol>
        )}
      </div>
    </div>
  );
}
