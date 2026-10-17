// @ts-nocheck
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireStudent } from "@/lib/auth";
import { isBangkokDateBefore } from "@/lib/bangkok-date";
import { activeCampStudentWhere } from "@/lib/active-camp-student";
import { resolveStudentCampId } from "@/lib/student-public-route";

// GET /api/student/surveys?campId=<id> — ดึงแบบสอบถามเพื่อให้นักเรียนทำ (และเช็คว่าทำไปแล้วหรือยัง)
export async function GET(request) {
  const { student, error } = await requireStudent();

  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const campId = searchParams.get("campId");

    if (!campId) {
      return NextResponse.json(
        { error: "campId is required" },
        { status: 400 },
      );
    }

    const cId = await resolveStudentCampId(campId);

    if (!cId) {
      return NextResponse.json({ error: "Invalid campId" }, { status: 400 });
    }

    // หาแบบสอบถามของค่ายนี้
    const survey = await prisma.survey.findUnique({
      where: { camp_camp_id: cId },
      include: {
        survey_question: { orderBy: { question_id: "asc" } },
      },
    });

    if (!survey) {
      return NextResponse.json({ survey: null, isCompleted: false });
    }

    const camp = await prisma.camp.findUnique({
      where: { camp_id: cId },
      select: { start_date: true },
    });

    if (camp?.start_date && isBangkokDateBefore(new Date(), camp.start_date)) {
      return NextResponse.json(
        { error: "ค่ายยังไม่เริ่ม ไม่สามารถทำแบบประเมินได้" },
        { status: 403 },
      );
    }

    // ต้องลงทะเบียนเข้าค่ายจริงก่อน จึงจะเห็นแบบประเมินได้
    const enrollment = await prisma.student_enrollment.findFirst({
      where: {
        student_students_id: student.students_id,
        camp_camp_id: cId,
        enrolled_at: { not: null },
        student: activeCampStudentWhere(cId),
      },
    });

    if (!enrollment) {
      return NextResponse.json(
        { error: "กรุณาเข้าร่วมค่ายก่อนจึงจะทำแบบประเมินได้" },
        { status: 403 },
      );
    }

    // เช็คว่าทำแบบสอบถามไปแล้วหรือยัง
    const response = await prisma.survey_response.findUnique({
      where: {
        survey_survey_id_student_enrollment_id: {
          survey_survey_id: survey.survey_id,
          student_enrollment_id: enrollment.student_enrollment_id,
        },
      },
    });

    return NextResponse.json({
      survey,
      isCompleted: !!response,
    });
  } catch {
    //     console.error("Error fetching student survey:", error);

    return NextResponse.json({ _error: "Failed" }, { status: 500 });
  }
}

