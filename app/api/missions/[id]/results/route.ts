// @ts-nocheck
import { NextResponse } from "next/server";

import { requireMissionOwner } from "@/lib/camp-management-auth";
import { prisma } from "@/lib/db";
import { activeCampEnrollmentWhere } from "@/lib/active-camp-student";

export async function GET(request, { params }) {
  const { id } = await params;
  const missionId = parseInt(id);
  const { error } = await requireMissionOwner(missionId);

  if (error) return error;

  try {
    if (!missionId) {
      return NextResponse.json(
        { error: "Invalid mission ID" },
        { status: 400 },
      );
    }

    const mission = await prisma.mission.findUnique({
      where: { mission_id: parseInt(missionId) },
      include: { station: true },
    });

    if (!mission) {
      return NextResponse.json({ error: "Mission not found" }, { status: 404 });
    }

    const enrollments = await prisma.student_enrollment.findMany({
      where: {
        ...activeCampEnrollmentWhere(mission.station.camp_camp_id),
        enrolled_at: { not: null },
      },
      include: {
        student: true,
        mission_result: {
          where: {
            mission_mission_id: missionId,
            status: "completed",
          },
          include: {
            mission_answer: {
              include: {
                mission_question: {
                  include: { choices: true },
                },
                answer_text: true,
                answer_mcq: true,
                answer_photo: true,
              },
            },
          },
        },
      },
    });

    const formattedResults = enrollments.map((e) => {
      const result =
        e.mission_result && e.mission_result.length > 0
          ? e.mission_result[0]
          : null;

      let answers = [];

      if (result) {
        answers = result.mission_answer.map((ans) => {
          let answerText = "-";
          let isCorrect = null;
          const qType = ans.mission_question?.question_type;

          if (
            qType === "TEXT" &&
            ans.answer_text &&
            ans.answer_text.length > 0
          ) {
            answerText = ans.answer_text[0].answer_text;
          } else if (
            qType === "MCQ" &&
            ans.answer_mcq &&
            ans.answer_mcq.length > 0
          ) {
            const chosenLetter = ans.answer_mcq[0].question_text;
            const choices = ans.mission_question.choices || [];
            const charCode = chosenLetter.charCodeAt(0) - 65;

            if (charCode >= 0 && charCode < choices.length) {
              answerText = `${chosenLetter}. ${choices[charCode].choice_text}`;
              isCorrect = choices[charCode].is_correct;
            } else {
              answerText = chosenLetter;
              const matchedChoice = choices.find(
                (c) => c.choice_text === chosenLetter,
              );

              if (matchedChoice) {
                isCorrect = matchedChoice.is_correct;
              }
            }
          } else if (
            qType === "PHOTO" &&
            ans.answer_photo &&
            ans.answer_photo.length > 0
          ) {
            answerText = ans.answer_photo[0].img_url;
          }

          return {
            questionId: ans.mission_question_question_id,
            questionText: ans.mission_question?.question_text,
            type: mission.type === "VIDEO_SUBMISSION" ? "VIDEO" : qType,
            answerText: answerText,
            isCorrect: isCorrect,
          };
        });
      }

      return {
        enrollmentId: e.student_enrollment_id,
        studentId: e.student.students_id,
        studentName: `${e.student.prefix_name || ""}${e.student.firstname} ${e.student.lastname}`,
        studentNickname: e.student.nickname,
        profileImageUrl: e.student.profile_image_url,
        initials: `${e.student.firstname.charAt(0)}${e.student.lastname.charAt(0)}`,
        isSubmitted: !!result,
        submittedAt: result ? result.submitted_at : null,
        answers: answers,
        resultId: result ? result.mission_result_id : null,
      };
    });

    // Sort: Submitted first (newest to oldest), then unsubmitted by student ID
    formattedResults.sort((a, b) => {
      if (a.isSubmitted && !b.isSubmitted) return -1;
      if (!a.isSubmitted && b.isSubmitted) return 1;
      if (a.isSubmitted && b.isSubmitted) {
        return new Date(b.submittedAt) - new Date(a.submittedAt);
      }

      return a.studentId - b.studentId;
    });

    return NextResponse.json(formattedResults);
  } catch {
    //     console.error("Error fetching mission results:", error);

    return NextResponse.json(
      { _error: "Failed to fetch results" },
      { status: 500 },
    );
  }
}
