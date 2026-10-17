import CampDetailPage from "../CampDetailPage";
import { GET as getCampDetail } from "@/app/api/camps/[id]/route";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const response = await getCampDetail(
    new Request(`http://localhost/api/camps/${id}`),
    { params: Promise.resolve({ id }) },
  );
  const initialCamp = response.ok ? await response.json() : null;

  return <CampDetailPage initialCamp={initialCamp} />;
}
