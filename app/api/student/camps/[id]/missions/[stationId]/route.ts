// @ts-nocheck

import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireStudent } from "@/lib/auth";
import { isBangkokDateBefore } from "@/lib/bangkok-date";
import { activeCampStudentWhere } from "@/lib/active-camp-student";
import { resolveStudentCampId, resolveStudentStationId } from "@/lib/student-public-route";

/**
 * Full station payload. This is the only student read endpoint that returns
 * mission questions, choices and the signed-in student's previous answers.
 */
export async function GET(request, context) {
  const { student, error: authError } = await requireStudent();

  if (authError) return authError;

  const params = await context.params;
  const [campId, stationId] = await Promise.all([
    resolveStudentCampId(params.id),
    resolveStudentStationId(params.stationId),
  ]);
  const studentId = Number(student.students_id);

  if (
    !Number.isInteger(campId) ||
    campId <= 0 ||
    !Number.isInteger(stationId) ||
    stationId <= 0
  ) {
    return NextResponse.json(
      { error: "ข้อมูลค่ายหรือฐานไม่ถูกต้อง" },
      { status: 400 },
    );
  }

  try {
    const enrollment = await prisma.student_enrollment.findFirst({
      where: {
        student_students_id: studentId,
        camp_camp_id: campId,
        enrolled_at: { not: null },
        student: activeCampStudentWhere(campId),
      },
      select: { student_enrollment_id: true },
    });

    if (!enrollment) {
      return NextResponse.json(
        { error: "กรุณาลงทะเบียนเข้าร่วมค่ายก่อนเข้าถึงภารกิจ" },
        { status: 403 },
      );
    }

    const [camp, station] = await Promise.all([
      prisma.camp.findFirst({
        where: { camp_id: campId, deletedAt: null },
        select: {
          camp_id: true,
          public_id: true,
          name: true,
          start_date: true,
        },
      }),
      prisma.station.findFirst({
        where: {
          station_id: stationId,
          camp_camp_id: campId,
          deletedAt: null,
        },
        select: {
          station_id: true,
          public_id: true,
          name: true,
          description: true,
          mission: {
            where: { deletedAt: null },
            select: {
              mission_id: true,
              title: true,
              description: true,
              type: true,
              mission_question: {
                select: {
                  question_id: true,
                  question_text: true,
                  question_type: true,
                  choices: {
                    select: {
                      choice_id: true,
                      choice_text: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    if (!camp || !station) {
      return NextResponse.json({ error: "ไม่พบฐานกิจกรรม" }, { status: 404 });
    }

    if (isBangkokDateBefore(new Date(), camp.start_date)) {
      return NextResponse.json(
        { error: "ค่ายยังไม่เริ่ม ไม่สามารถทำภารกิจได้" },
        { status: 403 },
      );
    }

    const stationMissionIds = station.mission.map(
      (mission) => mission.mission_id,
    );
    const [allStatuses, stationResults, preTestIds] = await Promise.all([
      prisma.mission_result.findMany({
        where: { student_enrollment_id: enrollment.student_enrollment_id },
        select: { mission_mission_id: true, status: true },
      }),
      stationMissionIds.length
        ? prisma.mission_result.findMany({
            where: {
              student_enrollment_id: enrollment.student_enrollment_id,
              mission_mission_id: { in: stationMissionIds },
            },
            select: {
              mission_result_id: true,
              mission_mission_id: true,
              status: true,
              mission_answer: {
                select: {
                  mission_question_question_id: true,
                  answer_text: { select: { answer_text: true } },
                  answer_mcq: { select: { question_text: true } },
                  answer_photo: { select: { img_url: true } },
                },
              },
            },
          })
        : Promise.resolve([]),
      prisma.mission.findMany({
        where: {
          deletedAt: null,
          type: "PRE_TEST",
          station: { camp_camp_id: campId, deletedAt: null },
        },
        select: { mission_id: true },
      }),
    ]);

    const statusByMission = new Map(
      allStatuses.map((result) => [result.mission_mission_id, result.status]),
    );
    const preTestMissionIds = preTestIds.map((mission) => mission.mission_id);
    const preTestCompleted = preTestMissionIds.every(
      (missionId) => statusByMission.get(missionId) === "completed",
    );
    const stationResultByMission = new Map(
      stationResults.map((result) => [result.mission_mission_id, result]),
    );
    // Keep all mission statuses for cross-station Pre-test locking, while
    // attaching answers only to missions in the opened station.
    const missionResults = allStatuses.map(
      (result) =>
        stationResultByMission.get(result.mission_mission_id) || result,
    );

    return NextResponse.json(
      {
        camp: {
          id: camp.camp_id,
          publicId: camp.public_id,
          title: camp.name,
          rawStartDate: camp.start_date,
          isRegistered: true,
        },
        station: {
          ...station,
          publicId: station.public_id,
          mission: station.mission.map((mission) => ({
            ...mission,
            status: statusByMission.get(mission.mission_id) ?? null,
          })),
        },
        missionResults,
        preTestMissionIds,
        preTestCompleted,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error("[student station detail] error:", error);

    return NextResponse.json(
      { _error: "Failed to fetch station" },
      { status: 500 },
    );
  }
}
