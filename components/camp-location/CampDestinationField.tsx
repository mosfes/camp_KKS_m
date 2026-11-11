"use client";

import type { FormEvent } from "react";
import type { MapPoint } from "./CampLocationMap";

import { MapPin, Search } from "lucide-react";
import { useCallback, useState } from "react";

import CampLocationMap from "./CampLocationMap";

import { searchGooglePlaces } from "@/lib/google-maps-client";
import { LOCATION_TRACKING_ENABLED } from "@/lib/features";

export interface CampDestination extends MapPoint {
  name: string;
  address?: string | null;
}

interface PlaceResult extends CampDestination {
  id: string;
}

interface Props {
  destination: CampDestination | null;
  enabled: boolean;
  hasTransport: boolean;
  onDestinationChange: (destination: CampDestination | null) => void;
  onEnabledChange: (enabled: boolean) => void;
  onHasTransportChange: (hasTransport: boolean) => void;
}

function searchError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const normalized = message.toLowerCase();

  if (
    ["quota", "rate limit", "resource_exhausted", "over_query_limit"].some(
      (keyword) => normalized.includes(keyword),
    )
  ) {
    return "ค้นหาถี่เกินไป กรุณารอสักครู่แล้วลองใหม่";
  }

  return message || "ค้นหาสถานที่ไม่สำเร็จ";
}

