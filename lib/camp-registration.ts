// กติกา "นักเรียนลงทะเบียนค่ายได้ไหม" — ใช้ร่วมกันทั้ง API, หน้านักเรียน และหน้าครู
// ห้ามเขียนเงื่อนไขนี้ซ้ำที่อื่น ไฟล์นี้ต้องไม่มี import ฝั่งเซิร์ฟเวอร์ (ใช้ใน client ได้)
//
// นักเรียนลงทะเบียนได้ใน 2 ช่วง: ช่วงรับสมัคร (start_regis_date..end_regis_date)
// หรือช่วงจัดค่าย (start_date..end_date) นับเป็นวันตามเวลาไทยทั้งวัน
import { getBangkokDateKey } from "@/lib/bangkok-date";

type DateInput = Date | string | number;

export type CampRegistrationInput = {
  status?: string | null;
  start_regis_date?: DateInput | null;
  end_regis_date?: DateInput | null;
  start_date?: DateInput | null;
  end_date?: DateInput | null;
};

export type RegistrationStatus =
  | "not_open" // ยังไม่ถึงวันเปิดรับสมัคร
  | "open" // ลงทะเบียนได้ตอนนี้
  | "paused" // ปิดรับสมัครแล้ว แต่จะลงได้อีกครั้งในวันค่าย
  | "closed" // ค่ายถูกตั้งเป็น CLOSED
  | "ended"; // ค่ายจบแล้ว

export type RegistrationState = {
  status: RegistrationStatus;
  canRegister: boolean;
  /** วันแรกที่ลงได้ (YYYY-MM-DD) ถ้ายังไม่เปิด หรือวันค่ายถ้าพักรับสมัครอยู่ */
  opensOn: string | null;
  /** วันสุดท้ายที่ยังลงได้ (YYYY-MM-DD) เมื่อ status = open */
  lastDay: string | null;
  /** จำนวนวันที่เหลือถึงวันสุดท้าย (0 = วันนี้วันสุดท้าย) เมื่อ status = open */
  daysLeft: number | null;
  /** ข้อความสั้นสำหรับปุ่ม/ป้าย */
  label: string;
  /** ข้อความอธิบายสำหรับนักเรียนเมื่อลงไม่ได้ */
  message: string;
};

/** ช่วงรับสมัครที่สั้นกว่านี้ (วัน) จะถูกเตือนในฟอร์มสร้าง/แก้ไขค่าย */
export const MIN_RECOMMENDED_REGISTRATION_DAYS = 3;

const key = (input?: DateInput | null) =>
  input == null || input === "" ? null : getBangkokDateKey(input);

