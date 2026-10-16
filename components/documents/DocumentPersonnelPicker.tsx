"use client";

import { Autocomplete, AutocompleteItem } from "@heroui/react";
import { useMemo } from "react";

type DocumentPerson = {
  document_personnel_id: number;
  prefix_name?: string | null;
  firstname: string;
  lastname: string;
  position?: string | null;
};

type DocumentPersonnelPickerProps = {
  ariaLabel: string;
  disabled?: boolean;
  fallbackLabel?: string;
  onChange: (personId: number | null) => void;
  people: DocumentPerson[];
  selectedId: number | string | null | undefined;
};

function personLabel(person: DocumentPerson) {
  const name =
    `${person.prefix_name || ""}${person.firstname} ${person.lastname}`.trim();

  return person.position ? `${name} (${person.position})` : name;
}

export default function DocumentPersonnelPicker({
  ariaLabel,
  disabled = false,
  fallbackLabel,
  onChange,
  people,
  selectedId,
}: DocumentPersonnelPickerProps) {
  const selectedKey = selectedId ? String(selectedId) : null;
  const options = useMemo(() => {
    const items = people.map((person) => ({
      id: String(person.document_personnel_id),
      label: personLabel(person),
    }));

    if (selectedKey && !items.some((item) => item.id === selectedKey)) {
      items.unshift({ id: selectedKey, label: fallbackLabel || selectedKey });
    }

    return items;
  }, [fallbackLabel, people, selectedKey]);

  return (
    <Autocomplete
      aria-label={ariaLabel}
      className="w-full"
      classNames={{
        listboxWrapper: "max-h-64",
        popoverContent: "rounded-xl border border-gray-200 bg-white shadow-lg",
      }}
      defaultItems={options}
      inputProps={{
        classNames: {
          inputWrapper:
            "h-11 min-h-11 rounded-xl border border-gray-200 bg-white shadow-none",
        },
      }}
      isDisabled={disabled}
      listboxProps={{ emptyContent: "ไม่พบรายชื่อ" }}
      placeholder="พิมพ์ชื่อเพื่อค้นหาบุคลากร"
      selectedKey={selectedKey}
      variant="bordered"
      onSelectionChange={(key) => onChange(key ? Number(key) : null)}
    >
      {(option) => (
        <AutocompleteItem key={option.id} textValue={option.label}>
          {option.label}
        </AutocompleteItem>
      )}
    </Autocomplete>
  );
}
