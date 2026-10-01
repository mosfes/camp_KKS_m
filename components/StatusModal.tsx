"use client";

import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
} from "@heroui/react";
import {
  CheckCircle,
  AlertOctagon,
  AlertCircle,
  Info,
  Trash2,
} from "lucide-react";

export type ModalType = "success" | "error" | "warning" | "info";

interface StatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: ModalType;
  title: string;
  message: string;
  onConfirm?: () => void | Promise<void>; // Optional for confirmation dialogs
  confirmText?: string;
  isLoading?: boolean;
}

export default function StatusModal({
  isOpen,
  onClose,
  type,
  title,
  message,
  onConfirm,
  confirmText = "ยืนยัน",
  isLoading = false,
}: StatusModalProps) {
  const isDeleteAction =
    type === "warning" && (title.includes("ลบ") || confirmText.includes("ลบ"));

  const getIcon = () => {
    if (isDeleteAction) {
      return <Trash2 className="text-[#E84A5F]" size={48} strokeWidth={1.75} />;
    }
    switch (type) {
      case "success":
        return (
          <CheckCircle
            className="text-green-500"
            size={48}
            strokeWidth={1.75}
          />
        );
      case "error":
        return (
          <AlertOctagon className="text-red-500" size={48} strokeWidth={1.75} />
        );
      case "warning":
        return (
          <AlertCircle
            className="text-yellow-500"
            size={48}
            strokeWidth={1.75}
          />
        );
      case "info":
        return <Info className="text-blue-500" size={48} strokeWidth={1.75} />;
    }
  };

  // Default confirm text if not provided
  const defaultConfirmText = "ยืนยัน";

  return (
    <Modal
      backdrop="blur"
      classNames={{
        base: "z-[2010] bg-[#F5F1E8] rounded-2xl shadow-xl border border-[#6b857a]/20",
        backdrop: "z-[2000] bg-black/60 backdrop-blur-sm",
        wrapper: "z-[2010] !items-center !justify-center p-4",
      }}
      isOpen={isOpen}
      isDismissable={!isLoading}
      isKeyboardDismissDisabled={isLoading}
      placement="center"
      onOpenChange={(open) => {
        if (!open && !isLoading) onClose();
      }}
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1 items-center justify-center pt-8">
              <div className="w-20 h-20 bg-[#e6e2d8] rounded-full flex items-center justify-center mb-4">
                {getIcon()}
              </div>
              <h3 className="text-xl font-medium text-center text-[#5c7267]">
                {title}
              </h3>
            </ModalHeader>
            <ModalBody className="text-center pb-6">
              <p className="text-[#6b857a]/80 font-normal text-lg">{message}</p>
            </ModalBody>
            <ModalFooter className="justify-center gap-4 pb-8">
              {onConfirm ? (
                <>
                  <Button
                    className={`text-white rounded-full font-medium w-36 shadow-sm ${
                      isDeleteAction
                        ? "bg-[#E84A5F] hover:bg-[#FF847C]"
                        : "bg-[#6b857a] hover:bg-[#5a7268]"
                    }`}
                    isLoading={isLoading}
                    isDisabled={isLoading}
                    onPress={() => {
                      void onConfirm();
                    }}
                  >
                    {confirmText === "Confirm"
                      ? defaultConfirmText
                      : confirmText}
                  </Button>
                  <Button
                    className="bg-white border-2 border-[#6b857a] text-[#6b857a] rounded-full font-medium w-36 shadow-sm hover:bg-gray-50"
                    variant="bordered"
                    isDisabled={isLoading}
                    onPress={onClose}
                  >
                    ยกเลิก
                  </Button>
                </>
              ) : (
                <Button
                  className="bg-[#6b857a] text-white rounded-full font-medium px-12 shadow-sm hover:bg-[#5a7268]"
                  onPress={onClose}
                >
                  ปิด
                </Button>
              )}
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
