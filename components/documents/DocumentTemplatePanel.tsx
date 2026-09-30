"use client";

import { Select, SelectItem } from "@heroui/react";
import { LayoutTemplate, Save, Trash2 } from "lucide-react";

type TemplateOption = {
  id: string;
  name: string;
};

type DocumentTemplatePanelProps = {
  description: string;
  disabled?: boolean;
  newTemplateName: string;
  selectedTemplateId: string;
  templates: TemplateOption[];
  title: string;
  onApply: () => void;
  onDelete: () => void;
  onNewTemplateNameChange: (value: string) => void;
  onSave: () => void;
  onSelectedTemplateChange: (value: string) => void;
};

const selectClassNames = {
  trigger:
    "h-11 min-h-11 rounded-xl border border-gray-200 bg-white px-3 shadow-none transition-colors data-[focus=true]:border-[#6b857a] data-[focus=true]:ring-2 data-[focus=true]:ring-[#6b857a]/15 data-[hover=true]:border-[#9eb5ab] data-[hover=true]:bg-white",
  value: "text-sm text-gray-800 group-data-[has-value=false]:text-gray-400",
  selectorIcon: "text-[#6b857a]",
  popoverContent: "rounded-xl border border-gray-200 bg-white shadow-lg",
  listboxWrapper: "max-h-64",
};

export default function DocumentTemplatePanel({
  description,
  disabled = false,
  newTemplateName,
  selectedTemplateId,
  templates,
  title,
  onApply,
  onDelete,
  onNewTemplateNameChange,
  onSave,
  onSelectedTemplateChange,
}: DocumentTemplatePanelProps) {
  const selectedTemplate = templates.find(
    (template) => template.id === selectedTemplateId,
  );

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm md:p-6">
      <div className="mb-5 flex items-start gap-3">
        <div className="rounded-xl bg-[#edf4f1] p-2.5 text-[#5d7c6f]">
          <LayoutTemplate size={21} />
        </div>
        <div>
          <h2 className="font-semibold text-gray-900">{title}</h2>
          <p className="mt-1 max-w-3xl text-sm text-gray-600">{description}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex min-h-full flex-col rounded-xl border border-gray-200 bg-gray-50 p-4">
          <div className="mb-4">
            <p className="font-medium text-gray-900">ใช้เท็มเพลตที่บันทึกไว้</p>
            <p className="mt-1 text-sm text-gray-500">
              เลือกรายการ แล้วกดใช้หรือลบเท็มเพลตนั้น
            </p>
          </div>

          <span className="mb-1.5 block text-sm font-medium text-gray-700">
            เลือกเท็มเพลต
          </span>
          <Select
            aria-label="เลือกเท็มเพลตที่บันทึกไว้"
            className="w-full"
            classNames={selectClassNames}
            isDisabled={disabled || templates.length === 0}
            placeholder={
              templates.length ? "เลือกเท็มเพลต" : "ยังไม่มีเท็มเพลต"
            }
            selectedKeys={selectedTemplateId ? [selectedTemplateId] : []}
            variant="bordered"
            onChange={(event) => onSelectedTemplateChange(event.target.value)}
          >
            {templates.map((template) => (
              <SelectItem key={template.id} textValue={template.name}>
                {template.name}
              </SelectItem>
            ))}
          </Select>

          <div className="mt-3 min-h-5 text-xs text-gray-500">
            {selectedTemplate
              ? `เลือกอยู่: ${selectedTemplate.name}`
              : templates.length
                ? "ยังไม่ได้เลือกเท็มเพลต"
                : "บันทึกเท็มเพลตแรกได้จากช่องด้านขวา"}
          </div>

          <div className="mt-auto flex flex-col gap-2 pt-4 sm:flex-row">
            <button
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#5d7c6f] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#4b685c] disabled:cursor-not-allowed disabled:opacity-40"
              disabled={disabled || !selectedTemplateId}
              type="button"
              onClick={onApply}
            >
              <LayoutTemplate size={16} /> ใช้เท็มเพลตนี้
            </button>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={disabled || !selectedTemplateId}
              type="button"
              onClick={onDelete}
            >
              <Trash2 size={16} /> ลบ
            </button>
          </div>
        </div>

        <div className="flex min-h-full flex-col rounded-xl border border-[#cad8d2] bg-[#f7faf9] p-4">
          <div className="mb-4">
            <p className="font-medium text-gray-900">สร้างเท็มเพลตใหม่</p>
            <p className="mt-1 text-sm text-gray-500">
              บันทึกข้อมูลในแบบฟอร์มปัจจุบันไว้ใช้กับค่ายครั้งถัดไป
            </p>
          </div>

          <label
            className="mb-1.5 block text-sm font-medium text-gray-700"
            htmlFor="new-template-name"
          >
            ชื่อเท็มเพลตใหม่
          </label>
          <input
            className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-800 outline-none transition focus:border-[#6b857a] focus:ring-2 focus:ring-[#6b857a]/15 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
            disabled={disabled}
            id="new-template-name"
            placeholder="เช่น โครงการวิทยาศาสตร์ประจำปี"
            value={newTemplateName}
            onChange={(event) => onNewTemplateNameChange(event.target.value)}
          />

          <p className="mt-3 text-xs text-gray-500">
            การบันทึกจะสร้างรายการใหม่ และไม่กระทบเท็มเพลตที่เลือกอยู่
          </p>

          <button
            className="mt-auto inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#5d7c6f] bg-white px-4 py-2.5 text-sm font-medium text-[#526c61] hover:bg-[#edf4f1] disabled:cursor-not-allowed disabled:opacity-40"
            disabled={disabled || !newTemplateName.trim()}
            type="button"
            onClick={onSave}
          >
            <Save size={16} /> บันทึกเป็นเท็มเพลตใหม่
          </button>
        </div>
      </div>
    </section>
  );
}
