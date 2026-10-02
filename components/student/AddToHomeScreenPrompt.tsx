"use client";

import { Download, MoreVertical, Share, SquarePlus } from "lucide-react";
import { useEffect, useState } from "react";

import { StudentPromptDialog } from "@/components/student/StudentPromptDialog";
import {
  KKS_PWA_INSTALLED_EVENT,
  isAndroidDevice,
  isIosDevice,
  isStandalonePwa,
} from "@/lib/client-web-push";

export const INSTALL_PROMPT_PARAM = "showInstallPrompt";
const LEGACY_IOS_INSTALL_PROMPT_PARAM = "showIosInstall";

type InstallPlatform = "ios" | "android";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
};

function InstallStep({
  number,
  children,
}: {
  number: number;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-3 rounded-2xl bg-[#f5f8f6] p-3.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#5d7c6f] text-sm font-bold text-white">
        {number}
      </span>
      <span className="flex-1 text-sm font-medium leading-relaxed text-gray-700">
        {children}
      </span>
    </li>
  );
}

export function AddToHomeScreenPrompt() {
  const [platform, setPlatform] = useState<InstallPlatform | null>(null);
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    const handleAppInstalled = () => {
      setInstallEvent(null);
      setPlatform(null);
      window.dispatchEvent(new Event(KKS_PWA_INSTALLED_EVENT));
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    const url = new URL(window.location.href);
    const shouldShow =
      url.searchParams.get(INSTALL_PROMPT_PARAM) === "1" ||
      url.searchParams.get(LEGACY_IOS_INSTALL_PROMPT_PARAM) === "1";

    if (shouldShow) {
      url.searchParams.delete(INSTALL_PROMPT_PARAM);
      url.searchParams.delete(LEGACY_IOS_INSTALL_PROMPT_PARAM);
      window.history.replaceState(
        window.history.state,
        "",
        `${url.pathname}${url.search}${url.hash}`,
      );

      if (!isStandalonePwa()) {
        if (isIosDevice()) setPlatform("ios");
        else if (isAndroidDevice()) setPlatform("android");
      }
    }

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const closePrompt = () => setPlatform(null);

  const installOnAndroid = async () => {
    if (!installEvent || isInstalling) return;

    setIsInstalling(true);

    try {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;

      setInstallEvent(null);
      if (choice.outcome === "accepted") closePrompt();
    } catch {
      setInstallEvent(null);
    } finally {
      setIsInstalling(false);
    }
  };

  return (
    <StudentPromptDialog
      isOpen={platform !== null}
      label="เพิ่ม KKS Camp ไปที่หน้าจอโฮม"
      onClose={closePrompt}
    >
      <div className="flex flex-col items-center gap-3 px-6 pb-2 pt-7 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e8f0ed] text-[#426a5b]">
          <SquarePlus size={28} strokeWidth={2} />
        </span>
        <span className="text-lg font-bold text-gray-900">
          เพิ่ม KKS Camp ไปที่หน้าจอโฮม
        </span>
      </div>

      <div className="flex flex-col gap-3 px-6 py-4">
        <p className="text-center text-sm leading-relaxed text-gray-500">
          เปิดใช้งานได้สะดวกเหมือนแอป และรับการแจ้งเตือนจาก KKS Camp ได้ง่ายขึ้น
        </p>

        {platform === "ios" && (
          <ol className="space-y-3">
            <InstallStep number={1}>
              กดปุ่มแชร์
              <Share
                aria-hidden="true"
                className="mx-1 inline text-[#3979c3]"
                size={19}
              />
              ที่แถบเมนูของ Safari
            </InstallStep>
            <InstallStep number={2}>
              เลื่อนลงแล้วเลือก “เพิ่มไปยังหน้าจอโฮม”
            </InstallStep>
            <InstallStep number={3}>
              กด “เพิ่ม” แล้วเปิด KKS Camp จากหน้าจอโฮม
            </InstallStep>
          </ol>
        )}

        {platform === "android" && (
          <ol className="space-y-3">
            <InstallStep number={1}>เปิดหน้านี้ด้วย Google Chrome</InstallStep>
            <InstallStep number={2}>
              กดเมนู
              <MoreVertical
                aria-hidden="true"
                className="mx-0.5 inline text-[#426a5b]"
                size={19}
              />
              มุมขวาบน
            </InstallStep>
            <InstallStep number={3}>
              เลือก “ติดตั้งแอป” หรือ “เพิ่มลงในหน้าจอหลัก” แล้วกดยืนยัน
            </InstallStep>
          </ol>
        )}
      </div>

      <div className="flex flex-col gap-2 px-6 pb-6 pt-2">
        {platform === "android" && installEvent && (
          <button
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#5d7c6f] text-sm font-bold text-white transition-colors hover:bg-[#4e6d61] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5d7c6f] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
            disabled={isInstalling}
            type="button"
            onClick={() => void installOnAndroid()}
          >
            <Download aria-hidden="true" size={18} />
            {isInstalling ? "กำลังเปิดหน้าติดตั้ง..." : "ติดตั้ง KKS Camp"}
          </button>
        )}
        <button
          className={`h-11 w-full rounded-xl text-sm font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5d7c6f] focus-visible:ring-offset-2 ${
            platform === "android" && installEvent
              ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
              : "bg-[#5d7c6f] text-white hover:bg-[#4e6d61]"
          }`}
          type="button"
          onClick={closePrompt}
        >
          {platform === "android" && installEvent ? "ไว้ภายหลัง" : "เข้าใจแล้ว"}
        </button>
      </div>
    </StudentPromptDialog>
  );
}
