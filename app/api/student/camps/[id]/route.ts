// @ts-nocheck

import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireStudent } from "@/lib/auth";
import { getBangkokDateKey, isBangkokDateBefore } from "@/lib/bangkok-date";
import { getCertificateEligibility } from "@/lib/certificate-eligibility";
import { activeCampEnrollmentWhere } from "@/lib/active-camp-student";

/**
 * Camp detail endpoint.
 *
 * This returns camp metadata, schedule and mission progress summaries only.
 * Questions, choices and answer payloads belong to the station endpoint.
 */
export async function GET(request, context) {
  const { student, error: authError } = await requireStudent();

  if (authError) return authError;

  const params = await context.params;
  const campId = Number(params.id);
  const studentId = Number(student.students_id);

  if (!Number.isInteger(campId) || campId <= 0) {
    return NextResponse.json(
      { error: "ข้อมูลค่ายไม่ถูกต้อง" },
      { status: 400 },
    );
  }

  try {
    // This count is independent from the detail lookup. Start it immediately so
    // it does not extend the critical path before the hero can stream to the
    // student page.
    const totalEnrolledPromise = prisma.student_enrollment.count({
      where: {
        ...activeCampEnrollmentWhere(campId),
        enrolled_at: { not: null },
      },
    });
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
        name: true,
        description: true,
        location: true,
        destination_name: true,
        destination_address: true,
        destination_latitude: true,
        destination_longitude: true,
        start_date: true,
        end_date: true,
        start_shirt_date: true,
        end_shirt_date: true,
        start_regis_date: true,
        end_regis_date: true,
        has_shirt: true,
        has_transport: true,
        img_camp_url: true,
        img_shirt_url: true,
        img_certificate_url: true,
        cert_mission_completion_percent: true,
        cert_require_survey: true,
        survey: { select: { survey_id: true } },
        student_enrollment: {
          where: { student_students_id: studentId },
          select: {
            student_enrollment_id: true,
            enrolled_at: true,
            shirt_size: true,
          },
          take: 1,
        },
        camp_classroom: {
          select: {
            classroom: {
              select: {
                academic_years_years_id: true,
                _count: { select: { classroom_students: true } },
              },
            },
          },
        },
        camp_daily_schedule: {
          select: {
            daily_schedule_id: true,
            day: true,
            time_slots: {
              select: {
                time_slot_id: true,
                startTime: true,
                endTime: true,
                activity: true,
              },
            },
          },
          orderBy: { day: "asc" },
        },
        station: {
          where: { deletedAt: null },
          select: {
            station_id: true,
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

    const enrollment = camp.student_enrollment[0];
    const [totalEnrolled, results, surveyResponseCount, certificateCount] =
      await Promise.all([
        totalEnrolledPromise,
        enrollment
          ? prisma.mission_result.findMany({
              where: {
                student_enrollment_id: enrollment.student_enrollment_id,
              },
              select: {
                mission_mission_id: true,
                status: true,
              },
            })
          : Promise.resolve([]),
        enrollment
          ? prisma.survey_response.count({
              where: {
                student_enrollment_id: enrollment.student_enrollment_id,
              },
            })
          : Promise.resolve(0),
        enrollment
          ? prisma.certificate.count({
              where: {
                student_enrollment_id: enrollment.student_enrollment_id,
              },
            })
          : Promise.resolve(0),
      ]);

    const resultByMission = new Map(
      results.map((result) => [result.mission_mission_id, result.status]),
    );
    const stations = camp.station.map((station) => ({
      station_id: station.station_id,
      name: station.name,
      description: station.description,
      mission: station.mission.map((mission) => ({
        mission_id: mission.mission_id,
        title: mission.title,
        description: mission.description,
        type: mission.type,
        status: resultByMission.get(mission.mission_id) ?? null,
      })),
    }));
    const totalMissions = stations.reduce(
      (total, station) => total + station.mission.length,
      0,
    );
    const activeMissionIds = new Set(
      stations.flatMap((station) =>
        station.mission.map((mission) => mission.mission_id),
      ),
    );
    const certificateEligibility = getCertificateEligibility({
      totalMissions,
      completedMissionIds: results
        .filter((result) => result.status === "completed")
        .map((result) => result.mission_mission_id)
        .filter((missionId) => activeMissionIds.has(missionId)),
      missionPercent: camp.cert_mission_completion_percent,
      requireSurvey: camp.cert_require_survey,
      hasSurveyResponse: surveyResponseCount > 0,
      hasIssuedCertificate: certificateCount > 0,
    });

    const totalCapacity = camp.camp_classroom.reduce(
      (sum, item) => sum + (item.classroom?._count?.classroom_students || 0),
      0,
    );

    return NextResponse.json(
      {
        id: camp.camp_id,
        title: camp.name,
        description: camp.description,
        location: camp.location,
        destination:
          camp.destination_latitude != null &&
          camp.destination_longitude != null
            ? {
                name: camp.destination_name || camp.location,
                address: camp.destination_address,
                latitude: camp.destination_latitude,
                longitude: camp.destination_longitude,
              }
            : null,
        startDate: getBangkokDateKey(camp.start_date),
        endDate: getBangkokDateKey(camp.end_date),
        status: enrollment?.enrolled_at ? "Registered" : "Available",
        isRegistered: !!enrollment?.enrolled_at,
        hasEnrollment: !!enrollment,
        hasSurvey: camp.survey.length > 0,
        isEnded: isBangkokDateBefore(camp.end_date),
        shirtSize: enrollment?.shirt_size || null,
        hasShirt: camp.has_shirt,
        hasTransport: camp.has_transport,
        startShirtDate: camp.start_shirt_date,
        endShirtDate: camp.end_shirt_date,
        rawStartDate: camp.start_date,
        rawEndDate: camp.end_date,
        missionResults: results,
        station: stations,
        img_camp_url: camp.img_camp_url,
        img_shirt_url: camp.img_shirt_url,
        img_certificate_url: camp.img_certificate_url,
        certificateRequirements: {
          missionCompletionPercent: camp.cert_mission_completion_percent,
          totalMissions,
          requiresSurvey: camp.cert_require_survey,
          hasSurvey: camp.survey.length > 0,
          surveyCompleted: surveyResponseCount > 0,
          hasIssuedCertificate: certificateCount > 0,
          ...certificateEligibility,
        },
        enrolledAt: enrollment?.enrolled_at ?? null,
        startRegisDate: camp.start_regis_date,
        endRegisDate: camp.end_regis_date,
        totalCapacity,
        totalEnrolled,
        academicYear:
          camp.camp_classroom[0]?.classroom?.academic_years_years_id ?? null,
        camp_daily_schedule: camp.camp_daily_schedule.map((schedule) => ({
          daily_schedule_id: schedule.daily_schedule_id,
          day: schedule.day,
          time_slots: (schedule.time_slots || []).map((slot) => ({
            time_slot_id: slot.time_slot_id,
            startTime: slot.startTime,
            endTime: slot.endTime,
            activity: slot.activity,
          })),
        })),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error("[student camp detail] error:", error);

    return NextResponse.json(
      { _error: "Failed to fetch camp" },
      { status: 500 },
    );
  }
}
