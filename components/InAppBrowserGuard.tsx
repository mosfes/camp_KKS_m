"use client";

import type { ReactNode } from "react";

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Chrome,
  Clipboard,
  ExternalLink,
  MoreVertical,
  ShieldAlert,
} from "lucide-react";

type BrowserInfo = {
  appName: string;
  isAndroid: boolean;
  isInAppBrowser: boolean;
  isIOS: boolean;
};

function detectBrowser(userAgent: string): BrowserInfo {
  const ua = userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(ua);
  const isAndroid = /android/.test(ua);

  const knownApps: Array<[RegExp, string]> = [
    [/line\//, "LINE"],
    [/fban|fbav|fb_iab|messengerforios/, "Messenger หรือ Facebook"],
    [/instagram/, "Instagram"],
    [/tiktok|musical_ly/, "TikTok"],
    [/twitter|x\//, "X"],
    [/telegram/, "Telegram"],
  ];
  const matchedApp = knownApps.find(([pattern]) => pattern.test(ua));
  const isAndroidWebView =
    isAndroid && (/; wv\)/.test(ua) || /\bwv\b/.test(ua));

  return {
    appName: matchedApp?.[1] ?? "แอปแชต",
    isAndroid,
    isIOS,
    isInAppBrowser: Boolean(matchedApp) || isAndroidWebView,
  };
}

function buildChromeIntent(currentUrl: string) {
  const url = new URL(currentUrl);
  const path = `${url.host}${url.pathname}${url.search}`;

  return `intent://${path}#Intent;scheme=${url.protocol.replace(":", "")};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(currentUrl)};end`;
}

export default function InAppBrowserGuard({
  children,
  initialUserAgent,
}: {
  children: ReactNode;
  initialUserAgent?: string;
}) {
  const [browserInfo, setBrowserInfo] = useState<BrowserInfo | null>(() =>
    initialUserAgent ? detectBrowser(initialUserAgent) : null,
  );
  const [currentUrl, setCurrentUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!initialUserAgent) {
      setBrowserInfo(detectBrowser(window.navigator.userAgent));
    }
    setCurrentUrl(window.location.href);
  }, [initialUserAgent]);

  const chromeIntent = useMemo(() => {
    if (!currentUrl || !browserInfo?.isAndroid) return "";

    return buildChromeIntent(currentUrl);
  }, [browserInfo?.isAndroid, currentUrl]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(currentUrl);
    } catch {
      const textArea = document.createElement("textarea");

      textArea.value = currentUrl;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      textArea.remove();
    }

    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  };

  // รออ่าน user agent ก่อน เพื่อไม่ให้ปุ่ม Google โผล่ชั่วครู่ใน in-app browser
  if (!browserInfo) {
    return (
      <div
        aria-label="กำลังตรวจสอบเบราว์เซอร์"
        className="h-10 w-10 animate-spin rounded-full border-4 border-[#dfe7e3] border-t-[#6b857a]"
        role="status"
      />
    );
  }

  if (!browserInfo.isInAppBrowser) return children;

  const titleText = browserInfo.isAndroid
    ? "กรุณาเปิดด้วย Chrome"
    : "กรุณาเปิดด้วยเบราว์เซอร์ภายนอก";

  const stepTwoText = browserInfo.isAndroid
    ? "เลือก “เปิดใน Chrome” หรือ “Open in browser”"
    : "เลือก “เปิดในเบราว์เซอร์” / “เปิดใน Safari” หรือ “Open in browser”";

  return (
    <section className="w-[calc(100vw-2rem)] max-w-[420px] overflow-hidden rounded-3xl border border-amber-100 bg-white shadow-[0_18px_55px_rgba(51,65,85,0.12)]">
      <div className="bg-amber-50 px-6 py-5 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white text-amber-600 shadow-sm">
          <ShieldAlert aria-hidden="true" size={28} />
        </div>
        <h1 className="text-xl font-bold text-slate-700">{titleText}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          หน้านี้เปิดอยู่ใน {browserInfo.appName} ซึ่ง Google ไม่อนุญาตให้
          เข้าสู่ระบบในหน้าต่างนี้
        </p>
      </div>

      <div className="space-y-4 px-6 py-6">
        <div className="rounded-2xl bg-[#f3f7f5] p-4">
          <p className="mb-3 text-sm font-bold text-slate-700">
            ทำตามขั้นตอนนี้ได้เลย
          </p>
          <ol className="space-y-3 text-sm leading-6 text-slate-600">
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#6b857a] bg-transparent text-xs font-bold text-[#6b857a]">
                1
              </span>
              <span>
                กดเมนู <MoreVertical className="inline" size={18} /> หรือ …
                ที่มุมขวาบน
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#6b857a] bg-transparent text-xs font-bold text-[#6b857a]">
                2
              </span>
              <span>{stepTwoText}</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#6b857a] bg-transparent text-xs font-bold text-[#6b857a]">
                3
              </span>
              <span>กลับมากดเข้าสู่ระบบด้วย Google อีกครั้ง</span>
            </li>
          </ol>
        </div>

        {browserInfo.isAndroid && chromeIntent ? (
          <a
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#6b857a] px-4 text-base font-bold text-white shadow-sm transition-colors hover:bg-[#5a7168]"
            href={chromeIntent}
          >
            <Chrome aria-hidden="true" size={20} />
            เปิดด้วย Chrome
            <ExternalLink aria-hidden="true" size={17} />
          </a>
        ) : (
          <button
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#6b857a] px-4 text-base font-bold text-white shadow-sm transition-colors hover:bg-[#5a7168]"
            type="button"
            onClick={copyLink}
          >
            {copied ? <Check size={20} /> : <Clipboard size={20} />}
            {copied
              ? "คัดลอกแล้ว—นำไปวางในเบราว์เซอร์"
              : "คัดลอกลิงก์ไปเปิดในเบราว์เซอร์ภายนอก"}
          </button>
        )}

        {browserInfo.isAndroid && (
          <button
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
            type="button"
            onClick={copyLink}
          >
            {copied ? <Check size={18} /> : <Clipboard size={18} />}
            {copied ? "คัดลอกลิงก์แล้ว" : "คัดลอกลิงก์"}
          </button>
        )}

        <p className="text-center text-xs leading-5 text-slate-400">
          บัญชี Google ของหนูไม่ได้มีปัญหา เพียงแค่ต้องเปลี่ยนเบราว์เซอร์
        </p>
      </div>
    </section>
  );
}
