// @ts-nocheck

import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireStudent } from "@/lib/auth";
import { isBangkokDateBefore } from "@/lib/bangkok-date";
import { resolveStudentCampId } from "@/lib/student-public-route";

/** Mission/station list only. Questions and answer payloads are not included. */
export async function GET(request, context) {
  const { student, error: authError } = await requireStudent();

  if (authError) return authError;

  const params = await context.params;
  const campId = await resolveStudentCampId(params.id);
  const studentId = Number(student.students_id);

  if (!Number.isInteger(campId) || campId <= 0) {
    return NextResponse.json(
      { error: "ข้อมูลค่ายไม่ถูกต้อง" },
      { status: 400 },
    );
  }

  try {
    const camp = await prisma.camp.findFirst({
      where: {
        camp_id: campId,
        deletedAt: null,
        camp_classroom: {
          some: {
            classroom: {
              deletedAt: null,
              classroom_students: {
                some: {
                  student_students_id: studentId,
                  student: { deletedAt: null },
                },
              },
            },
          },
        },
      },
      select: {
        camp_id: true,
        public_id: true,
        name: true,
        start_date: true,
        end_date: true,
        student_enrollment: {
          where: { student_students_id: studentId },
          select: {
            student_enrollment_id: true,
            enrolled_at: true,
          },
          take: 1,
        },
        station: {
          where: { deletedAt: null },
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
              },
            },
          },
        },
      },
    });

    if (!camp) {
      return NextResponse.json({ error: "ไม่พบค่าย" }, { status: 404 });
    }

    if (isBangkokDateBefore(new Date(), camp.start_date)) {
      return NextResponse.json(
        { error: "ค่ายยังไม่เริ่ม ไม่สามารถทำภารกิจได้" },
        { status: 403 },
      );
    }

    const enrollment = camp.student_enrollment[0];
    const results = enrollment
      ? await prisma.mission_result.findMany({
          where: { student_enrollment_id: enrollment.student_enrollment_id },
          select: { mission_mission_id: true, status: true },
        })
      : [];
    const resultByMission = new Map(
      results.map((result) => [result.mission_mission_id, result.status]),
    );

    return NextResponse.json(
      {
        id: camp.camp_id,
        publicId: camp.public_id,
        title: camp.name,
        rawStartDate: camp.start_date,
        rawEndDate: camp.end_date,
        isRegistered: !!enrollment?.enrolled_at,
        isEnded: isBangkokDateBefore(camp.end_date),
        missionResults: results,
        station: camp.station.map((station) => ({
          station_id: station.station_id,
          publicId: station.public_id,
          name: station.name,
          description: station.description,
          mission: station.mission.map((mission) => ({
            mission_id: mission.mission_id,
            title: mission.title,
            description: mission.description,
            type: mission.type,
            status: resultByMission.get(mission.mission_id) ?? null,
          })),
        })),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error("[student missions summary] error:", error);

    return NextResponse.json(
      { _error: "Failed to fetch missions" },
      { status: 500 },
    );
  }
}
