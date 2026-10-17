"use client";

import { useRouter } from "next/navigation";

import TrackingModal from "../../TrackingModal";

import type { TrackerData } from "@/components/camp-location/CampLocationTracker";

export default function LocationClient({
  campId,
  initialData,
}: {
  campId: number;
  initialData: TrackerData | null;
}) {
  const router = useRouter();

  return (
    <TrackingModal
      isOpen
      pageMode
      campId={campId}
      campName=""
      view="location"
      initialLocationData={initialData}
      onClose={() => router.push("/headteacher/dashboard")}
    />
  );
}
