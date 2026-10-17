import { GET as getStudents } from "@/app/api/camps/[id]/students/route";

import CampStudentsPage from "./StudentsClient";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const response = await getStudents(
    new Request(`https://www.kkscamp.com/api/camps/${id}/students?page=1&limit=10&filter=all&summary=true`),
    { params: Promise.resolve({ id }) },
  );
  const initialData = response.ok ? await response.json() : null;

  return <CampStudentsPage initialData={initialData} />;
}
