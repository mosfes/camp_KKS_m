import { GET as getLocation } from "@/app/api/camps/[id]/location/route";

import { notFound } from "next/navigation";

import LocationClient from "./LocationClient";

import { LOCATION_TRACKING_ENABLED } from "@/lib/features";

export default async function LocationTrackingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!LOCATION_TRACKING_ENABLED) notFound();

  const { id } = await params;
  const response = await getLocation(
    new Request(`https://www.kkscamp.com/api/camps/${id}/location`),
    { params: Promise.resolve({ id }) },
  );
  const initialData = response.ok ? await response.json() : null;

  return <LocationClient campId={Number(id)} initialData={initialData} />;
}
