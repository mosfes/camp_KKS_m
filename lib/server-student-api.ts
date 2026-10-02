import "server-only";

import { cache } from "react";

import { GET as getStudentMeRoute } from "@/app/api/auth/student/me/route";
import { GET as getStudentBusRoute } from "@/app/api/student/bus/route";
import { GET as getStudentCampsRoute } from "@/app/api/student/camps/route";
import { GET as getStudentCampRoute } from "@/app/api/student/camps/[id]/route";
import { GET as getStudentCampBusRoute } from "@/app/api/student/camps/[id]/bus/route";
import { GET as getStudentMissionsRoute } from "@/app/api/student/camps/[id]/missions/route";
import { GET as getStudentStationRoute } from "@/app/api/student/camps/[id]/missions/[stationId]/route";
import { GET as getStudentProfileRoute } from "@/app/api/student/profile/route";

async function readJson<T>(response: Response): Promise<T | null> {
  if (!response.ok) return null;

  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function internalRequest(pathname: string) {
  return new Request(`http://student-internal${pathname}`, {
    method: "GET",
  });
}

/**
 * Student page reads run in the current Next.js request instead of fetching
 * this deployment through its public URL. This preserves the existing route
 * response contracts while removing the extra Vercel Function invocation and
 * loopback transfer. Route handlers remain available for client refreshes.
 */
export const getStudentMe = cache(
  async <T>(): Promise<T | null> => readJson<T>(await getStudentMeRoute()),
);

export const getStudentCamps = cache(
  async <T>(): Promise<T | null> => readJson<T>(await getStudentCampsRoute()),
);

export const getStudentBusAssignments = cache(
  async <T>(): Promise<T | null> =>
    readJson<T>(await getStudentBusRoute(internalRequest("/api/student/bus"))),
);

export const getStudentProfile = cache(
  async <T>(): Promise<T | null> => readJson<T>(await getStudentProfileRoute()),
);

export const getStudentCamp = cache(
  async <T>(campId: string): Promise<T | null> =>
    readJson<T>(
      await getStudentCampRoute(
        internalRequest(`/api/student/camps/${campId}`),
        { params: Promise.resolve({ id: campId }) },
      ),
    ),
);

export const getStudentCampBus = cache(
  async <T>(campId: string): Promise<T | null> =>
    readJson<T>(
      await getStudentCampBusRoute(
        internalRequest(`/api/student/camps/${campId}/bus`),
        { params: Promise.resolve({ id: campId }) },
      ),
    ),
);

export const getStudentMissions = cache(
  async <T>(campId: string): Promise<T | null> =>
    readJson<T>(
      await getStudentMissionsRoute(
        internalRequest(`/api/student/camps/${campId}/missions`),
        { params: Promise.resolve({ id: campId }) },
      ),
    ),
);

export const getStudentStation = cache(
  async <T>(campId: string, stationId: string): Promise<T | null> =>
    readJson<T>(
      await getStudentStationRoute(
        internalRequest(`/api/student/camps/${campId}/missions/${stationId}`),
        { params: Promise.resolve({ id: campId, stationId }) },
      ),
    ),
);
