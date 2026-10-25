import CampDetailPage from "../CampDetailPage";
import { GET as getCampDetail } from "@/app/api/camps/[id]/route";
import { redirect } from "next/navigation";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const response = await getCampDetail(
    new Request(`https://www.kkscamp.com/api/camps/${id}?view=overview`),
    { params: Promise.resolve({ id }) },
  );
  if (response.status === 403 || response.status === 404) {
    redirect("/headteacher/dashboard?tab=camp");
  }
  if (!response.ok) {
    throw new Error(`Could not load camp overview (${response.status})`);
  }
  const initialCamp = await response.json();

  return <CampDetailPage initialCamp={initialCamp} />;
}
