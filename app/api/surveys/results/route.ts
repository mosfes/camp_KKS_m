// @ts-nocheck
import { NextResponse } from "next/server";

import { requireTeacher } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { activeCampStudentWhere } from "@/lib/active-camp-student";

// GET /api/surveys/results?campId=<id>
export async function GET(request) {
  const { teacher, error } = await requireTeacher();

  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const campId = searchParams.get("campId");

    if (!campId) {
      return NextResponse.json({ error: "กรุณาระบุ campId" }, { status: 400 });
    }

    const cId = parseInt(campId);

    // Verify if teacher is the owner of the camp
    const camp = await prisma.camp.findUnique({
      where: { camp_id: cId, deletedAt: null },
      select: { created_by_teacher_id: true },
    });

    if (!camp) {
      return NextResponse.json(
        { error: "ไม่พบค่ายนี้ในระบบ" },
        { status: 404 },
      );
    }

    if (
      camp.created_by_teacher_id !== teacher.teachers_id &&
      teacher.role !== "ADMIN"
    ) {
      return NextResponse.json(
        { error: "ไม่มีสิทธิ์ดูผลการประเมินนี้" },
        { status: 403 },
      );
    }

    const survey = await prisma.survey.findUnique({
      where: { camp_camp_id: cId },
      include: {
        _count: {
          select: {
            survey_response: {
              where: {
                student_enrollment: {
                  student: activeCampStudentWhere(cId),
                },
              },
            },
          },
        },
        survey_question: {
          orderBy: { question_id: "asc" },
          include: {
            survey_answer: {
              where: {
                survey_response: {
                  student_enrollment: {
                    student: activeCampStudentWhere(cId),
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!survey) {
      return NextResponse.json({ survey: null }, { status: 200 });
    }

    const totalResponses = survey._count.survey_response;

    const summaryQuestions = survey.survey_question.map((q) => {
      if (q.question_type === "scale") {
        const validAnswers = q.survey_answer.filter(
          (a) => a.scale_value !== null,
        );
        const total = validAnswers.length;
        const sum = validAnswers.reduce(
          (acc, a) => acc + (a.scale_value || 0),
          0,
        );
        const average = total > 0 ? (sum / total).toFixed(1) : "0.0";

        // Distribution
        const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

        validAnswers.forEach((a) => {
          if (a.scale_value && distribution[a.scale_value] !== undefined) {
            distribution[a.scale_value]++;
          }
        });

        return {
          id: q.question_id,
          text: q.question_text,
          type: "scale",
          scaleMax: q.scale_max || 5,
          average: parseFloat(average),
          total,
          distribution,
        };
      } else if (q.question_type === "text") {
        // text
        const answers = q.survey_answer
          .filter((a) => a.text_answer && String(a.text_answer).trim() !== "")
          .map((a) => String(a.text_answer).trim());

        return {
          id: q.question_id,
          text: q.question_text,
          type: "text",
          total: answers.length,
          answers,
        };
      } else if (q.question_type === "checkbox") {
        const options = (() => {
          try {
            const parsed = JSON.parse(q.options || "[]");

            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        })();
        const counts = new Map(options.map((option) => [option, 0]));
        let total = 0;

        q.survey_answer.forEach((answer) => {
          if (!answer.text_answer) return;

          try {
            const selected = JSON.parse(answer.text_answer);

            if (!Array.isArray(selected)) return;
            total++;
            selected.forEach((option) => {
              if (typeof option === "string") {
                counts.set(option, (counts.get(option) || 0) + 1);
              }
            });
          } catch {
            // Ignore legacy or malformed checkbox values without failing the
            // entire survey results page.
          }
        });

        return {
          id: q.question_id,
          text: q.question_text,
          type: "checkbox",
          allOptions: options,
          total,
          options: Array.from(counts, ([label, count]) => ({ label, count })),
        };
      } else {
        // header
        return {
          id: q.question_id,
          text: q.question_text,
          type: "header",
          total: 0,
        };
      }
    });

    const responses = await prisma.survey_response.findMany({
      where: {
        survey_survey_id: survey.survey_id,
        student_enrollment: {
          student: activeCampStudentWhere(cId),
        },
      },
      orderBy: { submitted_at: "asc" },
      select: {
        response_id: true,
        submitted_at: true,
        student_enrollment: {
          select: {
            student: {
              select: {
                students_id: true,
                prefix_name: true,
                firstname: true,
                lastname: true,
                classroom_students: {
                  take: 1,
                  select: {
                    classroom: {
                      select: {
                        grade: true,
                        classroom_types: { select: { name: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        survey_answer: {
          select: {
            question_id: true,
            text_answer: true,
            scale_value: true,
          },
        },
      },
    });

    const individualResponses = responses.map((r, index) => {
      const student = r.student_enrollment?.student;
      const cls = student?.classroom_students?.[0]?.classroom;
      const gradeStr = cls?.grade
        ? String(cls.grade).replace("Level_", "ม.")
        : "ไม่ระบุ";
      const roomName = cls?.classroom_types?.name;
      const roomStr = roomName ? `/${roomName}` : "";

      const answersMap: Record<
        number,
        { text_answer: string | null; scale_value: number | null }
      > = {};

      r.survey_answer.forEach((a) => {
        answersMap[a.question_id] = {
          text_answer: a.text_answer,
          scale_value: a.scale_value,
        };
      });

      return {
        responseId: r.response_id,
        index: index + 1,
        submittedAt: r.submitted_at,
        studentId: student?.students_id ?? null,
        studentName: student
          ? `${student.prefix_name || ""}${student.firstname} ${student.lastname}`.trim()
          : "ไม่ระบุชื่อ",
        classroom: `${gradeStr}${roomStr}`,
        answers: answersMap,
      };
    });

    const demographics = {
      gender: { male: 0, female: 0, other: 0 },
      grade: {} as Record<string, number>,
    };

    responses.forEach((r) => {
      const student = r.student_enrollment?.student;

      if (student) {
        // Gender
        const prefix = student.prefix_name?.trim() || "";

        if (["เด็กชาย", "ด.ช.", "นาย"].includes(prefix)) {
          demographics.gender.male++;
        } else if (["เด็กหญิง", "ด.ญ.", "นางสาว", "นาง"].includes(prefix)) {
          demographics.gender.female++;
        } else {
          demographics.gender.other++;
        }
        // Grade
        const cls = student.classroom_students?.[0]?.classroom;

        if (cls?.grade) {
          const gradeStr = String(cls.grade).replace("Level_", "ม.");

          demographics.grade[gradeStr] =
            (demographics.grade[gradeStr] || 0) + 1;
        } else {
          demographics.grade["ไม่ระบุ"] =
            (demographics.grade["ไม่ระบุ"] || 0) + 1;
        }
      }
    });

    const summaryData = {
      surveyId: survey.survey_id,
      title: survey.title,
      isAcceptingResponses: survey.is_accepting_responses ?? true,
      totalResponses,
      questions: summaryQuestions,
      individualResponses,
      demographics,
    };

    return NextResponse.json(summaryData);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error fetching survey results:", err);

    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการดึงข้อมูลผลแบบประเมิน" },
      { status: 500 },
    );
  }
}
