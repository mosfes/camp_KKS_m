"use client";

export type DocumentStandardIndicator = {
  code: string;
  label: string;
  clauseCode?: string;
  clauseLabel?: string;
};

export type DocumentStandardOption = {
  document_reference_option_id: number;
  label: string;
  indicators: DocumentStandardIndicator[];
};

export type DocumentStandardSelection = {
  standardCodes: string[];
  indicatorCodes: string[];
};

const STANDARD_SUMMARY_PREFIX = "มาตรฐานการศึกษาขั้นพื้นฐานฯ";

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
          clauseCode: clean(indicator?.clauseCode),
          clauseLabel: clean(indicator?.clauseLabel),
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

export function documentStandardCode(standard: DocumentStandardOption) {
  return (
    standard.label.match(/มาตรฐานที่\s*(\d+(?:\.\d+)*)/)?.[1] ||
    standard.label.match(/^\s*(\d+(?:\.\d+)*)/)?.[1] ||
    ""
  );
}

function codesFrom(value: string) {
  return value.match(/\d+(?:\.\d+)*/g) || [];
}

function compareCodes(left: string, right: string) {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const difference = (leftParts[index] ?? -1) - (rightParts[index] ?? -1);
    if (difference) return difference;
  }

  return left.localeCompare(right, "th");
}

function uniqueSortedCodes(values: string[]) {
  return Array.from(new Set(values.map(clean).filter(Boolean))).sort(
    compareCodes,
  );
}

export function readStandardReferenceSelection(
  value: unknown,
  standards: DocumentStandardOption[],
): DocumentStandardSelection {
  const text = String(value ?? "");
  const standardCodes: string[] = [];
  const indicatorCodes: string[] = [];
  const summary = text
    .split(/\r?\n/)
    .map(clean)
    .find((line) => line.startsWith(STANDARD_SUMMARY_PREFIX));

  if (summary) {
    const standardPart = summary.match(
      /มาตรฐานที่\s+(.+?)(?=\s+ข้อที่|\s+ตัวชี้วัดที่|$)/,
    )?.[1];
    const indicatorPart = summary.match(/ตัวชี้วัดที่\s+(.+)$/)?.[1];

    if (standardPart) standardCodes.push(...codesFrom(standardPart));
    if (indicatorPart) indicatorCodes.push(...codesFrom(indicatorPart));
  }

  const lines = new Set(text.split(/\r?\n/).map(clean).filter(Boolean));

  for (const standard of standards) {
    const standardCode = documentStandardCode(standard);
    if (standardCode && lines.has(standard.label))
      standardCodes.push(standardCode);

    for (const indicator of standard.indicators) {
      if (lines.has(documentIndicatorText(indicator))) {
        indicatorCodes.push(indicator.code);
        if (standardCode) standardCodes.push(standardCode);
      }
    }
  }

  return {
    standardCodes: uniqueSortedCodes(standardCodes),
    indicatorCodes: uniqueSortedCodes(indicatorCodes),
  };
}

export function formatStandardReferenceSelection(
  selection: DocumentStandardSelection,
  standards: DocumentStandardOption[],
) {
  const standardCodes = uniqueSortedCodes([
    ...selection.standardCodes,
    ...selection.indicatorCodes.map((code) => code.split(".")[0]),
  ]);
  const indicatorCodes = uniqueSortedCodes(selection.indicatorCodes);

  if (!standardCodes.length) return "";

  const clauses = indicatorCodes.map((indicatorCode) => {
    for (const standard of standards) {
      const indicator = standard.indicators.find(
        (item) => item.code === indicatorCode,
      );
      if (indicator) {
        if (indicator.clauseCode) return indicator.clauseCode;
        break;
      }
    }

    const parts = indicatorCode.split(".");
    return parts.length > 2 ? parts.slice(0, -1).join(".") : parts[0];
  });

  const pieces = [
    `${STANDARD_SUMMARY_PREFIX} มาตรฐานที่ ${standardCodes.join(",")}`,
  ];
  const clauseCodes = uniqueSortedCodes(clauses);

  if (clauseCodes.length) pieces.push(`ข้อที่ ${clauseCodes.join(", ")}`);
  if (indicatorCodes.length) {
    pieces.push(`ตัวชี้วัดที่ ${indicatorCodes.join(", ")}`);
  }

  return pieces.join(" ");
}

export function updateStandardReferenceSelection(
  currentValue: unknown,
  standards: DocumentStandardOption[],
  selection: DocumentStandardSelection,
) {
  const catalogLines = new Set(
    standards.flatMap((standard) => [
      standard.label,
      ...standard.indicators.map(documentIndicatorText),
    ]),
  );
  const customLines = String(currentValue ?? "")
    .split(/\r?\n/)
    .map(clean)
    .filter(
      (line) =>
        line &&
        !line.startsWith(STANDARD_SUMMARY_PREFIX) &&
        !catalogLines.has(line),
    );
  const summary = formatStandardReferenceSelection(selection, standards);

  return [summary, ...customLines].filter(Boolean).join("\n");
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
              {standard.indicators.map((indicator, index) => {
                const previousClause =
                  index > 0
                    ? standard.indicators[index - 1].clauseCode
                    : undefined;
                const showClause =
                  indicator.clauseCode &&
                  indicator.clauseCode !== previousClause;

                return (
                  <div key={`${indicator.code}-${indicator.label}-${index}`}>
                    {showClause ? (
                      <p className="mb-2 mt-3 text-sm font-medium text-gray-700 first:mt-0">
                        {[indicator.clauseCode, indicator.clauseLabel]
                          .filter(Boolean)
                          .join(" ")}
                      </p>
                    ) : null}
                    <label className="flex cursor-pointer items-start gap-3 text-sm text-gray-600">
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
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
