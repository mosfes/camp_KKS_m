"use client";

import { Select, SelectItem } from "@heroui/react";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { LayoutTemplate, Plus, RefreshCw, Trash2 } from "lucide-react";

import CampBreadcrumb from "../../CampBreadcrumb";

import DocumentEditorHeader from "@/components/documents/DocumentEditorHeader";
import {
  DocumentStrategiesChecklist,
  DocumentStandardsChecklist,
  documentStandardCode,
  isDocumentStrategySelected,
  normalizeDocumentStandardOptions,
  normalizeDocumentStrategyOptions,
  readStandardReferenceSelection,
  updateDocumentStrategySelection,
  updateStandardReferenceSelection,
  type DocumentStandardClause,
  type DocumentStandardIndicator,
  type DocumentStandardOption,
  type DocumentStrategyOption,
} from "@/components/documents/DocumentStandardsChecklist";
import DocumentTemplatePanel from "@/components/documents/DocumentTemplatePanel";
import { useStatusModal } from "@/components/StatusModalProvider";

const inputClass =
  "w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-[#6b857a] focus:ring-2 focus:ring-[#6b857a]/15 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500";
const selectClassNames = {
  trigger:
    "h-11 min-h-11 rounded-xl border border-gray-200 bg-white px-3 shadow-none transition-colors data-[focus=true]:border-[#6b857a] data-[focus=true]:ring-2 data-[focus=true]:ring-[#6b857a]/15 data-[hover=true]:border-[#9eb5ab] data-[hover=true]:bg-white",
  value: "text-sm text-gray-800 group-data-[has-value=false]:text-gray-400",
  selectorIcon: "text-[#6b857a]",
  popoverContent: "rounded-xl border border-gray-200 bg-white shadow-lg",
  listboxWrapper: "max-h-64",
};
const labelClass = "mb-1.5 block text-sm font-medium text-gray-700";
const BUDGET_SOURCE_INCOME = "เงินรายได้สถานศึกษา";
const BUDGET_SOURCE_SUBSIDY = "เงินอุดหนุน";
const BUDGET_SOURCE_OTHER = "อื่นๆ (ระบุ)";

function getBudgetSourceOption(value: string | null | undefined) {
  if (value === BUDGET_SOURCE_INCOME || value === BUDGET_SOURCE_SUBSIDY) {
    return value;
  }

  return value ? BUDGET_SOURCE_OTHER : "";
}

function getCustomBudgetSource(value: string | null | undefined) {
  if (
    !value ||
    value === BUDGET_SOURCE_INCOME ||
    value === BUDGET_SOURCE_SUBSIDY ||
    value === BUDGET_SOURCE_OTHER
  ) {
    return "";
  }

  return value;
}

