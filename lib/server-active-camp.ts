import type { NextResponse } from "next/server";

import {
  ACTIVE_BASE_COOKIE,
  ACTIVE_CAMP_COOKIE,
  ACTIVE_TRACKING_STUDENT_COOKIE,
  CLEAN_CAMP_PATH,
} from "@/lib/client-active-camp";

/** Forget camp navigation state when the authenticated account changes. */
export function clearActiveCampCookies(response: NextResponse) {
  for (const name of [
    ACTIVE_CAMP_COOKIE,
    ACTIVE_BASE_COOKIE,
    ACTIVE_TRACKING_STUDENT_COOKIE,
  ]) {
    response.cookies.set(name, "", {
      path: CLEAN_CAMP_PATH,
      maxAge: 0,
    });
  }

  return response;
}
