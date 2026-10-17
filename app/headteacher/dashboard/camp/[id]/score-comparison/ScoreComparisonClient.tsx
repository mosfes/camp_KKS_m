"use client";

import { useRouter } from "next/navigation";

import PrePostTestModal from "../../PrePostTestModal";

export default function ScoreComparisonClient({
  campId,
  initialPairs,
}: {
  campId: number;
  initialPairs: unknown;
}) {
  const router = useRouter();

  return (
    <PrePostTestModal
      isOpen
      pageMode
      campId={campId}
      initialPairs={initialPairs}
      onClose={() => router.push("/headteacher/dashboard")}
    />
  );
}
