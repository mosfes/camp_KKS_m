// @ts-nocheck

import { NextResponse } from "next/server";

import { requireStationOwner } from "@/lib/camp-management-auth";
import { prisma } from "@/lib/db";

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      title,
      description,
      type,
      // removed unused instructions:       instructions,
      question,
      choices,
      questions,
      stationId,
    } = body;

    // Although title/type etc are important, we might only strictly require stationId.
    // Adjust validation as needed.
    if (!stationId) {
      return NextResponse.json(
        { error: "Station ID is required" },
        { status: 400 },
      );
    }

    const parsedStationId = parseInt(stationId);
    const { error } = await requireStationOwner(parsedStationId);

    if (error) return error;

    const newMission = await prisma.mission.create({
      data: {
        title,
        description,
        type,
        station_station_id: parsedStationId,
      },
    });

    // Handle Question(s) based on type
    if (type === "QUESTION_ANSWERING" || type === "VIDEO_SUBMISSION") {
      const questionsToCreate = questions || [];

      if (questionsToCreate.length === 0 && question) {
        questionsToCreate.push({ text: question });
      }

      for (const q of questionsToCreate) {
        if (q.text) {
          await prisma.mission_question.create({
            data: {
              question_text: q.text,
              // Video links use the existing text-answer storage; this keeps
              // video data out of our cloud storage entirely.
              question_type: "TEXT",
              mission_mission_id: newMission.mission_id,
            },
          });
        }
      }
    } else if (type === "MULTIPLE_CHOICE_QUIZ" || type === "PRE_TEST") {
      // Support multiple questions from 'questions' array
      // Structure: questions: [{ text, choices: [{ text, isCorrect }] }]
      // Fallback to legacy single question/choices if 'questions' not present (backward compat if needed, but we can just require 'questions' for new UI)

      const questionsToCreate = questions || [];

      // If legacy single question/choices params are sent but 'questions' array is empty, wrap them
      if (questionsToCreate.length === 0 && question && choices) {
        questionsToCreate.push({ text: question, choices: choices });
      }

      if (questionsToCreate.length > 0) {
        for (const q of questionsToCreate) {
          if (q.text && q.choices && q.choices.length > 0) {
            await prisma.mission_question.create({
              data: {
                question_text: q.text,
                question_type: "MCQ",
                mission_mission_id: newMission.mission_id,
                choices: {
                  create: q.choices.map((c) => ({
                    choice_text: c.text,
                    is_correct: c.isCorrect,
                  })),
                },
              },
            });
          }
        }
      }
    } else if (type === "PHOTO_SUBMISSION") {
      const questionsToCreate = questions || [];

      if (questionsToCreate.length === 0 && question) {
        questionsToCreate.push({ text: question });
      }

      for (const q of questionsToCreate) {
        if (q.text) {
          await prisma.mission_question.create({
            data: {
              question_text: q.text,
              question_type: "PHOTO",
              mission_mission_id: newMission.mission_id,
            },
          });
        }
      }
    }

    // If PRE_TEST, automatically create a POST_TEST version
    if (type === "PRE_TEST") {
      const postTestTitle = title.replace(/ก่อนเรียน/g, "หลังเรียน");
      const newPostMission = await prisma.mission.create({
        data: {
          title:
            postTestTitle !== title ? postTestTitle : `${title} (หลังเรียน)`,
          description,
          type: "POST_TEST",
          station_station_id: parsedStationId,
        },
      });

      const questionsToCreate = questions || [];

      if (questionsToCreate.length === 0 && question && choices) {
        questionsToCreate.push({ text: question, choices: choices });
      }

      if (questionsToCreate.length > 0) {
        for (const q of questionsToCreate) {
          if (q.text && q.choices && q.choices.length > 0) {
            await prisma.mission_question.create({
              data: {
                question_text: q.text,
                question_type: "MCQ",
                mission_mission_id: newPostMission.mission_id,
                choices: {
                  create: q.choices.map((c) => ({
                    choice_text: c.text,
                    is_correct: c.isCorrect,
                  })),
                },
              },
            });
          }
        }
      }
    }

    return NextResponse.json(newMission, { status: 201 });
  } catch {
    //     console.error("Error creating mission:", error);

    return NextResponse.json(
      { _error: "Failed to create mission" },
      { status: 500 },
    );
  }
}
