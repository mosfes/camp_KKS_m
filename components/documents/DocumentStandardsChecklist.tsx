"use client";

export type DocumentStandardIndicator = {
  code: string;
  label: string;
  clauseCode?: string;
  clauseLabel?: string;
};

export type DocumentStandardClause = {
  code: string;
  label: string;
};

export type DocumentStandardOption = {
  document_reference_option_id: number;
  label: string;
  indicators: DocumentStandardIndicator[];
};

export type DocumentStandardSelection = {
  standardCodes: string[];
  clauseCodes: string[];
  indicatorCodes: string[];
};

export type DocumentStrategyOption = {
  document_reference_option_id: number;
  label: string;
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

export function normalizeDocumentStrategyOptions(
  value: unknown,
): DocumentStrategyOption[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(
      (item) => item?.category === "STRATEGY" && item?.is_active !== false,
    )
    .map((item) => ({
      document_reference_option_id: Number(item.document_reference_option_id),
      label: clean(item.label),
    }))
    .filter(
      (item) =>
        Number.isInteger(item.document_reference_option_id) && item.label,
    );
}

function normalizedComparableText(value: unknown) {
  return clean(value).replace(/\s+/g, " ");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function documentStrategyPattern(
  strategy: DocumentStrategyOption,
  global = false,
) {
  const labelPattern = normalizedComparableText(strategy.label)
    .split(" ")
    .map(escapeRegExp)
    .join("\\s+");

  return new RegExp(
    `(?:^|\\n)[\\t ]*(?:กลยุทธ์โรงเรียน\\s+)?${labelPattern}(?=[\\t ]*(?:\\n|$))`,
    global ? "gu" : "u",
  );
}

export function documentStrategyText(strategy: DocumentStrategyOption) {
  const label = clean(strategy.label);

  return label.startsWith("กลยุทธ์โรงเรียน")
    ? label
    : `กลยุทธ์โรงเรียน ${label}`;
}

export function isDocumentStrategySelected(
  value: unknown,
  strategy: DocumentStrategyOption,
) {
  return documentStrategyPattern(strategy).test(String(value ?? ""));
}

export function updateDocumentStrategySelection(
  currentValue: unknown,
  strategy: DocumentStrategyOption,
  selected: boolean,
) {
  const currentText = clean(currentValue);

  if (selected) {
    if (isDocumentStrategySelected(currentText, strategy)) return currentText;

    return [currentText, documentStrategyText(strategy)]
      .filter(Boolean)
      .join("\n");
  }

  return currentText
    .replace(documentStrategyPattern(strategy, true), "")
    .split(/\r?\n/)
    .map(clean)
    .filter(Boolean)
    .join("\n");
}

export function documentIndicatorText(indicator: DocumentStandardIndicator) {
  return [indicator.code, indicator.label].filter(Boolean).join(" ");
}

export function documentStandardClauses(
  standard: DocumentStandardOption,
): DocumentStandardClause[] {
  const clauses = new Map<string, DocumentStandardClause>();

  for (const indicator of standard.indicators) {
    const code = clean(indicator.clauseCode);
    if (!code || clauses.has(code)) continue;
    clauses.set(code, { code, label: clean(indicator.clauseLabel) });
  }

  return Array.from(clauses.values());
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
  const clauseCodes: string[] = [];
  const indicatorCodes: string[] = [];
  const summary = text
    .split(/\r?\n/)
    .map(clean)
    .find((line) => line.startsWith(STANDARD_SUMMARY_PREFIX));

  if (summary) {
    const standardPart = summary.match(
      /มาตรฐานที่\s+(.+?)(?=\s+ข้อที่|\s+ตัวชี้วัดที่|$)/,
    )?.[1];
    const clausePart = summary.match(
      /ข้อที่\s+(.+?)(?=\s+ตัวชี้วัดที่|$)/,
    )?.[1];
    const indicatorPart = summary.match(/ตัวชี้วัดที่\s+(.+)$/)?.[1];

    if (standardPart) standardCodes.push(...codesFrom(standardPart));
    if (clausePart) clauseCodes.push(...codesFrom(clausePart));
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
    clauseCodes: uniqueSortedCodes(clauseCodes),
    indicatorCodes: uniqueSortedCodes(indicatorCodes),
  };
}

export function formatStandardReferenceSelection(
  selection: DocumentStandardSelection,
  standards: DocumentStandardOption[],
) {
  const standardCodes = uniqueSortedCodes([
    ...selection.standardCodes,
    ...selection.clauseCodes.map((code) => code.split(".")[0]),
    ...selection.indicatorCodes.map((code) => code.split(".")[0]),
  ]);
  const indicatorCodes = uniqueSortedCodes(selection.indicatorCodes);

  if (!standardCodes.length) return "";

  const clauses = [
    ...selection.clauseCodes,
    ...indicatorCodes.map((indicatorCode) => {
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
    }),
  ];

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
  isClauseSelected,
  isStandardSelected,
  isIndicatorSelected,
  onToggleClause,
  onToggleStandard,
  onToggleIndicator,
}: {
  standards: DocumentStandardOption[];
  disabled?: boolean;
  isClauseSelected?: (
    standard: DocumentStandardOption,
    clause: DocumentStandardClause,
  ) => boolean;
  isStandardSelected: (standard: DocumentStandardOption) => boolean;
  isIndicatorSelected: (
    standard: DocumentStandardOption,
    indicator: DocumentStandardIndicator,
  ) => boolean;
  onToggleStandard: (
    standard: DocumentStandardOption,
    selected: boolean,
  ) => void;
  onToggleClause?: (
    standard: DocumentStandardOption,
    clause: DocumentStandardClause,
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
                const clause = {
                  code: clean(indicator.clauseCode),
                  label: clean(indicator.clauseLabel),
                };

                return (
                  <div key={`${indicator.code}-${indicator.label}-${index}`}>
                    {showClause ? (
                      isClauseSelected && onToggleClause ? (
                        <label className="mb-2 mt-3 flex cursor-pointer items-start gap-3 text-sm font-medium text-gray-700 first:mt-0">
                          <input
                            checked={isClauseSelected(standard, clause)}
                            className="mt-0.5 h-4 w-4 shrink-0 accent-[#5d7c6f]"
                            disabled={disabled}
                            type="checkbox"
                            onChange={(event) =>
                              onToggleClause(
                                standard,
                                clause,
                                event.target.checked,
                              )
                            }
                          />
                          <span>
                            {[clause.code, clause.label]
                              .filter(Boolean)
                              .join(" ")}
                          </span>
                        </label>
                      ) : (
                        <p className="mb-2 mt-3 text-sm font-medium text-gray-700 first:mt-0">
                          {[clause.code, clause.label]
                            .filter(Boolean)
                            .join(" ")}
                        </p>
                      )
                    ) : null}
                    <label className="ml-5 flex cursor-pointer items-start gap-3 text-sm text-gray-600 sm:ml-7">
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

export function DocumentStrategiesChecklist({
  strategies,
  disabled,
  isStrategySelected,
  onToggleStrategy,
}: {
  strategies: DocumentStrategyOption[];
  disabled?: boolean;
  isStrategySelected: (strategy: DocumentStrategyOption) => boolean;
  onToggleStrategy: (
    strategy: DocumentStrategyOption,
    selected: boolean,
  ) => void;
}) {
  if (!strategies.length) {
    return (
      <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
        ยังไม่มีกลยุทธ์จากแอดมิน สามารถกรอกข้อมูลเพิ่มเติมเองได้ด้านล่าง
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {strategies.map((strategy) => (
        <label
          key={strategy.document_reference_option_id}
          className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm font-medium text-gray-800"
        >
          <input
            checked={isStrategySelected(strategy)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[#5d7c6f]"
            disabled={disabled}
            type="checkbox"
            onChange={(event) =>
              onToggleStrategy(strategy, event.target.checked)
            }
          />
          <span>{strategy.label}</span>
        </label>
      ))}
    </div>
  );
}
