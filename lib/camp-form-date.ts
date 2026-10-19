import { parseDate } from "@internationalized/date";

export function isCompleteCampDate(value: string): boolean {
  // A partially typed year (2, 20, 202) is not a completed camp date.
  if (!/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value)) return false;

  try {
    parseDate(value);

    return true;
  } catch {
    return false;
  }
}

export function getShirtReservationDateError(
  startDate: string,
  endDate: string,
  campStartDate: string,
): string {
  if (!startDate || !endDate) return "กรุณาเลือกช่วงเวลาจองเสื้อให้ครบ";
  if (!isCompleteCampDate(startDate) || !isCompleteCampDate(endDate)) {
    return "กรุณากรอกวันที่ให้ถูกต้อง และปี ค.ศ. ให้ครบ 4 หลัก";
  }
  if (startDate > endDate) {
    return "วันสิ้นสุดจองเสื้อ ต้องไม่ก่อน วันเริ่มจองเสื้อ";
  }
  if (campStartDate && endDate >= campStartDate) {
    return "วันสิ้นสุดจองเสื้อ ต้องมาก่อน วันเริ่มค่าย";
  }

  return "";
}

export function getCampFormDayCount(
  startDate: string,
  endDate: string,
): number {
  if (!isCompleteCampDate(startDate) || !isCompleteCampDate(endDate)) return 0;

  const start = parseDate(startDate);
  const end = parseDate(endDate);

  if (end.compare(start) < 0) return 0;

  return (
    (end.toDate("UTC").getTime() - start.toDate("UTC").getTime()) / 86_400_000 +
    1
  );
}
