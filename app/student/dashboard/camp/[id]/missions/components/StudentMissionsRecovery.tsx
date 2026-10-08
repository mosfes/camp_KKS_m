"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";

import StudentMissionsSkeleton from "./StudentMissionsSkeleton";

import { isBangkokDateBefore } from "@/lib/bangkok-date";

interface StudentMissionsRecoveryProps {
  campId: string;
  onRecovered: (camp: any) => void;
}

export default function StudentMissionsRecovery({
  campId,
  onRecovered,
}: StudentMissionsRecoveryProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const fetchCamp = async () => {
      try {
        const campRes = await fetch(`/api/student/camps/${campId}/missions`, {
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache",
            Pragma: "no-cache",
          },
        });

        if (!active) return;

        if (campRes.ok) {
          const found = await campRes.json();

          if (!active) return;

          if (found) {
            if (!found.isRegistered) {
              toast.error("กรุณาลงทะเบียนเข้าร่วมค่ายก่อนเข้าถึงหน้าภารกิจ");
              router.replace(`/student/dashboard/camp/${campId}`);

              return;
            }

            const startDate = found.rawStartDate
              ? new Date(found.rawStartDate)
              : null;

            if (startDate && isBangkokDateBefore(new Date(), startDate)) {
              toast.error("ค่ายยังไม่เริ่ม ไม่สามารถทำภารกิจได้");
              router.replace(`/student/dashboard/camp/${campId}`);

              return;
            }

            onRecovered(found);
          } else {
            toast.error("ไม่พบค่าย");
          }
        } else if (campRes.status === 403) {
          const errorData = await campRes.json().catch(() => null);

          if (!active) return;

          toast.error(
            errorData?.error || "ค่ายยังไม่เริ่ม ไม่สามารถทำภารกิจได้",
          );
          router.replace(`/student/dashboard/camp/${campId}`);
        }
      } catch (error) {
        if (!active) return;

        console.error("Failed to fetch camp", error);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchCamp();

    return () => {
      active = false;
    };
  }, [campId, onRecovered, router]);

  if (loading) return <StudentMissionsSkeleton />;

  return (
    <div className="p-8 text-center bg-[#f5f5f2] min-h-screen flex items-center justify-center">
      <div className="text-gray-400 font-medium">ไม่พบค่าย</div>
    </div>
  );
}
