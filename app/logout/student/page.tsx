"use client";

import { useClerk } from "@clerk/nextjs";
import { useEffect } from "react";

import LoadingSpinner from "@/components/LoadingSpinner";

const APP_SESSION_LOGOUT_TIMEOUT_MS = 10_000;

export default function StudentLogoutPage() {
  const { signOut } = useClerk();

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(
      () => controller.abort(),
      APP_SESSION_LOGOUT_TIMEOUT_MS,
    );

    const logout = async () => {
      try {
        const response = await fetch("/api/auth/student/logout", {
          method: "POST",
          cache: "no-store",
          credentials: "same-origin",
          keepalive: true,
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Student logout failed with ${response.status}`);
        }
      } catch {
        // Clerk sign-out below still prevents access to protected student
        // routes if the app-session endpoint is temporarily unavailable.
      } finally {
        window.clearTimeout(timeout);
      }

      try {
        await signOut({ redirectUrl: "/" });
      } catch {
        // The server route also revokes the current Clerk session. Navigating
        // home is therefore safe even if the client SDK is already signed out.
      }

      if (!cancelled) {
        window.location.replace("/");
      }
    };

    void logout();

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [signOut]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f5f2]">
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-gray-100 bg-white p-6 shadow-lg">
        <LoadingSpinner />
        <p className="text-sm font-medium text-[#5d7c6f]">กำลังออกจากระบบ...</p>
      </div>
    </main>
  );
}
