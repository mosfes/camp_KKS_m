"use client";

import type { MapPoint } from "./CampLocationMap";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import dynamic from "next/dynamic";
import { Avatar } from "@heroui/avatar";
import { Pagination } from "@heroui/pagination";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  LocateFixed,
  MapPin,
  Navigation,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";

import { BANGKOK_TIME_ZONE } from "@/lib/bangkok-date";
import {
  computeGoogleDrivingRoute,
  reverseGeocodeThaiAdministrativeArea,
  searchGooglePlaces,
} from "@/lib/google-maps-client";
import CampDestinationCard from "@/components/camp-location/CampDestinationCard";

const CampLocationMap = dynamic(() => import("./CampLocationMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full animate-pulse items-center justify-center bg-slate-100 text-sm text-slate-400">
      กำลังโหลดแผนที่...
    </div>
  ),
});

interface Destination extends MapPoint {
  name: string;
  address?: string | null;
}

interface LocationUpdate extends MapPoint {
  accuracy?: number | null;
  recorded_at: string;
}

interface StudentLocation {
  studentId: number;
  name: string;
  nickname: string | null;
  profileImageUrl: string | null;
  initials: string;
  sharingEnabled: boolean;
  latest: LocationUpdate | null;
}

export interface TrackerData {
  destination: Destination | null;
  sharingEnabled: boolean;
  studentSharingEnabled: boolean;
  updateIntervalMinutes: 5 | 10;
  students: StudentLocation[];
  viewerPath: LocationUpdate[];
  permissions: {
    canConfigure: boolean;
    canSubmitStudentLocation: boolean;
    canManageStudentSharing: boolean;
  };
  privacy: {
    noticeVersion: string;
    purpose: string;
    recipients: string;
    retention: string;
    requiresGuardianConsent: boolean;
  };
  trackingLabel: string;
}

interface PlaceResult extends Destination {
  id: string;
}

interface StudentRouteSummary {
  path: MapPoint[];
  distanceMeters: number;
  durationMillis: number | null;
  calculatedAt: string;
  origin: MapPoint;
  destination: MapPoint;
  source: "google" | "straight";
  administrativeArea: string | null;
}

interface StudentAdministrativeAreaCache {
  administrativeArea: string | null;
  resolvedAt: string;
  origin: MapPoint;
}

const SEARCH_COOLDOWN_SECONDS = 3;
const SEARCH_CACHE_LIMIT = 20;
const ROUTE_CACHE_MAX_AGE_MS = 15 * 60_000;
const ROUTE_ORIGIN_REUSE_DISTANCE_METERS = 500;
const ROUTE_DESTINATION_REUSE_DISTANCE_METERS = 50;
const ROUTE_REFRESH_COOLDOWN_MS = 60_000;
const ADMINISTRATIVE_AREA_CACHE_MAX_AGE_MS = 15 * 60_000;
const ADMINISTRATIVE_AREA_FAILURE_CACHE_MAX_AGE_MS = 60_000;
const ADMINISTRATIVE_AREA_REUSE_DISTANCE_METERS = 500;

function distanceBetweenPoints(a: MapPoint, b: MapPoint) {
  const earthRadiusMeters = 6_371_000;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = toRadians(b.latitude - a.latitude);
  const longitudeDelta = toRadians(b.longitude - a.longitude);
  const latitudeA = toRadians(a.latitude);
  const latitudeB = toRadians(b.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitudeA) *
      Math.cos(latitudeB) *
      Math.sin(longitudeDelta / 2) ** 2;
  const normalizedHaversine = Math.min(1, Math.max(0, haversine));

  return (
    earthRadiusMeters *
    2 *
    Math.atan2(
      Math.sqrt(normalizedHaversine),
      Math.sqrt(1 - normalizedHaversine),
    )
  );
}

function formatRouteDistance(distanceMeters: number) {
  if (distanceMeters < 1_000) {
    return `${Math.max(0, Math.round(distanceMeters / 10) * 10).toLocaleString(
      "th-TH",
    )} เมตร`;
  }

  return `${(distanceMeters / 1_000).toLocaleString("th-TH", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} กม.`;
}

