/**
 * A parent logs in with the student id ("28661"). Extra accounts that an admin
 * creates for the same student get a suffix ("28661-2", "28661-3", ...).
 */
export type ParentUsername = { studentId: number; accountNo: number };

export function parseParentUsername(value: string): ParentUsername | null {
  const match = /^(\d+)(?:-([2-9]|[1-9]\d+))?$/.exec(value.trim());

  if (!match) return null;
  const studentId = Number(match[1]);
  const accountNo = match[2] ? Number(match[2]) : 1;

  if (
    !Number.isSafeInteger(studentId) ||
    studentId <= 0 ||
    !Number.isSafeInteger(accountNo)
  ) {
    return null;
  }

  return { studentId, accountNo };
}

export function formatParentUsername(studentId: number, accountNo: number) {
  return accountNo > 1 ? `${studentId}-${accountNo}` : String(studentId);
}
