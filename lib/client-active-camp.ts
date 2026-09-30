export const CLEAN_CAMP_PATH = "/headteacher/dashboard/camp";

export const ACTIVE_CAMP_COOKIE = "headteacher_active_camp_id";
export const ACTIVE_BASE_COOKIE = "headteacher_active_base_id";
export const ACTIVE_TRACKING_STUDENT_COOKIE =
  "headteacher_active_tracking_student_id";

function rememberNumericCookie(name: string, value: string | number) {
  if (typeof window === "undefined") return;

  const normalizedValue = String(value);

  if (!/^\d+$/.test(normalizedValue)) return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";

  document.cookie = `${name}=${normalizedValue}; Path=${CLEAN_CAMP_PATH}; Max-Age=2592000; SameSite=Lax${secure}`;
}

export function rememberActiveCampId(campId: string | number) {
  rememberNumericCookie(ACTIVE_CAMP_COOKIE, campId);
}

export function rememberActiveBaseId(baseId: string | number) {
  rememberNumericCookie(ACTIVE_BASE_COOKIE, baseId);
}

export function rememberActiveTrackingStudentId(studentId: string | number) {
  rememberNumericCookie(ACTIVE_TRACKING_STUDENT_COOKIE, studentId);
}

export function readActiveCampId() {
  if (typeof window === "undefined") return null;

  const value = document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${ACTIVE_CAMP_COOKIE}=`))
    ?.split("=")[1];

  return value && /^\d+$/.test(value) ? value : null;
}

export function getCleanCampPath(page = "overview") {
  return `${CLEAN_CAMP_PATH}/${page}`;
}

export function getCleanBasePath() {
  return getCleanCampPath("base");
}

export function getCleanTrackingStudentPath() {
  return getCleanCampPath("tracking/student");
}