function formatRouteDuration(durationMillis: number | null) {
  if (durationMillis == null || !Number.isFinite(durationMillis)) return null;

  const totalMinutes = Math.max(1, Math.round(durationMillis / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (!hours) return `ประมาณ ${minutes} นาที`;
  if (!minutes) return `ประมาณ ${hours} ชม.`;

  return `ประมาณ ${hours} ชม. ${minutes} นาที`;
}

function formatRouteDetail(route: StudentRouteSummary) {
  if (route.source === "straight") return "ระยะเส้นตรงโดยประมาณ";

  return formatRouteDuration(route.durationMillis) || "เส้นทางตามถนน";
}

function routeCacheKey(campId: number) {
  return `camp-student-route-v2:${campId}`;
}

function isValidMapPoint(point: MapPoint | null | undefined) {
  return (
    point != null &&
    Number.isFinite(point.latitude) &&
    point.latitude >= -90 &&
    point.latitude <= 90 &&
    Number.isFinite(point.longitude) &&
    point.longitude >= -180 &&
    point.longitude <= 180
  );
}

function administrativeAreaCacheKey(campId: number) {
  return `camp-student-administrative-area-v1:${campId}`;
}

function readCachedAdministrativeArea(campId: number) {
  try {
    const raw = window.localStorage.getItem(administrativeAreaCacheKey(campId));

    if (!raw) return null;

    const cached = JSON.parse(raw) as StudentAdministrativeAreaCache;

    if (
      !cached ||
      !isValidMapPoint(cached.origin) ||
      !cached.resolvedAt ||
      (cached.administrativeArea != null &&
        typeof cached.administrativeArea !== "string")
    ) {
      return null;
    }

    return cached;
  } catch {
    return null;
  }
}

function saveCachedAdministrativeArea(
  campId: number,
  cache: StudentAdministrativeAreaCache,
) {
  try {
    window.localStorage.setItem(
      administrativeAreaCacheKey(campId),
      JSON.stringify(cache),
    );
  } catch {
    // ยังแสดงชื่อพื้นที่ได้ตามปกติ แม้เบราว์เซอร์จะปิด localStorage
  }
}

function canReuseCachedAdministrativeArea(
  cached: StudentAdministrativeAreaCache,
  origin: MapPoint,
) {
  const resolvedAt = new Date(cached.resolvedAt).getTime();
  const maxAge =
    cached.administrativeArea == null
      ? ADMINISTRATIVE_AREA_FAILURE_CACHE_MAX_AGE_MS
      : ADMINISTRATIVE_AREA_CACHE_MAX_AGE_MS;

  return (
    Number.isFinite(resolvedAt) &&
    Date.now() - resolvedAt <= maxAge &&
    distanceBetweenPoints(cached.origin, origin) <=
      ADMINISTRATIVE_AREA_REUSE_DISTANCE_METERS
  );
}

function readCachedRoute(campId: number) {
  try {
    const raw = window.localStorage.getItem(routeCacheKey(campId));

    if (!raw) return null;

    const cached = JSON.parse(raw) as StudentRouteSummary;

    if (
      !cached ||
      !Array.isArray(cached.path) ||
      !cached.path.length ||
      !cached.path.every(isValidMapPoint) ||
      !Number.isFinite(cached.distanceMeters) ||
      !cached.calculatedAt ||
      !isValidMapPoint(cached.origin) ||
      !isValidMapPoint(cached.destination) ||
      !["google", "straight"].includes(cached.source)
    ) {
      return null;
    }

    return cached;
  } catch {
    return null;
  }
}

function saveCachedRoute(campId: number, route: StudentRouteSummary) {
  try {
    window.localStorage.setItem(routeCacheKey(campId), JSON.stringify(route));
  } catch {
    // ยังแสดงเส้นทางได้ตามปกติ แม้เบราว์เซอร์จะปิด localStorage
  }
}

function canReuseCachedRoute(
  cached: StudentRouteSummary,
  origin: MapPoint,
  destination: MapPoint,
) {
  const calculatedAt = new Date(cached.calculatedAt).getTime();

  return (
    Number.isFinite(calculatedAt) &&
    Date.now() - calculatedAt <= ROUTE_CACHE_MAX_AGE_MS &&
    distanceBetweenPoints(cached.origin, origin) <=
      ROUTE_ORIGIN_REUSE_DISTANCE_METERS &&
    distanceBetweenPoints(cached.destination, destination) <=
      ROUTE_DESTINATION_REUSE_DISTANCE_METERS
  );
}

function placeSearchError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const normalized = message.toLowerCase();
  const isRateLimited = [
    "quota",
    "rate limit",
    "resource_exhausted",
    "over_query_limit",
    "too many requests",
  ].some((keyword) => normalized.includes(keyword));

  return isRateLimited
    ? "ค้นหาถี่เกินไป กรุณารอสักครู่แล้วลองใหม่"
    : message || "ค้นหาสถานที่ไม่สำเร็จ";
}

interface CampLocationTrackerProps {
  campId: number;
  studentId?: number;
  viewer: "teacher" | "student" | "parent";
  configureDestination?: boolean;
  showDestination?: boolean;
  initialData?: TrackerData | null;
}

function thaiDateTime(value?: string | null) {
  if (!value) return "ยังไม่มีข้อมูล";

  return new Date(value).toLocaleString("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: BANGKOK_TIME_ZONE,
  });
}

function minutesSince(value: string) {
  return Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 60_000),
  );
}

function formatCoordinates(point: MapPoint) {
  return `${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}`;
}

