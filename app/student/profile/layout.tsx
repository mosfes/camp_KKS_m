import type { ReactNode } from "react";

import { Suspense } from "react";

import {
  StudentNavbarFallback,
  StudentNavbarServer,
} from "@/components/StudentNavbarServer";

export default function ProfileLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className="min-h-screen bg-[#f5f5f2]"
      style={{ fontFamily: 'Arial, "Noto Sans Thai", Tahoma, sans-serif' }}
    >
      <Suspense fallback={<StudentNavbarFallback />}>
        <StudentNavbarServer />
      </Suspense>
      <main>{children}</main>
    </div>
  );
}
