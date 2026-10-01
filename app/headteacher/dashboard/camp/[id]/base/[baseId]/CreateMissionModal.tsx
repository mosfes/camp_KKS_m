"use client";

import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Select,
  SelectItem,
} from "@heroui/react";
import { useRef, useState } from "react";
import { Save, Plus, Trash2, CheckCircle2, Circle } from "lucide-react";

import { useStatusModal } from "@/components/StatusModalProvider";

interface CreateMissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  baseId: number;
  onMissionCreated: () => void;
}

// ประเภทภารกิจ (ตรงกับ MissionType enum ใน schema)
const MISSION_TYPES = [
  {
    key: "QUESTION_ANSWERING",
    label: "ตอบคำถาม",
    description: "ให้นักเรียนพิมพ์คำตอบ",
  },
  {
    key: "MULTIPLE_CHOICE_QUIZ",
    label: "แบบทดสอบหลายตัวเลือก",
    description: "เลือกคำตอบที่ถูกต้อง",
  },
  {
    key: "PRE_TEST",
    label: "แบบทดสอบก่อนเรียน/หลังเรียน",
    description: "สร้างชุดคำถามก่อนและหลังเรียน",
  },
  {
    key: "PHOTO_SUBMISSION",
    label: "ส่งรูปภาพ",
    description: "ให้นักเรียนถ่ายหรือเลือกรูป",
  },
  {
    key: "VIDEO_SUBMISSION",
    label: "ส่งลิงก์วิดีโอ",
    description: "ฝังวิดีโอจากลิงก์ โดยไม่เก็บไฟล์",
  },
  {
    key: "QR_CODE_SCANNING",
    label: "สแกน QR Code",
    description: "ยืนยันการร่วมกิจกรรมด้วย QR",
  },
];

const inputCls =
  "w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6b857a] focus:border-[#6b857a] outline-none transition-colors text-sm";

