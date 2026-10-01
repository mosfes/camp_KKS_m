"use client";

import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";
import { Share, SquarePlus } from "lucide-react";
import { useEffect, useState } from "react";

import { isIosDevice, isStandalonePwa } from "@/lib/client-web-push";

export const IOS_INSTALL_PROMPT_PARAM = "showIosInstall";

export function IosAddToHomeScreenPrompt() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);

    if (url.searchParams.get(IOS_INSTALL_PROMPT_PARAM) !== "1") return;

    url.searchParams.delete(IOS_INSTALL_PROMPT_PARAM);
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );

    if (isIosDevice() && !isStandalonePwa()) {
      setIsOpen(true);
    }
  }, []);

  return (
    <Modal
      backdrop="blur"
      isOpen={isOpen}
      placement="center"
      size="sm"
      onClose={() => setIsOpen(false)}
    >
      <ModalContent className="mx-4 overflow-hidden rounded-3xl">
        <ModalHeader className="flex flex-col items-center gap-3 px-6 pb-2 pt-7 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e8f0ed] text-[#426a5b]">
            <SquarePlus size={28} strokeWidth={2} />
          </span>
          <span className="text-lg font-bold text-gray-900">
            เพิ่ม KKS Camp ไปที่หน้าจอโฮม
          </span>
        </ModalHeader>

        <ModalBody className="gap-3 px-6 py-4">
          <p className="text-center text-sm leading-relaxed text-gray-500">
            เปิดใช้งานได้สะดวกเหมือนแอป และรองรับการแจ้งเตือนบน iPhone
          </p>

          <ol className="space-y-3">
            <li className="flex items-center gap-3 rounded-2xl bg-[#f5f8f6] p-3.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#5d7c6f] text-sm font-bold text-white">
                1
              </span>
              <span className="flex-1 text-sm font-medium leading-relaxed text-gray-700">
                กดปุ่มแชร์
                <Share
                  aria-hidden="true"
                  className="mx-1 inline text-[#3979c3]"
                  size={19}
                />
                ที่แถบเมนูของ Safari
              </span>
            </li>
            <li className="flex items-center gap-3 rounded-2xl bg-[#f5f8f6] p-3.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#5d7c6f] text-sm font-bold text-white">
                2
              </span>
              <span className="text-sm font-medium leading-relaxed text-gray-700">
                เลื่อนลงแล้วเลือก “เพิ่มไปยังหน้าจอโฮม”
              </span>
            </li>
            <li className="flex items-center gap-3 rounded-2xl bg-[#f5f8f6] p-3.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#5d7c6f] text-sm font-bold text-white">
                3
              </span>
              <span className="text-sm font-medium leading-relaxed text-gray-700">
                กด “เพิ่ม” แล้วเปิด KKS Camp จากหน้าจอโฮม
              </span>
            </li>
          </ol>
        </ModalBody>

        <ModalFooter className="px-6 pb-6 pt-2">
          <button
            className="h-11 w-full rounded-xl bg-[#5d7c6f] text-sm font-bold text-white transition-colors hover:bg-[#4e6d61] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5d7c6f] focus-visible:ring-offset-2"
            type="button"
            onClick={() => setIsOpen(false)}
          >
            เข้าใจแล้ว
          </button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
