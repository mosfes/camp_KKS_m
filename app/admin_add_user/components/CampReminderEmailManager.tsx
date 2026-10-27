"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Card,
  CardBody,
  Chip,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownSection,
  DropdownTrigger,
  Input,
  Select,
  SelectItem,
  Spinner,
  Switch,
} from "@heroui/react";
import {
  Clock,
  FileText,
  Mail,
  Plus,
  RotateCcw,
  Save,
  Send,
  Trash2,
} from "lucide-react";

import CampReminderContentFields, {
  FieldLabel,
  hourLabel,
  SAMPLE_CAMP_START_KEY,
  thaiDate,
} from "./CampReminderContentFields";

import { useStatusModal } from "@/components/StatusModalProvider";
import {
  countdownText,
  createReminderFromContent,
  describeReminderContent,
  reminderContentSchema,
  toReminderContent,
  createReminderTemplate,
  DEFAULT_CAMP_REMINDER_SETTINGS,
  MAX_DAYS_BEFORE,
  MAX_REMINDERS,
  type CampReminderSettings,
  type ReminderPresetContent,
  type ReminderTemplate,
} from "@/lib/camp-reminder-config";
import { createCampReminderEmail } from "@/lib/camp-reminder-email";

type RunSummary = {
  dateKey: string;
  sent: number;
  failed: number;
  uncertain: number;
  lastFinishedAt: string | null;
};

type CampProgress = {
  campId: number;
  name: string;
  startDateKey: string;
  sent: number;
  remaining: number;
  problems: number;
  reminders: {
    id: string;
    name: string;
    number: number;
    sendDateKey: string;
    sent: number;
    remaining: number;
    problems: number;
  }[];
};

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const BLANK_PRESET = "blank";

type CustomTemplate = { id: number; content: ReminderPresetContent };

type TemplateOption = {
  key: string;
  customId: number;
  description: string;
  content: ReminderPresetContent;
};

// A crashed route can answer with an empty or HTML body; surface the status
// instead of a JSON parse error.
async function readJson(response: Response) {
  const text = await response.text();

  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { error: `เซิร์ฟเวอร์ตอบกลับไม่ถูกต้อง (HTTP ${response.status})` };
  }
}

