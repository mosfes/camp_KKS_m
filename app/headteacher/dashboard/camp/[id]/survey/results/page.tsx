"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

import { getCleanCampPath } from "@/lib/client-active-camp";

export default function SurveyResultsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const campId = Number(params.id);

  useEffect(() => {
    if (campId) {
      router.replace(`${getCleanCampPath("survey")}?tab=responses`);
    }
  }, [campId, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f5f2]">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#6b857a] border-t-transparent" />
    </div>
  );
}
