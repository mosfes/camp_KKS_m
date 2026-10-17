"use client";

import { useRouter } from "next/navigation";

import BusManagementModal, { type BusInitialData } from "../../BusManagementModal";

export default function BusCheckinClient({
  campId,
  initialData,
}: {
  campId: number;
  initialData: BusInitialData | null;
}) {
  const router = useRouter();

  return (
    <BusManagementModal
      isOpen
      pageMode
      campId={campId}
      initialData={initialData}
      onClose={() => router.push("/headteacher/dashboard")}
    />
  );
}
