"use client";

import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";
import { BellRing, CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";

import {
  KKS_PWA_INSTALLED_EVENT,
  enableStudentWebPush,
  isStandalonePwa,
  supportsWebPush,
} from "@/lib/client-web-push";

function promptSessionKey(studentId: number) {
  return `kks-student-push-permission-prompt:${studentId}`;
}

function wasDismissedThisSession(key: string) {
  try {
    return window.sessionStorage.getItem(key) === "dismissed";
  } catch {
    return false;
  }
}

function rememberDismissal(key: string) {
  try {
    window.sessionStorage.setItem(key, "dismissed");
  } catch {
    // The prompt can still close when private browsing blocks storage.
  }
}

export function StudentPushPermissionPrompt({
  studentId,
}: {
  studentId: number | null;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isEnabling, setIsEnabling] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!studentId) return;

    const key = promptSessionKey(studentId);
    const canAskForPermission = () =>
      supportsWebPush() &&
      Notification.permission === "default" &&
      !wasDismissedThisSession(key);
    const showAfterInstall = () => {
      if (canAskForPermission()) setIsOpen(true);
    };

    if (isStandalonePwa()) showAfterInstall();

    window.addEventListener(KKS_PWA_INSTALLED_EVENT, showAfterInstall);

    return () =>
      window.removeEventListener(KKS_PWA_INSTALLED_EVENT, showAfterInstall);
  }, [studentId]);

  const closePrompt = () => {
    if (studentId) {
      rememberDismissal(promptSessionKey(studentId));
    }

    setIsOpen(false);
  };

  const enableNotifications = async () => {
    if (isEnabling) return;

    setIsEnabling(true);
    setMessage("");

    try {
      const result = await enableStudentWebPush();

      if (result.subscribed) {
        setIsOpen(false);

        return;
      }

      setMessage(
        result.permission === "denied"
          ? "คุณปิดการแจ้งเตือนไว้ กรุณาเปิดสิทธิ์จากการตั้งค่าของอุปกรณ์"
          : "ยังไม่ได้อนุญาตการแจ้งเตือน คุณสามารถเปิดภายหลังได้จากเมนูกระดิ่ง",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "ไม่สามารถเปิดการแจ้งเตือนบนอุปกรณ์ได้",
      );
    } finally {
      setIsEnabling(false);
    }
  };

  return (
    <Modal
      backdrop="blur"
      isOpen={isOpen}
      placement="center"
      size="sm"
      onClose={closePrompt}
    >
      <ModalContent className="mx-4 overflow-hidden rounded-3xl">
        <ModalHeader className="flex flex-col items-center gap-3 px-6 pb-2 pt-7 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e8f0ed] text-[#426a5b]">
            <BellRing size={28} strokeWidth={2} />
          </span>
          <span className="text-lg font-bold text-gray-900">
            เปิดการแจ้งเตือนบนอุปกรณ์
          </span>
        </ModalHeader>

        <ModalBody className="gap-4 px-6 py-4">
          <p className="text-center text-sm leading-relaxed text-gray-500">
            รับแจ้งเตือนจากครูประจำรถได้ทันที แม้ไม่ได้เปิด KKS Camp อยู่
            เพื่อไม่พลาดการยืนยันขึ้นหรือลงรถ
          </p>

          <div className="space-y-2 rounded-2xl bg-[#f5f8f6] p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <CheckCircle2 className="shrink-0 text-[#4f7567]" size={18} />
              แจ้งเตือนเมื่อครูเรียกขึ้นรถ
            </p>
            <p className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <CheckCircle2 className="shrink-0 text-[#4f7567]" size={18} />
              แจ้งเตือนเมื่อถึงเวลาลงรถ
            </p>
          </div>

          {message && (
            <p
              aria-live="polite"
              className="rounded-xl bg-amber-50 px-3 py-2.5 text-center text-xs leading-relaxed text-amber-800"
            >
              {message}
            </p>
          )}
        </ModalBody>

        <ModalFooter className="flex-col gap-2 px-6 pb-6 pt-2">
          <button
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#5d7c6f] text-sm font-bold text-white transition-colors hover:bg-[#4e6d61] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5d7c6f] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
            disabled={isEnabling}
            type="button"
            onClick={() => void enableNotifications()}
          >
            <BellRing aria-hidden="true" size={18} />
            {isEnabling ? "กำลังเปิดการแจ้งเตือน..." : "อนุญาตการแจ้งเตือน"}
          </button>
          <button
            className="h-11 w-full rounded-xl bg-gray-100 text-sm font-bold text-gray-600 transition-colors hover:bg-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5d7c6f] focus-visible:ring-offset-2"
            disabled={isEnabling}
            type="button"
            onClick={closePrompt}
          >
            ไว้ภายหลัง
          </button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