export default function CreateMissionModal({
  isOpen,
  onClose,
  baseId,
  onMissionCreated,
}: CreateMissionModalProps) {
  const { showError, showSuccess } = useStatusModal();

  const [title, setTitle] = useState("");
  const [type, setType] = useState("QUESTION_ANSWERING");
  const [description, setDescription] = useState("");
  const [textQuestions, setTextQuestions] = useState([{ text: "" }]);
  const [mcqQuestions, setMcqQuestions] = useState([
    {
      text: "",
      choices: [
        { text: "", isCorrect: false },
        { text: "", isCorrect: false },
      ],
    },
  ]);
  const [loading, setLoading] = useState(false);
  const submitInFlightRef = useRef(false);
  const selectedType = MISSION_TYPES.find((item) => item.key === type);

  // MCQ Handlers
  const addMcqQuestion = () =>
    setMcqQuestions([
      ...mcqQuestions,
      {
        text: "",
        choices: [
          { text: "", isCorrect: false },
          { text: "", isCorrect: false },
        ],
      },
    ]);

  const removeMcqQuestion = (i: number) => {
    if (mcqQuestions.length <= 1) return;
    setMcqQuestions(mcqQuestions.filter((_, idx) => idx !== i));
  };

  const addTextQuestion = () =>
    setTextQuestions([...textQuestions, { text: "" }]);
  const removeTextQuestion = (i: number) => {
    if (textQuestions.length <= 1) return;
    setTextQuestions(textQuestions.filter((_, idx) => idx !== i));
  };
  const updateTextQ = (i: number, val: string) => {
    const q = [...textQuestions];

    q[i].text = val;
    setTextQuestions(q);
  };

  const updateQText = (qi: number, text: string) => {
    const q = [...mcqQuestions];

    q[qi].text = text;
    setMcqQuestions(q);
  };

  const addChoice = (qi: number) => {
    const q = [...mcqQuestions];

    q[qi].choices.push({ text: "", isCorrect: false });
    setMcqQuestions(q);
  };

  const removeChoice = (qi: number, ci: number) => {
    const q = [...mcqQuestions];

    if (q[qi].choices.length <= 2) return;
    q[qi].choices = q[qi].choices.filter((_, i) => i !== ci);
    setMcqQuestions(q);
  };

  const updateChoiceText = (qi: number, ci: number, text: string) => {
    const q = [...mcqQuestions];

    q[qi].choices[ci].text = text;
    setMcqQuestions(q);
  };

  const setCorrect = (qi: number, ci: number) => {
    const q = [...mcqQuestions];

    q[qi].choices = q[qi].choices.map((c, i) => ({
      ...c,
      isCorrect: i === ci,
    }));
    setMcqQuestions(q);
  };

  const handleSubmit = async () => {
    if (submitInFlightRef.current) return;
    if (!title.trim()) {
      showError("ข้อผิดพลาด", "กรุณากรอกชื่อภารกิจ");

      return;
    }

    if (type === "MULTIPLE_CHOICE_QUIZ" || type === "PRE_TEST") {
      for (let i = 0; i < mcqQuestions.length; i++) {
        const q = mcqQuestions[i];

        if (!q.text.trim()) {
          showError("ข้อผิดพลาด", `คำถามที่ ${i + 1} ยังว่างอยู่`);

          return;
        }
        if (q.choices.some((c) => !c.text.trim())) {
          showError(
            "ข้อผิดพลาด",
            `กรุณากรอกตัวเลือกในคำถามที่ ${i + 1} ให้ครบ`,
          );

          return;
        }
        if (!q.choices.some((c) => c.isCorrect)) {
          showError(
            "ข้อผิดพลาด",
            `กรุณาเลือกคำตอบที่ถูกต้องสำหรับคำถามที่ ${i + 1}`,
          );

          return;
        }
      }
    } else if (
      type === "QUESTION_ANSWERING" ||
      type === "PHOTO_SUBMISSION" ||
      type === "VIDEO_SUBMISSION"
    ) {
      for (let i = 0; i < textQuestions.length; i++) {
        if (!textQuestions[i].text.trim()) {
          showError("ข้อผิดพลาด", `คำถามที่ ${i + 1} ยังว่างอยู่`);

          return;
        }
      }
    }
    // QR_CODE_SCANNING: no questions needed

    submitInFlightRef.current = true;
    try {
      setLoading(true);
      const res = await fetch("/api/missions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          type,
          description,
          questions:
            type === "MULTIPLE_CHOICE_QUIZ" || type === "PRE_TEST"
              ? mcqQuestions
              : type === "QUESTION_ANSWERING" ||
                  type === "PHOTO_SUBMISSION" ||
                  type === "VIDEO_SUBMISSION"
                ? textQuestions
                : undefined,
          stationId: baseId,
        }),
      });

      if (!res.ok) throw new Error();
      showSuccess("สำเร็จ", "สร้างภารกิจสำเร็จ");
      onClose();
      onMissionCreated();
      setTitle("");
      setType("QUESTION_ANSWERING");
      setDescription("");
      setTextQuestions([{ text: "" }]);
      setMcqQuestions([
        {
          text: "",
          choices: [
            { text: "", isCorrect: false },
            { text: "", isCorrect: false },
          ],
        },
      ]);
    } catch {
      showError("ข้อผิดพลาด", "สร้างภารกิจไม่สำเร็จ");
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
      isDismissable={!loading}
      isKeyboardDismissDisabled={loading}
      scrollBehavior="inside"
      size="2xl"
      onOpenChange={(open) => {
        if (!open && !loading) onClose();
      }}
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1 p-6 pb-2">
              <h2 className="text-xl font-bold text-gray-900">สร้างภารกิจ</h2>
              <p className="text-sm text-gray-500 font-normal">
                ตั้งค่าภารกิจใหม่สำหรับนักเรียน
              </p>
            </ModalHeader>

            <ModalBody className="py-6 space-y-5 px-6">
              {/* ชื่อภารกิจ */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium text-gray-700" htmlFor="create-mission-title">
                    ชื่อภารกิจ <span className="text-red-500">*</span>
                  </label>
                  <span className="text-xs text-gray-400">
                    {title.length}/255
                  </span>
                </div>
                <input
                  id="create-mission-title"
                  className={inputCls}
                  maxLength={255}
                  placeholder="เช่น ถ่ายรูปสัตว์ป่า"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              {/* ประเภทภารกิจ */}
              <Select
                showScrollIndicators
                aria-label="ประเภทภารกิจ"
                classNames={{
                  base: "w-full",
                  description: "text-xs text-gray-500",
                  label: "text-sm font-medium text-gray-700",
                  listbox: "p-0",
                  listboxWrapper:
                    "max-h-[178px] overflow-y-scroll pr-1 scrollbar-thin scrollbar-thumb-[#6b857a]/70 scrollbar-track-transparent",
                  popoverContent:
                    "rounded-xl border border-gray-100 p-1 shadow-lg",
                  trigger:
                    "min-h-11 rounded-lg border border-gray-200 bg-white px-3 shadow-none data-[hover=true]:border-[#6b857a]",
                  value: "text-sm font-normal text-gray-900",
                }}
                description={selectedType?.description}
                label="ประเภทภารกิจ"
                maxListboxHeight={178}
                scrollShadowProps={{ hideScrollBar: false, size: 24 }}
                selectedKeys={[type]}
                onSelectionChange={(keys) => {
                  const selected = Array.from(keys)[0];

                  if (typeof selected === "string") setType(selected);
                }}
              >
                {MISSION_TYPES.map((item) => (
                  <SelectItem
                    key={item.key}
                    classNames={{
                      base: "min-h-10 rounded-lg px-3 py-2 data-[hover=true]:bg-[#6b857a]/10",
                      title: "text-sm font-normal text-gray-800",
                    }}
                    textValue={item.label}
                  >
                    {item.label}
                  </SelectItem>
                ))}
              </Select>

              {/* รายละเอียด */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium text-gray-700" htmlFor="create-mission-description">
                    รายละเอียด
                  </label>
                  <span className="text-xs text-gray-400">
                    {description.length}/1000
                  </span>
                </div>
                <textarea
                  id="create-mission-description"
                  className={`${inputCls} resize-none`}
                  maxLength={1000}
                  placeholder="อธิบายภารกิจนี้โดยย่อ"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              {/* ตอบคำถาม / ส่งรูปภาพ */}
              {(type === "QUESTION_ANSWERING" ||
                type === "PHOTO_SUBMISSION" ||
                type === "VIDEO_SUBMISSION") && (
                <div className="space-y-4">
                  {type === "VIDEO_SUBMISSION" && (
                    <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs leading-relaxed text-blue-700">
                      นักเรียนจะส่งลิงก์ YouTube หรือ Google Drive
                    </p>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-5 bg-[#6b857a] rounded-full" />
                    <p className="text-sm font-semibold text-gray-700">
                      คำถาม
                    </p>
                  </div>
                  {textQuestions.map((q, i) => (
                    <div key={i} className="flex gap-2 group">
                      <div className="flex-1 relative">
                        <span className="absolute left-3 top-2 text-xs text-gray-400 font-bold">
                          {i + 1}
                        </span>
                        <input
                          className={`${inputCls} pl-8 pr-16`}
                          maxLength={255}
                          placeholder="กรอกคำถาม..."
                          value={q.text}
                          onChange={(e) => updateTextQ(i, e.target.value)}
                        />
                        <span className="absolute right-3 top-2.5 text-xs text-gray-400">
                          {q.text.length}/255
                        </span>
                      </div>
                      {textQuestions.length > 1 && (
                        <button
                          className="p-2 text-[#E84A5F] opacity-40 group-hover:opacity-80 hover:!opacity-100 hover:text-[#FF847C] hover:bg-[#E84A5F]/10 rounded-lg transition-all"
                          onClick={() => removeTextQuestion(i)}
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    className="w-full py-2 border-2 border-dashed border-gray-200 hover:border-[#6b857a] rounded-xl text-xs text-gray-500 hover:text-[#6b857a] font-medium transition-colors flex items-center justify-center gap-1"
                    onClick={addTextQuestion}
                  >
                    <Plus size={14} /> เพิ่มคำถาม
                  </button>
                </div>
              )}

              {/* สแกน QR Code */}
              {type === "QR_CODE_SCANNING" && (
                <div className="p-4 bg-[#6b857a]/5 border border-[#6b857a]/20 rounded-xl">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-[#6b857a]/10 rounded-lg text-[#6b857a] shrink-0">
                      <svg
                        fill="none"
                        height="20"
                        stroke="currentColor"
                        strokeWidth={2}
                        viewBox="0 0 24 24"
                        width="20"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <rect height="7" rx="1" width="7" x="3" y="3" />
                        <rect height="7" rx="1" width="7" x="14" y="3" />
                        <rect height="7" rx="1" width="7" x="3" y="14" />
                        <path d="M14 14h3v3m0 0h3m-3 0v3" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-[#6b857a] text-sm mb-1">
                        ภารกิจสแกน QR Code
                      </p>
                      <p className="text-xs text-gray-600 leading-relaxed">
                        ระบบจะสร้าง QR Code ให้อัตโนมัติ ครูสามารถแสดง QR Code
                        ได้จากหน้า &ldquo;ดูคำตอบนักเรียน&rdquo;
                        นักเรียนเพียงแสกน QR Code
                        ด้วยกล้องมือถือเพื่อบันทึกการผ่านภารกิจ
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* แบบทดสอบหลายตัวเลือก / ก่อนเรียน-หลังเรียน */}
              {(type === "MULTIPLE_CHOICE_QUIZ" || type === "PRE_TEST") && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-5 bg-[#6b857a] rounded-full" />
                    <p className="text-sm font-semibold text-gray-700">
                      คำถามแบบทดสอบ
                    </p>
                  </div>

                  {mcqQuestions.map((q, qi) => (
                    <div
                      key={qi}
                      className="p-4 bg-gray-50 rounded-xl border border-gray-200 relative group"
                    >
                      {mcqQuestions.length > 1 && (
                        <button
                          className="p-2 text-[#E84A5F] opacity-0 group-hover:opacity-70 hover:!opacity-100 hover:text-[#FF847C] hover:bg-[#E84A5F]/10 rounded-lg transition-all absolute top-3 right-3"
                          onClick={() => removeMcqQuestion(qi)}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}

                      <div className="flex justify-between items-center mb-2">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          คำถามที่ {qi + 1}
                        </p>
                        <span className="text-xs text-gray-400">
                          {q.text.length}/255
                        </span>
                      </div>
                      <input
                        className={`${inputCls} mb-3 bg-white`}
                        maxLength={255}
                        placeholder="กรอกข้อความคำถาม"
                        value={q.text}
                        onChange={(e) => updateQText(qi, e.target.value)}
                      />

                      <div className="space-y-2 pl-2 border-l-2 border-[#6b857a]/20 ml-1">
                        {q.choices.map((c, ci) => (
                          <div key={ci} className="flex items-center gap-2">
                            <button
                              className={`p-1 rounded-full transition-colors flex-shrink-0 ${c.isCorrect ? "text-[#6b857a]" : "text-gray-300 hover:text-gray-400"}`}
                              title="เลือกเป็นคำตอบที่ถูกต้อง"
                              onClick={() => setCorrect(qi, ci)}
                            >
                              {c.isCorrect ? (
                                <CheckCircle2 size={20} />
                              ) : (
                                <Circle size={20} />
                              )}
                            </button>
                            <div className="flex-1 relative">
                              <input
                                className={`w-full px-3 py-1.5 border rounded-lg text-sm outline-none transition-colors pr-14 ${c.isCorrect ? "border-[#6b857a] ring-1 ring-[#6b857a] bg-[#6b857a]/5" : "border-gray-300 focus:border-[#6b857a] focus:ring-1 focus:ring-[#6b857a]"}`}
                                maxLength={255}
                                placeholder={`ตัวเลือกที่ ${ci + 1}`}
                                value={c.text}
                                onChange={(e) =>
                                  updateChoiceText(qi, ci, e.target.value)
                                }
                              />
                              <span className="absolute right-2 top-2 text-[10px] text-gray-400">
                                {c.text.length}/255
                              </span>
                            </div>
                            {q.choices.length > 2 && (
                              <button
                                className="text-[#E84A5F] opacity-70 hover:opacity-100 hover:text-[#FF847C] hover:bg-[#E84A5F]/10 p-1 rounded transition-colors"
                                onClick={() => removeChoice(qi, ci)}
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        ))}
                        <button
                          className="flex items-center gap-1 text-xs text-[#6b857a] hover:text-[#5a7268] font-medium ml-7 mt-1"
                          onClick={() => addChoice(qi)}
                        >
                          <Plus size={14} /> เพิ่มตัวเลือก
                        </button>
                      </div>
                    </div>
                  ))}

                  <button
                    className="w-full py-3 border-2 border-dashed border-gray-300 hover:border-[#6b857a] rounded-xl text-sm text-gray-500 hover:text-[#6b857a] font-medium transition-colors flex items-center justify-center gap-2"
                    onClick={addMcqQuestion}
                  >
                    <Plus size={16} /> เพิ่มคำถามอีก
                  </button>
                </div>
              )}
            </ModalBody>

            <ModalFooter className="p-6 pt-2 flex gap-2">
              <Button
                fullWidth
                className="font-normal text-gray-600"
                isDisabled={loading}
                size="lg"
                variant="light"
                onPress={onClose}
              >
                ยกเลิก
              </Button>
              <Button
                fullWidth
                className="bg-[#6b857a] text-white rounded-xl font-medium shadow-lg hover:bg-[#5a7268]"
                isLoading={loading}
                isDisabled={loading}
                size="lg"
                startContent={!loading && <Save size={18} />}
                onPress={handleSubmit}
              >
                สร้างภารกิจ
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
