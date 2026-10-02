"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

export function StudentPromptDialog({
  children,
  isOpen,
  label,
  onClose,
}: {
  children: React.ReactNode;
  isOpen: boolean;
  label: string;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        aria-label={label}
        aria-modal="true"
        className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl"
        role="dialog"
      >
        <button
          aria-label="ปิด"
          className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-lg text-gray-500 transition-colors hover:bg-gray-200"
          type="button"
          onClick={onClose}
        >
          ×
        </button>
        {children}
      </div>
    </div>,
    document.body,
  );
}
