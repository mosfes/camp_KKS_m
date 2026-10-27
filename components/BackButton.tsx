"use client";

import type { ReactNode } from "react";

import { useRouter } from "next/navigation";

export default function BackButton({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const router = useRouter();

  return (
    <button
      className={className}
      type="button"
      onClick={() => {
        if (window.history.length > 1) {
          router.back();
        } else {
          router.push("/");
        }
      }}
    >
      {children}
    </button>
  );
}
