"use client";

import dynamic from "next/dynamic";
import { Bell } from "lucide-react";
import { useEffect, useState } from "react";

const AddToHomeScreenPrompt = dynamic(
  () =>
    import("@/components/student/AddToHomeScreenPrompt").then(
      (module) => module.AddToHomeScreenPrompt,
    ),
  { ssr: false },
);

const StudentNotificationCenter = dynamic(
  () =>
    import("@/components/student/StudentNotificationCenter").then(
      (module) => module.StudentNotificationCenter,
    ),
  { ssr: false },
);

const StudentPushPermissionPrompt = dynamic(
  () =>
    import("@/components/student/StudentPushPermissionPrompt").then(
      (module) => module.StudentPushPermissionPrompt,
    ),
  { ssr: false },
);

export function StudentDeferredEnhancements({
  studentId,
}: {
  studentId: number | null;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let fallbackTimer = 0;
    const activate = () => {
      window.clearTimeout(fallbackTimer);
      window.removeEventListener("pointerdown", activate);
      window.removeEventListener("keydown", activate);
      setReady(true);
    };

    // These helpers are not needed for the first paint. Load them when the
    // student first interacts, or after the critical rendering window has
    // passed, so their parsing cannot interrupt LCP/TBT.
    fallbackTimer = window.setTimeout(activate, 5_000);
    window.addEventListener("pointerdown", activate, { once: true });
    window.addEventListener("keydown", activate, { once: true });

    return () => {
      window.clearTimeout(fallbackTimer);
      window.removeEventListener("pointerdown", activate);
      window.removeEventListener("keydown", activate);
    };
  }, []);

  if (!ready) {
    return (
      <span
        aria-hidden="true"
        className="flex h-9 w-9 items-center justify-center rounded-full text-gray-400"
      >
        <Bell size={20} />
      </span>
    );
  }

  return (
    <>
      <AddToHomeScreenPrompt />
      <StudentPushPermissionPrompt studentId={studentId} />
      <StudentNotificationCenter studentId={studentId} />
    </>
  );
}
