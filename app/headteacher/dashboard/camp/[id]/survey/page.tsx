"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  Button,
  Select,
  SelectItem,
  Switch,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
} from "@heroui/react";
import toast from "react-hot-toast";
import {
  FileText,
  BarChart3,
  Plus,
  Trash2,
  BookTemplate,
  ChevronDown,
  ChevronUp,
  CircleDot,
  ListChecks,
  AlignLeft,
  Heading,
  Star,
  Users,
  Sparkles,
  CheckCircle2,
  Lightbulb,
  Book,
  Save,
  MessageSquare,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  HelpCircle,
  Square,
  CheckSquare,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from "recharts";

import CampBreadcrumb from "../../CampBreadcrumb";

import { useStatusModal } from "@/components/StatusModalProvider";
import { getCleanCampPath } from "@/lib/client-active-camp";

interface Question {
  id?: number;
  text: string;
  type: "text" | "scale" | "header" | "grid" | "checkbox";
  scaleMax: number;
  options?: string[];
}

interface Template {
  template_id: number;
  title: string;
  description?: string;
  survey_template_question: {
    question_id: number;
    question_text: string;
    question_type: "text" | "scale" | "header" | "grid" | "checkbox";
    scale_max?: number;
    options?: string;
  }[];
}

interface QuestionSummary {
  id: number;
  text: string;
  type: "scale" | "text" | "checkbox" | "header";
  scaleMax?: number;
  allOptions?: string[];
  average?: number;
  total: number;
  distribution?: { [key: string]: number };
  answers?: string[];
  options?: { label: string; count: number }[];
}

interface IndividualResponse {
  responseId: number;
  index: number;
  submittedAt: string;
  studentId: number | null;
  studentName: string;
  classroom: string;
  answers: Record<
    number,
    { text_answer: string | null; scale_value: number | null }
  >;
}

interface SurveySummary {
  surveyId: number;
  title: string;
  isAcceptingResponses?: boolean;
  totalResponses: number;
  questions: QuestionSummary[];
  individualResponses?: IndividualResponse[];
  demographics?: {
    gender: { male: number; female: number; other: number };
    grade: Record<string, number>;
  };
}

function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-lg bg-gray-200 ${className}`}
    />
  );
}

function SurveyPageSkeleton() {
  return (
    <main
      aria-busy="true"
      aria-label="กำลังโหลดแบบสอบถาม"
      className="h-full min-h-0 overflow-y-auto bg-[#f5f5f2] pb-16"
    >
      {/* ── Top Header Bar Skeleton ── */}
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/95 backdrop-blur-md shadow-xs">
        <div className="mx-auto flex w-full max-w-6xl flex-col px-4 pt-4 pb-0 sm:px-8">
          {/* Title & Actions Skeleton */}
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center pb-2">
            <div className="flex items-center gap-3">
              <SkeletonBlock className="h-10 w-10 rounded-xl" />
              <div className="space-y-1.5">
                <SkeletonBlock className="h-6 w-48 sm:w-64" />
                <SkeletonBlock className="h-3.5 w-32" />
              </div>
            </div>

            {/* Header Actions Skeleton */}
            <div className="flex items-center gap-2">
              <SkeletonBlock className="h-8 w-20 rounded-md" />
              <SkeletonBlock className="h-8 w-20 rounded-md" />
            </div>
          </div>

          {/* Google Forms Navigation Tabs Skeleton */}
          <div className="flex items-center gap-8 border-t border-gray-100 pt-3 pb-3">
            <div className="flex items-center gap-2">
              <SkeletonBlock className="h-4 w-4 rounded-sm" />
              <SkeletonBlock className="h-4 w-14" />
            </div>
            <div className="flex items-center gap-2">
              <SkeletonBlock className="h-4 w-4 rounded-sm" />
              <SkeletonBlock className="h-4 w-20" />
              <SkeletonBlock className="h-4 w-6 rounded-full" />
            </div>
          </div>
        </div>
      </header>

      {/* ── Main Tab Content Skeleton ── */}
      <div className="mx-auto w-full max-w-6xl px-4 pt-6 sm:px-8 space-y-6">
        {/* Form Header Card Skeleton */}
        <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 pt-8 sm:p-8 sm:pt-9 shadow-sm space-y-4">
          <div className="absolute top-0 left-0 right-0 h-3 bg-gray-200" />
          <SkeletonBlock className="h-8 w-72 sm:w-96" />
          <SkeletonBlock className="h-4 w-full max-w-lg" />
        </div>

        {/* Template Banner Skeleton */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-4">
            <SkeletonBlock className="h-11 w-11 rounded-xl" />
            <div className="space-y-1.5">
              <SkeletonBlock className="h-4 w-44" />
              <SkeletonBlock className="h-3 w-64" />
            </div>
          </div>
          <SkeletonBlock className="h-8 w-24 rounded-md" />
        </div>

        {/* Settings Card Skeleton */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm flex items-center justify-between">
          <div className="space-y-1.5">
            <SkeletonBlock className="h-4 w-48" />
            <SkeletonBlock className="h-3 w-60" />
          </div>
          <SkeletonBlock className="h-6 w-10 rounded-full" />
        </div>

        {/* Question Cards Skeleton */}
        <div className="space-y-4 pb-6">
          {[1, 2].map((idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 shadow-sm space-y-4"
            >
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                <SkeletonBlock className="h-8 w-16 rounded-full" />
                <SkeletonBlock className="h-11 flex-1 rounded-t-md" />
                <SkeletonBlock className="h-11 w-full sm:w-56 rounded-lg" />
              </div>
              <div className="flex items-center gap-3 pt-2">
                <SkeletonBlock className="h-5 w-5 rounded-full" />
                <SkeletonBlock className="h-5 w-5 rounded-full" />
                <SkeletonBlock className="h-5 w-5 rounded-full" />
                <SkeletonBlock className="h-5 w-5 rounded-full" />
                <SkeletonBlock className="h-5 w-5 rounded-full" />
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <SkeletonBlock className="h-7 w-7 rounded-full" />
                <SkeletonBlock className="h-7 w-7 rounded-full" />
                <SkeletonBlock className="h-7 w-7 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

function ResponsesTabSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="กำลังโหลดผลการตอบกลับ"
      className="space-y-6"
    >
      {/* Score Banner Skeleton */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <SkeletonBlock className="h-12 w-12 rounded-2xl" />
          <div className="space-y-1.5">
            <SkeletonBlock className="h-4 w-36" />
            <SkeletonBlock className="h-3 w-48" />
          </div>
        </div>
        <SkeletonBlock className="h-10 w-24 rounded-lg" />
      </div>

      {/* Demographics Charts Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <SkeletonBlock className="h-8 w-8 rounded-full" />
            <SkeletonBlock className="h-4 w-36" />
          </div>
          <SkeletonBlock className="h-44 w-full rounded-xl" />
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <SkeletonBlock className="h-8 w-8 rounded-full" />
            <SkeletonBlock className="h-4 w-40" />
          </div>
          <SkeletonBlock className="h-44 w-full rounded-xl" />
        </div>
      </div>

      {/* Question Breakdown Skeleton */}
      <div className="space-y-4">
        {[1, 2].map((idx) => (
          <div
            key={idx}
            className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 shadow-sm space-y-4"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3 flex-1">
                <SkeletonBlock className="h-7 w-7 rounded-full" />
                <SkeletonBlock className="h-5 w-64" />
              </div>
              <SkeletonBlock className="h-6 w-16 rounded-full" />
            </div>
            <SkeletonBlock className="h-36 w-full rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SurveyPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const campId = Number(params.id);
  const { showError, showSuccess, showConfirm } = useStatusModal();

  // Tab State: 'questions' | 'responses'
  const initialTab =
    searchParams.get("tab") === "responses" ? "responses" : "questions";
  const [activeTab, setActiveTab] = useState<"questions" | "responses">(
    initialTab,
  );

  // Overall loading & survey metadata
  const [loading, setLoading] = useState(true);
  const [survey, setSurvey] = useState<any>(null);
  const [teacherId, setTeacherId] = useState(0);

  // Form Editor State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState<Question[]>([
    { text: "", type: "scale", scaleMax: 5 },
    { text: "", type: "text", scaleMax: 5 },
  ]);
  const [globalScaleMax, setGlobalScaleMax] = useState<number>(5);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateTitle, setTemplateTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const submitInFlightRef = useRef(false);

  // Template Modal State
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  // Responses State
  const [resultsData, setResultsData] = useState<SurveySummary | null>(null);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [resultsError, setResultsError] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState<any>(null);
  const [responseSubTab, setResponseSubTab] = useState<
    "summary" | "question" | "individual"
  >("summary");
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState(0);
  const [selectedIndividualIndex, setSelectedIndividualIndex] = useState(0);
  const [isTogglingAccepting, setIsTogglingAccepting] = useState(false);

  // Load Survey & Camp data on mount
  useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetch(`/api/surveys?campId=${campId}`).then((res) =>
        res.ok ? res.json() : null,
      ),
      fetch(`/api/camps/${campId}?view=survey`).then((res) =>
        res.ok ? res.json() : null,
      ),
    ])
      .then(([surveyData, campData]) => {
        if (cancelled) return;
        if (surveyData && !surveyData.error && surveyData.survey_id) {
          setSurvey(surveyData);
          setTitle(surveyData.title || "");
          setDescription(surveyData.description || "");
          if (
            surveyData.survey_question &&
            surveyData.survey_question.length > 0
          ) {
            setQuestions(
              surveyData.survey_question.map((q: any) => ({
                id: q.question_id,
                text: q.question_text,
                type: q.question_type,
                scaleMax: q.scale_max || 5,
                options: q.options ? JSON.parse(q.options) : [],
              })),
            );
            const scaleQ = surveyData.survey_question.find(
              (q: any) => q.question_type === "scale",
            );

            if (scaleQ && scaleQ.scale_max) {
              setGlobalScaleMax(scaleQ.scale_max);
            }
          }
        }
        setTeacherId(campData?.created_by_teacher_id ?? 0);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [campId]);

  // Load Responses data
  const fetchResults = async () => {
    try {
      setResultsLoading(true);
      setResultsError(null);
      const res = await fetch(`/api/surveys/results?campId=${campId}`);

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));

        throw new Error(errorData.error || "ไม่สามารถดึงข้อมูลผลแบบประเมินได้");
      }
      const json = await res.json();

      setResultsData(json.survey === null ? null : json);
    } catch (err: any) {
      setResultsError(err.message || "ไม่สามารถดึงข้อมูลผลแบบประเมินได้");
    } finally {
      setResultsLoading(false);
    }
  };

  useEffect(() => {
    if (campId) {
      fetchResults();
    }
  }, [campId]);

  // Sync tab change with URL search params
  const handleTabChange = (tab: "questions" | "responses") => {
    setActiveTab(tab);
    const newUrl = `${getCleanCampPath("survey")}?tab=${tab}`;

    window.history.replaceState(null, "", newUrl);
    if (tab === "responses") {
      fetchResults();
    }
  };

  // Template Fetching
  const fetchTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const res = await fetch(`/api/surveys/templates`);
      const data = await res.json();

      setTemplates(Array.isArray(data) ? data : []);
    } catch {
      setTemplates([]);
    } finally {
      setLoadingTemplates(false);
    }
  };

  useEffect(() => {
    if (showTemplates && templates.length === 0) {
      fetchTemplates();
    }
  }, [showTemplates]);

  const applyTemplate = (tpl: Template) => {
    setTitle(tpl.title);
    setDescription(tpl.description || "");
    setQuestions(
      tpl.survey_template_question.map((q) => ({
        text: q.question_text,
        type: q.question_type,
        scaleMax: q.scale_max || 5,
        options: q.options ? JSON.parse(q.options) : [],
      })),
    );
    const scaleQ = tpl.survey_template_question.find(
      (q) => q.question_type === "scale",
    );

    if (scaleQ && scaleQ.scale_max) {
      setGlobalScaleMax(scaleQ.scale_max);
    } else {
      setGlobalScaleMax(5);
    }
    setShowTemplates(false);
    toast.success("นำเข้าเทมเพลตเรียบร้อยแล้ว");
  };

  const deleteTemplate = (templateId: number) => {
    showConfirm(
      "ยืนยันการลบเทมเพลต",
      "คุณต้องการลบเทมเพลตนี้ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้",
      async () => {
        try {
          const res = await fetch(
            `/api/surveys/templates?templateId=${templateId}`,
            { method: "DELETE" },
          );

          if (res.ok) {
            setTemplates((prev) =>
              prev.filter((t) => t.template_id !== templateId),
            );
            showSuccess("สำเร็จ", "ลบเทมเพลตเรียบร้อยแล้ว");
          } else {
            showError("ข้อผิดพลาด", "ไม่สามารถลบเทมเพลตได้");
          }
        } catch {
          showError("ข้อผิดพลาด", "ไม่สามารถลบเทมเพลตได้");
        }
      },
      "ลบเทมเพลต",
    );
  };

  // Question Management Handlers
  const addQuestion = (
    type: "text" | "scale" | "header" | "grid" | "checkbox",
  ) => {
    setQuestions([
      ...questions,
      {
        text: "",
        type,
        scaleMax: globalScaleMax,
        options:
          type === "grid"
            ? ["รายการที่ 1"]
            : type === "checkbox"
              ? ["ตัวเลือกที่ 1"]
              : undefined,
      },
    ]);
  };

  const removeQuestion = (i: number) => {
    if (questions.length <= 1) return;
    setQuestions(questions.filter((_, idx) => idx !== i));
  };

  const moveQuestion = (i: number, dir: -1 | 1) => {
    if (i + dir < 0 || i + dir >= questions.length) return;
    const newQ = [...questions];
    const temp = newQ[i];

    newQ[i] = newQ[i + dir];
    newQ[i + dir] = temp;
    setQuestions(newQ);
  };

  const updateQuestion = (i: number, field: keyof Question, val: any) => {
    const q = [...questions];

    (q[i] as any)[field] = val;
    if (
      field === "type" &&
      (val === "grid" || val === "checkbox") &&
      !q[i].options?.length
    ) {
      q[i].options = [val === "checkbox" ? "ตัวเลือกที่ 1" : "รายการที่ 1"];
    }
    setQuestions(q);
  };

  const addGridRow = (i: number) => {
    const q = [...questions];

    if (!q[i].options) q[i].options = [];
    const label = q[i].type === "checkbox" ? "ตัวเลือกที่" : "รายการที่";

    q[i].options!.push(`${label} ${q[i].options!.length + 1}`);
    setQuestions(q);
  };

  const updateGridRow = (qi: number, ri: number, val: string) => {
    const q = [...questions];

    if (!q[qi].options) return;
    q[qi].options![ri] = val;
    setQuestions(q);
  };

  const removeGridRow = (qi: number, ri: number) => {
    const q = [...questions];

    if (!q[qi].options) return;
    q[qi].options = q[qi].options!.filter((_, idx) => idx !== ri);
    setQuestions(q);
  };

  // Submit / Save Form
  const handleSubmit = async () => {
    if (submitInFlightRef.current) return;
    const finalTitle = title.trim() || "แบบสอบถามความพึงพอใจ";
    const realQuestions = questions.filter((q) => q.type !== "header");

    if (realQuestions.length === 0) {
      showError("ข้อผิดพลาด", "กรุณาเพิ่มคำถามอย่างน้อย 1 ข้อ");

      return;
    }
    for (let i = 0; i < questions.length; i++) {
      if (!questions[i].text.trim()) {
        const itemType =
          questions[i].type === "header" ? "หัวข้อ" : "คำถามข้อที่";

        showError("ข้อผิดพลาด", `กรุณากรอก${itemType} ${i + 1} ให้ครบถ้วน`);

        return;
      }
      if (
        questions[i].type === "checkbox" &&
        !questions[i].options?.some((option) => option.trim())
      ) {
        showError("ข้อผิดพลาด", `กรุณาเพิ่มตัวเลือกสำหรับคำถามข้อที่ ${i + 1}`);

        return;
      }
    }

    const finalQuestions = questions.map((q) => ({
      id: q.id,
      text: q.text,
      type: q.type,
      scaleMax: q.type === "scale" ? globalScaleMax : 5,
      options: q.options,
    }));

    submitInFlightRef.current = true;
    try {
      setSaving(true);
      const isEditing = !!survey;
      const url = isEditing ? `/api/surveys?campId=${campId}` : "/api/surveys";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campId,
          teacherId,
          title: finalTitle,
          description,
          questions: finalQuestions,
          saveAsTemplate,
          templateTitle: templateTitle.trim() || finalTitle,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();

        throw new Error(errorData.error || "เกิดข้อผิดพลาดในการบันทึก");
      }

      const updatedSurvey = await res.json();

      setSurvey(updatedSurvey);
      if (
        updatedSurvey.survey_question &&
        updatedSurvey.survey_question.length > 0
      ) {
        setQuestions(
          updatedSurvey.survey_question.map((q: any) => ({
            id: q.question_id,
            text: q.question_text,
            type: q.question_type,
            scaleMax: q.scale_max || 5,
            options: q.options ? JSON.parse(q.options) : [],
          })),
        );
      }
      toast.success(
        isEditing
          ? "บันทึกการแก้ไขเรียบร้อยแล้ว"
          : "สร้างแบบสอบถามเรียบร้อยแล้ว",
      );
      fetchResults();
    } catch (err: any) {
      showError("เกิดข้อผิดพลาด", err.message);
    } finally {
      submitInFlightRef.current = false;
      setSaving(false);
    }
  };

  // AI Summary
  const fetchAiSummary = async () => {
    try {
      setIsAiLoading(true);
      const res = await fetch("/api/surveys/ai-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campId, force: true }),
      });

      if (!res.ok) {
        const errorData = await res.json();

        throw new Error(errorData.error || "เกิดข้อผิดพลาดในการสรุปผล");
      }
      const result = await res.json();

      if (result.error) throw new Error(result.error);
      setAiSummary(result);
      toast.success("สรุปผลด้วย AI สำเร็จแล้ว");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Export the evaluation summary and the existing response table to Excel.
  const handleExportExcel = async () => {
    if (!resultsData || !resultsData.individualResponses?.length) {
      toast.error("ไม่มีข้อมูลคำตอบสำหรับส่งออก");

      return;
    }

    try {
      const { exportSurveyResultsToExcel } = await import(
        "@/lib/export-survey-results-excel"
      );

      exportSurveyResultsToExcel({
        title: resultsData.title,
        questions: resultsData.questions,
        individualResponses: resultsData.individualResponses,
      });
      toast.success("ส่งออกไฟล์ Excel เรียบร้อยแล้ว");
    } catch {
      toast.error("ไม่สามารถส่งออกไฟล์ Excel ได้");
    }
  };

  // Toggle Accepting Responses
  const handleToggleAcceptingResponses = async (val: boolean) => {
    try {
      setIsTogglingAccepting(true);
      const res = await fetch(`/api/surveys?campId=${campId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAcceptingResponses: val }),
      });

      if (!res.ok) {
        const errorData = await res.json();

        throw new Error(errorData.error || "ไม่สามารถเปลี่ยนสถานะได้");
      }

      setResultsData((prev) =>
        prev ? { ...prev, isAcceptingResponses: val } : prev,
      );
      toast.success(
        val ? "เปิดรับคำตอบเรียบร้อยแล้ว" : "ปิดรับคำตอบเรียบร้อยแล้ว",
      );
    } catch (err: any) {
      showError("ข้อผิดพลาด", err.message || "เกิดข้อผิดพลาดในการเปลี่ยนสถานะ");
    } finally {
      setIsTogglingAccepting(false);
    }
  };

  const scaleQuestions =
    resultsData?.questions.filter(
      (q) => q.type === "scale" && q.average != null,
    ) ?? [];
  const campAverage =
    scaleQuestions.length > 0
      ? (
          scaleQuestions.reduce((sum, q) => sum + (q.average || 0), 0) /
          scaleQuestions.length
        ).toFixed(2)
      : null;

  const totalResponses = resultsData?.totalResponses || 0;

  if (loading) {
    return <SurveyPageSkeleton />;
  }

  return (
    <main className="h-full min-h-0 overflow-y-auto bg-[#f5f5f2] pb-16">
      {/* ── Top Header Bar (Google Forms Style) ── */}
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/95 backdrop-blur-md shadow-xs">
        <div className="mx-auto flex w-full max-w-6xl flex-col px-4 pt-4 pb-0 sm:px-8">
          <CampBreadcrumb
            campId={campId}
            className="mb-3"
            currentPage="แบบสอบถาม"
          />

          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center pb-2">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#6b857a]/10 text-[#6b857a]">
                <FileText size={22} />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-lg font-bold text-gray-900 sm:text-xl">
                  {title || (survey ? survey.title : "แบบสอบถามความพึงพอใจ")}
                </h1>
                <p className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Users size={13} />
                  <span>ผู้ตอบทั้งหมด {totalResponses} คน</span>
                </p>
              </div>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-2">
              {activeTab === "questions" ? (
                <>
                  <Button
                    className="border border-gray-200 bg-white font-medium text-gray-700 hover:bg-gray-50"
                    size="sm"
                    startContent={<BookTemplate size={16} />}
                    variant="flat"
                    onPress={() => setShowTemplates(true)}
                  >
                    เทมเพลต
                  </Button>
                  <Button
                    className="bg-[#6b857a] font-medium text-white shadow-sm hover:bg-[#5a7268]"
                    isLoading={saving}
                    isDisabled={saving}
                    size="sm"
                    startContent={!saving && <Save size={16} />}
                    onPress={handleSubmit}
                  >
                    บันทึก
                  </Button>
                </>
              ) : (
                <>
                  {totalResponses > 0 && !aiSummary && (
                    <Button
                      className="bg-indigo-50 font-medium text-indigo-700 hover:bg-indigo-100"
                      isLoading={isAiLoading}
                      size="sm"
                      startContent={<Sparkles size={16} />}
                      variant="flat"
                      onPress={fetchAiSummary}
                    >
                      สรุปผลด้วย AI
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* ── Google Forms Navigation Tabs ── */}
          <div className="flex items-center gap-8 border-t border-gray-100 pt-1">
            <button
              className={`relative flex items-center gap-2 py-3 text-sm font-semibold transition-colors ${
                activeTab === "questions"
                  ? "text-[#6b857a]"
                  : "text-gray-500 hover:text-gray-800"
              }`}
              type="button"
              onClick={() => handleTabChange("questions")}
            >
              <FileText size={17} />
              <span>คำถาม</span>
              {activeTab === "questions" && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-[#6b857a]" />
              )}
            </button>

            <button
              className={`relative flex items-center gap-2 py-3 text-sm font-semibold transition-colors ${
                activeTab === "responses"
                  ? "text-[#6b857a]"
                  : "text-gray-500 hover:text-gray-800"
              }`}
              type="button"
              onClick={() => handleTabChange("responses")}
            >
              <BarChart3 size={17} />
              <span>การตอบกลับ</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-bold transition-colors ${
                  activeTab === "responses"
                    ? "bg-[#6b857a] text-white"
                    : "bg-gray-200 text-gray-700"
                }`}
              >
                {totalResponses}
              </span>
              {activeTab === "responses" && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-[#6b857a]" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Tab Content ── */}
      <div className="mx-auto w-full max-w-6xl px-4 pt-6 sm:px-8">
        {activeTab === "questions" ? (
          /* ══════════════════════════════════════════════════════════ */
          /*  TAB 1: QUESTIONS / FORM BUILDER                           */
          /* ══════════════════════════════════════════════════════════ */
          <div className="space-y-6">
            {/* Header Card (Google Forms Top Bar Accent) */}
            <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="absolute top-0 left-0 right-0 h-3 bg-gradient-to-r from-[#6b857a] to-[#4f6d5f]" />
              <div className="space-y-4 p-6 pt-8 sm:p-8 sm:pt-9">
                <input
                  className="w-full border-b border-transparent pb-2 text-2xl font-bold text-gray-900 outline-none transition-all hover:border-gray-200 focus:border-b-2 focus:border-[#6b857a]"
                  placeholder="แบบฟอร์มไม่มีชื่อ"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
                <textarea
                  className="w-full resize-none border-b border-transparent pb-1 text-sm text-gray-600 outline-none transition-all hover:border-gray-200 focus:border-b-2 focus:border-[#6b857a]"
                  placeholder="คำอธิบายแบบฟอร์ม เช่น แบบประเมินความพึงพอใจในการเข้าร่วมกิจกรรมค่าย"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>

            {/* Template Banner */}
            <div
              className="group flex flex-col justify-between gap-4 rounded-2xl border border-[#6b857a]/20 bg-gradient-to-r from-[#6b857a]/10 to-transparent p-4 sm:p-5 transition-all hover:border-[#6b857a]/50 sm:flex-row sm:items-center"
            >
              <div className="flex items-center gap-4">
                <div className="bg-[#6b857a] p-3 rounded-xl text-white shadow-sm group-hover:scale-105 transition-transform">
                  <BookTemplate size={22} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800 group-hover:text-[#6b857a] transition-colors text-sm sm:text-base">
                    เลือกจากเทมเพลตแบบสอบถาม
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    เลือกโครงสร้างคำถามมาตรฐานหรือที่เคยบันทึกไว้
                    เพื่อความรวดเร็ว
                  </p>
                </div>
              </div>
              <Button
                className="bg-white text-[#6b857a] font-medium shadow-sm hover:bg-gray-50 shrink-0 border border-gray-200"
                size="sm"
                variant="flat"
                onPress={() => setShowTemplates(true)}
              >
                เลือกเทมเพลต
              </Button>
            </div>

            {/* Settings Card */}
            <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center justify-between w-full">
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      บันทึกเป็นเทมเพลตสำหรับใช้ในค่ายอื่น
                    </p>
                    <p className="text-xs text-gray-500">
                      แบบฟอร์มนี้จะถูกเพิ่มเข้าไปในรายการเทมเพลตของคุณ
                    </p>
                  </div>
                  <Switch
                    color="success"
                    isSelected={saveAsTemplate}
                    size="sm"
                    onValueChange={setSaveAsTemplate}
                  />
                </div>
              </div>

              {saveAsTemplate && (
                <div className="pt-2 border-t border-gray-100">
                  <input
                    className="w-full sm:w-1/2 text-sm bg-gray-50 border border-gray-200 focus:bg-white focus:border-[#6b857a] outline-none px-4 py-2.5 rounded-lg transition-all"
                    placeholder="ชื่อเทมเพลต (ค่าเริ่มต้นจะใช้ชื่อฟอร์ม)"
                    value={templateTitle}
                    onChange={(e) => setTemplateTitle(e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* Questions List */}
            <div className="space-y-4 pb-28">
              {questions.map((q, i) => (
                <div
                  key={i}
                  className={`relative flex flex-col rounded-2xl border border-gray-200 bg-white shadow-sm group gap-4 p-5 sm:p-6 transition-all ${
                    q.type === "header"
                      ? "border-l-4 border-l-purple-500 bg-purple-50/20"
                      : ""
                  }`}
                >
                  {/* Top Row: Title Input & Type Selector */}
                  <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                    {q.type !== "header" && (
                      <span className="shrink-0 rounded-full bg-[#e8f0ec] px-3 py-1.5 text-sm font-bold text-[#4f6d5f]">
                        ข้อ{" "}
                        {
                          questions
                            .slice(0, i + 1)
                            .filter((item) => item.type !== "header").length
                        }
                      </span>
                    )}
                    <input
                      className="flex-1 w-full text-base bg-gray-50 hover:bg-gray-100/80 focus:bg-gray-50 border-b border-gray-300 focus:border-[#6b857a] focus:border-b-2 outline-none px-4 py-3 rounded-t-md transition-all"
                      placeholder={
                        q.type === "scale"
                          ? "คำถามระดับความพึงพอใจ เช่น อาหารและเครื่องดื่มมีความสะอาด"
                          : q.type === "text"
                            ? "คำถามปลายเปิด เช่น ข้อเสนอแนะเพิ่มเติมสำหรับการจัดค่าย"
                            : q.type === "checkbox"
                              ? "คำถามเลือกได้หลายข้อ เช่น ทราบข่าวสารการจัดค่ายจากช่องทางใด"
                              : "ชื่อหัวข้อส่วน เช่น หมวดที่ 1 ด้านสถานที่และการบริการ"
                      }
                      value={q.text}
                      onChange={(e) =>
                        updateQuestion(i, "text", e.target.value)
                      }
                    />
                    <div className="relative w-full sm:w-56 shrink-0">
                      <Select
                        aria-label="ประเภทคำถาม"
                        className="w-full"
                        classNames={{
                          trigger:
                            "border border-gray-300 rounded-lg outline-none focus-within:border-[#6b857a] bg-white h-[46px] shadow-none hover:bg-white data-[hover=true]:bg-white",
                          value: "text-sm text-gray-700 font-medium",
                        }}
                        renderValue={(items) => {
                          return items.map((item) => (
                            <div
                              key={item.key}
                              className="flex items-center gap-2"
                            >
                              {item.key === "scale" && (
                                <CircleDot
                                  className="text-[#6b857a]"
                                  size={16}
                                />
                              )}
                              {item.key === "checkbox" && (
                                <ListChecks
                                  className="text-[#6b857a]"
                                  size={16}
                                />
                              )}
                              {item.key === "text" && (
                                <AlignLeft
                                  className="text-[#6b857a]"
                                  size={16}
                                />
                              )}
                              {item.key === "header" && (
                                <Heading
                                  className="text-purple-600"
                                  size={16}
                                />
                              )}
                              <span>{item.textValue}</span>
                            </div>
                          ));
                        }}
                        selectedKeys={[q.type]}
                        onChange={(e) => {
                          if (e.target.value) {
                            updateQuestion(
                              i,
                              "type",
                              e.target.value as
                                | "text"
                                | "scale"
                                | "header"
                                | "grid"
                                | "checkbox",
                            );
                          }
                        }}
                      >
                        <SelectItem
                          key="scale"
                          textValue="ระดับความพึงพอใจ (Scale)"
                        >
                          <div className="flex items-center gap-2">
                            <CircleDot className="text-gray-500" size={16} />
                            <span>ระดับความพึงพอใจ (Scale)</span>
                          </div>
                        </SelectItem>
                        <SelectItem key="text" textValue="ข้อความ (ปลายเปิด)">
                          <div className="flex items-center gap-2">
                            <AlignLeft className="text-gray-500" size={16} />
                            <span>ข้อความ (ปลายเปิด)</span>
                          </div>
                        </SelectItem>
                        <SelectItem key="checkbox" textValue="เลือกได้หลายข้อ">
                          <div className="flex items-center gap-2">
                            <ListChecks className="text-gray-500" size={16} />
                            <span>เลือกได้หลายข้อ (Checkbox)</span>
                          </div>
                        </SelectItem>
                        <SelectItem key="header" textValue="ส่วนแบ่งหัวข้อ">
                          <div className="flex items-center gap-2">
                            <Heading className="text-purple-600" size={16} />
                            <span>ส่วนแบ่งหัวข้อ (Section Header)</span>
                          </div>
                        </SelectItem>
                      </Select>
                    </div>
                  </div>

                  {/* Question Type Sub-Preview */}
                  <div className="pl-2 pt-1">
                    {q.type === "scale" && (
                      <div className="flex flex-wrap items-center gap-3 text-gray-500">
                        <span className="text-xs font-semibold text-[#4f6d5f]">
                          มากที่สุด ({globalScaleMax})
                        </span>
                        <div className="flex gap-3">
                          {Array.from({ length: globalScaleMax }).map(
                            (_, idx) => (
                              <div
                                key={idx}
                                className="flex flex-col items-center gap-1.5"
                              >
                                <div className="w-5 h-5 rounded-full border-2 border-gray-300 bg-gray-50" />
                                <span className="text-xs font-medium text-gray-400">
                                  {globalScaleMax - idx}
                                </span>
                              </div>
                            ),
                          )}
                        </div>
                        <span className="text-xs font-semibold text-gray-500">
                          น้อยที่สุด (1)
                        </span>
                      </div>
                    )}
                    {q.type === "text" && (
                      <div className="border-b border-dotted border-gray-300 w-full sm:w-2/3 pb-1 text-sm text-gray-400">
                        ข้อความคำตอบแบบยาว...
                      </div>
                    )}
                    {q.type === "header" && (
                      <div className="border-b-2 border-purple-200 w-full pb-2 text-sm text-purple-600 font-medium italic">
                        (ส่วนนี้จะแสดงเป็นตัวหนาขนาดใหญ่
                        เพื่อคั่นเนื้อหาแบบสอบถาม)
                      </div>
                    )}
                    {q.type === "checkbox" && (
                      <div className="w-full space-y-2 mt-1 rounded-xl border border-gray-200 bg-gray-50 p-4">
                        <p className="mb-2 text-xs font-semibold text-gray-600">
                          ตัวเลือก (นักเรียนสามารถเลือกได้มากกว่าหนึ่งข้อ)
                        </p>
                        {q.options?.map((option, optionIndex) => (
                          <div
                            key={optionIndex}
                            className="flex items-center gap-3"
                          >
                            <input
                              readOnly
                              checked={false}
                              className="h-4 w-4 rounded accent-[#6b857a]"
                              tabIndex={-1}
                              type="checkbox"
                            />
                            <input
                              className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none transition-all focus:border-[#6b857a]"
                              placeholder="เช่น ทราบจากคุณครูประจำชั้น"
                              value={option}
                              onChange={(e) =>
                                updateGridRow(i, optionIndex, e.target.value)
                              }
                            />
                            <button
                              className="text-gray-400 transition-colors hover:text-red-500 disabled:opacity-30"
                              disabled={(q.options?.length || 0) <= 1}
                              type="button"
                              onClick={() => removeGridRow(i, optionIndex)}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))}
                        <button
                          className="mt-2 flex items-center gap-1 text-xs font-semibold text-[#6b857a] transition-colors hover:text-[#5a7268]"
                          type="button"
                          onClick={() => addGridRow(i)}
                        >
                          <Plus size={14} /> เพิ่มตัวเลือก
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Footer Actions */}
                  <div className="flex items-center justify-end gap-1 pt-3 border-t border-gray-100 mt-1 text-gray-500">
                    <button
                      className="p-2 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-30"
                      disabled={i === 0}
                      title="เลื่อนขึ้น"
                      onClick={() => moveQuestion(i, -1)}
                    >
                      <ChevronUp size={18} />
                    </button>
                    <button
                      className="p-2 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-30"
                      disabled={i === questions.length - 1}
                      title="เลื่อนลง"
                      onClick={() => moveQuestion(i, 1)}
                    >
                      <ChevronDown size={18} />
                    </button>
                    <div className="w-px h-5 bg-gray-200 mx-2" />
                    <button
                      className="p-2 hover:bg-red-50 hover:text-red-500 rounded-full transition-colors disabled:opacity-30"
                      disabled={questions.length === 1}
                      title="ลบคำถาม"
                      onClick={() => removeQuestion(i)}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}

              {/* ── Fixed Floating Add Question Bar ── */}
              <div className="fixed bottom-6 inset-x-0 z-40 flex justify-center pointer-events-none px-4">
                <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-gray-200/90 bg-white/95 px-3.5 py-2 shadow-[0_8px_30px_rgba(0,0,0,0.16)] backdrop-blur-md transition-all hover:scale-[1.02] hover:shadow-[0_12px_36px_rgba(0,0,0,0.22)]">
                  <button
                    className="flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold text-gray-700 transition-all hover:bg-gray-100/90 active:scale-95 sm:px-4 sm:py-2 sm:text-sm"
                    type="button"
                    onClick={() => addQuestion("scale")}
                  >
                    <Plus className="text-[#6b857a]" size={16} />
                    ระดับคะแนน
                  </button>
                  <div className="h-5 w-px bg-gray-200" />
                  <button
                    className="flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold text-gray-700 transition-all hover:bg-gray-100/90 active:scale-95 sm:px-4 sm:py-2 sm:text-sm"
                    type="button"
                    onClick={() => addQuestion("checkbox")}
                  >
                    <Plus className="text-[#6b857a]" size={16} />
                    เลือกได้หลายข้อ
                  </button>
                  <div className="h-5 w-px bg-gray-200" />
                  <button
                    className="flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold text-gray-700 transition-all hover:bg-gray-100/90 active:scale-95 sm:px-4 sm:py-2 sm:text-sm"
                    type="button"
                    onClick={() => addQuestion("text")}
                  >
                    <Plus className="text-[#6b857a]" size={16} />
                    ข้อความ
                  </button>
                  <div className="h-5 w-px bg-gray-200" />
                  <button
                    className="flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold text-gray-700 transition-all hover:bg-gray-100/90 active:scale-95 sm:px-4 sm:py-2 sm:text-sm"
                    type="button"
                    onClick={() => addQuestion("header")}
                  >
                    <Plus className="text-purple-600" size={16} />
                    หัวข้อส่วน
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ══════════════════════════════════════════════════════════ */
          /*  TAB 2: RESPONSES / RESULTS & ANALYTICS                    */
          /* ══════════════════════════════════════════════════════════ */
          <div className="space-y-6">
            {/* Responses Sub-Navigation & Header Controls Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
              {/* 3 Sub-tabs: Summary | Question | Individual */}
              <div className="flex items-center gap-1 bg-gray-100/80 p-1 rounded-xl self-start md:self-auto overflow-x-auto max-w-full">
                <button
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all shrink-0 ${
                    responseSubTab === "summary"
                      ? "bg-white text-gray-900 shadow-xs"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                  type="button"
                  onClick={() => setResponseSubTab("summary")}
                >
                  <BarChart3 size={16} />
                  ข้อมูลสรุป
                </button>
                <button
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all shrink-0 ${
                    responseSubTab === "question"
                      ? "bg-white text-gray-900 shadow-xs"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                  type="button"
                  onClick={() => setResponseSubTab("question")}
                >
                  <HelpCircle size={16} />
                  คำถาม
                </button>
                <button
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all shrink-0 ${
                    responseSubTab === "individual"
                      ? "bg-white text-gray-900 shadow-xs"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                  type="button"
                  onClick={() => setResponseSubTab("individual")}
                >
                  <ClipboardCheck size={16} />
                  รายคำตอบ
                </button>
              </div>

              {/* Right Controls: Export Excel + Accepting Responses Switch */}
              <div className="flex items-center gap-3 self-end md:self-auto">
                {/* Export Excel Button */}
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-xs"
                  isDisabled={!resultsData || resultsData.totalResponses === 0}
                  size="sm"
                  startContent={<FileSpreadsheet size={16} />}
                  onPress={handleExportExcel}
                >
                  ส่งออก Excel
                </Button>

                {/* Accepting Responses Switch */}
                <div className="flex items-center gap-2 pl-3 border-l border-gray-200">
                  <span
                    className={`text-xs font-semibold ${
                      resultsData?.isAcceptingResponses !== false
                        ? "text-emerald-700"
                        : "text-gray-500"
                    }`}
                  >
                    {resultsData?.isAcceptingResponses !== false
                      ? "เปิดรับคำตอบ"
                      : "ปิดรับคำตอบ"}
                  </span>
                  <Switch
                    color="success"
                    isDisabled={isTogglingAccepting || !survey}
                    isSelected={resultsData?.isAcceptingResponses !== false}
                    size="sm"
                    onValueChange={handleToggleAcceptingResponses}
                  />
                </div>
              </div>
            </div>

            {/* Status Banner when Accepting Responses is OFF */}
            {resultsData?.isAcceptingResponses === false && (
              <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-2xl flex items-center gap-2.5 text-xs sm:text-sm shadow-xs">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                <span>
                  <strong>ปิดรับคำตอบอยู่</strong> —
                  ผู้เข้าร่วมจะไม่สามารถส่งคำตอบแบบสอบถามใหม่ได้ในขณะนี้
                </span>
              </div>
            )}

            {/* AI Summary Card (shown in summary tab) */}
            {responseSubTab === "summary" && aiSummary && (
              <div className="bg-indigo-50 border-2 border-indigo-200 rounded-2xl p-5 sm:p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4 border-b border-indigo-100 pb-3">
                  <Sparkles className="text-indigo-600" size={20} />
                  <h3 className="font-bold text-indigo-900 text-base sm:text-lg">
                    AI สรุปผลการประเมิน
                  </h3>
                </div>
                <div className="space-y-4">
                  {aiSummary.overview && (
                    <div className="bg-white p-4 rounded-xl border border-indigo-100 shadow-xs">
                      <h4 className="font-bold text-indigo-800 text-sm mb-2">
                        ภาพรวม
                      </h4>
                      <p className="text-gray-800 text-sm leading-relaxed">
                        {aiSummary.overview}
                      </p>
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                      <h4 className="font-bold text-emerald-800 text-sm mb-3 flex items-center gap-1.5">
                        <CheckCircle2 size={16} /> สิ่งที่ดี
                      </h4>
                      <ul className="space-y-2">
                        {aiSummary.strengths?.map(
                          (item: string, idx: number) => (
                            <li
                              key={idx}
                              className="text-sm text-gray-800 flex gap-2"
                            >
                              <span className="text-emerald-500 font-bold">
                                •
                              </span>
                              <span className="leading-relaxed">{item}</span>
                            </li>
                          ),
                        ) || (
                          <li className="text-sm text-gray-400 italic">
                            ไม่มีข้อมูล
                          </li>
                        )}
                      </ul>
                    </div>
                    <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                      <h4 className="font-bold text-amber-800 text-sm mb-3 flex items-center gap-1.5">
                        <Lightbulb size={16} /> สิ่งที่ควรปรับปรุง
                      </h4>
                      <ul className="space-y-2">
                        {aiSummary.improvements?.map(
                          (item: string, idx: number) => (
                            <li
                              key={idx}
                              className="text-sm text-gray-800 flex gap-2"
                            >
                              <span className="text-amber-500 font-bold">
                                •
                              </span>
                              <span className="leading-relaxed">{item}</span>
                            </li>
                          ),
                        ) || (
                          <li className="text-sm text-gray-400 italic">
                            ไม่มีข้อมูล
                          </li>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Loading / Error / Empty States */}
            {resultsLoading ? (
              <ResponsesTabSkeleton />
            ) : resultsError ? (
              <div className="bg-red-50 text-red-600 p-6 rounded-2xl text-center border border-red-200">
                <p>{resultsError}</p>
              </div>
            ) : !resultsData || resultsData.totalResponses === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-400 mb-4">
                  <BarChart3 size={28} />
                </div>
                <h3 className="text-base font-bold text-gray-900 mb-1">
                  ยังไม่มีผู้ตอบแบบสอบถาม
                </h3>
                <p className="text-sm text-gray-500 max-w-sm mx-auto mb-6">
                  เมื่อนักเรียนหรือผู้เข้าร่วมทำแบบสอบถามผ่านระบบ ข้อมูลสถิติ
                  กราฟ และผลคะแนนจะแสดงที่นี่โดยอัตโนมัติ
                </p>
                <Button
                  className="bg-[#6b857a] text-white font-medium shadow-sm hover:bg-[#5a7268]"
                  size="sm"
                  startContent={<FileText size={16} />}
                  onPress={() => handleTabChange("questions")}
                >
                  แก้ไขแบบสอบถาม
                </Button>
              </div>
            ) : responseSubTab === "summary" ? (
              /* ── 1. SUMMARY SUB-TAB ── */
              <div className="space-y-6">
                {/* Camp-wide Average Score Card */}
                {campAverage && (
                  <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
                    <div className="flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0">
                        <Star
                          className="text-amber-500 fill-amber-400"
                          size={24}
                        />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-amber-800 uppercase tracking-wide">
                          ภาพรวมคะแนนในค่ายนี้
                        </p>
                        <p className="text-xs text-amber-700/80 mt-0.5">
                          เฉลี่ยจาก {scaleQuestions.length} หัวข้อ · ผู้ตอบ{" "}
                          {resultsData.totalResponses} คน
                        </p>
                      </div>
                    </div>
                    <div className="flex items-baseline gap-1.5 sm:pr-2">
                      <span className="text-3xl sm:text-4xl font-extrabold text-amber-600">
                        {campAverage}
                      </span>
                      <span className="text-amber-500 font-bold text-base">
                        / {globalScaleMax || 5}
                      </span>
                    </div>
                  </div>
                )}

                {/* Demographics Charts */}
                {resultsData.demographics && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Gender Donut Chart */}
                    <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                          <Users size={16} />
                        </div>
                        <h3 className="font-semibold text-gray-900 text-sm">
                          สัดส่วนผู้ตอบตามเพศ
                        </h3>
                      </div>
                      <div className="h-[180px] w-full">
                        {(() => {
                          const { male, female, other } =
                            resultsData.demographics!.gender;
                          const genderData = [
                            { name: "ชาย", value: male, color: "#60a5fa" },
                            { name: "หญิง", value: female, color: "#f472b6" },
                          ];

                          if (other > 0) {
                            genderData.push({
                              name: "อื่นๆ",
                              value: other,
                              color: "#9ca3af",
                            });
                          }

                          return (
                            <ResponsiveContainer height="100%" width="100%">
                              <PieChart>
                                <Pie
                                  cx="50%"
                                  cy="50%"
                                  data={genderData}
                                  dataKey="value"
                                  innerRadius={40}
                                  outerRadius={70}
                                  paddingAngle={2}
                                >
                                  {genderData.map((entry, index) => (
                                    <Cell
                                      key={`cell-${index}`}
                                      fill={entry.color}
                                    />
                                  ))}
                                </Pie>
                                <RechartsTooltip
                                  contentStyle={{
                                    borderRadius: "8px",
                                    border: "none",
                                    boxShadow:
                                      "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                                  }}
                                  formatter={(value: any) => [
                                    `${value} คน`,
                                    "จำนวน",
                                  ]}
                                />
                              </PieChart>
                            </ResponsiveContainer>
                          );
                        })()}
                      </div>
                      <div className="flex justify-center gap-4 mt-2">
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded-full bg-blue-400" />
                          <span className="text-xs text-gray-600">ชาย</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded-full bg-pink-400" />
                          <span className="text-xs text-gray-600">หญิง</span>
                        </div>
                        {resultsData.demographics!.gender.other > 0 && (
                          <div className="flex items-center gap-1.5">
                            <div className="w-3 h-3 rounded-full bg-gray-400" />
                            <span className="text-xs text-gray-600">อื่นๆ</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Grade Level Bar Chart */}
                    <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                          <Book size={16} />
                        </div>
                        <h3 className="font-semibold text-gray-900 text-sm">
                          สัดส่วนผู้ตอบตามระดับชั้น
                        </h3>
                      </div>
                      <div className="h-[180px] w-full">
                        {(() => {
                          const gradeData = Object.entries(
                            resultsData.demographics!.grade,
                          )
                            .sort()
                            .map(([grade, count]) => ({
                              name: grade,
                              count,
                            }));

                          return (
                            <ResponsiveContainer height="100%" width="100%">
                              <BarChart
                                data={gradeData}
                                margin={{
                                  top: 10,
                                  right: 10,
                                  left: -25,
                                  bottom: 0,
                                }}
                              >
                                <CartesianGrid
                                  stroke="#f3f4f6"
                                  strokeDasharray="3 3"
                                  vertical={false}
                                />
                                <XAxis
                                  axisLine={false}
                                  dataKey="name"
                                  tick={{ fontSize: 12, fill: "#6b7280" }}
                                  tickLine={false}
                                />
                                <YAxis
                                  allowDecimals={false}
                                  axisLine={false}
                                  tick={{ fontSize: 12, fill: "#6b7280" }}
                                  tickLine={false}
                                />
                                <RechartsTooltip
                                  contentStyle={{
                                    borderRadius: "8px",
                                    border: "none",
                                    boxShadow:
                                      "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                                  }}
                                  cursor={{ fill: "#f3f4f6" }}
                                  formatter={(value: any) => [
                                    `${value} คน`,
                                    "จำนวน",
                                  ]}
                                />
                                <Bar
                                  dataKey="count"
                                  fill="#818cf8"
                                  maxBarSize={40}
                                  radius={[4, 4, 0, 0]}
                                />
                              </BarChart>
                            </ResponsiveContainer>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                )}

                {/* Per-Question Breakdown */}
                {(() => {
                  let qNum = 0;

                  return resultsData.questions.map((q) => {
                    if (q.type === "header") {
                      return (
                        <div
                          key={q.id}
                          className="bg-indigo-50/80 border border-indigo-100 shadow-xs rounded-2xl px-5 py-3 my-3"
                        >
                          <h3 className="font-bold text-indigo-900 text-sm flex items-center gap-2">
                            <span className="w-1.5 h-4 bg-indigo-500 rounded-full inline-block" />
                            {q.text}
                          </h3>
                        </div>
                      );
                    }

                    qNum++;

                    return (
                      <div
                        key={q.id}
                        className="bg-white border border-gray-200 shadow-sm rounded-2xl p-5 sm:p-6 my-4 flex flex-col"
                      >
                        <div className="flex items-start justify-between w-full mb-4">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <span className="shrink-0 w-7 h-7 rounded-full bg-[#6b857a]/10 text-[#6b857a] flex items-center justify-center text-xs font-bold mt-0.5">
                              {qNum}
                            </span>
                            <h3 className="flex-1 min-w-0 font-semibold text-gray-900 text-sm sm:text-base leading-snug whitespace-normal break-words pt-0.5">
                              {q.text}
                            </h3>
                          </div>
                          {q.type === "scale" && q.average != null && (
                            <div className="shrink-0 flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-full px-3 py-1 ml-4">
                              <Star
                                className="text-amber-500 fill-amber-400"
                                size={13}
                              />
                              <span className="text-amber-800 font-bold text-xs">
                                {q.average}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Scale Question Distribution Chart */}
                        {q.type === "scale" && q.distribution && (
                          <div className="h-[180px] w-full mt-2 pr-4">
                            {(() => {
                              const maxScale = q.scaleMax || 5;
                              const chartData = Array.from({
                                length: maxScale,
                              }).map((_, idx) => {
                                const star = (idx + 1).toString();

                                return {
                                  star,
                                  count: q.distribution![star] || 0,
                                };
                              });

                              return (
                                <ResponsiveContainer height="100%" width="100%">
                                  <BarChart
                                    data={chartData}
                                    margin={{
                                      top: 10,
                                      right: 10,
                                      left: -25,
                                      bottom: 0,
                                    }}
                                  >
                                    <CartesianGrid
                                      stroke="#f3f4f6"
                                      strokeDasharray="3 3"
                                      vertical={false}
                                    />
                                    <XAxis
                                      axisLine={false}
                                      dataKey="star"
                                      tick={{ fontSize: 12, fill: "#6b7280" }}
                                      tickFormatter={(val) => `${val} คะแนน`}
                                      tickLine={false}
                                    />
                                    <YAxis
                                      allowDecimals={false}
                                      axisLine={false}
                                      tick={{ fontSize: 12, fill: "#6b7280" }}
                                      tickLine={false}
                                    />
                                    <RechartsTooltip
                                      contentStyle={{
                                        borderRadius: "8px",
                                        border: "none",
                                        boxShadow:
                                          "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                                      }}
                                      cursor={{ fill: "#f3f4f6" }}
                                      formatter={(value: any) => [
                                        `${value} คน`,
                                        "จำนวน",
                                      ]}
                                    />
                                    <Bar
                                      dataKey="count"
                                      fill="#6b857a"
                                      maxBarSize={36}
                                      radius={[4, 4, 0, 0]}
                                    />
                                  </BarChart>
                                </ResponsiveContainer>
                              );
                            })()}
                          </div>
                        )}

                        {/* Checkbox Question Distribution */}
                        {q.type === "checkbox" && q.options && (
                          <div className="space-y-2 mt-2">
                            {q.options.map((opt, optIdx) => {
                              const percentage =
                                resultsData.totalResponses > 0
                                  ? Math.round(
                                      (opt.count / resultsData.totalResponses) *
                                        100,
                                    )
                                  : 0;

                              return (
                                <div key={optIdx} className="space-y-1">
                                  <div className="flex justify-between text-xs font-medium text-gray-700">
                                    <span>{opt.label}</span>
                                    <span className="text-gray-500">
                                      {opt.count} คน ({percentage}%)
                                    </span>
                                  </div>
                                  <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                                    <div
                                      className="bg-[#6b857a] h-full rounded-full transition-all duration-500"
                                      style={{ width: `${percentage}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Text Answers List */}
                        {q.type === "text" && q.answers && (
                          <div className="space-y-2.5 mt-2 max-h-[300px] overflow-y-auto pr-1">
                            {q.answers.length === 0 ? (
                              <p className="text-xs text-gray-400 italic py-2">
                                ยังไม่มีข้อความตอบกลับ
                              </p>
                            ) : (
                              q.answers.map((ans, ansIdx) => (
                                <div
                                  key={ansIdx}
                                  className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-sm text-gray-800 flex items-start gap-2.5"
                                >
                                  <MessageSquare
                                    className="text-gray-400 shrink-0 mt-0.5"
                                    size={15}
                                  />
                                  <span className="leading-relaxed">{ans}</span>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            ) : responseSubTab === "question" ? (
              /* ── 2. QUESTION SUB-TAB ── */
              <div className="space-y-6">
                {(() => {
                  const realQuestions = resultsData.questions.filter(
                    (q) => q.type !== "header",
                  );

                  if (realQuestions.length === 0) {
                    return (
                      <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center text-gray-500">
                        ไม่มีคำถามสำหรับแสดงผล
                      </div>
                    );
                  }

                  const curIdx = Math.min(
                    Math.max(0, selectedQuestionIndex),
                    realQuestions.length - 1,
                  );
                  const curQ = realQuestions[curIdx];

                  return (
                    <div className="space-y-4">
                      {/* Question Navigation Card */}
                      <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <button
                            className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-gray-700"
                            disabled={curIdx === 0}
                            title="คำถามก่อนหน้า"
                            type="button"
                            onClick={() => setSelectedQuestionIndex(curIdx - 1)}
                          >
                            <ChevronLeft size={18} />
                          </button>
                          <span className="text-sm font-bold text-gray-800">
                            คำถามที่ {curIdx + 1} จาก {realQuestions.length}
                          </span>
                          <button
                            className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-gray-700"
                            disabled={curIdx === realQuestions.length - 1}
                            title="คำถามถัดไป"
                            type="button"
                            onClick={() => setSelectedQuestionIndex(curIdx + 1)}
                          >
                            <ChevronRight size={18} />
                          </button>
                        </div>

                        {/* Dropdown Selector */}
                        <div className="w-full sm:w-80">
                          <select
                            className="w-full text-xs sm:text-sm bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-[#6b857a] text-gray-800"
                            value={curIdx}
                            onChange={(e) =>
                              setSelectedQuestionIndex(Number(e.target.value))
                            }
                          >
                            {realQuestions.map((q, idx) => (
                              <option key={q.id} value={idx}>
                                ข้อ {idx + 1}:{" "}
                                {q.text.length > 40
                                  ? `${q.text.slice(0, 40)}...`
                                  : q.text}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Question Detail Card */}
                      <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 shadow-sm space-y-5">
                        <div className="flex items-start justify-between gap-4 border-b border-gray-100 pb-4">
                          <div className="space-y-1">
                            <span className="inline-block rounded-full bg-[#e8f0ec] px-2.5 py-0.5 text-xs font-bold text-[#4f6d5f]">
                              ข้อ {curIdx + 1}
                            </span>
                            <h3 className="text-base sm:text-lg font-bold text-gray-900 leading-snug">
                              {curQ.text}
                            </h3>
                          </div>
                          <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full font-medium shrink-0">
                            {curQ.type === "scale"
                              ? "ระดับความพึงพอใจ"
                              : curQ.type === "checkbox"
                                ? "เลือกได้หลายข้อ"
                                : "ข้อความปลายเปิด"}
                          </span>
                        </div>

                        {/* Scale specific details */}
                        {curQ.type === "scale" && (
                          <div className="space-y-4">
                            {curQ.average != null && (
                              <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
                                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                                  <Star className="fill-amber-400" size={20} />
                                </div>
                                <div>
                                  <p className="text-xs font-bold text-amber-800 uppercase">
                                    คะแนนเฉลี่ยข้อนี้
                                  </p>
                                  <p className="text-xl font-extrabold text-amber-600">
                                    {curQ.average}{" "}
                                    <span className="text-sm font-normal text-amber-700">
                                      / {curQ.scaleMax || 5}
                                    </span>
                                  </p>
                                </div>
                              </div>
                            )}

                            {curQ.distribution && (
                              <div className="h-[220px] w-full pt-2">
                                {(() => {
                                  const maxScale = curQ.scaleMax || 5;
                                  const chartData = Array.from({
                                    length: maxScale,
                                  }).map((_, idx) => {
                                    const star = (idx + 1).toString();

                                    return {
                                      star,
                                      count: curQ.distribution![star] || 0,
                                    };
                                  });

                                  return (
                                    <ResponsiveContainer
                                      height="100%"
                                      width="100%"
                                    >
                                      <BarChart
                                        data={chartData}
                                        margin={{
                                          top: 10,
                                          right: 10,
                                          left: -20,
                                          bottom: 0,
                                        }}
                                      >
                                        <CartesianGrid
                                          stroke="#f3f4f6"
                                          strokeDasharray="3 3"
                                          vertical={false}
                                        />
                                        <XAxis
                                          axisLine={false}
                                          dataKey="star"
                                          tick={{
                                            fontSize: 12,
                                            fill: "#6b7280",
                                          }}
                                          tickFormatter={(v) => `${v} คะแนน`}
                                          tickLine={false}
                                        />
                                        <YAxis
                                          allowDecimals={false}
                                          axisLine={false}
                                          tick={{
                                            fontSize: 12,
                                            fill: "#6b7280",
                                          }}
                                          tickLine={false}
                                        />
                                        <RechartsTooltip
                                          formatter={(val: any) => [
                                            `${val} คน`,
                                            "จำนวนผู้ตอบ",
                                          ]}
                                        />
                                        <Bar
                                          dataKey="count"
                                          fill="#6b857a"
                                          maxBarSize={40}
                                          radius={[6, 6, 0, 0]}
                                        />
                                      </BarChart>
                                    </ResponsiveContainer>
                                  );
                                })()}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Checkbox specific details */}
                        {curQ.type === "checkbox" && curQ.options && (
                          <div className="space-y-3 pt-2">
                            {curQ.options.map((opt, optIdx) => {
                              const percentage =
                                resultsData.totalResponses > 0
                                  ? Math.round(
                                      (opt.count / resultsData.totalResponses) *
                                        100,
                                    )
                                  : 0;

                              return (
                                <div
                                  key={optIdx}
                                  className="space-y-1.5 p-3 rounded-xl bg-gray-50 border border-gray-100"
                                >
                                  <div className="flex justify-between text-xs sm:text-sm font-medium text-gray-800">
                                    <span>{opt.label}</span>
                                    <span className="font-bold text-[#4f6d5f]">
                                      {opt.count} คน ({percentage}%)
                                    </span>
                                  </div>
                                  <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                                    <div
                                      className="bg-[#6b857a] h-full rounded-full transition-all duration-500"
                                      style={{ width: `${percentage}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Text specific details */}
                        {curQ.type === "text" && (
                          <div className="space-y-3 pt-2">
                            <p className="text-xs font-semibold text-gray-500">
                              คำตอบทั้งหมด ({curQ.answers?.length || 0} รายการ)
                            </p>
                            {!curQ.answers || curQ.answers.length === 0 ? (
                              <p className="text-xs text-gray-400 italic py-4 text-center">
                                ยังไม่มีข้อความตอบกลับ
                              </p>
                            ) : (
                              <div className="space-y-2.5 max-h-[400px] overflow-y-auto pr-1">
                                {curQ.answers.map((ans, ansIdx) => (
                                  <div
                                    key={ansIdx}
                                    className="bg-gray-50 border border-gray-100 rounded-xl p-3.5 text-sm text-gray-800 flex items-start gap-3"
                                  >
                                    <MessageSquare
                                      className="text-[#6b857a] shrink-0 mt-0.5"
                                      size={16}
                                    />
                                    <span className="leading-relaxed">
                                      {ans}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              /* ── 3. INDIVIDUAL SUB-TAB (ANONYMOUS) ── */
              <div className="space-y-6">
                {(() => {
                  const indResponses = resultsData.individualResponses || [];

                  if (indResponses.length === 0) {
                    return (
                      <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center text-gray-500">
                        ยังไม่มีผู้ตอบแบบสอบถาม
                      </div>
                    );
                  }

                  const curIdx = Math.min(
                    Math.max(0, selectedIndividualIndex),
                    indResponses.length - 1,
                  );
                  const curResp = indResponses[curIdx];

                  return (
                    <div className="space-y-4">
                      {/* Individual Navigation Card (Anonymous UI) */}
                      <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <button
                            className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-gray-700"
                            disabled={curIdx === 0}
                            title="ผู้ตอบก่อนหน้า"
                            type="button"
                            onClick={() =>
                              setSelectedIndividualIndex(curIdx - 1)
                            }
                          >
                            <ChevronLeft size={18} />
                          </button>
                          <div>
                            <span className="text-sm font-bold text-gray-900 block">
                              ผู้ตอบคนที่ {curIdx + 1} จาก {indResponses.length}
                            </span>
                            <span className="text-xs text-gray-500">
                              ส่งเมื่อ{" "}
                              {new Date(curResp.submittedAt).toLocaleString(
                                "th-TH",
                                {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              )}
                            </span>
                          </div>
                          <button
                            className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-gray-700"
                            disabled={curIdx === indResponses.length - 1}
                            title="ผู้ตอบถัดไป"
                            type="button"
                            onClick={() =>
                              setSelectedIndividualIndex(curIdx + 1)
                            }
                          >
                            <ChevronRight size={18} />
                          </button>
                        </div>
                      </div>

                      {/* Filled Survey Form View (Google Forms Style) */}
                      <div className="space-y-4">
                        {/* Survey Header Card */}
                        <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 pt-8 shadow-sm">
                          <div className="absolute top-0 left-0 right-0 h-3 bg-[#6b857a]" />
                          <h2 className="text-xl font-bold text-gray-900">
                            {resultsData.title || "แบบสอบถามความพึงพอใจ"}
                          </h2>
                          <p className="text-xs text-gray-500 mt-1">
                            บันทึกคำตอบของ ผู้ตอบคนที่ {curIdx + 1}
                          </p>
                        </div>

                        {/* Questions with this individual's answers */}
                        {(() => {
                          let qCount = 0;

                          return resultsData.questions.map((q) => {
                            if (q.type === "header") {
                              return (
                                <div
                                  key={q.id}
                                  className="bg-indigo-50/80 border border-indigo-100 shadow-xs rounded-2xl px-5 py-3 my-3"
                                >
                                  <h3 className="font-bold text-indigo-900 text-sm flex items-center gap-2">
                                    <span className="w-1.5 h-4 bg-indigo-500 rounded-full inline-block" />
                                    {q.text}
                                  </h3>
                                </div>
                              );
                            }

                            qCount++;
                            const ans = curResp.answers[q.id];

                            return (
                              <div
                                key={q.id}
                                className="bg-white border border-gray-200 shadow-sm rounded-2xl p-5 sm:p-6 space-y-4"
                              >
                                <div className="flex items-start gap-3">
                                  <span className="shrink-0 w-7 h-7 rounded-full bg-[#6b857a]/10 text-[#6b857a] flex items-center justify-center text-xs font-bold mt-0.5">
                                    {qCount}
                                  </span>
                                  <h3 className="font-semibold text-gray-900 text-sm sm:text-base leading-snug">
                                    {q.text}
                                  </h3>
                                </div>

                                {/* Scale Answer */}
                                {q.type === "scale" && (
                                  <div className="pt-2 pl-2">
                                    <div className="flex items-center gap-2.5 flex-wrap">
                                      {Array.from({
                                        length: q.scaleMax || 5,
                                      }).map((_, sIdx) => {
                                        const maxScale = q.scaleMax || 5;
                                        const scoreVal = maxScale - sIdx;
                                        const isSelected =
                                          ans?.scale_value === scoreVal;

                                        return (
                                          <div
                                            key={scoreVal}
                                            className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                                              isSelected
                                                ? "bg-[#6b857a] text-white shadow-md ring-4 ring-[#6b857a]/20 scale-105"
                                                : "bg-gray-100 text-gray-400 border border-gray-200"
                                            }`}
                                          >
                                            {scoreVal}
                                          </div>
                                        );
                                      })}
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2.5">
                                      คะแนนที่เลือก:{" "}
                                      <strong className="text-[#6b857a] text-sm">
                                        {ans?.scale_value != null
                                          ? `${ans.scale_value} คะแนน`
                                          : "ไม่ได้ระบุ"}
                                      </strong>
                                    </p>
                                  </div>
                                )}

                                {/* Checkbox Answer */}
                                {q.type === "checkbox" && (
                                  <div className="space-y-2.5 pt-2 pl-2">
                                    {(() => {
                                      let selectedList: string[] = [];

                                      try {
                                        if (ans?.text_answer) {
                                          selectedList = JSON.parse(
                                            ans.text_answer,
                                          );
                                        }
                                      } catch {
                                        if (ans?.text_answer)
                                          selectedList = [ans.text_answer];
                                      }

                                      const allOptions =
                                        q.allOptions ||
                                        q.options?.map((o) => o.label) ||
                                        [];

                                      return allOptions.map(
                                        (optLabel, oIdx) => {
                                          const isChecked =
                                            selectedList.includes(optLabel);

                                          return (
                                            <div
                                              key={oIdx}
                                              className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                                                isChecked
                                                  ? "bg-[#6b857a]/5 border-[#6b857a]/30 text-gray-900 font-semibold"
                                                  : "bg-gray-50/50 border-gray-200 text-gray-400"
                                              }`}
                                            >
                                              {isChecked ? (
                                                <CheckSquare
                                                  className="text-[#6b857a] shrink-0"
                                                  size={18}
                                                />
                                              ) : (
                                                <Square
                                                  className="text-gray-300 shrink-0"
                                                  size={18}
                                                />
                                              )}
                                              <span className="text-sm">
                                                {optLabel}
                                              </span>
                                            </div>
                                          );
                                        },
                                      );
                                    })()}
                                  </div>
                                )}

                                {/* Text Answer */}
                                {q.type === "text" && (
                                  <div className="pt-2 pl-2">
                                    <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-800 min-h-[50px]">
                                      {ans?.text_answer ? (
                                        <p className="leading-relaxed">
                                          {ans.text_answer}
                                        </p>
                                      ) : (
                                        <p className="text-gray-400 italic">
                                          ไม่มีคำตอบ
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Template Selection Modal */}
      <Modal isOpen={showTemplates} onOpenChange={setShowTemplates}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1 text-lg font-bold">
                เลือกเทมเพลตแบบสอบถาม
              </ModalHeader>
              <ModalBody className="pb-6">
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xs">
                  {loadingTemplates ? (
                    <p className="text-sm text-gray-400 p-6 text-center">
                      กำลังโหลดเทมเพลต...
                    </p>
                  ) : templates.length === 0 ? (
                    <p className="text-sm text-gray-400 p-6 text-center">
                      ยังไม่มีเทมเพลตที่บันทึกไว้
                    </p>
                  ) : (
                    templates.map((tpl) => (
                      <div
                        key={tpl.template_id}
                        className="flex items-center justify-between border-b border-gray-100 transition-colors last:border-0 hover:bg-gray-50 group"
                      >
                        <button
                          className="flex-1 px-5 py-3.5 text-left"
                          type="button"
                          onClick={() => {
                            applyTemplate(tpl);
                            onClose();
                          }}
                        >
                          <p className="text-sm font-semibold text-gray-900">
                            {tpl.title}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {tpl.survey_template_question.length} รายการคำถาม
                          </p>
                        </button>
                        <button
                          className="p-2 text-red-400 opacity-0 group-hover:opacity-100 hover:text-red-600 hover:bg-red-50 rounded-full transition-all"
                          title="ลบเทมเพลต"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteTemplate(tpl.template_id);
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </ModalBody>
            </>
          )}
        </ModalContent>
      </Modal>
    </main>
  );
}
