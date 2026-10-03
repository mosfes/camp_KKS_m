import type { ReactNode } from "react";

import { Suspense } from "react";

import {
  StudentNavbarFallback,
  StudentNavbarServer,
} from "@/components/StudentNavbarServer";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f5f5f0] font-sans">
      <Suspense fallback={<StudentNavbarFallback />}>
        <StudentNavbarServer />
      </Suspense>
      <main>{children}</main>
    </div>
  );
}
