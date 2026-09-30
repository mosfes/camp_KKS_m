"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { getCleanCampPath } from "@/lib/client-active-camp";

export interface BreadcrumbItem {
  label: string;
  href?: string;
  onClick?: () => void;
}

export interface CampBreadcrumbProps {
  campId?: number | string;
  campName?: string | null;
  currentPage?: string;
  items?: BreadcrumbItem[];
  className?: string;
}

export default function CampBreadcrumb({
  campId,
  campName: initialCampName,
  currentPage,
  items,
  className = "",
}: CampBreadcrumbProps) {
  const router = useRouter();
  const [campName, setCampName] = useState<string | null>(
    initialCampName || null,
  );

  useEffect(() => {
    if (initialCampName) {
      setCampName(initialCampName);
    } else if (campId && !campName) {
      fetch(`/api/camps/${campId}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.name) setCampName(data.name);
        })
        .catch(() => {});
    }
  }, [campId, initialCampName, campName]);

  // If custom items are provided, render custom items
  if (items && items.length > 0) {
    return (
      <nav
        aria-label="Breadcrumb"
        className={`flex items-center gap-1.5 text-xs text-gray-500 sm:gap-2 max-w-full overflow-hidden ${className}`}
      >
        <button
          className="inline-flex shrink-0 items-center gap-1 font-normal text-gray-600 transition-colors hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6b857a] rounded-sm whitespace-nowrap"
          type="button"
          onClick={() => router.push("/headteacher/dashboard")}
        >
          หน้าหลัก
        </button>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <React.Fragment key={index}>
              <span className="shrink-0 text-gray-300 select-none">/</span>
              {isLast || (!item.href && !item.onClick) ? (
                <span
                  className="font-medium text-[#6b857a] truncate max-w-[120px] sm:max-w-[200px] md:max-w-none"
                  title={item.label}
                >
                  {item.label}
                </span>
              ) : (
                <button
                  className="font-normal text-gray-600 transition-colors hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6b857a] rounded-sm truncate max-w-[100px] sm:max-w-[180px] md:max-w-[260px] text-left"
                  title={item.label}
                  type="button"
                  onClick={() => {
                    if (item.onClick) item.onClick();
                    else if (item.href) router.push(item.href);
                  }}
                >
                  {item.label}
                </button>
              )}
            </React.Fragment>
          );
        })}
      </nav>
    );
  }

  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex items-center gap-1.5 text-xs text-gray-500 sm:gap-2 max-w-full overflow-hidden ${className}`}
    >
      <button
        className="inline-flex shrink-0 items-center gap-1 font-normal text-gray-600 transition-colors hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6b857a] rounded-sm whitespace-nowrap"
        type="button"
        onClick={() => router.push("/headteacher/dashboard")}
      >
        หน้าหลัก
      </button>

      {campId && (
        <>
          <span className="shrink-0 text-gray-300 select-none">/</span>
          <button
            className="font-normal text-gray-600 transition-colors hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6b857a] rounded-sm truncate max-w-[120px] sm:max-w-[200px] md:max-w-[320px] lg:max-w-md text-left"
            title={campName ? `ค่าย: ${campName}` : "รายละเอียดค่าย"}
            type="button"
            onClick={() => router.push(getCleanCampPath())}
          >
            {campName ? `ค่าย: ${campName}` : "รายละเอียดค่าย"}
          </button>
        </>
      )}

      {currentPage && (
        <>
          <span className="shrink-0 text-gray-300 select-none">/</span>
          <span
            className="font-medium text-[#6b857a] truncate max-w-[120px] sm:max-w-[200px] md:max-w-none"
            title={currentPage}
          >
            {currentPage}
          </span>
        </>
      )}
    </nav>
  );
}
