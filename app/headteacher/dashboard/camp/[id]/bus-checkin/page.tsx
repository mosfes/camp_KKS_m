import { GET as getBuses } from "@/app/api/camps/[id]/buses/route";

import BusCheckinClient from "./BusCheckinClient";

export default async function BusCheckinPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const response = await getBuses(
    new Request(`https://www.kkscamp.com/api/camps/${id}/buses`),
    { params: Promise.resolve({ id }) },
  );
  const initialData = response.ok ? await response.json() : null;

  return <BusCheckinClient campId={Number(id)} initialData={initialData} />;
}