function SkeletonBlock({ className }: { className: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-lg bg-gray-200 ${className}`}
    />
  );
}

function ProjectDocumentSkeleton() {
  return (
    <div className="min-h-screen bg-[#f5f5f2] pb-24">
      <main className="mx-auto max-w-6xl space-y-5 px-4 pb-24 pt-8">
        {/* Page Header Skeleton */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <SkeletonBlock className="h-5 w-5 rounded-md" />
              <SkeletonBlock className="h-6 w-64" />
            </div>
            <SkeletonBlock className="h-4 w-80 max-w-full" />
          </div>

          <div className="flex flex-wrap gap-2 lg:justify-end">
            <SkeletonBlock className="h-10 w-32 rounded-xl" />
            <SkeletonBlock className="h-10 w-44 rounded-xl" />
          </div>
        </div>

        {/* Template Box Skeleton */}
        <div className="rounded-2xl border border-[#cad8d2]/60 bg-[#f2f7f5]/70 p-5">
          <div className="mb-4 flex items-start gap-3">
            <SkeletonBlock className="h-10 w-10 rounded-xl" />
            <div className="flex-1 space-y-1.5">
              <SkeletonBlock className="h-5 w-44" />
              <SkeletonBlock className="h-3.5 w-80 max-w-full" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SkeletonBlock className="h-10 w-full rounded-xl" />
            <SkeletonBlock className="h-10 w-full rounded-xl" />
            <SkeletonBlock className="h-10 w-full rounded-xl" />
            <SkeletonBlock className="h-10 w-full rounded-xl" />
          </div>
        </div>

        {/* Form Card 1 Skeleton: ข้อมูลส่วนหัว */}
        <div className="space-y-5 rounded-2xl border border-gray-100 bg-white p-6 shadow-xs">
          <SkeletonBlock className="h-6 w-36" />
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <SkeletonBlock className="h-4 w-28" />
                <SkeletonBlock className="h-10 w-full rounded-xl" />
              </div>
            ))}
          </div>
        </div>

        {/* Form Card 2 Skeleton */}
        <div className="space-y-5 rounded-2xl border border-gray-100 bg-white p-6 shadow-xs">
          <SkeletonBlock className="h-6 w-48" />
          <div className="space-y-2">
            <SkeletonBlock className="h-4 w-32" />
            <SkeletonBlock className="h-28 w-full rounded-xl" />
          </div>
        </div>
      </main>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  );
}

function Section({
  number,
  title,
  children,
}: {
  number?: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm md:p-6">
      <h2 className="mb-5 text-lg font-semibold text-gray-900">
        {number ? `${number}. ` : ""}
        {title}
      </h2>
      {children}
    </section>
  );
}

function StringList({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (value: string[]) => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-3">
      {values.map((value, index) => (
        <div key={index} className="flex items-start gap-2">
          <span className="mt-2.5 w-8 shrink-0 text-sm text-gray-500">
            {index + 1}.
          </span>
          <textarea
            className={`${inputClass} min-h-20 resize-y`}
            placeholder={placeholder}
            value={value}
            onChange={(event) =>
              onChange(
                values.map((item, itemIndex) =>
                  itemIndex === index ? event.target.value : item,
                ),
              )
            }
          />
          <button
            aria-label="ลบรายการ"
            className="mt-1 rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-500"
            disabled={values.length === 1}
            type="button"
            onClick={() =>
              onChange(values.filter((_, itemIndex) => itemIndex !== index))
            }
          >
            <Trash2 size={17} />
          </button>
        </div>
      ))}
      <button
        className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-[#5d7c6f] hover:bg-[#f0f4f2]"
        type="button"
        onClick={() => onChange([...values, ""])}
      >
        <Plus size={16} /> เพิ่มรายการ
      </button>
    </div>
  );
}

function ResponsibleSelect({
  value,
  onChange,
  teachers,
  people,
  defaultCreator,
}: {
  value: string;
  onChange: (value: string) => void;
  teachers: any[];
  people: any[];
  defaultCreator: string;
}) {
  const teacherOptions = teachers
    .map((t) => `${t.prefix_name || ""}${t.firstname} ${t.lastname}`.trim())
    .filter(Boolean);

  const peopleOptions = people
    .map((p) => ({
      name: `${p.prefix_name || ""}${p.firstname} ${p.lastname}`.trim(),
      position: p.position || "",
    }))
    .filter((p) => Boolean(p.name));

  const allKnownNames = new Set([
    defaultCreator,
    ...teacherOptions,
    ...peopleOptions.map((p) => p.name),
  ]);
  const currentVal = value || "";
  const isUnknown = currentVal && !allKnownNames.has(currentVal);
  const options = new Map<string, string>();

  if (defaultCreator) {
    options.set(defaultCreator, `★ ${defaultCreator} (ผู้สร้างค่าย)`);
  }
  if (isUnknown) options.set(currentVal, currentVal);
  teacherOptions.forEach((name) => {
    if (!options.has(name)) options.set(name, `${name} (ครู)`);
  });
  peopleOptions.forEach((person) => {
    if (!options.has(person.name)) {
      options.set(
        person.name,
        `${person.name}${person.position ? ` (${person.position})` : ""}`,
      );
    }
  });

  return (
    <Select
      aria-label="ผู้รับผิดชอบโครงการ"
      className="w-full"
      classNames={selectClassNames}
      placeholder="เลือกผู้รับผิดชอบ"
      selectedKeys={currentVal ? [currentVal] : []}
      variant="bordered"
      onChange={(event) => onChange(event.target.value)}
    >
      {Array.from(options.entries()).map(([optionValue, label]) => (
        <SelectItem key={optionValue} textValue={label}>
          {label}
        </SelectItem>
      ))}
    </Select>
  );
}

export default function ProjectDocumentPage() {
  const params = useParams();
  const campId = String(params.id);
  const { showError, showSuccess, showConfirm, setIsLoading } =
    useStatusModal();
  const [document, setDocument] = useState<any>(null);
  const [people, setPeople] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [standardOptions, setStandardOptions] = useState<
    DocumentStandardOption[]
  >([]);
  const [strategyOptions, setStrategyOptions] = useState<
    DocumentStrategyOption[]
  >([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [loading, setLoading] = useState(true);
  const readOnly = document?.status === "FINALIZED";

  const loadTemplates = async () => {
    const response = await fetch("/api/project-document-templates");

    if (!response.ok) return [];
    const data = await response.json();

    setTemplates(data);

    return data;
  };

  useEffect(() => {
    Promise.all([
      fetch(`/api/camps/${campId}/project-document`).then(async (response) => {
        if (!response.ok)
          throw new Error(
            (await response.json()).error || "โหลดเอกสารไม่สำเร็จ",
          );

        return response.json();
      }),
      fetch("/api/document-personnel").then((response) =>
        response.ok ? response.json() : [],
      ),
      fetch("/api/project-document-templates").then((response) =>
        response.ok ? response.json() : [],
      ),
      fetch("/api/teachers").then((response) =>
        response.ok ? response.json() : [],
      ),
      fetch("/api/document-reference-options").then((response) =>
        response.ok ? response.json() : [],
      ),
    ])
      .then(
        ([
          documentData,
          personnelData,
          templateData,
          teachersData,
          referenceOptionsData,
        ]) => {
          setDocument(documentData);
          setPeople(Array.isArray(personnelData) ? personnelData : []);
          setTemplates(Array.isArray(templateData) ? templateData : []);
          setTeachers(
            Array.isArray(teachersData)
              ? teachersData
              : Array.isArray(teachersData?.data)
                ? teachersData.data
                : [],
          );
          setStandardOptions(
            normalizeDocumentStandardOptions(referenceOptionsData),
          );
          setStrategyOptions(
            normalizeDocumentStrategyOptions(referenceOptionsData),
          );
        },
      )
      .catch((error) => showError("ข้อผิดพลาด", error.message))
      .finally(() => setLoading(false));
  }, [campId]);

  const update = (key: string, value: any) => {
    if (readOnly && !(key === "status" && value === "DRAFT")) return;
    setDocument((current: any) => ({ ...current, [key]: value }));
  };

  const standardSelection = readStandardReferenceSelection(
    document?.standards,
    standardOptions,
  );

  const toggleStandardReference = (
    standard: DocumentStandardOption,
    selected: boolean,
  ) => {
    const standardCode = documentStandardCode(standard);
    const indicatorCodes = new Set(standardSelection.indicatorCodes);

    update(
      "standards",
      updateStandardReferenceSelection(document.standards, standardOptions, {
        standardCodes: selected
          ? [...standardSelection.standardCodes, standardCode]
          : standardSelection.standardCodes.filter(
              (code) => code !== standardCode,
            ),
        clauseCodes: selected
          ? standardSelection.clauseCodes
          : standardSelection.clauseCodes.filter(
              (code) => code.split(".")[0] !== standardCode,
            ),
        indicatorCodes: selected
          ? Array.from(indicatorCodes)
          : Array.from(indicatorCodes).filter(
              (code) => code.split(".")[0] !== standardCode,
            ),
      }),
    );
  };

  const toggleClauseReference = (
    standard: DocumentStandardOption,
    clause: DocumentStandardClause,
    selected: boolean,
  ) => {
    const clauseCodes = new Set(standardSelection.clauseCodes);
    const indicatorCodes = new Set(standardSelection.indicatorCodes);

    if (selected) {
      clauseCodes.add(clause.code);
    } else {
      clauseCodes.delete(clause.code);
      for (const indicator of standard.indicators) {
        if (indicator.clauseCode === clause.code) {
          indicatorCodes.delete(indicator.code);
        }
      }
    }

    update(
      "standards",
      updateStandardReferenceSelection(document.standards, standardOptions, {
        standardCodes: selected
          ? [...standardSelection.standardCodes, documentStandardCode(standard)]
          : standardSelection.standardCodes,
        clauseCodes: Array.from(clauseCodes),
        indicatorCodes: Array.from(indicatorCodes),
      }),
    );
  };

  const toggleIndicatorReference = (
    standard: DocumentStandardOption,
    indicator: DocumentStandardIndicator,
    selected: boolean,
  ) => {
    const indicatorCodes = new Set(standardSelection.indicatorCodes);
    if (selected) indicatorCodes.add(indicator.code);
    else indicatorCodes.delete(indicator.code);

    update(
      "standards",
      updateStandardReferenceSelection(document.standards, standardOptions, {
        standardCodes: selected
          ? [...standardSelection.standardCodes, documentStandardCode(standard)]
          : standardSelection.standardCodes,
        clauseCodes: standardSelection.clauseCodes,
        indicatorCodes: Array.from(indicatorCodes),
      }),
    );
  };

  const toggleStrategyReference = (
    strategy: DocumentStrategyOption,
    selected: boolean,
  ) => {
    update(
      "strategy",
      updateDocumentStrategySelection(document.strategy, strategy, selected),
    );
  };

  const refreshFromCamp = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/camps/${campId}/project-document`);
      const data = await response.json();

      if (!response.ok || !data.camp_source) {
        throw new Error(data.error || "ไม่สามารถดึงข้อมูลล่าสุดจากค่ายได้");
      }

      const source = data.camp_source;

      setDocument((current: any) => ({
        ...current,
        fiscal_year: source.fiscal_year,
        project_name: source.project_name,
        activity_name: source.activity_name,
        responsible_people: source.responsible_people,
        rationale: source.rationale,
        duration_text: source.duration_text,
        location_text: source.location_text,
        camp_source: source,
      }));
      showSuccess(
        "ดึงข้อมูลค่ายแล้ว",
        "อัปเดตชื่อโครงการ ผู้รับผิดชอบ รายละเอียด ระยะเวลา และสถานที่แล้ว",
      );
    } catch (error: any) {
      showError("ดึงข้อมูลไม่สำเร็จ", error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const save = async (nextStatus = document?.status || "DRAFT") => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/camps/${campId}/project-document`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...document, status: nextStatus }),
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "บันทึกเอกสารไม่สำเร็จ");
      setDocument(data);
      showSuccess(
        nextStatus === "FINALIZED" ? "ยืนยันเอกสารแล้ว" : "บันทึกแล้ว",
        "บันทึกข้อมูลเอกสารโครงการเรียบร้อยแล้ว",
      );

      return true;
    } catch (error: any) {
      showError("บันทึกไม่สำเร็จ", error.message);

      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const download = async (format: "pdf" | "docx") => {
    if (!readOnly && !(await save(document.status || "DRAFT"))) return;
    window.location.href = `/api/camps/${campId}/project-document/${format}`;
  };

  const applyTemplate = () => {
    const template = templates.find(
      (item) =>
        item.project_document_template_id === Number(selectedTemplateId),
    );

    if (!template) {
      showError("ยังไม่ได้เลือกเทมเพลต", "กรุณาเลือกเทมเพลตที่ต้องการใช้");

      return;
    }

    const data = JSON.parse(JSON.stringify(template.template_data || {}));

    setDocument((current: any) => ({
      ...current,
      ...data,
      fiscal_year: current.fiscal_year,
      project_name: current.project_name,
      project_code: current.project_code,
      activity_name: current.activity_name,
      activity_order: current.activity_order,
      responsible_people: current.responsible_people,
      duration_text: current.duration_text,
      location_text: current.location_text,
      camp_source: current.camp_source,
    }));
    showSuccess(
      "ใช้เทมเพลตแล้ว",
      "เติมเนื้อหาจากเทมเพลตโดยคงข้อมูลเฉพาะของค่ายนี้ไว้",
    );
  };

  const saveTemplate = async () => {
    if (!templateName.trim()) {
      showError("ยังไม่ได้ตั้งชื่อ", "กรุณาระบุชื่อเทมเพลต");

      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/project-document-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: templateName,
          template_data: document,
        }),
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "บันทึกเทมเพลตไม่สำเร็จ");
      await loadTemplates();
      setSelectedTemplateId(String(data.project_document_template_id));
      setTemplateName("");
      showSuccess(
        "บันทึกเทมเพลตแล้ว",
        "ครั้งต่อไปสามารถเลือกเทมเพลตนี้ได้ทันที",
      );
    } catch (error: any) {
      showError("บันทึกไม่สำเร็จ", error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteTemplate = () => {
    const template = templates.find(
      (item) =>
        item.project_document_template_id === Number(selectedTemplateId),
    );

    if (!template) {
      showError("ยังไม่ได้เลือกเทมเพลต", "กรุณาเลือกเทมเพลตที่ต้องการลบ");

      return;
    }

    showConfirm(
      "ลบเทมเพลต",
      `ต้องการลบเทมเพลต “${template.name}” ใช่หรือไม่`,
      async () => {
        setIsLoading(true);
        try {
          const response = await fetch(
            `/api/project-document-templates/${template.project_document_template_id}`,
            { method: "DELETE" },
          );

          if (!response.ok) throw new Error();
          setSelectedTemplateId("");
          await loadTemplates();
          showSuccess("ลบแล้ว", "ลบเทมเพลตเรียบร้อยแล้ว");
        } catch {
          showError("ลบไม่สำเร็จ", "ไม่สามารถลบเทมเพลตได้");
        } finally {
          setIsLoading(false);
        }
      },
      "ลบเทมเพลต",
    );
  };

  if (loading || !document) {
    return <ProjectDocumentSkeleton />;
  }

  return (
    <div className="min-h-screen bg-[#f5f5f2] pb-24">
      <main className="mx-auto max-w-6xl space-y-5 px-4 pb-24 pt-8">
        <div className="space-y-6">
          <CampBreadcrumb campId={campId} currentPage="เอกสารข้อเสนอโครงการ" />

          <DocumentEditorHeader
            description="กรอกข้อมูลโครงการและกำหนดผู้ลงนามในเอกสารให้ครบถ้วน"
            icon={<LayoutTemplate size={21} />}
            isFinalized={readOnly}
            title="เอกสารข้อเสนอโครงการ"
            onDownload={download}
            onFinalize={() => save("FINALIZED")}
            onSaveDraft={() => save("DRAFT")}
            onUnlock={() => update("status", "DRAFT")}
          />
        </div>

        {/* prettier-ignore */}
        <fieldset
          className={
            readOnly
              ? "min-w-0 space-y-5 [&_button]:cursor-not-allowed [&_button]:opacity-40"
              : "min-w-0 space-y-5"
          }
          disabled={readOnly}
        >
        <section className="flex flex-col gap-4 rounded-2xl border border-[#cad8d2] bg-[#f2f7f5] p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-semibold text-gray-900">เติมข้อมูลจากค่าย</p>
            <p className="mt-1 text-sm text-gray-600">
              ดึงชื่อโครงการ ผู้สร้างค่าย คำอธิบาย วันจัดค่าย
              และสถานที่มาใส่ในเอกสารข้อเสนอ
            </p>
          </div>
          <button
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#5d7c6f] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#4b685c]"
            type="button"
            onClick={refreshFromCamp}
          >
            <RefreshCw size={16} /> ดึงข้อมูลล่าสุดจากค่าย
          </button>
        </section>

        <DocumentTemplatePanel
          description="นำเนื้อหาเดิมมาใช้กับค่ายใหม่ โดยระบบจะคงชื่อค่าย รหัสกิจกรรม วันที่ สถานที่ และผู้รับผิดชอบของค่ายปัจจุบันไว้"
          disabled={readOnly}
          newTemplateName={templateName}
          selectedTemplateId={selectedTemplateId}
          templates={templates.map((template) => ({
            id: String(template.project_document_template_id),
            name: template.name,
          }))}
          title="เท็มเพลตเอกสารเสนอโครงการ"
          onApply={applyTemplate}
          onDelete={deleteTemplate}
          onNewTemplateNameChange={setTemplateName}
          onSave={saveTemplate}
          onSelectedTemplateChange={setSelectedTemplateId}
        />

        <Section title="ข้อมูลส่วนหัว">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="ปีงบประมาณ (พ.ศ.)">
              <input
                className={inputClass}
                min="2500"
                type="number"
                value={document.fiscal_year}
                onChange={(event) =>
                  update("fiscal_year", Number(event.target.value))
                }
              />
            </Field>
            <Field label="รหัสโครงการ/กิจกรรม">
              <input
                className={inputClass}
                value={document.project_code || ""}
                onChange={(event) => update("project_code", event.target.value)}
              />
            </Field>
            <Field label="ชื่อโครงการ">
              <input
                className={inputClass}
                value={document.project_name}
                onChange={(event) => update("project_name", event.target.value)}
              />
            </Field>
            <Field label="ชื่อกิจกรรม">
              <input
                className={inputClass}
                value={document.activity_name || ""}
                onChange={(event) =>
                  update("activity_name", event.target.value)
                }
              />
            </Field>
            <Field label="ลำดับกิจกรรม">
              <input
                className={inputClass}
                value={document.activity_order || ""}
                onChange={(event) =>
                  update("activity_order", event.target.value)
                }
              />
            </Field>
            <Field label="ลักษณะโครงการ">
              <Select
                aria-label="ลักษณะโครงการ"
                className="w-full"
                classNames={selectClassNames}
                selectedKeys={[document.project_type]}
                variant="bordered"
                onChange={(event) => update("project_type", event.target.value)}
              >
                <SelectItem key="NEW">โครงการใหม่</SelectItem>
                <SelectItem key="CONTINUING">โครงการต่อเนื่อง</SelectItem>
              </Select>
            </Field>
            <Field label="ผู้รับผิดชอบโครงการ">
              <ResponsibleSelect
                defaultCreator={document.creator_name || ""}
                people={people}
                teachers={teachers}
                value={document.responsible_people || ""}
                onChange={(val) => update("responsible_people", val)}
              />
            </Field>
            <Field label="กลุ่มงาน/กลุ่มสาระฯ/ระดับ">
              <input
                className={inputClass}
                value={document.department || ""}
                onChange={(event) => update("department", event.target.value)}
              />
            </Field>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <span className={labelClass}>สนองมาตรฐานการศึกษา</span>
              <p className="mb-3 text-xs text-gray-500">
                เลือกมาตรฐานและตัวชี้วัดจากรายการที่แอดมินกำหนด
              </p>
              <DocumentStandardsChecklist
                disabled={readOnly}
                isClauseSelected={(_, clause) =>
                  standardSelection.clauseCodes.includes(clause.code)
                }
                isIndicatorSelected={(_, indicator) =>
                  standardSelection.indicatorCodes.includes(indicator.code)
                }
                isStandardSelected={(standard) =>
                  standardSelection.standardCodes.includes(
                    documentStandardCode(standard),
                  )
                }
                standards={standardOptions}
                onToggleClause={toggleClauseReference}
                onToggleIndicator={toggleIndicatorReference}
                onToggleStandard={toggleStandardReference}
              />
              <span className={`${labelClass} mt-4`}>รายละเอียดเพิ่มเติม</span>
              <textarea
                className={`${inputClass} min-h-28 resize-y`}
                placeholder="รายการที่เลือกจะแสดงที่นี่ และสามารถพิมพ์เพิ่มเติมได้"
                value={document.standards || ""}
                onChange={(event) =>
                  update("standards", event.target.value)
                }
              />
            </div>
            <div>
              <span className={labelClass}>กลยุทธ์โรงเรียน</span>
              <p className="mb-3 text-xs text-gray-500">
                เลือกกลยุทธ์จากรายการที่แอดมินกำหนด
              </p>
              <DocumentStrategiesChecklist
                disabled={readOnly}
                isStrategySelected={(strategy) =>
                  isDocumentStrategySelected(document.strategy, strategy)
                }
                strategies={strategyOptions}
                onToggleStrategy={toggleStrategyReference}
              />
              <span className={`${labelClass} mt-4`}>รายละเอียดเพิ่มเติม</span>
              <textarea
                className={`${inputClass} min-h-28 resize-y`}
                placeholder="รายการที่เลือกจะแสดงที่นี่ และสามารถพิมพ์เพิ่มเติมได้"
                value={document.strategy || ""}
                onChange={(event) => update("strategy", event.target.value)}
              />
            </div>
          </div>
        </Section>

        <Section number="1" title="หลักการและเหตุผล">
          <textarea
            className={`${inputClass} min-h-48 resize-y`}
            value={document.rationale || ""}
            onChange={(event) => update("rationale", event.target.value)}
          />
        </Section>
        <Section number="2" title="วัตถุประสงค์">
          <StringList
            placeholder="ระบุวัตถุประสงค์"
            values={document.objectives}
            onChange={(value) => update("objectives", value)}
          />
        </Section>
        <Section number="3" title="เป้าหมาย">
          <h3 className="mb-3 font-medium text-gray-800">3.1 เชิงปริมาณ</h3>
          <StringList
            placeholder="ระบุเป้าหมายเชิงปริมาณ"
            values={document.quantitative_targets}
            onChange={(value) => update("quantitative_targets", value)}
          />
          <h3 className="mb-3 mt-6 font-medium text-gray-800">
            3.2 เชิงคุณภาพ
          </h3>
          <StringList
            placeholder="ระบุเป้าหมายเชิงคุณภาพ"
            values={document.qualitative_targets}
            onChange={(value) => update("qualitative_targets", value)}
          />
        </Section>

        <Section number="4" title="วิธีดำเนินการ">
          <div className="space-y-4">
            {document.procedures.map((row: any, index: number) => (
              <div
                key={index}
                className="rounded-xl border border-gray-200 bg-gray-50 p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-medium text-gray-700">
                    ขั้นตอนที่ {index + 1}
                  </span>
                  <button
                    className="text-gray-400 hover:text-red-500"
                    type="button"
                    onClick={() =>
                      update(
                        "procedures",
                        document.procedures.filter(
                          (_: any, rowIndex: number) => rowIndex !== index,
                        ),
                      )
                    }
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="ขั้นตอน (เช่น 1. วางแผน / Plan)">
                    <input
                      className={inputClass}
                      placeholder="ขั้นตอน เช่น 1. วางแผน (Plan)"
                      value={row.step}
                      onChange={(event) =>
                        update(
                          "procedures",
                          document.procedures.map(
                            (item: any, rowIndex: number) =>
                              rowIndex === index
                                ? { ...item, step: event.target.value }
                                : item,
                          ),
                        )
                      }
                    />
                  </Field>
                  <Field label="ระยะเวลา">
                    <input
                      className={inputClass}
                      placeholder="เช่น ต.ค. - พ.ย. 67"
                      value={row.period}
                      onChange={(event) =>
                        update(
                          "procedures",
                          document.procedures.map(
                            (item: any, rowIndex: number) =>
                              rowIndex === index
                                ? { ...item, period: event.target.value }
                                : item,
                          ),
                        )
                      }
                    />
                  </Field>
                  <div className="md:col-span-2">
                    <Field label="วิธีดำเนินการ (รายละเอียดกิจกรรม)">
                      <textarea
                        className={`${inputClass} min-h-24 resize-y`}
                        placeholder="รายละเอียดวิธีดำเนินการ"
                        value={row.method}
                        onChange={(event) =>
                          update(
                            "procedures",
                            document.procedures.map(
                              (item: any, rowIndex: number) =>
                                rowIndex === index
                                  ? { ...item, method: event.target.value }
                                  : item,
                            ),
                          )
                        }
                      />
                    </Field>
                  </div>
                  <Field label="งบประมาณ (บาท)">
                    <input
                      className={inputClass}
                      min="0"
                      placeholder="0"
                      type="number"
                      value={row.budget}
                      onChange={(event) =>
                        update(
                          "procedures",
                          document.procedures.map(
                            (item: any, rowIndex: number) =>
                              rowIndex === index
                                ? {
                                    ...item,
                                    budget: Number(event.target.value),
                                  }
                                : item,
                          ),
                        )
                      }
                    />
                  </Field>
                  <Field label="ผู้รับผิดชอบ">
                    <ResponsibleSelect
                      defaultCreator={document.creator_name || ""}
                      people={people}
                      teachers={teachers}
                      value={row.responsible || ""}
                      onChange={(val) =>
                        update(
                          "procedures",
                          document.procedures.map(
                            (item: any, rowIndex: number) =>
                              rowIndex === index
                                ? { ...item, responsible: val }
                                : item,
                          ),
                        )
                      }
                    />
                  </Field>
                </div>
              </div>
            ))}
            <button
              className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-[#5d7c6f] hover:bg-[#f0f4f2]"
              type="button"
              onClick={() =>
                update("procedures", [
                  ...document.procedures,
                  {
                    step: "",
                    method: "",
                    period: "",
                    budget: 0,
                    responsible: document.creator_name || "",
                  },
                ])
              }
            >
              <Plus size={16} /> เพิ่มขั้นตอน
            </button>
          </div>
        </Section>

        <Section number="5" title="ระยะเวลาในการดำเนินการ">
          <Field label="ระยะเวลาดำเนินการ">
            <input
              className={inputClass}
              value={document.duration_text || ""}
              onChange={(event) =>
                update("duration_text", event.target.value)
              }
            />
          </Field>
        </Section>

        <Section number="6" title="สถานที่ดำเนินงาน">
          <Field label="สถานที่ดำเนินงาน">
            <input
              className={inputClass}
              value={document.location_text || ""}
              onChange={(event) =>
                update("location_text", event.target.value)
              }
            />
          </Field>
        </Section>

        <Section number="7" title="งบประมาณ">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="งบประมาณรวม">
              <input
                className={inputClass}
                min="0"
                type="number"
                value={document.budget_total}
                onChange={(event) =>
                  update("budget_total", Number(event.target.value))
                }
              />
            </Field>
            <div>
              <span className={labelClass}>แหล่งงบประมาณ</span>
              <Select
                aria-label="แหล่งงบประมาณ"
                className="w-full"
                classNames={selectClassNames}
                placeholder="เลือกแหล่งงบประมาณ"
                selectedKeys={
                  getBudgetSourceOption(document.budget_source)
                    ? [getBudgetSourceOption(document.budget_source)]
                    : []
                }
                variant="bordered"
                onChange={(event) =>
                  update("budget_source", event.target.value)
                }
              >
                <SelectItem key={BUDGET_SOURCE_INCOME}>
                  {BUDGET_SOURCE_INCOME}
                </SelectItem>
                <SelectItem key={BUDGET_SOURCE_SUBSIDY}>
                  {BUDGET_SOURCE_SUBSIDY}
                </SelectItem>
                <SelectItem key={BUDGET_SOURCE_OTHER}>
                  {BUDGET_SOURCE_OTHER}
                </SelectItem>
              </Select>
              {getBudgetSourceOption(document.budget_source) ===
                BUDGET_SOURCE_OTHER && (
                <input
                  aria-label="ระบุแหล่งงบประมาณอื่นๆ"
                  className={`${inputClass} mt-2`}
                  placeholder="ระบุแหล่งงบประมาณ"
                  value={getCustomBudgetSource(document.budget_source)}
                  onChange={(event) =>
                    update(
                      "budget_source",
                      event.target.value || BUDGET_SOURCE_OTHER,
                    )
                  }
                />
              )}
            </div>
          </div>
          <h3 className="mb-3 mt-6 font-medium text-gray-800">
            รายการใช้งบประมาณ
          </h3>
          <div className="space-y-4">
            {document.budget_items.map((row: any, index: number) => (
              <div
                key={index}
                className="rounded-xl border border-gray-200 bg-gray-50 p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-medium text-gray-700">
                    รายการที่ {index + 1}
                  </span>
                  <button
                    className="text-gray-400 hover:text-red-500"
                    type="button"
                    onClick={() =>
                      update(
                        "budget_items",
                        document.budget_items.filter(
                          (_: any, rowIndex: number) => rowIndex !== index,
                        ),
                      )
                    }
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6">
                  <div className="md:col-span-2 lg:col-span-2">
                    <Field label="กิจกรรม/รายการ">
                      <input
                        className={inputClass}
                        placeholder="ชื่อกิจกรรมหรือรายการ"
                        value={row.description}
                        onChange={(event) =>
                          update(
                            "budget_items",
                            document.budget_items.map(
                              (item: any, rowIndex: number) =>
                                rowIndex === index
                                  ? { ...item, description: event.target.value }
                                  : item,
                            ),
                          )
                        }
                      />
                    </Field>
                  </div>
                  <Field label="ค่าตอบแทน (บาท)">
                    <input
                      className={inputClass}
                      min="0"
                      placeholder="0"
                      type="number"
                      value={row.compensation}
                      onChange={(event) =>
                        update(
                          "budget_items",
                          document.budget_items.map(
                            (item: any, rowIndex: number) =>
                              rowIndex === index
                                ? {
                                    ...item,
                                    compensation: Number(event.target.value),
                                  }
                                : item,
                          ),
                        )
                      }
                    />
                  </Field>
                  <Field label="ค่าใช้สอย (บาท)">
                    <input
                      className={inputClass}
                      min="0"
                      placeholder="0"
                      type="number"
                      value={row.expenses}
                      onChange={(event) =>
                        update(
                          "budget_items",
                          document.budget_items.map(
                            (item: any, rowIndex: number) =>
                              rowIndex === index
                                ? {
                                    ...item,
                                    expenses: Number(event.target.value),
                                  }
                                : item,
                          ),
                        )
                      }
                    />
                  </Field>
                  <Field label="ค่าวัสดุ (บาท)">
                    <input
                      className={inputClass}
                      min="0"
                      placeholder="0"
                      type="number"
                      value={row.materials}
                      onChange={(event) =>
                        update(
                          "budget_items",
                          document.budget_items.map(
                            (item: any, rowIndex: number) =>
                              rowIndex === index
                                ? {
                                    ...item,
                                    materials: Number(event.target.value),
                                  }
                                : item,
                          ),
                        )
                      }
                    />
                  </Field>
                  <Field label="ผู้รับผิดชอบ">
                    <ResponsibleSelect
                      defaultCreator={document.creator_name || ""}
                      people={people}
                      teachers={teachers}
                      value={row.responsible || ""}
                      onChange={(val) =>
                        update(
                          "budget_items",
                          document.budget_items.map(
                            (item: any, rowIndex: number) =>
                              rowIndex === index
                                ? { ...item, responsible: val }
                                : item,
                          ),
                        )
                      }
                    />
                  </Field>
                </div>
              </div>
            ))}
          </div>
          <button
            className="mt-3 inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-[#5d7c6f] hover:bg-[#f0f4f2]"
            type="button"
            onClick={() =>
              update("budget_items", [
                ...document.budget_items,
                {
                  description: "",
                  compensation: 0,
                  expenses: 0,
                  materials: 0,
                  responsible: document.creator_name || "",
                },
              ])
            }
          >
            <Plus size={16} /> เพิ่มรายการงบประมาณ
          </button>
        </Section>

        <Section number="8" title="การวัดและประเมินผล">
          <div className="space-y-4">
            {document.evaluations.map((row: any, index: number) => (
              <div
                key={index}
                className="rounded-xl border border-gray-200 bg-gray-50 p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-medium text-gray-700">
                    ตัวชี้วัดที่ {index + 1}
                  </span>
                  <button
                    className="text-gray-400 hover:text-red-500"
                    type="button"
                    onClick={() =>
                      update(
                        "evaluations",
                        document.evaluations.filter(
                          (_: any, rowIndex: number) => rowIndex !== index,
                        ),
                      )
                    }
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <Field label="ตัวชี้วัดความสำเร็จ">
                      <textarea
                        className={`${inputClass} min-h-20 resize-y`}
                        placeholder="ระบุตัวชี้วัดความสำเร็จของโครงการ"
                        value={row.indicator}
                        onChange={(event) =>
                          update(
                            "evaluations",
                            document.evaluations.map(
                              (item: any, rowIndex: number) =>
                                rowIndex === index
                                  ? { ...item, indicator: event.target.value }
                                  : item,
                            ),
                          )
                        }
                      />
                    </Field>
                  </div>
                  <Field label="วิธีวัด">
                    <input
                      className={inputClass}
                      placeholder="เช่น การประเมิน, การสังเกต, ตรวจผลงาน"
                      value={row.method}
                      onChange={(event) =>
                        update(
                          "evaluations",
                          document.evaluations.map(
                            (item: any, rowIndex: number) =>
                              rowIndex === index
                                ? { ...item, method: event.target.value }
                                : item,
                          ),
                        )
                      }
                    />
                  </Field>
                  <Field label="เครื่องมือ">
                    <input
                      className={inputClass}
                      placeholder="เช่น แบบประเมินความพึงพอใจ, แบบสังเกต"
                      value={row.tool}
                      onChange={(event) =>
                        update(
                          "evaluations",
                          document.evaluations.map(
                            (item: any, rowIndex: number) =>
                              rowIndex === index
                                ? { ...item, tool: event.target.value }
                                : item,
                          ),
                        )
                      }
                    />
                  </Field>
                </div>
              </div>
            ))}
          </div>
          <button
            className="mt-3 inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-[#5d7c6f] hover:bg-[#f0f4f2]"
            type="button"
            onClick={() =>
              update("evaluations", [
                ...document.evaluations,
                { indicator: "", method: "", tool: "" },
              ])
            }
          >
            <Plus size={16} /> เพิ่มตัวชี้วัด
          </button>
        </Section>

        <Section number="9" title="ผลที่คาดว่าจะได้รับ">
          <StringList
            placeholder="ระบุผลที่คาดว่าจะได้รับ"
            values={document.expected_results}
            onChange={(value) => update("expected_results", value)}
          />
        </Section>

        <Section title="ช่องลงนาม">
          <p className="mb-4 text-sm text-gray-500">
            บทบาทเป็นข้อความของช่องในเอกสาร
            บุคลากรไม่ได้ถูกผูกกับบทบาทใดไว้ล่วงหน้า
          </p>
          <div className="space-y-3">
            {(document.signatories || []).map((row: any, index: number) => {
              const currentExists = people.some(
                (person) =>
                  person.document_personnel_id === Number(row.personnelId),
              );

              return (
                <div
                  key={index}
                  className="rounded-xl border border-gray-200 bg-gray-50 p-4"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span className="font-medium text-gray-700">
                      ลำดับที่ {index + 1}
                    </span>
                    <button
                      className="text-gray-400 hover:text-red-500"
                      type="button"
                      onClick={() =>
                        update(
                          "signatories",
                          document.signatories.filter(
                            (_: any, rowIndex: number) => rowIndex !== index,
                          ),
                        )
                      }
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="บทบาท/ข้อความใต้ช่องลงนาม">
                      <input
                        className={inputClass}
                        placeholder="บทบาท เช่น ผู้อนุมัติโครงการ หรือ ผู้เสนอโครงการ"
                        value={row.role}
                        onChange={(event) =>
                          update(
                            "signatories",
                            document.signatories.map(
                              (item: any, rowIndex: number) =>
                                rowIndex === index
                                  ? { ...item, role: event.target.value }
                                  : item,
                            ),
                          )
                        }
                      />
                    </Field>
                    <Field label="เลือกบุคลากร">
                      <Select
                        aria-label={`เลือกบุคลากรช่องลงนามลำดับที่ ${index + 1}`}
                        className="w-full"
                        classNames={selectClassNames}
                        placeholder="เลือกบุคลากร"
                        selectedKeys={
                          row.personnelId ? [String(row.personnelId)] : []
                        }
                        variant="bordered"
                        onChange={(event) =>
                          update(
                            "signatories",
                            document.signatories.map(
                              (item: any, rowIndex: number) =>
                                rowIndex === index
                                  ? {
                                      ...item,
                                      personnelId: Number(event.target.value),
                                    }
                                  : item,
                            ),
                          )
                        }
                      >
                        {!currentExists && row.personnelId && (
                          <SelectItem
                            key={String(row.personnelId)}
                            textValue={`${row.prefixName || ""}${row.firstname} ${row.lastname} - ${row.position}`}
                          >
                            {row.prefixName || ""}
                            {row.firstname} {row.lastname} - {row.position}
                          </SelectItem>
                        )}
                        {people.map((person) => (
                          <SelectItem
                            key={String(person.document_personnel_id)}
                            textValue={`${person.prefix_name || ""}${person.firstname} ${person.lastname} - ${person.position}`}
                          >
                            {person.prefix_name || ""}
                            {person.firstname} {person.lastname} -{" "}
                            {person.position}
                          </SelectItem>
                        ))}
                      </Select>
                    </Field>
                  </div>
                </div>
              );
            })}
          </div>
          <button
            className="mt-3 inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-[#5d7c6f] hover:bg-[#f0f4f2]"
            type="button"
            onClick={() =>
              update("signatories", [
                ...(document.signatories || []),
                { role: "", personnelId: "" },
              ])
            }
          >
            <Plus size={16} /> เพิ่มช่องลงนาม
          </button>
          {people.length === 0 && (
            <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-700">
              ยังไม่มีบุคลากรให้เลือก กรุณาให้ผู้ดูแลระบบเพิ่มในเมนู
              “บุคลากรในเอกสาร”
            </p>
          )}
        </Section>
        </fieldset>
      </main>
    </div>
  );
}