export default function CampDestinationField({
  destination,
  enabled,
  hasTransport,
  onDestinationChange,
  onEnabledChange,
  onHasTransportChange,
}: Props) {
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  async function handleSearch(event: FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();

    if (trimmed.length < 2 || searching) return;

    setSearching(true);
    setMessage("");

    try {
      const results = await searchGooglePlaces(trimmed);

      setPlaces(results);
      if (!results.length) {
        setMessage("ไม่พบสถานที่ ลองระบุจังหวัดหรืออำเภอเพิ่ม");
      }
    } catch (error) {
      setPlaces([]);
      setMessage(searchError(error));
    } finally {
      setSearching(false);
    }
  }

  const handleMapClick = useCallback(
    (point: MapPoint) => {
      onDestinationChange({
        ...point,
        name: "จุดที่ปักบนแผนที่",
        address: `${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}`,
      });
      setPlaces([]);
      setMessage("");
    },
    [onDestinationChange],
  );

  return (
    <div className="md:col-span-2 overflow-hidden rounded-xl border border-slate-200 bg-slate-50/70">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-800">
            ปักหมุดสถานที่จัดค่าย
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            หมุดนี้จะแสดงให้นักเรียน ครู และผู้ปกครองเปิดดูได้
          </p>
        </div>
        <button
          className="h-9 shrink-0 rounded-lg border border-[#5d7c6f] bg-white px-3 text-xs font-semibold text-[#5d7c6f] transition hover:bg-[#5d7c6f] hover:text-white"
          type="button"
          onClick={() => setPickerOpen((current) => !current)}
        >
          {pickerOpen
            ? "ซ่อนแผนที่"
            : destination
              ? "แก้ไขหมุด"
              : "ปักหมุดสถานที่"}
        </button>
      </div>

      {LOCATION_TRACKING_ENABLED && (
      <div className="border-t border-slate-200 px-4 py-3">
        <label className="flex cursor-pointer items-start justify-between gap-3 text-sm">
          <span>
            <span className="block font-semibold text-slate-800">
              ติดตามนักเรียนด้วย GPS
            </span>
            <span className="mt-0.5 block text-xs text-slate-500">
              เปิดเมื่อให้นักเรียนแชร์ตำแหน่งระหว่างเดินทางเท่านั้น
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2 font-medium text-slate-700">
            <input
              checked={enabled}
              className="peer sr-only"
              type="checkbox"
              onChange={(event) => {
                const nextEnabled = event.target.checked;

                if (nextEnabled && !destination) setPickerOpen(true);
                onEnabledChange(nextEnabled);
              }}
            />
            <span className="relative h-6 w-11 rounded-full bg-slate-300 transition peer-checked:bg-[#5d7c6f] after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5" />
            {enabled ? "เปิด GPS" : "ปิด GPS"}
          </span>
        </label>
      </div>
      )}

      <div className="border-t border-slate-200 px-4 py-3">
        <div className="flex items-start gap-3 text-sm">
          <input
            aria-label="ค่ายมีการเดินทาง"
            checked={hasTransport || enabled}
            className="mt-0.5 h-4 w-4 accent-[#5d7c6f]"
            disabled={enabled}
            type="checkbox"
            onChange={(event) => onHasTransportChange(event.target.checked)}
          />
          <span>
            <span className="block font-semibold text-slate-800">
              ค่ายมีการเดินทาง
            </span>
            <span className="mt-0.5 block text-xs text-slate-500">
              ใช้สำหรับแสดงเมนูเช็คชื่อขึ้นรถ
              {enabled && " (เปิดอัตโนมัติเมื่อใช้ติดตามตำแหน่ง)"}
            </span>
          </span>
        </div>
      </div>

      {!pickerOpen && (
        <div className="border-t border-slate-200 p-4">
          <div
            className={`rounded-lg border p-3 ${
              destination
                ? "border-emerald-200 bg-emerald-50"
                : "border-amber-200 bg-amber-50"
            }`}
          >
            {destination ? (
              <div className="flex items-start gap-2">
                <MapPin
                  className="mt-0.5 shrink-0 text-emerald-700"
                  size={17}
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800">
                    {destination.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {destination.address ||
                      `${destination.latitude.toFixed(6)}, ${destination.longitude.toFixed(6)}`}
                  </p>
                  <p className="mt-1 text-[11px] font-medium text-emerald-700">
                    บันทึกค่ายแล้วทุกบทบาทจะเปิดดูหมุดนี้ได้
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-xs font-medium text-amber-800">
                ยังไม่ได้ปักหมุด กด “ปักหมุดสถานที่” เพื่อเลือกตำแหน่ง
              </p>
            )}
          </div>
        </div>
      )}

      {pickerOpen && (
        <div className="space-y-3 border-t border-slate-200 p-4">
          <form className="flex gap-2" onSubmit={handleSearch}>
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
              disabled={searching || query.trim().length < 2}
              type="submit"
            >
              {searching ? "กำลังค้นหา..." : "ค้นหา"}
            </button>
          </form>

          {message && <p className="text-xs text-amber-700">{message}</p>}

          {places.length > 0 && (
            <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
              {places.map((place) => (
                <button
                  key={place.id}
                  className="flex w-full gap-3 p-3 text-left transition hover:bg-emerald-50"
                  type="button"
                  onClick={() => {
                    onDestinationChange(place);
                    setQuery(place.name);
                    setPlaces([]);
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
          )}

          <p className="text-xs text-slate-500">
            ค้นหาสถานที่หรือคลิกบนแผนที่เพื่อปักหมุดจุดหมาย
          </p>
          <div className="h-72 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
            <CampLocationMap
              editable
              destination={destination}
              path={[]}
              students={[]}
              onMapClick={handleMapClick}
            />
          </div>

          <div
            className={`rounded-lg border p-3 ${
              destination
                ? "border-emerald-200 bg-emerald-50"
                : "border-amber-200 bg-amber-50"
            }`}
          >
            {destination ? (
              <div className="flex items-start gap-2">
                <MapPin
                  className="mt-0.5 shrink-0 text-emerald-700"
                  size={17}
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800">
                    {destination.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {destination.address ||
                      `${destination.latitude.toFixed(6)}, ${destination.longitude.toFixed(6)}`}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-xs font-medium text-amber-800">
                กรุณาปักหมุดจุดหมายก่อนบันทึกค่าย
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
