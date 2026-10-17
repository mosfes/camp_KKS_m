import { GET as getScores } from "@/app/api/camps/[id]/pre-post-tests/route";

import ScoreComparisonClient from "./ScoreComparisonClient";

export default async function ScoreComparisonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const response = await getScores(
    new Request(`https://www.kkscamp.com/api/camps/${id}/pre-post-tests`),
    { params: Promise.resolve({ id }) },
  );
  const data = response.ok ? await response.json() : null;

  return <ScoreComparisonClient campId={Number(id)} initialPairs={data?.pairs || null} />;
}
