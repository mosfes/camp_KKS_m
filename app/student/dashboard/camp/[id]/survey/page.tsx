"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Textarea } from "@heroui/input";
import { ChevronLeft, ClipboardList } from "lucide-react";
import { toast } from "react-hot-toast";

export default function StudentSurveyPage() {
  const params = useParams();
  const router = useRouter();
  const { id } = params;

  const [survey, setSurvey] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const submitInFlightRef = useRef(false);
  const [answers, setAnswers] = useState<Record<number, any>>({});
  const [isCompleted, setIsCompleted] = useState(false);

  const fetchSurvey = async () => {
    try {
      const res = await fetch(`/api/student/surveys?campId=${id}`, {
        cache: "no-store",
      });

      if (res.ok) {
        const data = await res.json();

        if (data.isCompleted) {
          setIsCompleted(true);
          toast.success("คุณทำแบบประเมินนี้ไปแล้ว");
          setTimeout(
            () => router.replace(`/student/dashboard/camp/${id}/missions`),
            1500,
          );
        } else if (!data.survey) {
          toast.error("ไม่พบแบบประเมิน");
          router.replace(`/student/dashboard/camp/${id}/missions`);
        } else {
          setSurvey(data.survey);
        }
      } else {
        const errorData = await res.json().catch(() => null);

        if (res.status === 403) {
          toast.error(errorData?.error || "ไม่สามารถทำแบบประเมินได้ในขณะนี้");
          router.replace(`/student/dashboard/camp/${id}`);
        } else {
          toast.error("ดึงข้อมูลแบบประเมินล้มเหลว");
        }
      }
    } catch (error) {
      console.error("Failed to fetch survey", error);
      toast.error("เกิดข้อผิดพลาดในการดึงข้อมูล");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    window.scrollTo(0, 0);
    fetchSurvey();
  }, [id]);

  const handleAnswerChange = (questionId: number, value: any) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  };

  const toggleCheckboxAnswer = (questionId: number, option: string) => {
    setAnswers((prev) => {
      const selected = Array.isArray(prev[questionId]) ? prev[questionId] : [];

      return {
        ...prev,
        [questionId]: selected.includes(option)
          ? selected.filter((item: string) => item !== option)
          : [...selected, option],
      };
    });
  };

  const handleSubmit = async () => {
    if (submitInFlightRef.current) return;
    if (!survey || !survey.survey_question) return;

    // Validate that all questions are answered (except text-based feedback)
    const unanswered = survey.survey_question.some((q: any) => {
      const ans = answers[q.question_id];

      if (q.question_type === "scale" && !ans) return true;

      // if (q.question_type === 'text' && (!ans || ans.trim() === '')) return true; // Now optional
      return false;
    });

    if (unanswered) {
      toast.error("กรุณาตอบคำถามให้ครบทุกข้อ");

      return;
    }

    submitInFlightRef.current = true;
    setSubmitting(true);

    try {
      const answerableQuestions = survey.survey_question.filter((q: any) =>
        ["scale", "text", "checkbox"].includes(q.question_type),
      );

      const formattedAnswers = answerableQuestions.map((q: any) => ({
        questionId: q.question_id,
        scaleValue:
          q.question_type === "scale" ? Number(answers[q.question_id]) : null,
        textAnswer:
          q.question_type === "text"
            ? answers[q.question_id]
            : q.question_type === "checkbox"
              ? JSON.stringify(answers[q.question_id] || [])
              : null,
      }));

      const res = await fetch("/api/student/surveys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          surveyId: survey.survey_id,
          campId: id,
          answers: formattedAnswers,
        }),
      });

      if (res.ok) {
        toast.success("ส่งแบบประเมินเรียบร้อยแล้ว");
        router.replace(`/student/dashboard/camp/${id}/missions`);
      } else {
        const errorData = await res.json();

        toast.error(errorData.error || "บันทึกข้อมูลล้มเหลว");
      }
    } catch (error) {
      console.error("Failed to submit survey", error);
      toast.error("เกิดข้อผิดพลาดในการส่งข้อมูล");
    } finally {
      submitInFlightRef.current = false;
      setSubmitting(false);
    }
  };

  if (loading || isCompleted) {
    return (
      <div className="p-8 text-center bg-[#f5f5f2] min-h-screen flex items-center justify-center">
        {loading ? "กำลังโหลดแบบประเมิน..." : "กำลังพากลับหน้าภารกิจ..."}
      </div>
    );
  }

  if (!survey) return null;

  return (
    <div className="min-h-screen bg-[#f5f5f2]">
      {/* Header */}
      <div className="bg-white px-4 py-4 shadow-sm flex items-center gap-4 sticky top-0 z-50">
        <Button isIconOnly variant="light" onPress={() => router.back()}>
          <ChevronLeft className="text-gray-600" size={24} />
        </Button>
        <div>
          <h1 className="text-lg font-bold text-[#2d3748]">
            แบบประเมินความพึงพอใจ
          </h1>
          <p className="text-sm text-gray-500">
            {survey.title || "ค่ายกิจกรรม"}
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Survey Header Info */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-[#EBE7DD] flex items-center justify-center text-[#5a4a3a]">
              <ClipboardList size={20} />
            </div>
            <h2 className="text-xl font-bold text-[#2d3748]">{survey.title}</h2>
          </div>
          {survey.description && (
            <p className="text-gray-600 whitespace-pre-wrap">
              {survey.description}
            </p>
          )}
        </div>

        {/* Questions List */}
        <div className="space-y-6">
          {(() => {
            let questionNumber = 0;

            return survey.survey_question?.map((q: any) => {
              if (q.question_type === "header") {
                return (
                  <div
                    key={q.question_id}
                    className="rounded-2xl border border-purple-100 bg-purple-50/50 p-5"
                  >
                    <h3 className="text-lg font-bold text-purple-900">
                      {q.question_text}
                    </h3>
                  </div>
                );
              }

              const currentQuestionNumber = ++questionNumber;

              return (
                <div
                  key={q.question_id}
                  className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
                >
                  <h3 className="text-gray-800 font-medium mb-4">
                    ข้อ {currentQuestionNumber}. {q.question_text}
                    {q.question_type === "scale" ? (
                      <span className="text-red-500 ml-1">*</span>
                    ) : (
                      <span className="text-gray-400 font-normal ml-2 text-sm">
                        (ไม่บังคับ)
                      </span>
                    )}
                  </h3>

                  {q.question_type === "scale" && (
                    <div className="mt-4 overflow-x-auto pb-2">
                      <div className="inline-block min-w-full sm:min-w-[auto]">
                        <div className="flex items-center gap-3 sm:gap-5 py-2">
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
                                      value.toString(),
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

                  {q.question_type === "text" && (
                    <Textarea
                      classNames={{
                        input: "text-gray-900 bg-gray-50",
                        inputWrapper:
                          "bg-gray-50 data-[hover=true]:bg-gray-100",
                      }}
                      minRows={3}
                      placeholder="พิมพ์คำตอบของคุณที่นี่..."
                      value={answers[q.question_id] || ""}
                      onValueChange={(val) =>
                        handleAnswerChange(q.question_id, val)
                      }
                    />
                  )}
                  {q.question_type === "checkbox" && (
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
                                  toggleCheckboxAnswer(q.question_id, option)
                                }
                              />
                              {option}
                            </label>
                          );
                        },
                      )}
                    </div>
                  )}
                </div>
              );
            });
          })()}
        </div>

        {/* Submit Button */}
        <div className="pt-4 pb-8 flex justify-center">
          <Button
            className="w-full md:w-auto md:min-w-[200px] bg-[#5d7c6f] text-white py-6 shadow-md hover:bg-[#4a6358] transition-colors"
            isLoading={submitting}
            isDisabled={submitting}
            radius="full"
            size="lg"
            onPress={handleSubmit}
          >
            ส่งแบบประเมิน
          </Button>
        </div>
      </div>
    </div>
  );
}