export default function CampReminderEmailManager() {
  const { showSuccess, showError, showConfirm } = useStatusModal();
  const [settings, setSettings] = useState<CampReminderSettings | null>(null);
  const [saved, setSaved] = useState<CampReminderSettings | null>(null);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [camps, setCamps] = useState<CampProgress[] | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [customTemplates, setCustomTemplates] = useState<CustomTemplate[]>([]);
  const [templateSavingId, setTemplateSavingId] = useState<string | null>(null);
  // Set when the trash icon inside a template item is pressed, so the item's
  // own action deletes instead of applying the template.
  const deleteIntent = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/admin/camp-reminder-settings", { cache: "no-store" })
      .then(async (response) => {
        const data = await readJson(response);

        if (!response.ok) throw new Error(data.error || "โหลดข้อมูลไม่สำเร็จ");
        if (cancelled) return;
        setSettings(data.settings);
        setSaved(data.settings);
        setRuns(data.runs ?? []);
        setCamps(data.camps ?? []);
        setCustomTemplates(data.templates ?? []);
      })
      .catch((error: Error) => {
        if (!cancelled) {
          showError("โหลดการตั้งค่าไม่สำเร็จ", error.message);
          setSettings((current) => current ?? DEFAULT_CAMP_REMINDER_SETTINGS);
          setCamps([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [showError, reloadKey]);

  const dirty = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(saved),
    [settings, saved],
  );

  const preview = useMemo(() => {
    if (!settings) return null;
    const index = Math.max(
      0,
      settings.reminders.findIndex((reminder) => reminder.id === previewId),
    );
    const template = settings.reminders[index];
    const daysLeft = template.daysBefore;

    const email = createCampReminderEmail({
      template,
      values: {
        name: "ด.ช.สมชาย ใจดี",
        campName: "ค่ายลูกเสือ ม.2",
        campDate: thaiDate(SAMPLE_CAMP_START_KEY),
        location: "ค่ายลูกเสือวชิราวุธ",
        daysLeft: String(daysLeft),
        countdown: countdownText(daysLeft),
      },
      campUrl: "https://example.com",
    });

    return {
      ...email,
      id: template.id,
      name: template.name,
      number: index + 1,
    };
  }, [settings, previewId]);

  const templateOptions = useMemo(
    () =>
      customTemplates.map(
        (template): TemplateOption => ({
          key: `template:${template.id}`,
          customId: template.id,
          description: describeReminderContent(template.content),
          content: template.content,
        }),
      ),
    [customTemplates],
  );

  if (!settings) {
    return (
      <div className="flex justify-center py-16">
        <Spinner color="success" label="กำลังโหลดการตั้งค่า" />
      </div>
    );
  }

  const updateTemplate = (id: string, patch: Partial<ReminderTemplate>) => {
    setSettings((current) =>
      current
        ? {
            ...current,
            reminders: current.reminders.map((reminder) =>
              reminder.id === id ? { ...reminder, ...patch } : reminder,
            ),
          }
        : current,
    );
  };

  const findTemplateContent = (key: string) =>
    templateOptions.find((option) => option.key === key)?.content;

  const addReminder = (key: string) => {
    const content = findTemplateContent(key);
    const reminder = content
      ? createReminderFromContent(content)
      : createReminderTemplate(settings.reminders);

    setSettings({ ...settings, reminders: [...settings.reminders, reminder] });
    setPreviewId(reminder.id);
  };

  const applyTemplate = (id: string, number: number, key: string) => {
    const content = findTemplateContent(key);

    if (!content) return;

    showConfirm(
      `ใช้เท็มเพลตกับครั้งที่ ${number}`,
      "ชื่อ ผู้รับ จำนวนวัน และข้อความทั้งหมดของครั้งนี้จะถูกแทนที่ด้วยเท็มเพลต (ยังไม่บันทึกจนกว่าจะกดบันทึก)",
      () => {
        updateTemplate(id, content);
        setPreviewId(id);
      },
      "ใช้เท็มเพลต",
    );
  };

  const writeTemplate = async (
    content: ReminderPresetContent,
    existingId: number | null,
  ) => {
    const response = await fetch(
      existingId == null
        ? "/api/admin/camp-reminder-templates"
        : `/api/admin/camp-reminder-templates/${existingId}`,
      {
        method: existingId == null ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(content),
      },
    );
    const data = await readJson(response);

    if (!response.ok) {
      showError("บันทึกเท็มเพลตไม่สำเร็จ", data.error || "เกิดข้อผิดพลาด");

      return;
    }

    setCustomTemplates((current) =>
      existingId == null
        ? [...current, data.template]
        : current.map((item) =>
            item.id === existingId ? data.template : item,
          ),
    );
    showSuccess(
      "บันทึกเท็มเพลตแล้ว",
      `เลือกใช้ “${content.name}” ได้จากปุ่ม “ใช้เท็มเพลต” หรือปุ่มเพิ่มการแจ้งเตือน`,
    );
  };

  const saveAsTemplate = (reminder: ReminderTemplate) => {
    const parsed = reminderContentSchema.safeParse(toReminderContent(reminder));

    if (!parsed.success) {
      const issue = parsed.error.issues[0];

      showError(
        "บันทึกเป็นเท็มเพลตไม่ได้",
        issue?.path[0] === "name"
          ? "กรุณาตั้งชื่อการแจ้งเตือนก่อน ชื่อนี้จะใช้เป็นชื่อเท็มเพลต"
          : issue?.message || "ข้อมูลไม่ครบ",
      );

      return;
    }

    const content = parsed.data;
    const existing = customTemplates.find(
      (item) => item.content.name === content.name,
    );
    const run = async () => {
      setTemplateSavingId(reminder.id);
      try {
        await writeTemplate(content, existing?.id ?? null);
      } finally {
        setTemplateSavingId(null);
      }
    };

    if (existing) {
      showConfirm(
        "มีเท็มเพลตชื่อนี้แล้ว",
        `แทนที่เท็มเพลต “${content.name}” เดิมด้วยข้อความของครั้งนี้?`,
        run,
        "แทนที่",
      );
    } else {
      void run();
    }
  };

  const deleteTemplate = (template: CustomTemplate) => {
    showConfirm(
      "ลบเท็มเพลต",
      `ลบเท็มเพลต “${template.content.name}” ? การแจ้งเตือนที่สร้างจากเท็มเพลตนี้ไปแล้วจะไม่ถูกลบ`,
      async () => {
        const response = await fetch(
          `/api/admin/camp-reminder-templates/${template.id}`,
          { method: "DELETE" },
        );
        const data = await readJson(response);

        if (!response.ok) {
          showError("ลบเท็มเพลตไม่สำเร็จ", data.error || "เกิดข้อผิดพลาด");

          return;
        }
        setCustomTemplates((current) =>
          current.filter((item) => item.id !== template.id),
        );
      },
      "ลบ",
    );
  };

  const templateItems = (options: TemplateOption[]) =>
    options.map((option) => (
      <DropdownItem
        key={option.key}
        description={option.description}
        endContent={
          <span
            aria-label={`ลบเท็มเพลต ${option.content.name}`}
            className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
            role="button"
            title="ลบเท็มเพลต"
            onPointerDown={() => {
              deleteIntent.current = option.key;
            }}
          >
            <Trash2 size={15} />
          </span>
        }
      >
        {option.content.name}
      </DropdownItem>
    ));

  /** Runs `onPick` for a chosen template, or deletes it if its trash was hit. */
  const handleTemplateAction = (key: string, onPick: (key: string) => void) => {
    const wantsDelete = deleteIntent.current === key;

    deleteIntent.current = null;

    if (!wantsDelete) {
      onPick(key);

      return;
    }

    const option = templateOptions.find((item) => item.key === key);
    const target = customTemplates.find((item) => item.id === option?.customId);

    if (target) deleteTemplate(target);
  };

  const templateSections = () =>
    templateOptions.length > 0
      ? [
          <DropdownSection key="templates" title="เท็มเพลต">
            {templateItems(templateOptions)}
          </DropdownSection>,
        ]
      : [];

  const removeReminder = (id: string, number: number) => {
    showConfirm(
      `ลบการแจ้งเตือนครั้งที่ ${number}`,
      "อีเมลครั้งนี้จะไม่ถูกส่งอีกหลังจากกดบันทึก",
      () => {
        setSettings((current) =>
          current
            ? {
                ...current,
                reminders: current.reminders.filter(
                  (reminder) => reminder.id !== id,
                ),
              }
            : current,
        );
      },
      "ลบ",
    );
  };

  const save = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/admin/camp-reminder-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await readJson(response);

      if (!response.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      setSettings(data.settings);
      setSaved(data.settings);
      setReloadKey((key) => key + 1);
      showSuccess("บันทึกแล้ว", "รอบส่งถัดไปจะใช้การตั้งค่าใหม่นี้");
    } catch (error) {
      showError(
        "บันทึกไม่สำเร็จ",
        error instanceof Error ? error.message : "เกิดข้อผิดพลาด",
      );
    } finally {
      setSaving(false);
    }
  };

  const resetToDefault = () => {
    showConfirm(
      "คืนค่าเริ่มต้น",
      "ข้อความและกำหนดการทั้งหมดจะกลับเป็นค่าเริ่มต้น (ยังไม่บันทึกจนกว่าจะกดบันทึก)",
      () => setSettings(DEFAULT_CAMP_REMINDER_SETTINGS),
    );
  };

  return (
    <div className="flex flex-col gap-6 pb-24">
      {/* Send time */}
      <Card className="border border-[#efece5] shadow-none">
        <CardBody className="gap-4 p-5">
          <div className="flex items-center gap-2">
            <Clock className="text-[#5d7c6f]" size={20} />
            <h2 className="text-lg font-semibold text-gray-800">เวลาส่ง</h2>
          </div>
          <div className="flex flex-col gap-1.5 sm:max-w-[200px]">
            <FieldLabel>ส่งทุกวันเวลา (เวลาไทย)</FieldLabel>
            <Select
              disallowEmptySelection
              aria-label="ส่งทุกวันเวลา (เวลาไทย)"
              selectedKeys={[String(settings.sendHour)]}
              variant="bordered"
              onSelectionChange={(keys) => {
                const value = Array.from(keys)[0];

                if (value != null) {
                  setSettings({ ...settings, sendHour: Number(value) });
                }
              }}
            >
              {HOURS.map((hour) => (
                <SelectItem
                  key={String(hour)}
                >{`${hourLabel(hour)} น.`}</SelectItem>
              ))}
            </Select>
          </div>
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            ระบบตรวจคิวอีเมลทุกชั่วโมง อีเมลจะเริ่มส่งตั้งแต่เวลา{" "}
            {hourLabel(settings.sendHour)} น.
            แต่อาจถึงผู้รับช้ากว่าที่ตั้งไว้ประมาณ 1 ชั่วโมง (ช่วง{" "}
            {hourLabel(settings.sendHour)}–
            {hourLabel((settings.sendHour + 1) % 24)} น.
            หรือช้ากว่านั้นเล็กน้อย)
          </p>
        </CardBody>
      </Card>

      {/* Delivery progress per camp */}
      <Card className="border border-[#efece5] shadow-none">
        <CardBody className="gap-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Send className="text-[#5d7c6f]" size={20} />
              <h2 className="text-lg font-semibold text-gray-800">
                สถานะการส่งรายค่าย
              </h2>
            </div>
            <span className="text-xs text-gray-500">
              ค่ายที่เริ่มภายใน {MAX_DAYS_BEFORE} วันข้างหน้า
            </span>
          </div>

          {camps == null ? (
            <Spinner className="py-4" color="success" size="sm" />
          ) : camps.length === 0 ? (
            <p className="py-2 text-sm text-gray-500">
              ยังไม่มีค่ายที่จะเริ่มใน {MAX_DAYS_BEFORE} วันข้างหน้า
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {camps.map((camp) => (
                <li
                  key={camp.campId}
                  className="rounded-xl border border-[#efece5] p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-gray-800">
                        {camp.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        เริ่ม {thaiDate(camp.startDateKey)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Chip
                        className="bg-emerald-50 text-emerald-700"
                        size="sm"
                      >
                        ส่งแล้ว {camp.sent} ฉบับ
                      </Chip>
                      <Chip className="bg-amber-50 text-amber-700" size="sm">
                        เหลือ {camp.remaining} ฉบับ
                      </Chip>
                      {camp.problems > 0 && (
                        <Chip className="bg-red-50 text-red-600" size="sm">
                          มีปัญหา {camp.problems} ฉบับ
                        </Chip>
                      )}
                    </div>
                  </div>
                  {camp.reminders.length > 0 && (
                    <ul className="mt-3 divide-y divide-gray-100 text-sm">
                      {camp.reminders.map((item) => (
                        <li
                          key={item.id}
                          className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2"
                        >
                          <span className="text-gray-600">
                            ครั้งที่ {item.number}
                            {item.name && ` · ${item.name}`}
                            <span className="ml-2 text-xs text-gray-400">
                              กำหนดส่ง {thaiDate(item.sendDateKey)}
                            </span>
                          </span>
                          <span className="flex gap-3">
                            <span className="text-emerald-700">
                              ส่งแล้ว {item.sent}
                            </span>
                            <span className="text-amber-700">
                              เหลือ {item.remaining}
                            </span>
                            {item.problems > 0 && (
                              <span className="text-red-600">
                                มีปัญหา {item.problems}
                              </span>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-gray-500">
            “เหลือ” นับจากรายชื่อผู้รับปัจจุบัน
            จะเปลี่ยนตามการกดเข้าร่วมของนักเรียนและครูที่ถูกเพิ่มเข้าค่าย ส่วน
            “มีปัญหา” คืออีเมลที่ส่งไม่สำเร็จหรือยืนยันผลไม่ได้
            ระบบจะไม่ส่งซ้ำให้อัตโนมัติ
          </p>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,460px)]">
        {/* Reminders */}
        <div className="flex flex-col gap-6">
          {settings.reminders.map((template, index) => {
            const number = index + 1;
            const isPreviewed = preview?.id === template.id;

            return (
              <Card
                key={template.id}
                className={`border shadow-none ${
                  isPreviewed ? "border-[#5d7c6f]" : "border-[#efece5]"
                }`}
              >
                <CardBody className="gap-4 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-center gap-2 sm:min-w-[260px]">
                      <Chip
                        className="shrink-0 bg-[#e6eee9] font-semibold text-[#3f5c50]"
                        variant="flat"
                      >
                        ครั้งที่ {number}
                      </Chip>
                      <Input
                        aria-label={`ชื่อการแจ้งเตือนครั้งที่ ${number}`}
                        className="max-w-xs"
                        classNames={{ input: "font-semibold" }}
                        maxLength={100}
                        placeholder="ตั้งชื่อ เช่น เตือนเตรียมตัว"
                        size="sm"
                        value={template.name}
                        variant="underlined"
                        onValueChange={(name) =>
                          updateTemplate(template.id, { name })
                        }
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <Dropdown isDisabled={templateOptions.length === 0}>
                        <DropdownTrigger>
                          <Button
                            isDisabled={templateOptions.length === 0}
                            size="sm"
                            startContent={<FileText size={14} />}
                            title={
                              templateOptions.length === 0
                                ? "ยังไม่มีเท็มเพลต กด “บันทึกเป็นเท็มเพลต” เพื่อสร้าง"
                                : undefined
                            }
                            variant="flat"
                          >
                            ใช้เท็มเพลต
                          </Button>
                        </DropdownTrigger>
                        <DropdownMenu
                          aria-label="เลือกเท็มเพลต"
                          onAction={(key) =>
                            handleTemplateAction(String(key), (value) =>
                              applyTemplate(template.id, number, value),
                            )
                          }
                        >
                          {templateSections()}
                        </DropdownMenu>
                      </Dropdown>
                      <Button
                        className={
                          isPreviewed ? "bg-[#5d7c6f] text-white" : undefined
                        }
                        size="sm"
                        variant={isPreviewed ? "solid" : "flat"}
                        onPress={() => setPreviewId(template.id)}
                      >
                        ดูตัวอย่าง
                      </Button>
                      <Switch
                        color="success"
                        isSelected={template.enabled}
                        size="sm"
                        onValueChange={(enabled) =>
                          updateTemplate(template.id, { enabled })
                        }
                      >
                        {template.enabled ? "เปิด" : "ปิด"}
                      </Switch>
                      {index > 0 && (
                        <Button
                          isIconOnly
                          aria-label={`ลบการแจ้งเตือนครั้งที่ ${number}`}
                          color="danger"
                          size="sm"
                          variant="light"
                          onPress={() => removeReminder(template.id, number)}
                        >
                          <Trash2 size={16} />
                        </Button>
                      )}
                    </div>
                  </div>

                  <CampReminderContentFields
                    isDisabled={!template.enabled}
                    sendHour={settings.sendHour}
                    value={template}
                    onChange={(patch) => updateTemplate(template.id, patch)}
                  />
                  <div className="flex justify-end">
                    <Button
                      isLoading={templateSavingId === template.id}
                      size="sm"
                      startContent={
                        templateSavingId !== template.id && <Save size={14} />
                      }
                      variant="flat"
                      onPress={() => saveAsTemplate(template)}
                    >
                      บันทึกเป็นเท็มเพลต
                    </Button>
                  </div>
                </CardBody>
              </Card>
            );
          })}

          {settings.reminders.length < MAX_REMINDERS && (
            <Dropdown placement="bottom">
              <DropdownTrigger>
                <button
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#c9d6cf] bg-white/60 py-5 text-sm font-medium text-[#3f5c50] transition-colors hover:border-[#5d7c6f] hover:bg-[#f4f7f5]"
                  type="button"
                >
                  <Plus size={18} />
                  เพิ่มการแจ้งเตือนครั้งที่ {settings.reminders.length + 1}
                </button>
              </DropdownTrigger>
              <DropdownMenu
                aria-label="เลือกเท็มเพลตสำหรับการแจ้งเตือนใหม่"
                onAction={(key) =>
                  handleTemplateAction(String(key), addReminder)
                }
              >
                {[
                  ...templateSections(),
                  <DropdownSection key="blank">
                    <DropdownItem
                      key={BLANK_PRESET}
                      description="เริ่มจากข้อความทั่วไป แล้วแก้เอง"
                    >
                      เขียนเอง
                    </DropdownItem>
                  </DropdownSection>,
                ]}
              </DropdownMenu>
            </Dropdown>
          )}
        </div>

        {/* Preview */}
        <div className="xl:sticky xl:top-[88px] xl:self-start">
          <Card className="border border-[#efece5] shadow-none">
            <CardBody className="gap-3 p-4">
              <div className="flex items-center gap-2">
                <Mail className="text-[#5d7c6f]" size={18} />
                <h2 className="font-semibold text-gray-800">
                  ตัวอย่าง: ครั้งที่ {preview?.number}
                  {preview?.name && ` · ${preview.name}`}
                </h2>
              </div>
              {preview && (
                <>
                  <p className="break-words rounded-lg bg-gray-50 px-3 py-2 text-sm">
                    <span className="text-gray-500">หัวเรื่อง: </span>
                    {preview.subject}
                  </p>
                  <iframe
                    className="h-[560px] w-full rounded-lg border border-gray-200 bg-white"
                    sandbox=""
                    srcDoc={preview.html}
                    title="ตัวอย่างอีเมล"
                  />
                </>
              )}
            </CardBody>
          </Card>

          {runs.length > 0 && (
            <Card className="mt-6 border border-[#efece5] shadow-none">
              <CardBody className="gap-2 p-4">
                <h2 className="font-semibold text-gray-800">
                  ผลการส่ง 7 วันล่าสุด
                </h2>
                <ul className="divide-y divide-gray-100 text-sm">
                  {runs.map((run) => (
                    <li
                      key={run.dateKey}
                      className="flex items-center justify-between py-2"
                    >
                      <span className="text-gray-600">
                        {thaiDate(run.dateKey)}
                      </span>
                      <span className="flex gap-3">
                        <span className="text-emerald-700">
                          ส่งแล้ว {run.sent}
                        </span>
                        {run.failed > 0 && (
                          <span className="text-red-600">
                            ล้มเหลว {run.failed}
                          </span>
                        )}
                        {run.uncertain > 0 && (
                          <span className="text-amber-600">
                            ไม่แน่ใจ {run.uncertain}
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          )}
        </div>
      </div>

      {/* Save bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur md:left-56">
        <div className="mx-auto flex max-w-5xl items-center justify-end gap-3">
          {dirty && (
            <span className="mr-auto text-sm text-amber-700">
              มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก
            </span>
          )}
          <Button
            startContent={<RotateCcw size={16} />}
            variant="flat"
            onPress={resetToDefault}
          >
            ค่าเริ่มต้น
          </Button>
          <Button
            className="bg-[#5d7c6f] text-white"
            isDisabled={!dirty}
            isLoading={saving}
            startContent={!saving && <Save size={16} />}
            onPress={save}
          >
            บันทึก
          </Button>
        </div>
      </div>
    </div>
  );
}
