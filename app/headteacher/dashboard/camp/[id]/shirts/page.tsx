import { GET as getShirts } from "@/app/api/camps/[id]/shirts/route";

import ShirtsClient from "./ShirtsClient";

export default async function ShirtsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const response = await getShirts(
    new Request(`https://www.kkscamp.com/api/camps/${id}/shirts`),
    { params: Promise.resolve({ id }) },
  );
  const initialData = response.ok ? await response.json() : null;

  return <ShirtsClient campId={Number(id)} initialData={initialData} />;
}
