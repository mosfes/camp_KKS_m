import { z } from "zod";

import {
  aiInt,
  aiList,
  aiText,
  PROJECT_DOCUMENT_JSON_SPEC,
  PROJECT_DOCUMENT_RULES,
  projectDocumentAiSchema,
} from "@/lib/project-document-ai";

/**
 * สร้างค่ายด่วน: ใส่แค่ชื่อโครงการ แล้วให้ AI ร่างข้อมูลที่เหลือทั้งหมด
 * ไฟล์นี้รวม prompt และตัวแปลงผลลัพธ์จาก AI ให้อยู่ในขอบเขตที่ฐานข้อมูลรับได้
 */

export type QuickCreateClassroomOption = {
  classroom_id: number;
  grade: number;
  type_name: string;
};

const text = aiText;
const int = aiInt;
const list = aiList;

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const timeSlotSchema = z.object({
  startTime: text(5),
  endTime: text(5),
  activity: text(255),
});

const missionSchema = z.object({
  title: text(255),
  description: text(2000),
  type: z
    .unknown()
    .transform((value) =>
      value === "PHOTO_SUBMISSION" || value === "MULTIPLE_CHOICE_QUIZ"
        ? value
        : "QUESTION_ANSWERING",
    ),
  questions: list(
    z.object({
      text: text(255),
      choices: list(
        z.object({
          text: text(255),
          is_correct: z.unknown().transform((value) => value === true),
        }),
        6,
      ),
    }),
    10,
  ),
});

export const aiCampSchema = z.object({
  location: text(255, "โรงเรียน"),
  description: text(5000),
  lead_days: int(14, 120, 30),
  duration_days: int(1, 5, 2),
  grades: list(int(1, 6, 0), 6),
  daily_schedule: list(
    z.object({
      day: int(1, 5, 1),
      time_slots: list(timeSlotSchema, 15),
    }),
    5,
  ),
  stations: list(
    z.object({
      name: text(255),
      description: text(255),
      missions: list(missionSchema, 5),
    }),
    8,
  ),
  survey: z
    .object({
      title: text(255, "แบบประเมินความพึงพอใจ"),
      description: text(2000),
      questions: list(
        z.object({
          text: text(255),
          type: z
            .unknown()
            .transform((value) => (value === "text" ? "text" : "scale")),
        }),
        20,
      ),
    })
    .catch({ title: "แบบประเมินความพึงพอใจ", description: "", questions: [] }),
  document: projectDocumentAiSchema,
});

export type AiCamp = z.infer<typeof aiCampSchema>;

export function buildQuickCreatePrompt({
  projectName,
  todayKey,
  classrooms,
}: {
  projectName: string;
  todayKey: string;
  classrooms: QuickCreateClassroomOption[];
}) {
  const grades = Array.from(new Set(classrooms.map((c) => c.grade))).sort();

  return `คุณเป็นครูผู้เชี่ยวชาญการจัดค่ายกิจกรรมของโรงเรียนมัธยมในประเทศไทย
ช่วยวางแผนค่ายทั้งหมดจาก "ชื่อโครงการ" ต่อไปนี้ และเขียนเอกสารโครงการตามแบบฟอร์มราชการไทย

ชื่อโครงการ: ${JSON.stringify(projectName)}
วันนี้: ${todayKey}
ระดับชั้นที่โรงเรียนมี (มัธยมศึกษาปีที่): ${grades.join(", ") || "1-6"}

ตอบเป็น JSON object เท่านั้น ตามโครงสร้างนี้ ภาษาไทยทั้งหมด:
{
  "location": "สถานที่จัดค่าย (ถ้าชื่อโครงการไม่ระบุ ให้ใช้ \\"โรงเรียน\\")",
  "description": "คำอธิบายค่ายสั้นๆ 2-3 ประโยค สำหรับนักเรียนและผู้ปกครอง",
  "lead_days": จำนวนวันนับจากวันนี้ถึงวันเริ่มค่าย (14-120),
  "duration_days": จำนวนวันจัดค่าย (1-5),
  "grades": [ระดับชั้นที่เหมาะกับค่ายนี้ เช่น 1, 2, 3],
  "daily_schedule": [
    { "day": 1, "time_slots": [ { "startTime": "08:30", "endTime": "09:00", "activity": "ลงทะเบียน" } ] }
  ],
  "stations": [
    {
      "name": "ชื่อฐานกิจกรรม",
      "description": "อธิบายฐาน ไม่เกิน 200 ตัวอักษร",
      "missions": [
        {
          "title": "ชื่อภารกิจ",
          "description": "คำชี้แจงภารกิจ",
          "type": "QUESTION_ANSWERING" | "PHOTO_SUBMISSION" | "MULTIPLE_CHOICE_QUIZ",
          "questions": [ { "text": "คำถาม", "choices": [ { "text": "ตัวเลือก", "is_correct": true } ] } ]
        }
      ]
    }
  ],
  "survey": {
    "title": "แบบประเมินความพึงพอใจ...",
    "description": "",
    "questions": [ { "text": "คำถาม", "type": "scale" | "text" } ]
  },
  "document": ${PROJECT_DOCUMENT_JSON_SPEC}
}

กติกา:
- daily_schedule ต้องมีครบทุกวันตั้งแต่ day 1 ถึง duration_days เวลาอยู่ในรูปแบบ HH:MM และเรียงตามเวลา
- stations 3-6 ฐาน แต่ละฐานมี 1-2 ภารกิจ
- QUESTION_ANSWERING: questions เป็นคำถามปลายเปิด 1-3 ข้อ ไม่ต้องมี choices
- PHOTO_SUBMISSION: questions 1 ข้อ เป็นคำสั่งให้ถ่ายรูป ไม่ต้องมี choices
- MULTIPLE_CHOICE_QUIZ: questions 3-5 ข้อ แต่ละข้อมี 4 choices และถูกต้องเพียง 1 ข้อ
- survey 6-10 ข้อ ส่วนใหญ่เป็น scale (1-5) และมี text 1-2 ข้อท้าย

กติกาของ document:
${PROJECT_DOCUMENT_RULES}`;
}

