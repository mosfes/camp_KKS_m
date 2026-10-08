"use client";

import { useEffect } from "react";

import { registerPwaServiceWorker } from "@/lib/client-web-push";

export function PwaServiceWorkerRegistration() {
  useEffect(() => {
    let fallbackTimer = 0;
    let idleCallbackId: number | null = null;
    const idleWindow = window as unknown as {
      cancelIdleCallback?: (handle: number) => void;
      requestIdleCallback?: (
        callback: IdleRequestCallback,
        options?: IdleRequestOptions,
      ) => number;
    };
    const register = () => {
      void registerPwaServiceWorker().catch(() => {
        // The application remains usable when service workers are unavailable.
      });
    };

    if (idleWindow.requestIdleCallback) {
      idleCallbackId = idleWindow.requestIdleCallback(register, {
        timeout: 5_000,
      });
    } else {
      fallbackTimer = window.setTimeout(register, 1_000);
    }

    return () => {
      if (idleCallbackId !== null) {
        idleWindow.cancelIdleCallback?.(idleCallbackId);
      }
      window.clearTimeout(fallbackTimer);
    };
  }, []);

  return null;
}
