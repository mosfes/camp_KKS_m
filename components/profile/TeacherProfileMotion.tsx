"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Save, X } from "lucide-react";

import { ConfirmModal } from "./ConfirmModal";

export function ProfileErrorAlert({
  error,
  onDismiss,
}: {
  error: string;
  onDismiss: () => void;
}) {
  return (
    <AnimatePresence>
      {error && (
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-rose-800"
          exit={{ opacity: 0, y: -10 }}
          initial={{ opacity: 0, y: -10 }}
        >
          <AlertCircle className="text-rose-600 shrink-0 mt-0.5" size={20} />
          <div className="text-xs sm:text-sm">
            <p className="font-semibold">เกิดข้อผิดพลาด</p>
            <p className="text-rose-700/90 mt-0.5">{error}</p>
          </div>
          <button
            className="ml-auto p-1 rounded-lg text-rose-500 hover:bg-rose-100/60"
            onClick={onDismiss}
          >
            <X size={16} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function ProfileEditorControls({
  editing,
  isFormDirty,
  saving,
  successToast,
  showCancelModal,
  onCancel,
  onSave,
  onDismissCancel,
  onConfirmCancel,
}: {
  editing: boolean;
  isFormDirty: boolean;
  saving: boolean;
  successToast: boolean;
  showCancelModal: boolean;
  onCancel: () => void;
  onSave: () => void;
  onDismissCancel: () => void;
  onConfirmCancel: () => void;
}) {
  return (
    <>
      <AnimatePresence>
        {editing && (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="sticky bottom-6 z-40 max-w-2xl mx-auto w-full px-4"
            exit={{ opacity: 0, y: 20 }}
            initial={{ opacity: 0, y: 20 }}
          >
            <div className="p-3 bg-white/95 backdrop-blur-lg rounded-2xl border border-gray-200/90 shadow-xl flex items-center justify-between gap-3">
              <div className="hidden sm:flex items-center gap-2 pl-2">
                <span className="w-2 h-2 rounded-full bg-[#5d7c6f] animate-ping" />
                <span className="text-xs text-gray-600 font-medium">
                  {isFormDirty
                    ? "มีการแก้ไขข้อมูลที่ยังไม่บันทึก"
                    : "กำลังอยู่ในโหมดแก้ไข"}
                </span>
              </div>

              <div className="flex items-center gap-2.5 w-full sm:w-auto ml-auto">
                <button
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-700 text-xs sm:text-sm font-semibold hover:bg-gray-50 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                  disabled={saving}
                  type="button"
                  onClick={onCancel}
                >
                  <X size={16} />
                  <span>ยกเลิก</span>
                </button>

                <button
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[#5d7c6f] text-white text-xs sm:text-sm font-semibold hover:bg-[#4a6659] active:scale-95 transition-all shadow-md cursor-pointer disabled:opacity-60"
                  disabled={saving}
                  type="button"
                  onClick={onSave}
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>กำลังบันทึก...</span>
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      <span>บันทึกข้อมูล</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {successToast && (
          <motion.div
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-[#2d5d4b] text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-emerald-400/30"
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
          >
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-white shrink-0">
              <CheckCircle2 size={18} />
            </div>
            <div>
              <p className="font-semibold text-sm">บันทึกข้อมูลโปรไฟล์สำเร็จ!</p>
              <p className="text-xs text-emerald-100/90">
                ข้อมูลของคุณได้รับการอัปเดตเรียบร้อยแล้ว
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmModal
        cancelText="แก้ไขต่อ"
        confirmText="ละทิ้งการแก้ไข"
        confirmVariant="danger"
        description="คุณมีข้อมูลที่แก้ไขแล้วและยังไม่ได้บันทึก หากยกเลิก ข้อมูลที่แก้ไขจะกลับไปเป็นค่าเดิม"
        isOpen={showCancelModal}
        title="ต้องการยกเลิกการแก้ไข?"
        onCancel={onDismissCancel}
        onConfirm={onConfirmCancel}
      />
    </>
  );
}