function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00Z`);

  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

function toMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);

  return h * 60 + m;
}

/** แปลงผลจาก AI ให้เป็นข้อมูลที่พร้อมบันทึก (วันที่ กำหนดการ ห้องเรียน) */
export function planQuickCreateCamp(
  ai: AiCamp,
  todayKey: string,
  classrooms: QuickCreateClassroomOption[],
) {
  const campStartDate = addDays(todayKey, ai.lead_days);
  const campEndDate = addDays(campStartDate, ai.duration_days - 1);
  const registrationStartDate = todayKey;
  const registrationEndDate = addDays(campStartDate, -3);

  const dailySchedule = Array.from({ length: ai.duration_days }, (_, i) => {
    const day = i + 1;
    const source = ai.daily_schedule.find((d) => d.day === day);
    const timeSlots = (source?.time_slots || [])
      .filter(
        (slot) =>
          TIME_RE.test(slot.startTime) &&
          TIME_RE.test(slot.endTime) &&
          toMinutes(slot.endTime) > toMinutes(slot.startTime) &&
          slot.activity,
      )
      .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));

    return { day, timeSlots };
  }).filter((d) => d.timeSlots.length > 0);

  const wantedGrades = new Set(ai.grades.filter((g) => g >= 1));
  let classroomIds = classrooms
    .filter((c) => wantedGrades.has(c.grade))
    .map((c) => c.classroom_id);

  if (classroomIds.length === 0) {
    classroomIds = classrooms.map((c) => c.classroom_id);
  }

  const stations = ai.stations
    .filter((s) => s.name)
    .map((station) => ({
      ...station,
      missions: station.missions
        .filter((m) => m.title)
        .map((mission) => {
          const questions = mission.questions.filter((q) => q.text);

          if (mission.type !== "MULTIPLE_CHOICE_QUIZ") {
            return {
              ...mission,
              questions: questions.map((q) => ({ text: q.text, choices: [] })),
            };
          }

          return {
            ...mission,
            questions: questions
              .map((q) => {
                const choices = q.choices.filter((c) => c.text);
                const correctIndex = Math.max(
                  0,
                  choices.findIndex((c) => c.is_correct),
                );

                return {
                  text: q.text,
                  choices: choices.map((c, i) => ({
                    text: c.text,
                    is_correct: i === correctIndex,
                  })),
                };
              })
              .filter((q) => q.choices.length >= 2),
          };
        })
        .filter((m) => m.questions.length > 0),
    }));

  return {
    campStartDate,
    campEndDate,
    registrationStartDate,
    registrationEndDate,
    dailySchedule,
    classroomIds,
    stations,
    survey: {
      ...ai.survey,
      questions: ai.survey.questions.filter((q) => q.text),
    },
  };
}
