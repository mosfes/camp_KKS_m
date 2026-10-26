"use client";

import { Check, Chrome, Download, SquarePlus } from "lucide-react";
import { useEffect, useState } from "react";

import {
  KKS_PWA_INSTALLED_EVENT,
  isStandalonePwa,
} from "@/lib/client-web-push";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function AndroidInstallClient() {
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [chromeUrl, setChromeUrl] = useState("");

  useEffect(() => {
    setIsInstalled(isStandalonePwa());

    const url = new URL(window.location.href);
    const fallbackUrl = encodeURIComponent(url.href);

    setChromeUrl(
      `intent://${url.host}${url.pathname}#Intent;scheme=${url.protocol.replace(":", "")};package=com.android.chrome;S.browser_fallback_url=${fallbackUrl};end`,
    );

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    const handleAppInstalled = () => {
      setInstallEvent(null);
      setIsInstalled(true);
      window.dispatchEvent(new Event(KKS_PWA_INSTALLED_EVENT));
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!installEvent || isInstalling) return;

    setIsInstalling(true);

    try {
      await installEvent.prompt();
      await installEvent.userChoice;
      setInstallEvent(null);
    } catch {
      setInstallEvent(null);
    } finally {
      setIsInstalling(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f5f2] px-4 py-8">
      <section className="w-full max-w-sm rounded-3xl bg-white px-6 py-8 text-center shadow-lg">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e8f0ed] text-[#426a5b]">
          {isInstalled ? <Check size={28} /> : <SquarePlus size={28} />}
        </span>
        <h1 className="mt-4 text-xl font-bold text-gray-900">
          {isInstalled ? "ติดตั้ง KKS Camp แล้ว" : "ติดตั้ง KKS Camp บน Android"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-gray-600">
          {isInstalled
            ? "เปิดแอปได้จากหน้าจอโฮมของโทรศัพท์"
            : "เพิ่ม KKS Camp ไปยังหน้าจอโฮมเพื่อเปิดใช้งานได้สะดวก"}
        </p>

        {!isInstalled && installEvent && (
          <button
            className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#5d7c6f] text-sm font-bold text-white hover:bg-[#4e6d61] disabled:opacity-60"
            disabled={isInstalling}
            onClick={() => void install()}
            type="button"
          >
            <Download aria-hidden="true" size={18} />
            {isInstalling ? "กำลังเปิดหน้าติดตั้ง..." : "ติดตั้ง KKS Camp"}
          </button>
        )}

        {!isInstalled && !installEvent && (
          <div className="mt-6 text-left">
            <p className="text-sm font-semibold text-gray-800">
              ติดตั้งผ่านเมนู Chrome
            </p>
            <ol className="mt-3 list-inside list-decimal space-y-2 text-sm leading-6 text-gray-600">
              <li>เปิดหน้านี้ด้วย Chrome บน Android</li>
              <li>กดเมนู ⋮ ที่มุมขวาบน</li>
              <li>เลือก “ติดตั้งแอป” หรือ “เพิ่มไปยังหน้าจอหลัก”</li>
            </ol>
            {chromeUrl && (
              <a
                className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#5d7c6f] text-sm font-bold text-white hover:bg-[#4e6d61]"
                href={chromeUrl}
              >
                <Chrome aria-hidden="true" size={18} />
                เปิดลิงก์ติดตั้งใน Chrome
              </a>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
