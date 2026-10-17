import { GET as getStation } from "@/app/api/stations/[id]/route";

import BaseDetailPage from "./BaseDetailClient";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string; baseId: string }>;
}) {
  const { baseId } = await params;
  const response = await getStation(
    new Request(`https://www.kkscamp.com/api/stations/${baseId}`),
    { params: Promise.resolve({ id: baseId }) },
  );
  const initialBase = response.ok ? await response.json() : null;

  return <BaseDetailPage initialBase={initialBase} />;
}
