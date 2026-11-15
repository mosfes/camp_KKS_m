"use client";

import { AlertTriangle, CalendarCheck } from "lucide-react";

import {
  describeRegistrationWindows,
  formatThaiDateKey,
  getRegistrationWindowWarnings,
} from "@/lib/camp-registration";

type Props = {
  registrationStartDate?: string | null;
  registrationEndDate?: string | null;
  campStartDate?: string | null;
  campEndDate?: string | null;
};

function toInput(props: Props) {
  return {
    start_regis_date: props.registrationStartDate || null,
    end_regis_date: props.registrationEndDate || null,
    start_date: props.campStartDate || null,
    end_date: props.campEndDate || null,
  };
}

/** คำเตือนช่วงรับสมัครของฟอร์มสร้าง/แก้ไขค่าย (ใช้ตอนกดบันทึก) */
export function registrationFormWarnings(props: Props): string[] {
  return getRegistrationWindowWarnings(toInput(props));
}

/**
 * สรุปให้ครูเห็นว่านักเรียนลงทะเบียนได้วันไหนบ้างจริง ๆ
 * (ระบบให้ลงได้ทั้งช่วงรับสมัครและช่วงจัดค่าย)
 */
export default function RegistrationWindowSummary(props: Props) {
  const input = toInput(props);

  if (!input.start_regis_date || !input.end_regis_date) return null;

  const windows = describeRegistrationWindows(input).filter(
    (window) => window.from && window.to,
  );
  const warnings = getRegistrationWindowWarnings(input);
  const text = windows
    .map((window) =>
      window.from === window.to
        ? formatThaiDateKey(window.from)
        : `${formatThaiDateKey(window.from)} – ${formatThaiDateKey(window.to)}`,
    )
    .join(" และ ");

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2 rounded-xl border border-[#5d7c6f]/20 bg-[#5d7c6f]/5 px-3 py-2.5 text-sm text-[#3f5a4f]">
        <CalendarCheck className="mt-0.5 shrink-0" size={16} />
        <p>
          นักเรียนลงทะเบียนได้: <span className="font-semibold">{text}</span>
          {input.start_date && (
            <span className="block text-xs text-[#5d7c6f]/80">
              (ระบบเปิดให้ลงทะเบียนในวันจัดค่ายด้วย)
            </span>
          )}
        </p>
      </div>
      {warnings.map((warning) => (
        <div
          key={warning}
          className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800"
        >
          <AlertTriangle className="mt-0.5 shrink-0" size={16} />
          <p>{warning}</p>
        </div>
      ))}
    </div>
  );
}
