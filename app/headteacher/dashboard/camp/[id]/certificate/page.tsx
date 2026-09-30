"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import EditCertificateModal from "../../EditCertificateModal";

import { getCleanCampPath } from "@/lib/client-active-camp";

function SkeletonBlock({ className }: { className: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-lg bg-gray-200 ${className}`}
    />
  );
}

function CertificateSkeleton() {
  return (
    <div className="min-h-screen bg-[#f5f5f2] px-4 pb-24 pt-6 sm:px-8">
      <div className="mx-auto max-w-[1440px] space-y-6">
        {/* Page Header Skeleton */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <SkeletonBlock className="h-5 w-5 rounded-md" />
            <SkeletonBlock className="h-6 w-48" />
          </div>
          <SkeletonBlock className="h-4 w-80 max-w-full" />
        </div>

        {/* 2-Column Content Skeleton */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left Column (5 cols) */}
          <div className="space-y-6 lg:col-span-5">
            {/* Card 1: Conditions */}
            <div className="space-y-4 rounded-2xl border border-gray-100 bg-white p-6 shadow-xs">
              <div className="flex items-center gap-3">
                <SkeletonBlock className="h-8 w-8 rounded-full" />
                <div className="space-y-1">
                  <SkeletonBlock className="h-4 w-36" />
                  <SkeletonBlock className="h-3 w-48" />
                </div>
              </div>
              <SkeletonBlock className="h-24 w-full rounded-xl" />
              <SkeletonBlock className="h-14 w-full rounded-xl" />
            </div>

            {/* Card 2: Template Upload */}
            <div className="space-y-4 rounded-2xl border border-gray-100 bg-white p-6 shadow-xs">
              <div className="flex items-center gap-3">
                <SkeletonBlock className="h-8 w-8 rounded-full" />
                <div className="space-y-1">
                  <SkeletonBlock className="h-4 w-36" />
                  <SkeletonBlock className="h-3 w-48" />
                </div>
              </div>
              <SkeletonBlock className="h-28 w-full rounded-xl" />
            </div>
          </div>

          {/* Right Column (7 cols): Certificate Preview */}
          <div className="lg:col-span-7">
            <div className="space-y-4 rounded-2xl border border-gray-100 bg-white p-6 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <SkeletonBlock className="h-4 w-28" />
                  <SkeletonBlock className="h-3 w-40" />
                </div>
                <SkeletonBlock className="h-8 w-32 rounded-lg" />
              </div>
              <SkeletonBlock className="aspect-[1.414/1] w-full rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CertificatePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const campId = Number(params.id);
  const [camp, setCamp] = useState<any>(null);

  const loadCamp = useCallback(() => {
    return fetch(`/api/camps/${campId}?view=certificate`)
      .then((response) => (response.ok ? response.json() : null))
      .then(setCamp);
  }, [campId]);

  useEffect(() => {
    void loadCamp();
  }, [loadCamp]);

  if (!camp) {
    return <CertificateSkeleton />;
  }

  return (
    <EditCertificateModal
      isOpen
      pageMode
      campData={camp}
      onClose={() => router.push(getCleanCampPath())}
      onSuccess={() => void loadCamp()}
    />
  );
}
