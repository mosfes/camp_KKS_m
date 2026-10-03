"use client";

import { useClerk } from "@clerk/nextjs";
import { useEffect } from "react";

import LoadingSpinner from "@/components/LoadingSpinner";

export default function StudentLogoutPage() {
  const { signOut } = useClerk();

  useEffect(() => {
    const fallback = window.setTimeout(() => {
      window.location.replace("/");
    }, 8_000);

    void signOut().then(
      () => window.location.replace("/"),
      () => window.location.replace("/"),
    );

    return () => window.clearTimeout(fallback);
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
