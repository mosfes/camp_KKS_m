"use client";

import { useRouter } from "next/navigation";

import AttendanceModal, { type AttendanceInitialData } from "../../AttendanceModal";

export default function AttendanceClient({
  campId,
  initialData,
}: {
  campId: number;
  initialData: AttendanceInitialData | null;
}) {
  const router = useRouter();

  return (
    <AttendanceModal
      isOpen
      pageMode
      campId={campId}
      initialData={initialData}
      onClose={() => router.push("/headteacher/dashboard")}
    />
  );
}
