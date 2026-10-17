import { GET as getCamp } from "@/app/api/camps/[id]/route";

import CertificatePage from "./CertificateClient";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const response = await getCamp(
    new Request(`https://www.kkscamp.com/api/camps/${id}?view=certificate`),
    { params: Promise.resolve({ id }) },
  );
  const initialCamp = response.ok ? await response.json() : null;

  return <CertificatePage initialCamp={initialCamp} />;
}
