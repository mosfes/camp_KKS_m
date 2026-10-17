"use client";

import { useRouter } from "next/navigation";

import ShirtTrackingModal, { type ShirtTrackingData } from "../../ShirtTrackingModal";

export default function ShirtsClient({
  campId,
  initialData,
}: {
  campId: number;
  initialData: ShirtTrackingData | null;
}) {
  const router = useRouter();

  return (
    <ShirtTrackingModal
      isOpen
      pageMode
      campId={campId}
      campName=""
      initialData={initialData}
      onClose={() => router.push("/headteacher/dashboard")}
    />
  );
}
