"use client";

import { Select, SelectItem } from "@heroui/react";
import { useState } from "react";
import {
  ChevronDown,
  CircleHelp,
  LayoutTemplate,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";

type TemplateOption = {
  id: string;
  name: string;
};

type DocumentTemplatePanelProps = {
  description: string;
  disabled?: boolean;
  helpText: string;
  loading?: boolean;
  newTemplateName: string;
  selectedTemplateId: string;
  templates: TemplateOption[];
  title: string;
  variant?: "default" | "compact";
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
  helpText,
  loading = false,
  newTemplateName,
  selectedTemplateId,
  templates,
  title,
  variant = "default",
  onApply,
  onDelete,
  onNewTemplateNameChange,
  onSave,
  onSelectedTemplateChange,
}: DocumentTemplatePanelProps) {
  const [isCreateExpanded, setIsCreateExpanded] = useState(false);
  const selectedTemplate = templates.find(
    (template) => template.id === selectedTemplateId,
  );

  return (
    <section
      className={`rounded-2xl border border-gray-200 bg-white shadow-sm ${
        variant === "compact" ? "px-5 py-4 md:px-6" : "p-5 md:p-6"
      }`}
    >
      <div
        className={`flex items-start gap-3 ${
          variant === "compact" ? "mb-3" : "mb-5"
        }`}
      >
        {variant !== "compact" && (
          <div className="rounded-xl bg-[#edf4f1] p-2.5 text-[#5d7c6f]">
            <LayoutTemplate size={21} />
          </div>
        )}
        <div className="relative min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h2
              className={`font-semibold text-gray-900 ${
                variant === "compact" ? "text-lg" : ""
              }`}
            >
              {title}
            </h2>
            <details className="group shrink-0">
              <summary
                aria-label={`คำอธิบาย${title}`}
                className="flex h-7 w-7 cursor-pointer list-none items-center justify-center rounded-full bg-[#f2f7f5] text-gray-400 transition-colors hover:bg-[#e5efe9] focus-visible:bg-[#e5efe9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5d7c6f]/40 [&::-webkit-details-marker]:hidden"
              >
                <CircleHelp aria-hidden="true" size={18} strokeWidth={1.8} />
              </summary>
              <div className="absolute left-0 top-9 z-20 w-full max-w-sm rounded-xl border border-[#cad8d2] bg-white p-3 text-sm leading-6 text-gray-700 shadow-lg">
                {helpText}
              </div>
            </details>
          </div>
          {variant !== "compact" && (
            <p className="mt-1 max-w-3xl text-sm text-gray-600">
              {description}
            </p>
          )}
        </div>
        {variant === "compact" && (
          <button
            aria-expanded={isCreateExpanded}
            className="ml-auto inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-medium text-[#526c61] transition hover:bg-[#edf4f1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5d7c6f]/30 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={disabled}
            type="button"
            onClick={() => setIsCreateExpanded((current) => !current)}
          >
            {isCreateExpanded ? <X size={15} /> : <Plus size={15} />}
            <span>{isCreateExpanded ? "ปิด" : "บันทึกใหม่"}</span>
          </button>
        )}
      </div>

      {variant === "compact" ? (
        <div>
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <select
                aria-label={`เลือก${title}`}
                className="h-11 w-full appearance-none rounded-xl border border-gray-200 bg-white py-2 pl-3 pr-10 text-sm text-gray-800 outline-none transition hover:border-[#9eb5ab] focus:border-[#6b857a] focus:ring-2 focus:ring-[#6b857a]/15 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500"
                disabled={disabled || templates.length === 0}
                value={selectedTemplateId}
                onChange={(event) =>
                  onSelectedTemplateChange(event.target.value)
                }
              >
                <option value="">
                  {loading
                    ? "กำลังโหลดเท็มเพลต..."
                    : templates.length
                    ? "เลือกเท็มเพลตที่บันทึกไว้"
                    : "ยังไม่มีเท็มเพลต"}
                </option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
              <ChevronDown
                aria-hidden="true"
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#6b857a]"
                size={16}
              />
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                aria-label={
                  selectedTemplate
                    ? `ใช้เท็มเพลต ${selectedTemplate.name}`
                    : "ใช้เท็มเพลตที่เลือก"
                }
                className="inline-flex h-11 items-center justify-center rounded-xl bg-[#5d7c6f] px-3 text-sm font-semibold text-white transition hover:bg-[#4b685c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5d7c6f]/30 disabled:cursor-not-allowed disabled:opacity-40 sm:px-4"
                disabled={disabled || !selectedTemplate}
                type="button"
                onClick={onApply}
              >
                <span className="sm:hidden">ใช้</span>
                <span className="hidden sm:inline">ใช้เท็มเพลต</span>
              </button>
              <button
                aria-label={
                  selectedTemplate
                    ? `ลบเท็มเพลต ${selectedTemplate.name}`
                    : "ลบเท็มเพลตที่เลือก"
                }
                className="inline-flex h-11 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 text-gray-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/30 disabled:cursor-not-allowed disabled:opacity-40 sm:w-11"
                disabled={disabled || !selectedTemplate}
                title="ลบเท็มเพลตที่เลือก"
                type="button"
                onClick={onDelete}
              >
                <Trash2 aria-hidden="true" size={16} />
              </button>
            </div>
          </div>

          {isCreateExpanded && (
            <form
              className="mt-3 flex flex-col gap-2 border-t border-gray-100 pt-3 sm:flex-row"
              onSubmit={(event) => {
                event.preventDefault();
                onSave();
              }}
            >
              <label className="sr-only" htmlFor="document-template-name">
                ชื่อเท็มเพลตใหม่
              </label>
              <input
                className="h-10 min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-800 outline-none transition focus:border-[#6b857a] focus:ring-2 focus:ring-[#6b857a]/15 disabled:cursor-not-allowed disabled:bg-gray-100"
                disabled={disabled}
                id="document-template-name"
                placeholder="ตั้งชื่อเท็มเพลตใหม่"
                value={newTemplateName}
                onChange={(event) =>
                  onNewTemplateNameChange(event.target.value)
                }
              />
              <button
                className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-[#5d7c6f] px-4 text-sm font-medium text-[#526c61] transition hover:bg-[#edf4f1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5d7c6f]/30 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={disabled || !newTemplateName.trim()}
                type="submit"
              >
                <Save aria-hidden="true" size={15} /> บันทึก
              </button>
            </form>
          )}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="flex min-h-full flex-col rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="mb-4">
              <p className="font-medium text-gray-900">
                ใช้เท็มเพลตที่บันทึกไว้
              </p>
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
      )}
    </section>
  );
}
