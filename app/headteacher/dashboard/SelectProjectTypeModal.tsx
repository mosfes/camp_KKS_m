"use client";

import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
} from "@heroui/react";
import { useState, useEffect } from "react";
import {
  ChevronRight,
  FileText,
  AlertCircle,
  Pencil,
  Trash2,
} from "lucide-react";

import { useStatusModal } from "@/components/StatusModalProvider";

interface Template {
  camp_template_id: number;
  name: string;
  camp?: {
    name: string;
    location: string;
  } | null;
}

interface SelectProjectTypeModalProps {
  isOpen: boolean;
  onClose: (isOpen: boolean) => void;
  onSelect: (type: "new" | "continuing", data: any | null) => void;
}

export default function SelectProjectTypeModal({
  isOpen,
  onClose,
  onSelect,
}: SelectProjectTypeModalProps) {
  const { showError, showInfo, showConfirm, setIsLoading, close } =
    useStatusModal();
  const [selectedType, setSelectedType] = useState<"new" | "continuing" | null>(
    null,
  );
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [showTemplateList, setShowTemplateList] = useState(false);

  // States for Edit Template Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [editingTemplateName, setEditingTemplateName] = useState("");

  // Fetch templates when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
      // Reset states
      setSelectedType(null);
      setSelectedTemplate(null);
      setShowTemplateList(false);
    }
  }, [isOpen]);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/templates");
      const data = await response.json();

      setTemplates(data);
    } catch (error) {
      console.error("Error fetching templates:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTemplate = async (templateId: number) => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/templates/${templateId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        // Remove from local state immediately
        setTemplates(
          templates.filter((t) => t.camp_template_id !== templateId),
        );
        if (selectedTemplate?.camp_template_id === templateId) {
          setSelectedTemplate(null);
        }
        close(); // Close the confirmation modal
      } else {
        showError("ล้มเหลว", "Failed to delete template");
      }
    } catch (error) {
      console.error("Error deleting template:", error);
      showError("ข้อผิดพลาด", "Error deleting template");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRenameTemplate = async (templateId: number, newName: string) => {
    try {
      const response = await fetch(`/api/templates/${templateId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });

      if (response.ok) {
        // Update local state immediately
        setTemplates(
          templates.map((t) =>
            t.camp_template_id === templateId ? { ...t, name: newName } : t,
          ),
        );
      } else {
        showError("ล้มเหลว", "Failed to rename template");
      }
    } catch (error) {
      console.error("Error renaming template:", error);
      showError("ข้อผิดพลาด", "Error renaming template");
    }
  };

  const handleTypeSelect = (type: "new" | "continuing") => {
    setSelectedType(type);

    if (type === "continuing") {
      if (templates.length === 0) {
        // ถ้าไม่มี template แจ้งเตือน
        showInfo(
          "ไม่มีข้อมูล",
          "ยังไม่มี Template ในระบบ\nกรุณาสร้างค่ายใหม่และบันทึกเป็น Template ก่อน",
        );
        setSelectedType(null);
      } else {
        // ถ้ามี template แสดงรายการ
        setShowTemplateList(true);
      }
    } else {
      setShowTemplateList(false);
      setSelectedTemplate(null);
    }
  };

  const handleContinue = async () => {
    if (loading) return;
    console.log("handleContinue called");
    console.log("selectedType:", selectedType);
    console.log("selectedTemplate:", selectedTemplate);

    if (selectedType === "new") {
      console.log("Calling onSelect with 'new'");
      onSelect("new", null);
    } else if (selectedType === "continuing" && selectedTemplate) {
      try {
        setLoading(true);
        console.log(
          "Fetching template data for ID:",
          selectedTemplate.camp_template_id,
        );
        const response = await fetch(
          `/api/templates/${selectedTemplate.camp_template_id}`,
        );
        const templateData = await response.json();

        console.log("Template data loaded:", templateData);
        onSelect("continuing", templateData); // ส่ง templateData ไปด้วย
      } catch (error) {
        console.error("Error loading template:", error);
        showError("ข้อผิดพลาด", "ไม่สามารถโหลดข้อมูล Template ได้");
      } finally {
        setLoading(false);
      }
    } else {
      console.log("Cannot continue - missing selection");
    }
  };

  const canContinue =
    selectedType === "new" ||
    (selectedType === "continuing" && selectedTemplate);

  return (
    <>
      <Modal
        backdrop="blur"
        classNames={{
          base: "bg-white rounded-2xl shadow-xl",
          backdrop: "bg-black/60 backdrop-blur-sm",
        }}
        isOpen={isOpen}
        size="2xl"
        onOpenChange={onClose}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1 p-6 pb-2">
                <h2 className="text-2xl font-bold text-gray-900">
                  เลือกประเภทโครงการ
                </h2>
                <p className="text-sm text-gray-500 font-normal">
                  เลือกรูปแบบการสร้างค่ายของคุณ
                </p>
              </ModalHeader>

              <ModalBody className="py-6">
                {!showTemplateList ? (
                  // Step 1: เลือกประเภท
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* New Project */}
                    <button
                      className={`
                                            p-6 rounded-xl border-2 transition-all text-left
                                            ${
                                              selectedType === "new"
                                                ? "border-[#6b857a] bg-[#6b857a]/5"
                                                : "border-gray-200 hover:border-gray-300"
                                            }
                                        `}
                      onClick={() => handleTypeSelect("new")}
                    >
                      <h3 className="text-xl font-semibold mb-2">
                        สร้างโครงการใหม่
                      </h3>
                      <p className="text-gray-600 text-sm">
                        สร้างโครงการใหม่โดยเริ่มต้นจากศูนย์
                      </p>
                    </button>

                    {/* Continuing Project */}
                    <button
                      className={`
                                            p-6 rounded-xl border-2 transition-all text-left relative
                                            ${
                                              selectedType === "continuing"
                                                ? "border-[#6b857a] bg-[#6b857a]/5"
                                                : "border-gray-200 hover:border-gray-300"
                                            }
                                        `}
                      onClick={() => handleTypeSelect("continuing")}
                    >
                      <h3 className="text-xl font-semibold mb-2">
                        โครงการต่อเนื่อง
                      </h3>
                      <p className="text-gray-600 text-sm">
                        ใช้ Template ที่มีอยู่เป็นจุดเริ่มต้น
                      </p>
                      {templates.length > 0 && (
                        <span className="absolute top-2 right-2 bg-[#6b857a] text-white text-xs px-2 py-1 rounded-full">
                          {templates.length} รายการ
                        </span>
                      )}
                    </button>
                  </div>
                ) : (
                  // Step 2: เลือก Template
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold">เลือก Template</h3>
                      <button
                        className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
                        onClick={() => {
                          setShowTemplateList(false);
                          setSelectedType(null);
                          setSelectedTemplate(null);
                        }}
                      >
                        <ChevronRight className="rotate-180" size={16} />
                        ย้อนกลับ
                      </button>
                    </div>

                    {loading ? (
                      <div className="text-center py-8 text-gray-500">
                        กำลังโหลดข้อมูล...
                      </div>
                    ) : templates.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <AlertCircle className="text-gray-400 mb-3" size={48} />
                        <p className="text-gray-600 font-medium">
                          ไม่พบ Template
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                          สร้างค่ายและบันทึกเป็น Template ก่อนใช้งาน
                        </p>
                      </div>
                    ) : (
                      <div className="max-h-96 overflow-y-auto space-y-3">
                        {templates.map((template) => (
                          <div
                            key={template.camp_template_id}
                            className={`
                                                        w-full p-4 rounded-lg border-2 transition-all flex items-center justify-between group
                                                        ${
                                                          selectedTemplate?.camp_template_id ===
                                                          template.camp_template_id
                                                            ? "border-[#6b857a] bg-[#6b857a]/5"
                                                            : "border-gray-200 hover:border-gray-300"
                                                        }
                                                    `}
                          >
                            <button
                              className="flex flex-1 cursor-pointer items-start gap-3 text-left"
                              type="button"
                              onClick={() => setSelectedTemplate(template)}
                            >
                              <div className="p-2 bg-white rounded-lg border border-gray-200">
                                <FileText
                                  className="text-[#6b857a]"
                                  size={20}
                                />
                              </div>
                              <div>
                                <h4 className="font-semibold text-gray-900 mb-1">
                                  {template.name}
                                </h4>
                                <p className="text-sm text-gray-500">
                                  จาก:{" "}
                                  {template.camp?.name || "ไม่ทราบชื่อค่าย"}
                                </p>
                                {template.camp?.location && (
                                  <p className="text-xs text-gray-400 mt-1">
                                    📍 {template.camp.location}
                                  </p>
                                )}
                              </div>
                            </button>

                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                className="p-2 text-gray-400 hover:text-[#6b857a] hover:bg-[#6b857a]/10 rounded-full transition-colors"
                                title="เปลี่ยนชื่อ Template"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingTemplate(template);
                                  setEditingTemplateName(template.name);
                                  setIsEditModalOpen(true);
                                }}
                              >
                                <Pencil size={18} />
                              </button>
                              <button
                                className="p-2 text-[#E84A5F] opacity-70 hover:opacity-100 hover:text-[#FF847C] hover:bg-[#E84A5F]/10 rounded-full transition-colors"
                                title="ลบ Template"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  showConfirm(
                                    "ลบ Template",
                                    `คุณแน่ใจหรือไม่ว่าต้องการลบ Template "${template.name}"?`,
                                    () =>
                                      handleDeleteTemplate(
                                        template.camp_template_id,
                                      ),
                                    "ลบ",
                                  );
                                }}
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </ModalBody>

              <ModalFooter>
                <Button
                  fullWidth
                  className="bg-[#6b857a] text-white rounded-xl font-bold shadow-lg hover:bg-[#5a7268]"
                  isDisabled={!canContinue || loading}
                  isLoading={loading}
                  size="lg"
                  onPress={handleContinue}
                >
                  ถัดไป
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Edit Template Name Modal */}
      <Modal
        classNames={{
          base: "bg-white rounded-2xl shadow-xl",
        }}
        isOpen={isEditModalOpen}
        size="md"
        onOpenChange={setIsEditModalOpen}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1 p-6 pb-2">
                <h3 className="text-xl font-bold text-gray-900">
                  แก้ไขชื่อ Template
                </h3>
              </ModalHeader>
              <ModalBody className="px-6 py-4">
                <Input
                  label="ชื่อ Template"
                  placeholder="กรอกชื่อ Template ใหม่..."
                  value={editingTemplateName}
                  variant="bordered"
                  onValueChange={setEditingTemplateName}
                />
              </ModalBody>
              <ModalFooter className="p-6 pt-2 border-t border-gray-100">
                <Button variant="light" onPress={onClose}>
                  ยกเลิก
                </Button>
                <Button
                  className="bg-[#6b857a] text-white font-medium shadow-sm hover:bg-[#5a7268] transition-colors"
                  isDisabled={
                    !editingTemplateName.trim() ||
                    editingTemplateName.trim() === editingTemplate?.name
                  }
                  onPress={() => {
                    if (
                      editingTemplate &&
                      editingTemplateName.trim() &&
                      editingTemplateName.trim() !== editingTemplate.name
                    ) {
                      handleRenameTemplate(
                        editingTemplate.camp_template_id,
                        editingTemplateName.trim(),
                      );
                    }
                    onClose();
                  }}
                >
                  บันทึก
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}
