"use client";

import { useEffect, useState } from "react";

import DocumentTemplatePanel from "@/components/documents/DocumentTemplatePanel";
import { useStatusModal } from "@/components/StatusModalProvider";

type SurveyQuestion = {
  text: string;
  type: "text" | "scale" | "header" | "grid" | "checkbox";
  scaleMax: number;
  options?: string[];
};

export type SurveyTemplate = {
  template_id: number;
  title: string;
  description?: string;
  survey_template_question: {
    question_id: number;
    question_text: string;
    question_type: SurveyQuestion["type"];
    scale_max?: number;
    options?: string;
  }[];
};

type Props = {
  description: string;
  enabled?: boolean;
  globalScaleMax: number;
  questions: SurveyQuestion[];
  onApply: (template: SurveyTemplate) => void;
};

export default function SurveyTemplatePanel({
  description,
  enabled = true,
  globalScaleMax,
  questions,
  onApply,
}: Props) {
  const { showConfirm, showError, showSuccess } = useStatusModal();
  const [templates, setTemplates] = useState<SurveyTemplate[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [newName, setNewName] = useState("");
  const [editorKey, setEditorKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const loadTemplates = async () => {
      setLoading(true);
      try {
        const response = await fetch("/api/surveys/templates");

        if (!response.ok) throw new Error();
        const data = await response.json();

        if (!cancelled) setTemplates(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) showError("ข้อผิดพลาด", "ไม่สามารถโหลดเท็มเพลตได้");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadTemplates();

    return () => {
      cancelled = true;
    };
  }, [enabled, showError]);

  const selectedTemplate = templates.find(
    (template) => String(template.template_id) === selectedId,
  );

  const saveTemplate = async () => {
    if (saving) return;
    const name = newName.trim();

    if (!name) return;
    if (!questions.some((question) => question.type !== "header")) {
      showError("ข้อผิดพลาด", "กรุณาเพิ่มคำถามอย่างน้อย 1 ข้อ");

      return;
    }
    if (questions.some((question) => !question.text.trim())) {
      showError("ข้อผิดพลาด", "กรุณากรอกคำถามให้ครบก่อนบันทึกเท็มเพลต");

      return;
    }
    if (
      questions.some(
        (question) =>
          question.type === "checkbox" &&
          !question.options?.some((option) => option.trim()),
      )
    ) {
      showError(
        "ข้อผิดพลาด",
        "กรุณาเพิ่มตัวเลือกสำหรับคำถามแบบเลือกได้หลายข้อ",
      );

      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/surveys/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: name,
          description,
          questions: questions.map((question) => ({
            text: question.text.trim(),
            type: question.type,
            scaleMax: question.type === "scale" ? globalScaleMax : 5,
            options: question.options,
          })),
        }),
      });
      const data = await response.json();

      if (!response.ok)
        throw new Error(data.error || "ไม่สามารถบันทึกเท็มเพลตได้");
      setTemplates((current) => [data, ...current]);
      setSelectedId(String(data.template_id));
      setNewName("");
      setEditorKey((current) => current + 1);
      showSuccess("สำเร็จ", "บันทึกเท็มเพลตเรียบร้อยแล้ว");
    } catch (error) {
      showError(
        "ข้อผิดพลาด",
        error instanceof Error ? error.message : "ไม่สามารถบันทึกเท็มเพลตได้",
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteTemplate = () => {
    if (!selectedTemplate) return;
    const id = selectedTemplate.template_id;

    showConfirm(
      "ยืนยันการลบเท็มเพลต",
      `ต้องการลบเท็มเพลต “${selectedTemplate.title}” ใช่หรือไม่?`,
      async () => {
        try {
          const response = await fetch(
            `/api/surveys/templates?templateId=${id}`,
            { method: "DELETE" },
          );

          if (!response.ok) throw new Error();
          setTemplates((current) =>
            current.filter((template) => template.template_id !== id),
          );
          setSelectedId("");
          showSuccess("สำเร็จ", "ลบเท็มเพลตเรียบร้อยแล้ว");
        } catch {
          showError("ข้อผิดพลาด", "ไม่สามารถลบเท็มเพลตได้");
        }
      },
      "ลบเท็มเพลต",
    );
  };

  return (
    <DocumentTemplatePanel
      key={editorKey}
      description="เลือก ใช้ หรือบันทึกเท็มเพลตแบบสอบถาม"
      disabled={loading || saving}
      helpText="เลือกเท็มเพลตที่บันทึกไว้เพื่อเติมคำถาม หรือบันทึกคำถามปัจจุบันเป็นเท็มเพลตใหม่โดยไม่ต้องบันทึกแบบสอบถามก่อน"
      loading={loading}
      newTemplateName={newName}
      selectedTemplateId={selectedId}
      templates={templates.map((template) => ({
        id: String(template.template_id),
        name: template.title,
      }))}
      title="เท็มเพลตแบบสอบถาม"
      variant="compact"
      onApply={() => {
        if (selectedTemplate) onApply(selectedTemplate);
      }}
      onDelete={deleteTemplate}
      onNewTemplateNameChange={setNewName}
      onSave={saveTemplate}
      onSelectedTemplateChange={setSelectedId}
    />
  );
}
