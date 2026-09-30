"use client";

import { useState, useRef, useEffect } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
} from "@heroui/react";
import { ClipboardList, Heading, Info } from "lucide-react";
import { toast } from "react-hot-toast";

interface Question {
  question_id: number;
  question_text: string;
  question_type: "text" | "scale" | "header" | "checkbox";
  scale_max?: number;
  options?: string | null;
}

interface TakeSurveyModalProps {
  isOpen: boolean;
  onClose: () => void;
  survey: {
    survey_id: number;
    title: string;
    description: string;
    survey_question: Question[];
  };
  campId: number;
  onCompleted: () => void;
}

export default function TakeSurveyModal({
  isOpen,
  onClose,
  survey,
  campId,
  onCompleted,
}: TakeSurveyModalProps) {
  const [answers, setAnswers] = useState<Record<number, any>>({});
  const [loading, setLoading] = useState(false);
  const submitInFlightRef = useRef(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (errorMsg) {
      const timer = setTimeout(() => {
        if (errorRef.current) {
          errorRef.current.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
          });
        }
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [errorMsg]);

  if (!survey) return null;

  const handleAnswerChange = (qId: number, value: any) => {
    setAnswers((prev) => ({
      ...prev,
      [qId]: value,
    }));
  };

  const toggleCheckboxAnswer = (qId: number, option: string) => {
    setAnswers((prev) => {
      const selected = Array.isArray(prev[qId]) ? prev[qId] : [];

      return {
        ...prev,
        [qId]: selected.includes(option)
          ? selected.filter((item: string) => item !== option)
          : [...selected, option],
      };
    });
  };

  const handleSubmit = async () => {
    if (submitInFlightRef.current) return;
    const validQuestions = survey.survey_question.filter(
      (q) => q.question_type !== "header",
    );

    // Validate
    for (const q of validQuestions) {
      if (q.question_type === "scale" && !answers[q.question_id]) {
        toast.error("กรุณาตอบคำถามให้ครบทุกข้อ");
        setErrorMsg(
          "กรุณาตอบคำถามที่มีเครื่องหมาย * ให้ครบทุกข้อก่อนส่งแบบสอบถาม",
        );

        return;
      }
    }

    const formattedAnswers = validQuestions.map((q) => ({
      questionId: q.question_id,
      textAnswer:
        q.question_type === "text"
          ? answers[q.question_id]
          : q.question_type === "checkbox"
            ? JSON.stringify(answers[q.question_id] || [])
            : null,
      scaleValue:
        q.question_type === "scale" ? Number(answers[q.question_id]) : null,
    }));

    submitInFlightRef.current = true;
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await fetch("/api/student/surveys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          surveyId: survey.survey_id,
          campId,
          answers: formattedAnswers,
        }),
      });

      if (!res.ok) {
        const resClone = res.clone();
        let errorMessage = "Failed to submit survey";

        try {
          const err = await res.json();

          console.warn("Survey submission failed (JSON):", err);
          errorMessage = err.error || errorMessage;
        } catch (e) {
          const text = await resClone.text();

          console.warn("Survey submission failed (Text):", text);
          errorMessage = text.slice(0, 100) || errorMessage;
        }

        throw new Error(errorMessage);
      }

      toast.success("ส่งแบบสอบถามเรียบร้อยแล้ว");
      onCompleted();
      onClose();
    } catch (error: any) {
      setErrorMsg(error.message || "เกิดข้อผิดพลาดในการส่งแบบสอบถาม");
      toast.error(error.message || "เกิดข้อผิดพลาดในการส่งแบบสอบถาม");
    } finally {
      submitInFlightRef.current = false;
      setLoading(false);
    }
  };

  return (
    <Modal
      backdrop="blur"
      classNames={{
        base: "bg-white rounded-3xl shadow-xl max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100%_-_8rem)]",
        backdrop: "bg-black/40 backdrop-blur-sm",
      }}
      isOpen={isOpen}
      scrollBehavior="inside"
      size="2xl"
      onOpenChange={onClose}
    >
      <ModalContent>
        {() => (
          <>
            <ModalHeader className="flex flex-col gap-1 px-4 pt-4 pb-3 sm:px-8 sm:pt-8 sm:pb-4">
              <div className="flex items-center gap-2 mb-1 sm:gap-3 sm:mb-2">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                  <ClipboardList size={20} />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {survey.title}
                </h2>
              </div>
              {survey.description && (
                <p className="text-sm text-gray-500 font-normal leading-relaxed">
                  {survey.description}
                </p>
              )}

              <div className="mt-3 bg-blue-50/80 border border-blue-100 rounded-xl p-2.5 flex items-start gap-2 sm:mt-4 sm:p-3 sm:gap-3">
                <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-700 font-normal leading-relaxed">
                  <span className="font-normal">แบบสอบถามไม่ระบุตัวตน:</span>{" "}
                  จะไม่มีการแสดงชื่อหรือข้อมูลส่วนตัวของผู้ตอบแบบสอบถาม
                </p>
              </div>
            </ModalHeader>

            <ModalBody className="px-4 py-3 space-y-3 sm:px-8 sm:py-4 sm:space-y-6">
              {(() => {
                let qNumber = 1;

                return survey.survey_question.map((q) => {
                  if (q.question_type === "header") {
                    return (
                      <div
                        key={q.question_id}
                        className="bg-purple-50/50 rounded-2xl p-3 sm:p-5 border border-purple-100 mt-1 sm:mt-2"
                      >
                        <div className="flex gap-3 items-center">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                            <Heading size={16} />
                          </div>
                          <h3 className="font-bold text-purple-900 text-lg">
                            {q.question_text}
                          </h3>
                        </div>
                      </div>
                    );
                  }

                  const currentIndex = qNumber++;

                  return (
                    <div
                      key={q.question_id}
                      className="bg-gray-50 rounded-2xl p-3 sm:p-5 border border-gray-100"
                    >
                      <div className="flex gap-2 mb-2 sm:gap-3 sm:mb-4">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center text-xs font-bold text-gray-500">
                          {currentIndex}
                        </span>
                        <p className="font-medium text-gray-800 leading-relaxed pt-0.5">
                          {q.question_text}
                          {q.question_type === "scale" ? (
                            <span className="text-red-500 ml-1">*</span>
                          ) : (
                            <span className="text-gray-400 font-normal ml-2 text-sm">
                              (ไม่บังคับ)
                            </span>
                          )}
                        </p>
                      </div>

                      <div className="pl-8 sm:pl-9">
                        {q.question_type === "text" ? (
                          <textarea
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#5d7c6f] focus:border-[#5d7c6f] outline-none transition-all text-sm resize-none bg-white text-gray-900"
                            placeholder="พิมพ์คำตอบของคุณที่นี่..."
                            rows={3}
                            value={answers[q.question_id] || ""}
                            onChange={(e) =>
                              handleAnswerChange(q.question_id, e.target.value)
                            }
                          />
                        ) : q.question_type === "checkbox" ? (
                          <div className="space-y-3">
                            {(q.options ? JSON.parse(q.options) : []).map(
                              (option: string, optionIndex: number) => {
                                const selected = (
                                  answers[q.question_id] || []
                                ).includes(option);

                                return (
                                  <label
                                    key={`${option}-${optionIndex}`}
                                    className="flex cursor-pointer items-center gap-3 text-sm text-gray-700"
                                  >
                                    <input
                                      checked={selected}
                                      className="h-4 w-4 rounded accent-[#5d7c6f]"
                                      type="checkbox"
                                      onChange={() =>
                                        toggleCheckboxAnswer(
                                          q.question_id,
                                          option,
                                        )
                                      }
                                    />
                                    {option}
                                  </label>
                                );
                              },
                            )}
                          </div>
                        ) : (
                          <div className="mt-2 overflow-x-auto pb-1 sm:mt-4 sm:pb-2">
                            <div className="inline-block min-w-full sm:min-w-[auto]">
                              <div className="flex items-center gap-2 sm:gap-5 py-1 sm:py-2">
                                <span className="text-xs font-medium text-[#4f6d5f] whitespace-nowrap">
                                  มากที่สุด
                                </span>
                                {Array.from({ length: q.scale_max || 5 }).map(
                                  (_, i) => {
                                    const scaleMax = q.scale_max || 5;
                                    const value = scaleMax - i;
                                    const isSelected =
                                      Number(answers[q.question_id]) === value;

                                    return (
                                      <button
                                        key={value}
                                        aria-label={`ให้คะแนน ${value}`}
                                        className="flex flex-col items-center gap-3 group focus:outline-none flex-shrink-0 w-10 relative"
                                        type="button"
                                        onClick={() =>
                                          handleAnswerChange(
                                            q.question_id,
                                            value,
                                          )
                                        }
                                      >
                                        <span
                                          className={`text-sm font-medium transition-colors ${isSelected ? "text-[#5d7c6f]" : "text-gray-500"}`}
                                        >
                                          {value}
                                        </span>
                                        <div
                                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                                            isSelected
                                              ? "border-[#5d7c6f]"
                                              : "border-gray-300 group-hover:border-gray-400"
                                          }`}
                                        >
                                          {isSelected && (
                                            <div className="w-3 h-3 bg-[#5d7c6f] rounded-full" />
                                          )}
                                        </div>
                                      </button>
                                    );
                                  },
                                )}
                                <span className="text-xs font-medium text-gray-500 whitespace-nowrap">
                                  น้อยที่สุด
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}

              {errorMsg && (
                <div ref={errorRef} className="pt-2 pb-4">
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start gap-3 shadow-sm">
                    <div className="mt-0.5 flex-shrink-0">
                      <svg
                        className="text-rose-500"
                        fill="none"
                        height="20"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                        width="20"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" x2="12" y1="8" y2="12" />
                        <line x1="12" x2="12.01" y1="16" y2="16" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-bold text-rose-800 mb-1">
                        ไม่สามารถส่งแบบสอบถามได้
                      </h3>
                      <p className="text-sm text-rose-600 leading-relaxed">
                        {errorMsg}
                      </p>
                    </div>
                    <button
                      className="text-rose-400 hover:text-rose-600 transition-colors flex-shrink-0"
                      type="button"
                      onClick={() => setErrorMsg(null)}
                    >
                      <svg
                        fill="none"
                        height="18"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                        width="18"
                      >
                        <line x1="18" x2="6" y1="6" y2="18" />
                        <line x1="6" x2="18" y1="6" y2="18" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </ModalBody>

            <ModalFooter className="px-4 py-3 flex-col sm:flex-row gap-2 sm:px-8 sm:py-6 sm:gap-3">
              <Button
                fullWidth
                className="bg-gray-100 text-gray-600 font-normal sm:w-1/3"
                isDisabled={loading}
                size="lg"
                onPress={onClose}
              >
                ยกเลิก
              </Button>
              <Button
                fullWidth
                className="bg-[#5d7c6f] text-white font-normal shadow-lg shadow-[#5d7c6f]/20 sm:w-2/3"
                isLoading={loading}
                isDisabled={loading}
                size="lg"
                onPress={handleSubmit}
              >
                ส่งแบบสอบถาม
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
