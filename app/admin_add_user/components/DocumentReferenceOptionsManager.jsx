"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Chip, Input, Select, SelectItem, Switch } from "@heroui/react";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  useDisclosure,
} from "@heroui/modal";
import {
  ArrowDown,
  ArrowUp,
  ListChecks,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";

import { useStatusModal } from "@/components/StatusModalProvider";

const categories = {
  STANDARD: "มาตรฐานการศึกษา",
  STRATEGY: "กลยุทธ์โรงเรียน",
};

const emptyForm = {
  category: "STANDARD",
  label: "",
  indicators: [],
  is_active: true,
};

function ReferenceOptionsSkeleton() {
  return (
    <div
      aria-label="กำลังโหลดตัวเลือกเอกสาร"
      className="divide-y divide-gray-100"
      role="status"
    >
      {Array.from({ length: 6 }, (_, index) => (
        <div
          className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center"
          key={index}
        >
          <div className="h-4 min-w-0 flex-1 animate-pulse rounded bg-gray-200" />
          <div className="h-6 w-20 animate-pulse rounded-full bg-gray-200" />
          <div className="h-5 w-10 animate-pulse rounded-full bg-gray-200" />
          <div className="flex gap-1">
            <div className="h-8 w-8 animate-pulse rounded bg-gray-200" />
            <div className="h-8 w-8 animate-pulse rounded bg-gray-200" />
            <div className="h-8 w-8 animate-pulse rounded bg-gray-200" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DocumentReferenceOptionsManager() {
  const { isOpen, onOpen, onClose, onOpenChange } = useDisclosure();
  const { showError, showSuccess, setIsLoading } = useStatusModal();
  const [options, setOptions] = useState([]);
  const [category, setCategory] = useState("STANDARD");
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadOptions = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        "/api/document-reference-options?includeInactive=true",
      );
      if (!response.ok) throw new Error();
      setOptions(await response.json());
    } catch {
      showError("ข้อผิดพลาด", "ไม่สามารถโหลดตัวเลือกเอกสารได้");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOptions();
  }, []);

  const filtered = useMemo(
    () =>
      options.filter(
        (option) =>
          option.category === category &&
          option.label.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [options, category, query],
  );

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...emptyForm, category });
    onOpen();
  };

  const openEdit = (option) => {
    setEditingId(option.document_reference_option_id);
    setForm({
      category: option.category,
      label: option.label,
      indicators: Array.isArray(option.indicators) ? option.indicators : [],
      is_active: option.is_active,
    });
    onOpen();
  };

  const save = async () => {
    if (!form.label.trim()) {
      showError("ข้อมูลไม่ครบ", "กรุณากรอกข้อความตัวเลือก");
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch(
        editingId
          ? `/api/document-reference-options/${editingId}`
          : "/api/document-reference-options",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...form,
            indicators:
              form.category === "STANDARD"
                ? form.indicators.filter((item) =>
                    String(item.label || "").trim(),
                  )
                : [],
          }),
        },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      onClose();
      await loadOptions();
      showSuccess(
        "สำเร็จ",
        editingId ? "แก้ไขตัวเลือกแล้ว" : "เพิ่มตัวเลือกแล้ว",
      );
    } catch (error) {
      showError("บันทึกไม่สำเร็จ", error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleActive = async (option) => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/document-reference-options/${option.document_reference_option_id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_active: !option.is_active }),
        },
      );
      if (!response.ok) throw new Error();
      await loadOptions();
    } catch {
      showError("ข้อผิดพลาด", "ไม่สามารถเปลี่ยนสถานะได้");
    } finally {
      setIsLoading(false);
    }
  };

  const moveOption = async (option, direction) => {
    if (query.trim()) {
      showError("กรุณาล้างคำค้นหา", "ล้างคำค้นหาก่อนจัดลำดับรายการ");
      return;
    }
    const categoryOptions = options.filter(
      (item) => item.category === category,
    );
    const currentIndex = categoryOptions.findIndex(
      (item) =>
        item.document_reference_option_id ===
        option.document_reference_option_id,
    );
    const targetIndex = currentIndex + direction;
    if (
      currentIndex < 0 ||
      targetIndex < 0 ||
      targetIndex >= categoryOptions.length
    )
      return;

    const reordered = [...categoryOptions];
    [reordered[currentIndex], reordered[targetIndex]] = [
      reordered[targetIndex],
      reordered[currentIndex],
    ];

    setIsLoading(true);
    try {
      const response = await fetch("/api/document-reference-options", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderedIds: reordered.map(
            (item) => item.document_reference_option_id,
          ),
        }),
      });
      if (!response.ok) throw new Error();
      await loadOptions();
    } catch {
      showError("จัดลำดับไม่สำเร็จ", "กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-semibold text-gray-800">คลังตัวเลือกเอกสาร</h2>
            <p className="mt-1 text-sm text-gray-500">
              ผู้จัดทำเอกสารเลือกได้หลายรายการ
              และยังกรอกหัวข้ออื่นเพิ่มเติมเองได้
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              isClearable
              placeholder="ค้นหาตัวเลือก"
              startContent={<Search className="text-gray-400" size={16} />}
              value={query}
              onClear={() => setQuery("")}
              onValueChange={setQuery}
            />
            <Button
              className="bg-[#5d7c6f] text-white"
              startContent={<Plus size={18} />}
              onPress={openAdd}
            >
              {category === "STANDARD" ? "เพิ่มมาตรฐาน" : "เพิ่มกลยุทธ์"}
            </Button>
          </div>
        </div>
        <div className="mt-5 flex gap-2">
          {Object.entries(categories).map(([key, label]) => (
            <button
              className={`rounded-full px-4 py-2 text-sm font-medium ${category === key ? "bg-[#5d7c6f] text-white" : "bg-gray-100 text-gray-600"}`}
              key={key}
              onClick={() => setCategory(key)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <ReferenceOptionsSkeleton />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-12 text-center text-gray-500">
            <ListChecks className="text-gray-300" size={42} />
            ยังไม่มีตัวเลือกในหมวดนี้
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map((option) => (
              <div
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center"
                key={option.document_reference_option_id}
              >
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-wrap text-sm text-gray-800">
                    {option.label}
                  </p>
                  {option.category === "STANDARD" &&
                  Array.isArray(option.indicators) &&
                  option.indicators.length ? (
                    <div className="mt-2 space-y-1 border-l-2 border-[#cad8d2] pl-3 text-xs text-gray-500">
                      {option.indicators.map((indicator, index) => (
                        <p
                          key={`${indicator.code}-${indicator.label}-${index}`}
                        >
                          {[indicator.code, indicator.label]
                            .filter(Boolean)
                            .join(" ")}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </div>
                <Chip
                  color={option.is_active ? "success" : "default"}
                  size="sm"
                  variant="flat"
                >
                  {option.is_active ? "ใช้งาน" : "ปิดใช้งาน"}
                </Chip>
                <Switch
                  isSelected={option.is_active}
                  size="sm"
                  onValueChange={() => toggleActive(option)}
                />
                <div className="flex gap-1">
                  <Button
                    isIconOnly
                    aria-label="เลื่อนขึ้น"
                    isDisabled={
                      Boolean(query.trim()) ||
                      filtered[0]?.document_reference_option_id ===
                        option.document_reference_option_id
                    }
                    size="sm"
                    variant="flat"
                    onPress={() => moveOption(option, -1)}
                  >
                    <ArrowUp size={16} />
                  </Button>
                  <Button
                    isIconOnly
                    aria-label="เลื่อนลง"
                    isDisabled={
                      Boolean(query.trim()) ||
                      filtered[filtered.length - 1]
                        ?.document_reference_option_id ===
                        option.document_reference_option_id
                    }
                    size="sm"
                    variant="flat"
                    onPress={() => moveOption(option, 1)}
                  >
                    <ArrowDown size={16} />
                  </Button>
                </div>
                <Button
                  isIconOnly
                  aria-label="แก้ไข"
                  size="sm"
                  variant="light"
                  onPress={() => openEdit(option)}
                >
                  <Pencil size={17} />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        isOpen={isOpen}
        scrollBehavior="inside"
        size="2xl"
        onOpenChange={onOpenChange}
      >
        <ModalContent>
          {(close) => (
            <>
              <ModalHeader>
                {editingId
                  ? form.category === "STANDARD"
                    ? "แก้ไขมาตรฐานและตัวชี้วัด"
                    : "แก้ไขกลยุทธ์"
                  : form.category === "STANDARD"
                    ? "เพิ่มมาตรฐานและตัวชี้วัด"
                    : "เพิ่มกลยุทธ์"}
              </ModalHeader>
              <ModalBody>
                <Select
                  label="หมวด"
                  selectedKeys={new Set([form.category])}
                  onSelectionChange={(keys) => {
                    const nextCategory = Array.from(keys)[0];
                    setForm({
                      ...form,
                      category: nextCategory,
                      indicators:
                        nextCategory === "STANDARD" ? form.indicators : [],
                    });
                  }}
                >
                  <SelectItem key="STANDARD">มาตรฐานการศึกษา</SelectItem>
                  <SelectItem key="STRATEGY">กลยุทธ์โรงเรียน</SelectItem>
                </Select>
                <Input
                  isRequired
                  label={
                    form.category === "STANDARD"
                      ? "ชื่อมาตรฐาน"
                      : "ข้อความกลยุทธ์"
                  }
                  value={form.label}
                  onValueChange={(value) => setForm({ ...form, label: value })}
                />
                {form.category === "STANDARD" ? (
                  <div className="space-y-3 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-gray-800">
                          ตัวชี้วัดของมาตรฐาน
                        </p>
                        <p className="mt-0.5 text-xs text-gray-500">
                          ครูจะเห็นรายการเหล่านี้และติ๊กเลือกในเอกสารได้
                        </p>
                      </div>
                      <Button
                        size="sm"
                        startContent={<Plus size={15} />}
                        variant="flat"
                        onPress={() =>
                          setForm({
                            ...form,
                            indicators: [
                              ...form.indicators,
                              {
                                code: "",
                                label: "",
                                clauseCode: "",
                                clauseLabel: "",
                              },
                            ],
                          })
                        }
                      >
                        เพิ่มตัวชี้วัด
                      </Button>
                    </div>
                    {form.indicators.length === 0 ? (
                      <p className="rounded-xl bg-white p-3 text-center text-sm text-gray-400">
                        ยังไม่มีตัวชี้วัด
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {form.indicators.map((indicator, index) => (
                          <div
                            className="grid gap-2 rounded-xl bg-white p-3 sm:grid-cols-[100px_110px_1fr_auto]"
                            key={index}
                          >
                            <Input
                              label="รหัส"
                              placeholder="เช่น 1.1.2"
                              value={indicator.code}
                              onValueChange={(value) =>
                                setForm({
                                  ...form,
                                  indicators: form.indicators.map(
                                    (item, itemIndex) =>
                                      itemIndex === index
                                        ? { ...item, code: value }
                                        : item,
                                  ),
                                })
                              }
                            />
                            <Input
                              label="ข้อหลัก"
                              placeholder="เช่น 1.1"
                              value={indicator.clauseCode || ""}
                              onValueChange={(value) =>
                                setForm({
                                  ...form,
                                  indicators: form.indicators.map(
                                    (item, itemIndex) =>
                                      itemIndex === index
                                        ? { ...item, clauseCode: value }
                                        : item,
                                  ),
                                })
                              }
                            />
                            <Input
                              isRequired
                              label="รายละเอียดตัวชี้วัด"
                              value={indicator.label}
                              onValueChange={(value) =>
                                setForm({
                                  ...form,
                                  indicators: form.indicators.map(
                                    (item, itemIndex) =>
                                      itemIndex === index
                                        ? { ...item, label: value }
                                        : item,
                                  ),
                                })
                              }
                            />
                            <Input
                              className="sm:col-start-2 sm:col-end-4"
                              label="ชื่อข้อหลัก (ถ้ามี)"
                              placeholder="เช่น ผลสัมฤทธิ์ทางวิชาการของผู้เรียน"
                              value={indicator.clauseLabel || ""}
                              onValueChange={(value) =>
                                setForm({
                                  ...form,
                                  indicators: form.indicators.map(
                                    (item, itemIndex) =>
                                      itemIndex === index
                                        ? { ...item, clauseLabel: value }
                                        : item,
                                  ),
                                })
                              }
                            />
                            <Button
                              isIconOnly
                              aria-label="ลบตัวชี้วัด"
                              className="mt-4"
                              color="danger"
                              size="sm"
                              variant="light"
                              onPress={() =>
                                setForm({
                                  ...form,
                                  indicators: form.indicators.filter(
                                    (_, itemIndex) => itemIndex !== index,
                                  ),
                                })
                              }
                            >
                              <Trash2 size={16} />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
                <Switch
                  isSelected={form.is_active}
                  onValueChange={(value) =>
                    setForm({ ...form, is_active: value })
                  }
                >
                  แสดงในรายการเลือก
                </Switch>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={close}>
                  ยกเลิก
                </Button>
                <Button className="bg-[#5d7c6f] text-white" onPress={save}>
                  บันทึก
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