// POST /api/student/surveys — ส่งคำตอบแบบสอบถาม
export async function POST(request) {
  const { student, error } = await requireStudent();

  if (error) return error;

  try {
    const body = await request.json();
    const { surveyId, answers, campId } = body;

    if (
      surveyId === undefined ||
      answers === undefined ||
      campId === undefined
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    if (!Array.isArray(answers)) {
      return NextResponse.json(
        { error: "Invalid answers format" },
        { status: 400 },
      );
    }

    const sId = parseInt(surveyId);
    const cId = await resolveStudentCampId(String(campId));

    if (isNaN(sId) || !cId) {
      return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
    }

    const survey = await prisma.survey.findUnique({
      where: { survey_id: sId },
      select: { camp_camp_id: true, is_accepting_responses: true },
    });

    if (!survey || survey.camp_camp_id !== cId) {
      return NextResponse.json(
        { error: "Survey not found for this camp" },
        { status: 404 },
      );
    }

    if (survey.is_accepting_responses === false) {
      return NextResponse.json(
        { error: "แบบสอบถามนี้ปิดรับคำตอบแล้ว ไม่สามารถส่งคำตอบได้" },
        { status: 403 },
      );
    }

    const camp = await prisma.camp.findUnique({
      where: { camp_id: cId },
      select: { start_date: true },
    });

    if (camp?.start_date && isBangkokDateBefore(new Date(), camp.start_date)) {
      return NextResponse.json(
        { error: "ค่ายยังไม่เริ่ม ไม่สามารถทำแบบประเมินได้" },
        { status: 403 },
      );
    }

    const enrollment = await prisma.student_enrollment.findFirst({
      where: {
        student_students_id: student.students_id,
        camp_camp_id: cId,
        enrolled_at: { not: null },
        student: activeCampStudentWhere(cId),
      },
    });

    if (!enrollment) {
      return NextResponse.json(
        { error: "กรุณาเข้าร่วมค่ายก่อนจึงจะทำแบบประเมินได้" },
        { status: 403 },
      );
    }

    // --- Vulgar Word Filter ---
    const textAnswers = answers
      .filter((ans) => ans.textAnswer && String(ans.textAnswer).trim() !== "")
      .map((ans) => String(ans.textAnswer).trim());

    if (textAnswers.length > 0) {
      const debugVulgarWordsList = await prisma.vulgar_words.findMany();
      const vulgarList = debugVulgarWordsList
        .map((v) => v.word.toLowerCase())
        .filter((w) => w !== "");

      let foundVulgarInDb = null;

      for (const text of textAnswers) {
        const lowerText = text.toLowerCase();

        for (const word of vulgarList) {
          if (word && lowerText.includes(word)) {
            foundVulgarInDb = word;
            break;
          }
        }
        if (foundVulgarInDb) break;
      }

      if (foundVulgarInDb) {
        return NextResponse.json(
          { error: `กรุณางดใช้คำหยาบคาย: ${foundVulgarInDb}`, success: false },
          { status: 400 },
        );
      }

      if (process.env.GEMINI_API_KEY) {
        const combinedText = textAnswers.join(" | ");
        const prompt = `ประเมินว่าข้อความเหล่านี้เป็นข้อความที่เหมาะสมหรือไม่ (ตรวจสอบคำหยาบ, คำด่า, ภาษาลับ, ภาษาวิบัติที่รุนแรง, ภาษาลู เป็นต้น) 
ทั้งภาษาไทยและอังกฤษ รวมถึงการระบุคำที่ใช้คำแสลง หรือคำที่จงใจเขียนเลี่ยง (เช่น ใช้ "I" แทน "ไอ้" หรือเขียนสลับตัวอักษร) 

สำคัญที่สุด: ให้พิจารณา "บริบท (Context)" ของประโยคด้วย 
- หากเป็นคำที่มักใช้เป็นคำด่า แต่ในประโยคนั้นใช้ในความหมายปกติหรือพูดถึงสัตว์/สิ่งของ (เช่น "เมื่อคืนหมาหอน", "ฉันเห็นควายกินหญ้า", "เหี้ยตัวใหญ่มาก") ให้ถือว่า "ไม่หยาบ" (isVulgar: false)
- หากใช้ในบริบทที่ตั้งใจด่าทอ เปรียบเปรยให้เสียหาย หรือคำสแลงที่ไม่สุภาพ (เช่น "อาหารหมาไม่แดก", "ไอ้ควาย", "เหี้ยเอ๊ย") ให้ถือว่า "หยาบ" (isVulgar: true)

ในกรณีที่พบคำหยาบ ให้ระบุคำหรือวลีนั้นๆ ลงใน detectedWords โดยพยายามระบุเป็น "วลีเต็มๆ" ที่ทำให้เกิดความหมายหยาบคาย (เช่น "หมาไม่แดก", "ไอ้ควาย") แทนที่จะระบุแค่คำโดดๆ เพื่อป้องกันการแบนเงื่อนไขยิบย่อยที่ผิดพลาดในอนาคต

ตอบกลับเป็น JSON ในรูปแบบ {"isVulgar": boolean, "detectedWords": string[]} 

ข้อความที่ต้องการตรวจ: "${combinedText}"`;

        try {
          const geminiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${process.env.GEMINI_API_KEY}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
              }),
            },
          );

          if (geminiResponse.ok) {
            const geminiData = await geminiResponse.json();
            const textResponse =
              geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

            const jsonMatch = textResponse.match(/\{[\s\S]*\}/);

            if (jsonMatch) {
              let result = JSON.parse(jsonMatch[0]);

              // บันทึกคำที่ตรวจพบลงใน DB
              if (result.detectedWords && result.detectedWords.length > 0) {
                result.isVulgar = true;
              }

              if (
                result.isVulgar &&
                result.detectedWords &&
                result.detectedWords.length > 0
              ) {
                // ... logic to add to DB ...
                for (const word of result.detectedWords) {
                  const existing = await prisma.vulgar_words.findFirst({
                    where: { word },
                  });

                  if (!existing)
                    await prisma.vulgar_words.create({
                      data: { word, is_ai: true },
                    });
                }

                return NextResponse.json(
                  {
                    error: `กรุณางดใช้คำหยาบคาย: ${result.detectedWords.join(", ")}`,
                    success: false,
                  },
                  { status: 400 },
                );
              }
            } else {
            }
          } else {
          }
        } catch {
          //           console.error("Gemini processing error:", err);
        }
      }
    }
    // --- End Vulgar Word Filter ---

    // สร้าง response และ answers ให้ครบใน Transaction
    const result = await prisma.$transaction(async (tx) => {
      const response = await tx.survey_response.create({
        data: {
          survey_survey_id: parseInt(surveyId),
          student_enrollment_id: enrollment.student_enrollment_id,
          survey_answer: {
            create: answers.map((ans) => ({
              question_id: parseInt(ans.questionId),
              text_answer: ans.textAnswer || null,
              scale_value: ans.scaleValue || null,
            })),
          },
        },
      });

      return response;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    //     console.error("Error submitting survey:", error);
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "คุณทำแบบสอบถามนี้ไปแล้ว" },
        { status: 409 },
      );
    }

    return NextResponse.json({ error: "Failed to submit" }, { status: 500 });
  }
}
