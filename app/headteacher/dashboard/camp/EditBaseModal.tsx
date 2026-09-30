"use client";

import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
} from "@heroui/react";
import { useState, useEffect, useRef } from "react";
import { Save } from "lucide-react";

import { useStatusModal } from "@/components/StatusModalProvider";

interface EditBaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  baseData: {
    station_id: number;
    name: string;
    description: string;
  } | null;
  onSuccess: () => void;
}

export default function EditBaseModal({
  isOpen,
  onClose,
  baseData,
  onSuccess,
}: EditBaseModalProps) {
  const { showError, showSuccess } = useStatusModal();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const submitInFlightRef = useRef(false);

  useEffect(() => {
    if (baseData) {
      setName(baseData.name || "");
      setDescription(baseData.description || "");
    }
  }, [baseData]);

  const handleSubmit = async () => {
    if (submitInFlightRef.current) return;
    if (!name.trim()) {
      showError("ข้อผิดพลาด", "กรุณากรอกชื่อฐานกิจกรรม");

      return;
    }

    submitInFlightRef.current = true;
    try {
      setLoading(true);
      const response = await fetch(`/api/stations/${baseData?.station_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
        }),
      });

      if (!response.ok) throw new Error("Failed to update base");

      showSuccess("สำเร็จ", "แก้ไขฐานกิจกรรมสำเร็จ");
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error updating base:", error);
      showError("ข้อผิดพลาด", "แก้ไขฐานกิจกรรมไม่สำเร็จ");
    } finally {
      submitInFlightRef.current = false;
      setLoading(false);
    }
  };

  return (
    <Modal
      backdrop="blur"
      classNames={{
        base: "bg-white rounded-2xl shadow-xl",
        backdrop: "bg-black/60 backdrop-blur-sm",
      }}
      isOpen={isOpen}
      size="lg"
      onOpenChange={onClose}
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1 p-6 pb-2">
              <h2 className="text-xl font-bold text-gray-900">
                แก้ไขฐานกิจกรรม
              </h2>
              <p className="text-sm text-gray-500 font-normal">
                แก้ไขข้อมูลฐานกิจกรรม
              </p>
            </ModalHeader>

            <ModalBody className="py-6 space-y-4 px-6">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium text-gray-700">
                    ชื่อฐานกิจกรรม <span className="text-red-500">*</span>
                  </label>
                  <span className="text-xs text-gray-500">
                    {name.length}/255
                  </span>
                </div>
                <input
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6b857a] focus:border-[#6b857a] outline-none transition-colors"
                  maxLength={255}
                  placeholder="เช่น ฐานสำรวจธรรมชาติ"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium text-gray-700">
                    รายละเอียด
                  </label>
                  <span className="text-xs text-gray-500">
                    {description.length}/255
                  </span>
                </div>
                <textarea
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6b857a] focus:border-[#6b857a] outline-none transition-colors resize-none"
                  maxLength={255}
                  placeholder="อธิบายกิจกรรมและเป้าหมายของฐานนี้"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </ModalBody>

            <ModalFooter className="p-6 pt-2 flex-row gap-2">
              <Button
                fullWidth
                className="font-medium text-gray-600"
                isDisabled={loading}
                size="lg"
                variant="light"
                onPress={onClose}
              >
                ยกเลิก
              </Button>
              <Button
                fullWidth
                className="bg-[#6b857a] text-white rounded-xl font-bold shadow-lg hover:bg-[#5a7268]"
                isLoading={loading}
                isDisabled={loading}
                size="lg"
                startContent={!loading && <Save size={18} />}
                onPress={handleSubmit}
              >
                บันทึกการแก้ไข
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
