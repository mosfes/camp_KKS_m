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
import { useState } from "react";
import { Sparkles } from "lucide-react";

import { useStatusModal } from "@/components/StatusModalProvider";

interface QuickCreateCampModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (campId: number) => void;
}

export default function QuickCreateCampModal({
  isOpen,
  onClose,
  onCreated,
}: QuickCreateCampModalProps) {
  const { showError } = useStatusModal();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    const projectName = name.trim();

    if (!projectName || loading) return;
    setLoading(true);

    try {
      const response = await fetch("/api/camps/quick-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: projectName }),
      });
      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.camp?.camp_id) {
        showError(
          "สร้างค่ายไม่สำเร็จ",
          result?.error || "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง",
        );

        return;
      }

      setName("");
      onCreated(result.camp.camp_id);
    } catch {
      showError("ข้อผิดพลาด", "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isDismissable={!loading}
      isOpen={isOpen}
      placement="center"
      onClose={loading ? undefined : onClose}
    >
      <ModalContent>
        <ModalHeader className="flex items-center gap-2 text-[#2d3748]">
          <Sparkles className="text-[#6b857a]" size={20} />
          สร้างค่ายด่วนด้วย AI
        </ModalHeader>
        <ModalBody>
          <p className="text-sm text-gray-500">
            ใส่ชื่อโครงการ แล้ว AI จะร่างสถานที่ วันที่ กำหนดการ ฐานกิจกรรม
            แบบสอบถาม และเอกสารโครงการให้ทั้งหมด
            คุณแก้ไขทุกอย่างได้ภายหลังในหน้าค่าย
          </p>
          <Input
            isDisabled={loading}
            label="ชื่อโครงการ"
            maxLength={255}
            placeholder="เช่น ค่ายพัฒนาทักษะวิทยาศาสตร์ ม.2"
            value={name}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
            }}
            onValueChange={setName}
          />
          {loading && (
            <p className="text-sm text-[#6b857a]">
              AI กำลังร่างค่ายและเอกสาร อาจใช้เวลาประมาณ 30-60 วินาที...
            </p>
          )}
        </ModalBody>
        <ModalFooter>
          <Button isDisabled={loading} variant="light" onPress={onClose}>
            ยกเลิก
          </Button>
          <Button
            className="bg-[#6b857a] text-white"
            isDisabled={!name.trim()}
            isLoading={loading}
            startContent={loading ? null : <Sparkles size={16} />}
            onPress={handleCreate}
          >
            สร้างค่าย
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
