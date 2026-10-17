import { GET as getSummary } from "@/app/api/camps/[id]/project-summary-document/route";
import { GET as getPeople } from "@/app/api/document-personnel/route";
import { GET as getTemplates } from "@/app/api/project-summary-document-templates/route";
import { GET as getReferenceOptions } from "@/app/api/document-reference-options/route";

import ProjectSummaryDocumentPage from "./ProjectSummaryClient";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [summary, people, templates, referenceOptions] = await Promise.all([
    getSummary(new Request(`https://www.kkscamp.com/api/camps/${id}/project-summary-document`), { params: Promise.resolve({ id }) }),
    getPeople(new Request("https://www.kkscamp.com/api/document-personnel")),
    getTemplates(),
    getReferenceOptions(new Request("https://www.kkscamp.com/api/document-reference-options")),
  ]);

  const initialData = summary.ok
    ? {
        summary: await summary.json(),
        people: people.ok ? await people.json() : [],
        templates: templates.ok ? await templates.json() : [],
        referenceOptions: referenceOptions.ok ? await referenceOptions.json() : [],
      }
    : null;

  return <ProjectSummaryDocumentPage initialData={initialData} />;
}
