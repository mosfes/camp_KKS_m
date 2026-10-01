"use client";

import { useEffect } from "react";

import { registerPwaServiceWorker } from "@/lib/client-web-push";

export function PwaServiceWorkerRegistration() {
  useEffect(() => {
    void registerPwaServiceWorker().catch(() => {
      // The application remains usable when service workers are unavailable.
    });
  }, []);

  return null;
}