export function addDateKeyDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00.000Z`);

  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

export function dateKeyDiffDays(fromKey: string, toKey: string): number {
  return Math.round(
    (Date.parse(`${toKey}T00:00:00Z`) - Date.parse(`${fromKey}T00:00:00Z`)) /
      86_400_000,
  );
}

export function formatThaiDateKey(dateKey: string | null): string {
  if (!dateKey) return "";

  return new Date(`${dateKey}T00:00:00.000Z`).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function inRange(today: string, start: string | null, end: string | null) {
  return (!start || start <= today) && (!end || today <= end);
}

/**
 * ช่วงวันที่นักเรียนลงทะเบียนได้จริง (รวมช่วงค่ายถ้าต่อกันหรือซ้อนกัน)
 * ใช้แสดงสรุปในฟอร์มของครู
 */
export function describeRegistrationWindows(camp: CampRegistrationInput) {
  const regisStart = key(camp.start_regis_date);
  const regisEnd = key(camp.end_regis_date);
  const campStart = key(camp.start_date);
  const campEnd = key(camp.end_date);
  const windows: { from: string | null; to: string | null }[] = [];

  if (regisStart || regisEnd) windows.push({ from: regisStart, to: regisEnd });
  if (campStart || campEnd) {
    const last = windows[windows.length - 1];

    if (
      last &&
      last.to &&
      campStart &&
      addDateKeyDays(last.to, 1) >= campStart
    ) {
      if (campEnd && (!last.to || campEnd > last.to)) last.to = campEnd;
    } else {
      windows.push({ from: campStart, to: campEnd });
    }
  }

  return windows;
}

export function getRegistrationState(
  camp: CampRegistrationInput,
  now: DateInput = new Date(),
): RegistrationState {
  const today = getBangkokDateKey(now);
  const regisStart = key(camp.start_regis_date);
  const regisEnd = key(camp.end_regis_date);
  const campStart = key(camp.start_date);
  const campEnd = key(camp.end_date);

  if (campEnd && today > campEnd) {
    return {
      status: "ended",
      canRegister: false,
      opensOn: null,
      lastDay: null,
      daysLeft: null,
      label: "สิ้นสุดการรับสมัครแล้ว",
      message: "ค่ายนี้จบแล้ว",
    };
  }

  if (camp.status && camp.status !== "OPEN") {
    return {
      status: "closed",
      canRegister: false,
      opensOn: null,
      lastDay: null,
      daysLeft: null,
      label: "ปิดรับลงทะเบียน",
      message: "ค่ายนี้ปิดรับลงทะเบียนแล้ว กรุณาติดต่อครูผู้รับผิดชอบค่าย",
    };
  }

  const inRegis = inRange(today, regisStart, regisEnd);
  const inCamp = inRange(today, campStart, campEnd);

  if (inRegis || inCamp) {
    // วันสุดท้ายที่ลงได้ต่อเนื่องจากวันนี้
    let lastDay = inCamp ? campEnd : regisEnd;

    if (
      !inCamp &&
      regisEnd &&
      campStart &&
      addDateKeyDays(regisEnd, 1) >= campStart
    ) {
      lastDay = campEnd;
    }
    const daysLeft = lastDay ? dateKeyDiffDays(today, lastDay) : null;

    return {
      status: "open",
      canRegister: true,
      opensOn: null,
      lastDay,
      daysLeft,
      label:
        daysLeft === 0
          ? "วันสุดท้ายของการรับสมัคร"
          : lastDay
            ? `รับสมัครถึง ${formatThaiDateKey(lastDay)}`
            : "เปิดรับสมัคร",
      message: "",
    };
  }

  if (regisStart && today < regisStart) {
    return {
      status: "not_open",
      canRegister: false,
      opensOn: regisStart,
      lastDay: null,
      daysLeft: null,
      label: `เปิดรับสมัคร ${formatThaiDateKey(regisStart)}`,
      message: `ยังไม่เปิดรับสมัคร เริ่มลงทะเบียนได้วันที่ ${formatThaiDateKey(regisStart)}`,
    };
  }

  // หลังปิดรับสมัคร แต่ค่ายยังไม่เริ่ม: จะลงได้อีกครั้งในวันค่าย
  return {
    status: "paused",
    canRegister: false,
    opensOn: campStart,
    lastDay: null,
    daysLeft: null,
    label: "หมดเขตรับสมัครแล้ว",
    message: campStart
      ? `หมดเขตรับสมัครแล้ว (ปิดรับ ${formatThaiDateKey(regisEnd)}) ลงทะเบียนได้อีกครั้งในวันค่าย ${formatThaiDateKey(campStart)} หรือติดต่อครูผู้รับผิดชอบค่าย`
      : "หมดเขตรับสมัครแล้ว กรุณาติดต่อครูผู้รับผิดชอบค่าย",
  };
}

/** คำเตือนสำหรับฟอร์มของครู (ไม่บล็อกการบันทึก) */
export function getRegistrationWindowWarnings(
  camp: CampRegistrationInput,
  now: DateInput = new Date(),
): string[] {
  const warnings: string[] = [];
  const today = getBangkokDateKey(now);
  const regisStart = key(camp.start_regis_date);
  const regisEnd = key(camp.end_regis_date);
  const campStart = key(camp.start_date);

  if (regisStart && regisEnd) {
    const days = dateKeyDiffDays(regisStart, regisEnd) + 1;

    if (days >= 1 && days < MIN_RECOMMENDED_REGISTRATION_DAYS) {
      warnings.push(
        `ช่วงรับสมัครมีแค่ ${days} วัน นักเรียนที่ไม่ได้เข้าระบบในวันนั้นจะลงทะเบียนไม่ได้ แนะนำอย่างน้อย ${MIN_RECOMMENDED_REGISTRATION_DAYS} วัน`,
      );
    }
  }

  if (regisEnd && regisEnd < today && (!campStart || today < campStart)) {
    warnings.push(
      "วันปิดรับสมัครผ่านไปแล้ว นักเรียนที่ยังไม่ลงทะเบียนจะลงไม่ได้จนถึงวันค่าย",
    );
  }

  if (regisEnd && campStart && addDateKeyDays(regisEnd, 1) < campStart) {
    warnings.push(
      `ระหว่าง ${formatThaiDateKey(addDateKeyDays(regisEnd, 1))} ถึง ${formatThaiDateKey(addDateKeyDays(campStart, -1))} นักเรียนจะลงทะเบียนไม่ได้`,
    );
  }

  return warnings;
}

/** ค่าเริ่มต้นวันปิดรับสมัคร = 1 วันก่อนเริ่มค่าย */
export function defaultRegistrationEndKey(campStartKey: string): string {
  return addDateKeyDays(campStartKey, -1);
}
