"use client";

import type { CalendarOnlyDateRangePickerProps } from "@/components/CalendarOnlyDateFields";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

const DateRangePicker = dynamic(() => import("./DocumentDateRangePicker"), {
  ssr: false,
});

export default function DeferredDateRangePicker(
  props: CalendarOnlyDateRangePickerProps,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [nearViewport, setNearViewport] = useState(false);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) return;

    if (!("IntersectionObserver" in window)) {
      setNearViewport(true);

      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setNearViewport(true);
          observer.disconnect();
        }
      },
      { rootMargin: "1200px" },
    );

    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="min-h-11 w-full">
      {nearViewport && <DateRangePicker {...props} />}
    </div>
  );
}
