"use client";

export type DocumentStandardIndicator = {
  code: string;
  label: string;
};

export type DocumentStandardOption = {
  document_reference_option_id: number;
  label: string;
  indicators: DocumentStandardIndicator[];
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

export function normalizeDocumentStandardOptions(
  value: unknown,
): DocumentStandardOption[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(
      (item) => item?.category === "STANDARD" && item?.is_active !== false,
    )
    .map((item) => ({
      document_reference_option_id: Number(item.document_reference_option_id),
      label: clean(item.label),
      indicators: (Array.isArray(item.indicators) ? item.indicators : [])
        .map((indicator: any) => ({
          code: clean(indicator?.code),
          label: clean(indicator?.label),
        }))
        .filter((indicator: DocumentStandardIndicator) => indicator.label),
    }))
    .filter(
      (item) =>
        Number.isInteger(item.document_reference_option_id) && item.label,
    );
}

export function documentIndicatorText(indicator: DocumentStandardIndicator) {
  return [indicator.code, indicator.label].filter(Boolean).join(" ");
}

export function updateStandardReferenceText(
  currentValue: unknown,
  removeLines: string[],
  addLines: string[],
) {
  const removed = new Set(removeLines.map(clean).filter(Boolean));
  const existing = String(currentValue ?? "")
    .split(/\r?\n/)
    .map(clean)
    .filter((line) => line && !removed.has(line));

  for (const line of addLines.map(clean).filter(Boolean)) {
    if (!existing.includes(line)) existing.push(line);
  }

  return existing.join("\n");
}

export function DocumentStandardsChecklist({
  standards,
  disabled,
  isStandardSelected,
  isIndicatorSelected,
  onToggleStandard,
  onToggleIndicator,
}: {
  standards: DocumentStandardOption[];
  disabled?: boolean;
  isStandardSelected: (standard: DocumentStandardOption) => boolean;
  isIndicatorSelected: (
    standard: DocumentStandardOption,
    indicator: DocumentStandardIndicator,
  ) => boolean;
  onToggleStandard: (
    standard: DocumentStandardOption,
    selected: boolean,
  ) => void;
  onToggleIndicator: (
    standard: DocumentStandardOption,
    indicator: DocumentStandardIndicator,
    selected: boolean,
  ) => void;
}) {
  if (!standards.length) {
    return (
      <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
        ยังไม่มีมาตรฐานจากแอดมิน สามารถกรอกข้อมูลเพิ่มเติมเองได้ด้านล่าง
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {standards.map((standard) => (
        <div
          key={standard.document_reference_option_id}
          className="rounded-xl border border-gray-200 bg-gray-50 p-4"
        >
          <label className="flex cursor-pointer items-start gap-3 text-sm font-medium text-gray-800">
            <input
              checked={isStandardSelected(standard)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[#5d7c6f]"
              disabled={disabled}
              type="checkbox"
              onChange={(event) =>
                onToggleStandard(standard, event.target.checked)
              }
            />
            <span>{standard.label}</span>
          </label>
          {standard.indicators.length ? (
            <div className="mt-3 space-y-2 border-l-2 border-[#cad8d2] pl-5">
              {standard.indicators.map((indicator, index) => (
                <label
                  key={`${indicator.code}-${indicator.label}-${index}`}
                  className="flex cursor-pointer items-start gap-3 text-sm text-gray-600"
                >
                  <input
                    checked={isIndicatorSelected(standard, indicator)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[#5d7c6f]"
                    disabled={disabled}
                    type="checkbox"
                    onChange={(event) =>
                      onToggleIndicator(
                        standard,
                        indicator,
                        event.target.checked,
                      )
                    }
                  />
                  <span>{documentIndicatorText(indicator)}</span>
                </label>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
