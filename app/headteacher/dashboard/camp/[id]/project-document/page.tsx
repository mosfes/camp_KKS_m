import { GET as getDocument } from "@/app/api/camps/[id]/project-document/route";
import { GET as getPeople } from "@/app/api/document-personnel/route";
import { GET as getTemplates } from "@/app/api/project-document-templates/route";
import { GET as getTeachers } from "@/app/api/teachers/route";
import { GET as getReferenceOptions } from "@/app/api/document-reference-options/route";

import ProjectDocumentPage from "./ProjectDocumentClient";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [document, people, templates, teachers, referenceOptions] =
    await Promise.all([
      getDocument(new Request(`https://www.kkscamp.com/api/camps/${id}/project-document`), { params: Promise.resolve({ id }) }),
      getPeople(new Request("https://www.kkscamp.com/api/document-personnel")),
      getTemplates(),
      getTeachers(new Request("https://www.kkscamp.com/api/teachers")),
      getReferenceOptions(new Request("https://www.kkscamp.com/api/document-reference-options")),
    ]);

  const initialData = document.ok
    ? {
        document: await document.json(),
        people: people.ok ? await people.json() : [],
        templates: templates.ok ? await templates.json() : [],
        teachers: teachers.ok ? await teachers.json() : [],
        referenceOptions: referenceOptions.ok ? await referenceOptions.json() : [],
      }
    : null;

  return <ProjectDocumentPage initialData={initialData} />;
}