function LocationSkeletonBlock({ className }: { className: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-lg bg-gray-200 ${className}`}
    />
  );
}

function LocationTrackerSkeleton({ showMap }: { showMap: boolean }) {
  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      {showMap && (
        <LocationSkeletonBlock className="h-[420px] w-full rounded-none sm:h-[520px] lg:h-[58vh] lg:min-h-[560px]" />
      )}

      <div className="space-y-4 p-4">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 p-4">
          <div className="space-y-2">
            <LocationSkeletonBlock className="h-4 w-40" />
            <LocationSkeletonBlock className="h-3 w-64 max-w-full" />
          </div>
          <div className="flex gap-2">
            <LocationSkeletonBlock className="h-6 w-20 rounded-full" />
            <LocationSkeletonBlock className="h-6 w-20 rounded-full" />
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 p-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <LocationSkeletonBlock className="h-4 w-36" />
            <LocationSkeletonBlock className="h-3 w-24" />
          </div>
          <div className="grid gap-3 py-4 sm:grid-cols-2">
            {Array.from({ length: 4 }, (_, index) => (
              <div
                key={index}
                className="flex items-center gap-3 rounded-xl border border-gray-100 p-3"
              >
                <LocationSkeletonBlock className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <LocationSkeletonBlock className="h-3 w-28" />
                  <LocationSkeletonBlock className="h-2.5 w-20" />
                </div>
                <LocationSkeletonBlock className="h-5 w-16 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

async function responseError(response: Response) {
  const body = await response.json().catch(() => null);

  return body?.error || "เกิดข้อผิดพลาด กรุณาลองใหม่";
}

export default function CampLocationTracker({
  campId,
  studentId,
  viewer,
  configureDestination = true,
  showDestination = true,
  initialData,
}: CampLocationTrackerProps) {
  const locationUrl = `/api/camps/${campId}/location${viewer === "parent" && studentId ? `?studentId=${studentId}` : ""}`;
  const initialDataPendingRef = useRef(Boolean(initialData));
  const [data, setData] = useState<TrackerData | null>(initialData || null);
  const [draftDestination, setDraftDestination] = useState<Destination | null>(
    initialData?.destination || null,
  );
  const [destinationConfirmed, setDestinationConfirmed] = useState(Boolean(initialData?.destination));
  const [sharingEnabled, setSharingEnabled] = useState(Boolean(initialData?.sharingEnabled));
  const [loading, setLoading] = useState(!initialData);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmingDestination, setConfirmingDestination] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [savingStudentSharing, setSavingStudentSharing] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchCooldownSeconds, setSearchCooldownSeconds] = useState(0);
  const [places, setPlaces] = useState<PlaceResult[]>([]);
  const [selectedMapStudentId, setSelectedMapStudentId] = useState<
    number | null
  >(null);
  const [studentMapVisible, setStudentMapVisible] = useState(false);
  const [studentRoute, setStudentRoute] = useState<StudentRouteSummary | null>(
    null,
  );
  const [studentRouteLoading, setStudentRouteLoading] = useState(false);
  const [studentRouteNotice, setStudentRouteNotice] = useState("");
  const [studentAdministrativeArea, setStudentAdministrativeArea] = useState<
    string | null
  >(null);
  const [
    studentAdministrativeAreaLoading,
    setStudentAdministrativeAreaLoading,
  ] = useState(false);
  const [
    studentAdministrativeAreaResolved,
    setStudentAdministrativeAreaResolved,
  ] = useState(false);
  const [teacherSearchQuery, setTeacherSearchQuery] = useState("");
  const [teacherStatusFilter, setTeacherStatusFilter] = useState<
    "all" | "has_location" | "no_location"
  >("all");
  const [teacherPage, setTeacherPage] = useState(1);
  const TEACHER_PAGE_SIZE = 10;

  const autoStartedRef = useRef(false);
  const publishingRef = useRef(false);
  const lastRouteRequestAtRef = useRef(0);
  const administrativeAreaLookupRef = useRef<{
    signature: string;
    promise: Promise<string | null>;
  } | null>(null);
  const searchCacheRef = useRef(new Map<string, PlaceResult[]>());

  useEffect(() => {
    setTeacherPage(1);
  }, [teacherSearchQuery, teacherStatusFilter]);

  useEffect(() => {
    if (searchCooldownSeconds <= 0) return;

    const timer = window.setTimeout(() => {
      setSearchCooldownSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1_000);

    return () => window.clearTimeout(timer);
  }, [searchCooldownSeconds]);

  const fetchLocation = useCallback(
    async ({
      showLoader = false,
      syncSettings = false,
    }: {
      showLoader?: boolean;
      syncSettings?: boolean;
    } = {}) => {
      if (showLoader) setLoading(true);

      try {
        const response = await fetch(locationUrl, {
          cache: "no-store",
        });

        if (!response.ok) throw new Error(await responseError(response));

        const nextData: TrackerData = await response.json();

        setData(nextData);
        setLoadError("");

        // การ poll ข้อมูลล่าสุดต้องไม่เขียนทับค่าที่ครูกำลังแก้แต่ยังไม่ได้บันทึก
        if (syncSettings) {
          setDraftDestination(nextData.destination);
          setDestinationConfirmed(Boolean(nextData.destination));
          setSharingEnabled(nextData.sharingEnabled);
        }
      } catch (error) {
        setLoadError(
          error instanceof Error ? error.message : "โหลดตำแหน่งไม่สำเร็จ",
        );
      } finally {
        setLoading(false);
      }
    },
    [locationUrl],
  );

  useEffect(() => {
    if (initialDataPendingRef.current) {
      initialDataPendingRef.current = false;
    } else {
      void fetchLocation({ showLoader: true, syncSettings: true });
    }
  }, [fetchLocation]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void fetchLocation();
    }, 60_000);

    return () => window.clearInterval(timer);
  }, [fetchLocation]);

  const publishStudentLocation = useCallback(
    async (showSuccess = true) => {
      if (!navigator.geolocation || publishingRef.current) {
        if (!navigator.geolocation) {
          setMessage({ type: "error", text: "เบราว์เซอร์นี้ไม่รองรับ GPS" });
        }

        return;
      }

      publishingRef.current = true;
      setPublishing(true);
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const response = await fetch(locationUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
              }),
            });

            if (!response.ok) throw new Error(await responseError(response));
            if (showSuccess) {
              setMessage({
                type: "success",
                text: "อัปเดตตำแหน่งของนักเรียนแล้ว",
              });
            }
            await fetchLocation();
          } catch (error) {
            setMessage({
              type: "error",
              text:
                error instanceof Error ? error.message : "อัปเดต GPS ไม่สำเร็จ",
            });
          } finally {
            publishingRef.current = false;
            setPublishing(false);
          }
        },
        (error) => {
          const text =
            error.code === error.PERMISSION_DENIED
              ? "กรุณาอนุญาตการเข้าถึงตำแหน่งในเบราว์เซอร์"
              : "ไม่สามารถอ่านตำแหน่ง GPS ได้ กรุณาลองใหม่ในพื้นที่สัญญาณชัดเจน";

          setMessage({ type: "error", text });
          publishingRef.current = false;
          setPublishing(false);
        },
        { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
      );
    },
    [locationUrl, fetchLocation],
  );

  useEffect(() => {
    if (
      viewer !== "student" ||
      !data?.sharingEnabled ||
      !data.studentSharingEnabled ||
      !data.permissions.canSubmitStudentLocation
    ) {
      autoStartedRef.current = false;

      return;
    }

    if (!autoStartedRef.current) {
      autoStartedRef.current = true;
      void publishStudentLocation(false);
    }

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void publishStudentLocation(false);
      }
    }, data.updateIntervalMinutes * 60_000);

    return () => window.clearInterval(timer);
  }, [
    data?.sharingEnabled,
    data?.studentSharingEnabled,
    data?.updateIntervalMinutes,
    data?.permissions.canSubmitStudentLocation,
    publishStudentLocation,
    viewer,
  ]);

  async function setStudentSharing(enabled: boolean) {
    setSavingStudentSharing(true);
    setMessage(null);

    try {
      const response = await fetch(locationUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled,
          ...(enabled && { noticeVersion: data?.privacy.noticeVersion }),
        }),
      });

      if (!response.ok) throw new Error(await responseError(response));

      autoStartedRef.current = false;
      setData((current) =>
        current
          ? {
              ...current,
              studentSharingEnabled: enabled,
              students: current.students.map((student) => ({
                ...student,
                sharingEnabled: enabled,
              })),
            }
          : current,
      );
      setMessage({
        type: "success",
        text: enabled
          ? "เปิดแชร์ตำแหน่งแล้ว"
          : "ปิดแชร์ตำแหน่งแล้ว ระบบจะหยุดส่ง GPS",
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "บันทึกไม่สำเร็จ",
      });
    } finally {
      setSavingStudentSharing(false);
    }
  }

  async function searchPlaces(event: FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    const cacheKey = trimmed.toLocaleLowerCase("th-TH");

    if (trimmed.length < 2 || searchCooldownSeconds > 0) return;

    const cachedPlaces = searchCacheRef.current.get(cacheKey);

    if (cachedPlaces) {
      setPlaces(cachedPlaces);

      setMessage(
        cachedPlaces.length
          ? null
          : {
              type: "error",
              text: "ไม่พบสถานที่ ลองระบุจังหวัดหรืออำเภอเพิ่ม",
            },
      );

      return;
    }

    setSearching(true);
    setPlaces([]);
    setMessage(null);

    try {
      const nextPlaces = await searchGooglePlaces(trimmed);

      if (searchCacheRef.current.size >= SEARCH_CACHE_LIMIT) {
        const oldestQuery = searchCacheRef.current.keys().next().value;

        if (oldestQuery) searchCacheRef.current.delete(oldestQuery);
      }

      searchCacheRef.current.set(cacheKey, nextPlaces);

      setPlaces(nextPlaces);

      if (!nextPlaces.length) {
        setMessage({
          type: "error",
          text: "ไม่พบสถานที่ ลองระบุจังหวัดหรืออำเภอเพิ่ม",
        });
      }
    } catch (error) {
      setMessage({
        type: "error",
        text: placeSearchError(error),
      });
    } finally {
      setSearching(false);
      setSearchCooldownSeconds(SEARCH_COOLDOWN_SECONDS);
    }
  }

  async function saveSettings(nextSharingEnabled: boolean = sharingEnabled) {
    if (!draftDestination) {
      setMessage({
        type: "error",
        text: "กรุณาค้นหาหรือคลิกแผนที่เพื่อปักหมุดจุดหมาย",
      });

      return;
    }

    if (!destinationConfirmed) {
      setMessage({ type: "error", text: "กรุณายืนยันหมุดจุดหมายก่อนบันทึก" });

      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch(locationUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination: draftDestination,
          sharingEnabled: nextSharingEnabled,
        }),
      });

      if (!response.ok) throw new Error(await responseError(response));
      setMessage({
        type: "success",
        text: nextSharingEnabled
          ? "เปิดการติดตามนักเรียนแล้ว"
          : "ปิดการติดตามนักเรียนแล้ว",
      });
      await fetchLocation({ syncSettings: true });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "บันทึกไม่สำเร็จ",
      });
    } finally {
      setSaving(false);
    }
  }

  const studentsOnMap = useMemo(
    () =>
      (data?.students ?? []).flatMap((student) =>
        student.latest
          ? [
              {
                studentId: student.studentId,
                name: student.name,
                latitude: student.latest.latitude,
                longitude: student.latest.longitude,
              },
            ]
          : [],
      ),
    [data?.students],
  );
  const mapPath = useMemo(
    () => (viewer === "teacher" ? [] : (data?.viewerPath ?? [])),
    [data?.viewerPath, viewer],
  );

  const filteredTeacherStudents = useMemo(() => {
    if (!data?.students) return [];

    const query = teacherSearchQuery.trim().toLowerCase();

    return data.students.filter((student) => {
      const hasLocation = Boolean(student.latest);

      if (teacherStatusFilter === "has_location" && !hasLocation) return false;
      if (teacherStatusFilter === "no_location" && hasLocation) return false;

      if (!query) return true;

      const matchName = student.name.toLowerCase().includes(query);
      const matchNickname = student.nickname?.toLowerCase().includes(query);
      const matchId = String(student.studentId).includes(query);

      return matchName || matchNickname || matchId;
    });
  }, [data?.students, teacherSearchQuery, teacherStatusFilter]);

  const teacherTotalPages = Math.ceil(
    (filteredTeacherStudents.length || 0) / TEACHER_PAGE_SIZE,
  );

  const paginatedTeacherStudents = useMemo(() => {
    const start = (teacherPage - 1) * TEACHER_PAGE_SIZE;

    return filteredTeacherStudents.slice(start, start + TEACHER_PAGE_SIZE);
  }, [filteredTeacherStudents, teacherPage]);
  const resolveStudentAdministrativeArea = useCallback(
    async (origin: MapPoint) => {
      const cached = readCachedAdministrativeArea(campId);

      if (cached && canReuseCachedAdministrativeArea(cached, origin)) {
        setStudentAdministrativeArea(cached.administrativeArea);
        setStudentAdministrativeAreaLoading(false);
        setStudentAdministrativeAreaResolved(true);

        return cached.administrativeArea;
      }

      const signature = `${origin.latitude.toFixed(
        5,
      )},${origin.longitude.toFixed(5)}`;
      const existingLookup = administrativeAreaLookupRef.current;
      const lookup =
        existingLookup?.signature === signature
          ? existingLookup.promise
          : reverseGeocodeThaiAdministrativeArea(origin);

      administrativeAreaLookupRef.current = { signature, promise: lookup };
      setStudentAdministrativeAreaLoading(true);
      setStudentAdministrativeAreaResolved(false);

      try {
        const administrativeArea = await lookup;

        saveCachedAdministrativeArea(campId, {
          administrativeArea,
          resolvedAt: new Date().toISOString(),
          origin,
        });
        setStudentAdministrativeArea(administrativeArea);
        setStudentAdministrativeAreaResolved(true);

        return administrativeArea;
      } catch {
        saveCachedAdministrativeArea(campId, {
          administrativeArea: null,
          resolvedAt: new Date().toISOString(),
          origin,
        });
        setStudentAdministrativeArea(null);
        setStudentAdministrativeAreaResolved(true);

        return null;
      } finally {
        if (administrativeAreaLookupRef.current?.signature === signature) {
          administrativeAreaLookupRef.current = null;
        }
        setStudentAdministrativeAreaLoading(false);
      }
    },
    [campId],
  );
  const loadStudentRoute = useCallback(
    async (forceRefresh = false) => {
      if (viewer !== "student") return;

      const origin = data?.students[0]?.latest ?? null;
      const destination = showDestination ? (data?.destination ?? null) : null;

      if (!origin || !destination) {
        setStudentRoute(null);
        setStudentRouteNotice(
          !origin
            ? "ยังไม่มีพิกัดล่าสุด จึงยังคำนวณระยะทางไม่ได้"
            : "ค่ายนี้ยังไม่ได้กำหนดจุดหมาย",
        );

        return;
      }

      const administrativeAreaPromise =
        resolveStudentAdministrativeArea(origin);
      const cached = readCachedRoute(campId);

      if (
        !forceRefresh &&
        cached &&
        canReuseCachedRoute(cached, origin, destination)
      ) {
        const administrativeArea = await administrativeAreaPromise;
        const cachedWithAdministrativeArea = {
          ...cached,
          administrativeArea:
            administrativeArea ?? cached.administrativeArea ?? null,
        };

        setStudentRoute(cachedWithAdministrativeArea);
        saveCachedRoute(campId, cachedWithAdministrativeArea);
        setStudentRouteNotice(
          cached.source === "google"
            ? "ใช้เส้นทางที่บันทึกไว้เพื่อลดการเรียก Google Routes"
            : "แสดงระยะเส้นตรงโดยประมาณจากข้อมูลที่บันทึกไว้",
        );

        return;
      }

      const now = Date.now();

      if (
        forceRefresh &&
        now - lastRouteRequestAtRef.current < ROUTE_REFRESH_COOLDOWN_MS
      ) {
        setStudentRouteNotice(
          "เพิ่งคำนวณเส้นทางไป กรุณารอประมาณ 1 นาทีก่อนอัปเดตอีกครั้ง",
        );

        return;
      }

      lastRouteRequestAtRef.current = now;
      setStudentRouteLoading(true);
      setStudentRouteNotice("");

      try {
        let summary: StudentRouteSummary;
        const administrativeArea = await administrativeAreaPromise;

        try {
          const route = await computeGoogleDrivingRoute(origin, destination);

          summary = {
            ...route,
            calculatedAt: new Date().toISOString(),
            origin,
            destination,
            source: "google",
            administrativeArea,
          };
        } catch {
          summary = {
            path: [origin, destination],
            distanceMeters: distanceBetweenPoints(origin, destination),
            durationMillis: null,
            calculatedAt: new Date().toISOString(),
            origin,
            destination,
            source: "straight",
            administrativeArea,
          };
        }

        setStudentRoute(summary);
        saveCachedRoute(campId, summary);
        setStudentRouteNotice(
          summary.source === "google"
            ? "เส้นทางตามถนนแบบไม่รวมสภาพจราจร"
            : "Google Routes ยังไม่พร้อม จึงแสดงเส้นตรงและระยะโดยประมาณแทน",
        );
      } catch {
        setStudentRoute(null);
        setStudentRouteNotice("ไม่สามารถโหลดข้อมูลตำแหน่งได้ กรุณาลองใหม่");
      } finally {
        setStudentRouteLoading(false);
      }
    },
    [
      campId,
      data?.destination,
      data?.students,
      resolveStudentAdministrativeArea,
      showDestination,
      viewer,
    ],
  );
  const handleMapClick = useCallback((point: MapPoint) => {
    setDraftDestination({
      ...point,
      name: "จุดหมายที่ปักบนแผนที่",
      address: `${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}`,
    });
    setDestinationConfirmed(false);
    setPlaces([]);
  }, []);

  async function confirmDestination() {
    if (!draftDestination) return;

    setConfirmingDestination(true);
    setMessage(null);

    try {
      const response = await fetch(locationUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destination: draftDestination }),
      });

      if (!response.ok) throw new Error(await responseError(response));

      setDestinationConfirmed(true);
      setData((current) =>
        current ? { ...current, destination: draftDestination } : current,
      );
      setMessage({ type: "success", text: "บันทึกหมุดจุดหมายแล้ว" });
    } catch (error) {
      setDestinationConfirmed(false);
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "บันทึกหมุดไม่สำเร็จ",
      });
    } finally {
      setConfirmingDestination(false);
    }
  }

  if (loading) {
    return (
      <LocationTrackerSkeleton
        showMap={viewer !== "teacher" || showDestination}
      />
    );
  }

  if (!data) {
    return (
      <section
        aria-live="polite"
        className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700"
      >
        <p className="font-semibold">ไม่สามารถโหลดข้อมูลตำแหน่งค่ายได้</p>
        {loadError && <p className="mt-1 text-xs">{loadError}</p>}
        <button
          className="mt-3 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold transition hover:bg-red-100"
          type="button"
          onClick={() =>
            void fetchLocation({ showLoader: true, syncSettings: true })
          }
        >
          ลองโหลดอีกครั้ง
        </button>
      </section>
    );
  }

  const canConfigureDestination =
    data.permissions.canConfigure && configureDestination;
  const mapDestination = showDestination
    ? canConfigureDestination
      ? draftDestination
      : data.destination
    : null;
  const ownLocation = data.students[0] ?? null;

  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {viewer !== "teacher" && (
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="flex items-center gap-2 font-bold text-slate-800">
              <Navigation className="text-[#5d7c6f]" size={19} />
              ตำแหน่งนักเรียนระหว่างเดินทาง
            </h3>
            <p className="mt-1 text-xs text-slate-500">{data.trackingLabel}</p>
          </div>
          {data.permissions.canManageStudentSharing ? (
            <label
              className={`flex w-fit items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${
                data.sharingEnabled
                  ? "cursor-pointer border-slate-200 text-slate-700"
                  : "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400"
              }`}
            >
              <input
                checked={data.sharingEnabled && data.studentSharingEnabled}
                className="peer sr-only"
                disabled={!data.sharingEnabled || savingStudentSharing}
                type="checkbox"
                onChange={(event) =>
                  void setStudentSharing(event.target.checked)
                }
              />
              <span className="relative h-6 w-11 rounded-full bg-slate-300 transition peer-checked:bg-[#5d7c6f] after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5 peer-disabled:opacity-60" />
              {savingStudentSharing
                ? "กำลังบันทึก..."
                : !data.sharingEnabled
                  ? "ครูยังไม่เปิดการแชร์"
                  : data.studentSharingEnabled
                    ? "กำลังแชร์ตำแหน่ง"
                    : "ปิดแชร์ตำแหน่ง"}
            </label>
          ) : (
            <div
              className={`inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
                data.sharingEnabled
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${data.sharingEnabled ? "bg-emerald-500" : "bg-slate-400"}`}
              />
              {data.sharingEnabled
                ? "เปิดติดตามเป็นช่วงเวลา"
                : "ปิดการติดตามตำแหน่ง"}
            </div>
          )}
        </div>
      )}

      {viewer !== "teacher" && (
        <details className="group border-b border-blue-100 bg-blue-50/70 p-4 text-xs leading-5 text-slate-700">
          <summary className="flex cursor-pointer items-center font-bold text-slate-800 outline-none">
            รายละเอียดก่อนเปิดแชร์ตำแหน่ง
            <span className="ml-auto text-[11px] font-medium text-blue-600 underline underline-offset-2 group-open:hidden">
              อ่านรายละเอียด
            </span>
            <span className="ml-auto hidden text-[11px] font-medium text-slate-500 underline underline-offset-2 group-open:inline">
              ซ่อนรายละเอียด
            </span>
          </summary>
          <div className="mt-3">
            <ul className="list-disc space-y-0.5 pl-5">
              <li>{data.privacy.purpose}</li>
              <li>ผู้ที่ดูได้: {data.privacy.recipients}</li>
              <li>{data.privacy.retention}</li>
              <li>ปิดแชร์ได้ทุกเมื่อโดยไม่กระทบสิทธิในการเข้าร่วมกิจกรรม</li>
            </ul>
            <p className="mt-2 font-medium text-blue-800">
              {viewer === "student" && data.privacy.requiresGuardianConsent
                ? "นักเรียนอายุต่ำกว่า 10 ปีต้องให้ผู้ปกครองเข้าสู่ระบบและเป็นผู้เปิดแชร์"
                : "การเปิดสวิตช์ถือเป็นการยืนยันว่าได้รับทราบรายละเอียดข้างต้น หากนักเรียนยังไม่สามารถให้ความยินยอมเองได้ ให้ผู้ปกครองเป็นผู้เปิด"}
            </p>
          </div>
        </details>
      )}

      {canConfigureDestination && (
        <div className="space-y-3 border-b border-slate-100 bg-slate-50/70 p-4">
          <form className="flex gap-2" onSubmit={searchPlaces}>
            <div className="relative flex-1">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={17}
              />
              <input
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none transition focus:border-[#5d7c6f] focus:ring-2 focus:ring-[#5d7c6f]/15"
                placeholder='ค้นหา เช่น "มหาวิทยาลัยขอนแก่น"'
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <button
              className="h-11 rounded-xl bg-[#5d7c6f] px-4 text-sm font-semibold text-white disabled:opacity-50"
              disabled={
                searching ||
                searchCooldownSeconds > 0 ||
                query.trim().length < 2
              }
              type="submit"
            >
              {searching
                ? "กำลังค้นหา..."
                : searchCooldownSeconds > 0
                  ? `รอ ${searchCooldownSeconds} วิ`
                  : "ค้นหา"}
            </button>
          </form>

          {places.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="divide-y divide-slate-100">
                {places.map((place) => (
                  <button
                    key={place.id}
                    className="flex w-full gap-3 p-3 text-left transition hover:bg-emerald-50"
                    type="button"
                    onClick={() => {
                      setDraftDestination(place);
                      setDestinationConfirmed(false);
                      setPlaces([]);
                      setQuery(place.name);
                    }}
                  >
                    <MapPin
                      className="mt-0.5 shrink-0 text-[#5d7c6f]"
                      size={17}
                    />
                    <span>
                      <span className="block text-sm font-semibold text-slate-800">
                        {place.name}
                      </span>
                      <span className="block text-xs text-slate-500">
                        {place.address}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
              <p className="border-t border-slate-100 px-3 py-2 text-[10px] text-slate-400">
                ผลการค้นหาจาก Google Maps
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">
              ค้นหาสถานที่หรือคลิกตำแหน่งบนแผนที่เพื่อย้ายหมุดปลายทาง
            </p>
            <button
              className="h-8 w-full shrink-0 rounded-md bg-[#5d7c6f] px-3 text-[11px] font-normal text-white transition disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 sm:w-auto"
              disabled={
                confirmingDestination ||
                !draftDestination ||
                destinationConfirmed
              }
              type="button"
              onClick={() => void confirmDestination()}
            >
              {confirmingDestination
                ? "กำลังบันทึก..."
                : destinationConfirmed
                  ? "บันทึกหมุดแล้ว"
                  : "ยืนยันและบันทึกหมุด"}
            </button>
          </div>

          <div
            className={`rounded-lg border px-2.5 py-2 ${
              draftDestination
                ? destinationConfirmed
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-amber-200 bg-amber-50"
                : "border-slate-200 bg-white"
            }`}
          >
            <p className="text-[11px] font-medium text-slate-500">
              ตำแหน่งหมุดปัจจุบัน
            </p>
            {draftDestination ? (
              <div className="mt-0.5 flex flex-col gap-0.5">
                <p className="text-xs font-semibold text-slate-800">
                  ตอนนี้หมุดปักอยู่ที่ {draftDestination.name}
                </p>
                <p className="text-[11px] leading-4 text-slate-500">
                  {draftDestination.address ||
                    formatCoordinates(draftDestination)}
                </p>
                <p
                  className={`text-[11px] font-semibold ${
                    destinationConfirmed ? "text-emerald-700" : "text-amber-700"
                  }`}
                >
                  {destinationConfirmed
                    ? "ยืนยันหมุดนี้แล้ว"
                    : "ยังไม่ได้ยืนยันหมุดนี้"}
                </p>
              </div>
            ) : (
              <p className="mt-0.5 text-xs text-slate-400">
                ยังไม่ได้ปักหมุดจุดหมาย
              </p>
            )}
          </div>

          {destinationConfirmed && (
            <div className="rounded-xl border border-[#5d7c6f]/25 bg-white p-3">
              <div className="mb-3">
                <p className="text-xs font-semibold text-[#5d7c6f]">
                  ขั้นตอนที่ 2 · เปิดการติดตามนักเรียน
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  เปิดแล้วนักเรียนจึงจะสามารถส่งตำแหน่ง GPS ให้ครูดูได้
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700">
                    <input
                      checked={sharingEnabled}
                      className="h-4 w-4 accent-[#5d7c6f]"
                      type="checkbox"
                      onChange={(event) =>
                        setSharingEnabled(event.target.checked)
                      }
                    />
                    ให้นักเรียนแชร์ตำแหน่ง
                  </label>
                </div>
                <button
                  className="h-9 rounded-lg bg-[#5d7c6f] px-4 text-xs font-medium text-white disabled:opacity-50"
                  disabled={saving}
                  type="button"
                  onClick={() => {
                    const nextSharingEnabled = data.sharingEnabled
                      ? sharingEnabled
                      : true;

                    setSharingEnabled(nextSharingEnabled);
                    void saveSettings(nextSharingEnabled);
                  }}
                >
                  {saving
                    ? "กำลังบันทึก..."
                    : data.sharingEnabled
                      ? "บันทึกการเปลี่ยนแปลง"
                      : "เปิดติดตามนักเรียน"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {viewer === "student" && (
        <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/70 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <MapPin className="mt-0.5 shrink-0 text-[#5d7c6f]" size={18} />
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-500">
                ตำแหน่งล่าสุดของฉัน
              </p>
              <p className="mt-0.5 text-sm font-semibold text-slate-800">
                {!ownLocation?.latest
                  ? "ยังไม่มีตำแหน่งล่าสุด"
                  : !studentMapVisible
                    ? "กดแสดงแผนที่เพื่อดูตำบล อำเภอ จังหวัด"
                    : studentAdministrativeAreaLoading
                      ? "กำลังค้นหาตำบล อำเภอ จังหวัด..."
                      : studentAdministrativeArea
                        ? studentAdministrativeArea
                        : studentAdministrativeAreaResolved
                          ? "ไม่สามารถระบุชื่อตำบล อำเภอ จังหวัดได้"
                          : "กำลังเตรียมข้อมูลตำแหน่ง..."}
              </p>
              {ownLocation?.latest && (
                <p className="mt-1 text-[11px] font-normal text-slate-400">
                  พิกัด {formatCoordinates(ownLocation.latest)}
                </p>
              )}
              {!studentMapVisible && (
                <p className="mt-1 text-[11px] text-slate-400">
                  แผนที่จะโหลดเมื่อกดแสดงแผนที่เท่านั้น
                </p>
              )}
            </div>
          </div>
          {!studentMapVisible && (
            <button
              className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-[#5d7c6f] px-3 text-xs font-semibold text-[#5d7c6f] transition hover:bg-[#5d7c6f] hover:text-white disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400 disabled:hover:bg-transparent"
              disabled={!ownLocation?.latest && !mapDestination}
              type="button"
              onClick={() => {
                setStudentMapVisible(true);
                void loadStudentRoute();
              }}
            >
              <LocateFixed size={15} />
              แสดงแผนที่
            </button>
          )}
        </div>
      )}

      {viewer === "student" && studentMapVisible && (
        <div className="border-b border-emerald-100 bg-emerald-50/70 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <Navigation
                className="mt-0.5 shrink-0 text-emerald-700"
                size={19}
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-emerald-700">
                  ระยะทางไปยังจุดหมาย
                </p>
                {studentRouteLoading ? (
                  <p className="mt-0.5 text-sm font-bold text-slate-700">
                    กำลังคำนวณเส้นทาง...
                  </p>
                ) : studentRoute ? (
                  <>
                    <p className="mt-0.5 text-xl font-extrabold text-slate-800">
                      เหลืออีก{" "}
                      {formatRouteDistance(studentRoute.distanceMeters)}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {formatRouteDetail(studentRoute)}
                      {" · "}
                      คำนวณล่าสุด{" "}
                      {new Date(studentRoute.calculatedAt).toLocaleTimeString(
                        "th-TH",
                        {
                          hour: "2-digit",
                          minute: "2-digit",
                          timeZone: BANGKOK_TIME_ZONE,
                        },
                      )}
                    </p>
                    {(studentAdministrativeArea ||
                      studentRoute.administrativeArea) && (
                      <p className="mt-1 text-xs font-medium text-slate-700">
                        ตำแหน่งปัจจุบัน:{" "}
                        {studentAdministrativeArea ||
                          studentRoute.administrativeArea}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="mt-0.5 text-sm font-semibold text-slate-600">
                    ยังไม่สามารถคำนวณระยะทางได้
                  </p>
                )}
                {studentRouteNotice && (
                  <p className="mt-1 text-[11px] leading-4 text-slate-500">
                    {studentRouteNotice}
                  </p>
                )}
              </div>
            </div>
            <button
              className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-emerald-700 bg-white px-3 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              disabled={
                studentRouteLoading || !ownLocation?.latest || !mapDestination
              }
              type="button"
              onClick={() => void loadStudentRoute(true)}
            >
              <RefreshCw
                className={studentRouteLoading ? "animate-spin" : ""}
                size={14}
              />
              อัปเดตเส้นทาง
            </button>
          </div>
        </div>
      )}

      {(viewer !== "teacher" || showDestination) &&
        (viewer !== "student" || studentMapVisible) && (
          <div className="h-[420px] w-full shrink-0 bg-slate-100 sm:h-[520px] lg:h-[58vh] lg:min-h-[560px] lg:max-h-[680px]">
            <CampLocationMap
              destination={mapDestination}
              editable={canConfigureDestination}
              path={mapPath}
              routePath={viewer === "student" ? (studentRoute?.path ?? []) : []}
              students={studentsOnMap}
              onMapClick={handleMapClick}
            />
          </div>
        )}

      <div className="space-y-4 p-4">
        {loadError && (
          <div
            aria-live="polite"
            className="flex items-start justify-between gap-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800"
          >
            <span className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 shrink-0" size={17} />
              อัปเดตข้อมูลล่าสุดไม่สำเร็จ: {loadError}
            </span>
            <button
              className="shrink-0 font-semibold underline underline-offset-2"
              type="button"
              onClick={() => void fetchLocation()}
            >
              ลองใหม่
            </button>
          </div>
        )}

        <CampDestinationCard destination={mapDestination} />

        {viewer === "teacher" ? (
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/70 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <span className="flex items-center gap-2 text-sm font-bold text-slate-800">
                    <Users size={17} /> สถานะตำแหน่งนักเรียน
                  </span>
                  <p className="mt-1 text-xs text-slate-500">
                    ตำแหน่งจะอัปเดตเมื่อหน้าเว็บของนักเรียนเปิดอยู่
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                  <button
                    className={`rounded-full px-2.5 py-1 transition ${
                      teacherStatusFilter === "has_location"
                        ? "bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-600/20"
                        : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                    }`}
                    type="button"
                    onClick={() =>
                      setTeacherStatusFilter((current) =>
                        current === "has_location" ? "all" : "has_location",
                      )
                    }
                  >
                    มีพิกัดล่าสุด {studentsOnMap.length} คน
                  </button>
                  <button
                    className={`rounded-full px-2.5 py-1 transition ${
                      teacherStatusFilter === "no_location"
                        ? "bg-slate-700 text-white shadow-sm ring-2 ring-slate-700/20"
                        : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                    }`}
                    type="button"
                    onClick={() =>
                      setTeacherStatusFilter((current) =>
                        current === "no_location" ? "all" : "no_location",
                      )
                    }
                  >
                    ยังไม่มีพิกัด {data.students.length - studentsOnMap.length}{" "}
                    คน
                  </button>
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  size={16}
                />
                <input
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-8 text-xs text-slate-800 placeholder-slate-400 outline-none transition focus:border-[#5d7c6f] focus:ring-2 focus:ring-[#5d7c6f]/15"
                  placeholder="ค้นหาชื่อ ชื่อเล่น หรือรหัสนักเรียน..."
                  type="text"
                  value={teacherSearchQuery}
                  onChange={(e) => setTeacherSearchQuery(e.target.value)}
                />
                {teacherSearchQuery && (
                  <button
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    type="button"
                    onClick={() => setTeacherSearchQuery("")}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {(teacherSearchQuery || teacherStatusFilter !== "all") && (
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>
                    พบนักเรียน {filteredTeacherStudents.length} จากทั้งหมด{" "}
                    {data.students.length} คน
                  </span>
                  <button
                    className="font-medium text-[#5d7c6f] underline underline-offset-2 hover:text-[#4a6358]"
                    type="button"
                    onClick={() => {
                      setTeacherSearchQuery("");
                      setTeacherStatusFilter("all");
                    }}
                  >
                    ล้างการค้นหาและตัวกรอง
                  </button>
                </div>
              )}
            </div>
            <div className="divide-y divide-slate-100">
              {filteredTeacherStudents.length ? (
                paginatedTeacherStudents.map((student) => {
                  const age = student.latest
                    ? minutesSince(student.latest.recorded_at)
                    : null;
                  const stale =
                    age != null && age > data.updateIntervalMinutes * 2;

                  return (
                    <div
                      key={student.studentId}
                      className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(260px,1.25fr)] sm:items-center"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar
                          className="h-10 w-10 shrink-0 bg-[#e8f0ee] text-[#3d6357]"
                          imgProps={{
                            alt: `รูปโปรไฟล์ของ ${student.name}`,
                          }}
                          name={student.initials}
                          src={student.profileImageUrl || undefined}
                        />
                        <div className="min-w-0">
                          <div className="flex min-w-0 items-center gap-2">
                            <p
                              className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800"
                              title={student.name}
                            >
                              {student.name}
                            </p>
                            <span
                              className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                !student.sharingEnabled
                                  ? "bg-amber-50 text-amber-700"
                                  : student.latest
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {!student.sharingEnabled
                                ? "นักเรียนปิดแชร์"
                                : student.latest
                                  ? "แชร์ตำแหน่งแล้ว"
                                  : "ยังไม่แชร์ตำแหน่ง"}
                            </span>
                          </div>
                          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-slate-400">
                            <span>ชื่อเล่น: {student.nickname || "-"}</span>
                            <span aria-hidden="true">·</span>
                            <span>รหัสนักเรียน {student.studentId}</span>
                          </p>
                        </div>
                      </div>
                      <div>
                        {student.latest ? (
                          <div className="space-y-1.5 rounded-lg bg-slate-50 px-3 py-2.5 text-xs">
                            <p className="flex items-start gap-2 text-slate-700">
                              <MapPin
                                className="mt-0.5 shrink-0 text-[#5d7c6f]"
                                size={14}
                              />
                              <span>
                                <span className="font-semibold">
                                  พิกัดล่าสุด
                                </span>{" "}
                                {formatCoordinates(student.latest)}
                              </span>
                            </p>
                            <p className="flex items-start gap-2 text-slate-500">
                              <Clock3 className="mt-0.5 shrink-0" size={14} />
                              <span>
                                ได้รับเมื่อ{" "}
                                {thaiDateTime(student.latest.recorded_at)}
                                <span
                                  className={`ml-1 font-semibold ${
                                    stale
                                      ? "text-amber-600"
                                      : "text-emerald-600"
                                  }`}
                                >
                                  (
                                  {age === 0
                                    ? "ไม่ถึง 1 นาทีที่แล้ว"
                                    : `${age} นาทีที่แล้ว`}
                                  )
                                </span>
                              </span>
                            </p>
                            <div className="flex justify-end pt-1">
                              <button
                                className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-[#5d7c6f] px-3 text-[11px] font-semibold text-[#5d7c6f] transition hover:bg-[#5d7c6f] hover:text-white"
                                type="button"
                                onClick={() =>
                                  setSelectedMapStudentId((current) =>
                                    current === student.studentId
                                      ? null
                                      : student.studentId,
                                  )
                                }
                              >
                                <LocateFixed size={14} />
                                {selectedMapStudentId === student.studentId
                                  ? "ปิดแผนที่"
                                  : "ดูบนแผนที่"}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-lg bg-slate-50 px-3 py-3 text-xs text-slate-500">
                            ยังไม่ได้รับพิกัดจากอุปกรณ์ของนักเรียนคนนี้
                          </div>
                        )}
                      </div>
                      {student.latest &&
                        selectedMapStudentId === student.studentId && (
                          <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100 sm:col-span-2">
                            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-3 py-2">
                              <p className="text-xs font-semibold text-slate-700">
                                ตำแหน่งล่าสุดของ {student.name}
                              </p>
                              <p className="text-[11px] text-slate-400">
                                {formatCoordinates(student.latest)}
                              </p>
                            </div>
                            <div className="h-72 w-full sm:h-80">
                              <CampLocationMap
                                destination={null}
                                path={[]}
                                students={[
                                  {
                                    studentId: student.studentId,
                                    name: student.name,
                                    latitude: student.latest.latitude,
                                    longitude: student.latest.longitude,
                                  },
                                ]}
                              />
                            </div>
                          </div>
                        )}
                    </div>
                  );
                })
              ) : (
                <div className="py-8 text-center text-slate-400">
                  <p className="text-sm">
                    {teacherSearchQuery || teacherStatusFilter !== "all"
                      ? "ไม่พบข้อมูลนักเรียนที่ตรงกับเงื่อนไขการค้นหา"
                      : "ยังไม่มีนักเรียนลงทะเบียนค่าย"}
                  </p>
                </div>
              )}
            </div>

            {teacherTotalPages > 1 && (
              <div className="flex justify-center border-t border-slate-100 bg-slate-50/50 p-3">
                <Pagination
                  isCompact
                  showControls
                  showShadow
                  className="bg-transparent"
                  classNames={{
                    cursor: "bg-[#5d7c6f] text-white font-medium",
                  }}
                  color="default"
                  page={teacherPage}
                  total={teacherTotalPages}
                  onChange={setTeacherPage}
                />
              </div>
            )}
          </div>
        ) : ownLocation?.latest && data.sharingEnabled ? (
          <div className="flex items-start gap-3 rounded-xl bg-blue-50 p-3">
            <Clock3 className="mt-0.5 shrink-0 text-blue-600" size={18} />
            <div>
              <p className="text-xs font-medium text-slate-500">
                ตำแหน่งล่าสุดของ {ownLocation.name}
              </p>
              <p className="text-sm font-bold text-slate-800">
                {thaiDateTime(ownLocation.latest.recorded_at)}
              </p>
              <p className="text-xs text-slate-500">
                {minutesSince(ownLocation.latest.recorded_at) === 0
                  ? "ไม่ถึง 1 นาทีที่แล้ว"
                  : `${minutesSince(ownLocation.latest.recorded_at)} นาทีที่แล้ว`}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex gap-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
            <ShieldCheck className="shrink-0 text-slate-400" size={18} />
            {data.sharingEnabled
              ? viewer === "parent"
                ? "ยังไม่มีตำแหน่งจากอุปกรณ์ของนักเรียน"
                : data.studentSharingEnabled
                  ? "กำลังรอสิทธิ์ GPS หรือยังไม่ได้รับตำแหน่งจากอุปกรณ์นี้"
                  : "คุณปิดการแชร์ตำแหน่งอยู่ ระบบจะไม่ส่ง GPS"
              : "ครูยังไม่ได้เปิดการติดตามตำแหน่ง นักเรียนจะยังไม่ส่ง GPS"}
          </div>
        )}

        {viewer === "parent" && data.sharingEnabled && (
          <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-700">
            ตำแหน่งจะอัปเดตเมื่อหน้าเว็บของนักเรียนเปิดอยู่เท่านั้น
            และอาจล่าช้าตามรอบการอัปเดตของระบบ
          </div>
        )}

        {message && (
          <div
            className={`flex items-start gap-2 rounded-xl p-3 text-sm ${
              message.type === "success"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            {message.type === "success" ? (
              <CheckCircle2 className="shrink-0" size={18} />
            ) : (
              <AlertCircle className="shrink-0" size={18} />
            )}
            {message.text}
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          {viewer === "student" &&
            data.permissions.canSubmitStudentLocation &&
            data.sharingEnabled &&
            data.studentSharingEnabled && (
              <button
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#5d7c6f] px-4 text-sm font-semibold text-[#5d7c6f] disabled:opacity-50"
                disabled={publishing}
                type="button"
                onClick={() => void publishStudentLocation(true)}
              >
                <LocateFixed size={17} />
                {publishing ? "กำลังอ่าน GPS..." : "อัปเดตตำแหน่งของฉันตอนนี้"}
              </button>
            )}
        </div>
      </div>
    </section>
  );
}
