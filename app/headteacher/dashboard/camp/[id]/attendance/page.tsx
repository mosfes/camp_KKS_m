import { GET as getQr } from "@/app/api/attendance/[campId]/qr/route";
import { GET as getResults } from "@/app/api/attendance/[campId]/results/route";

import AttendanceClient from "./AttendanceClient";

export default async function AttendancePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const context = { params: Promise.resolve({ campId: id }) };
  const [qrResponse, resultsResponse] = await Promise.all([
    getQr(new Request(`https://www.kkscamp.com/api/attendance/${id}/qr`), context),
    getResults(new Request(`https://www.kkscamp.com/api/attendance/${id}/results`), context),
  ]);
  const initialData = qrResponse.ok && resultsResponse.ok
    ? { qr: await qrResponse.json(), results: await resultsResponse.json() }
    : null;

  return <AttendanceClient campId={Number(id)} initialData={initialData} />;
}
