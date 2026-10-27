// @ts-nocheck
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireTeacher } from "@/lib/auth";
import { activeCampEnrollmentWhere } from "@/lib/active-camp-student";
import { canViewCampTracking } from "@/lib/camp-tracking-auth";
import { getCertificateEligibility } from "@/lib/certificate-eligibility";

export async function GET(request, context) {
  const { teacher, error: authError } = await requireTeacher();

  if (authError) return authError;

  try {
    const params = await context.params;
    const campId = Number(params.id);

    if (!(await canViewCampTracking(campId, teacher))) {
      return NextResponse.json(
        { error: "ไม่มีสิทธิ์เข้าถึงค่ายนี้" },
        { status: 403 },
      );
    }

    const camp = await prisma.camp.findUnique({
      where: { camp_id: campId },
      select: {
        img_certificate_url: true,
        cert_mission_completion_percent: true,
        cert_require_survey: true,
      },
    });
    const certificateEnabled = Boolean(camp?.img_certificate_url);
    const missionPercent = camp?.cert_mission_completion_percent ?? 100;
    const requireSurvey = Boolean(camp?.cert_require_survey);

    // 1. Get total missions for the camp
    const missions = await prisma.mission.findMany({
      where: {
        deletedAt: null,
        station: {
          camp_camp_id: campId,
          deletedAt: null,
        },
      },
      select: { mission_id: true },
    });
    const totalMissions = missions.length;

    // 2. Fetch all students in camp_classrooms
    const campClassrooms = await prisma.camp_classroom.findMany({
      where: { camp_camp_id: campId },
      include: {
        classroom: {
          include: {
            classroom_students: {
              where: { student: { deletedAt: null } },
              include: {
                student: {
                  select: {
                    students_id: true,
                    prefix_name: true,
                    firstname: true,
                    lastname: true,
                    nickname: true,
                    profile_image_url: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Deduplicate students
    const studentMap = new Map();

    for (const cc of campClassrooms) {
      for (const cs of cc.classroom.classroom_students) {
        const s = cs.student;

        if (!studentMap.has(s.students_id)) {
          studentMap.set(s.students_id, {
            studentId: s.students_id,
            name: `${s.prefix_name ?? ""}${s.firstname} ${s.lastname}`,
            nickname: s.nickname,
            profileImageUrl: s.profile_image_url,
            initials: `${s.firstname.charAt(0)}${s.lastname.charAt(0)}`,
          });
        }
      }
    }

    // 3. Get enrollments and mission results. Include pre-created enrollments
    // too, because bulk certificate generation can issue certificates to them.
    const enrollments = await prisma.student_enrollment.findMany({
      where: {
        ...activeCampEnrollmentWhere(campId),
      },
      include: {
        student: {
          select: {
            students_id: true,
            prefix_name: true,
            firstname: true,
            lastname: true,
            nickname: true,
            profile_image_url: true,
          },
        },
        mission_result: {
          // Keep the numerator aligned with `totalMissions`: historical
          // results for missions (or stations) that were soft-deleted must
          // not contribute to a student's current camp progress.
          where: {
            status: "completed",
            mission: {
              deletedAt: null,
              station: {
                camp_camp_id: campId,
                deletedAt: null,
              },
            },
          },
          select: { mission_mission_id: true },
        },
        certificate: {
          select: {
            certificate_id: true,
            certificate_no: true,
            issue_date: true,
          },
          take: 1,
        },
        survey_response: {
          select: { response_id: true },
          take: 1,
        },
      },
    });

    // Direct enrollments may not belong to a classroom attached to the camp.
    // Add them so the certificate totals represent everyone in the camp.
    for (const enrollment of enrollments) {
      const student = enrollment.student;

      if (!studentMap.has(student.students_id)) {
        studentMap.set(student.students_id, {
          studentId: student.students_id,
          name: `${student.prefix_name ?? ""}${student.firstname} ${student.lastname}`,
          nickname: student.nickname,
          profileImageUrl: student.profile_image_url,
          initials: `${student.firstname.charAt(0)}${student.lastname.charAt(0)}`,
        });
      }
    }

    const enrollmentMap = new Map(
      enrollments.map((enr) => [enr.student_students_id, enr]),
    );

    const studentsProgress = [];

    for (const [id, student] of studentMap) {
      const enr = enrollmentMap.get(id);
      // A mission can only count once, even if legacy data has duplicate
      // completion records for the same mission.
      const completedMissions = Math.min(
        enr
          ? new Set(
              enr.mission_result.map((result) => result.mission_mission_id),
            ).size
          : 0,
        totalMissions,
      );
      const progressPercentage =
        totalMissions > 0
          ? Math.min(100, Math.round((completedMissions / totalMissions) * 100))
          : 0;

      const hasCertificate = enr ? enr.certificate.length > 0 : false;
      // Same rule the certificate endpoint applies, so the tracking view
      // explains why a student with finished missions has no certificate yet.
      const eligibility = getCertificateEligibility({
        totalMissions,
        completedMissionIds: enr
          ? enr.mission_result.map((result) => result.mission_mission_id)
          : [],
        missionPercent,
        requireSurvey,
        hasSurveyResponse: enr ? enr.survey_response.length > 0 : false,
        hasIssuedCertificate: hasCertificate,
      });

      studentsProgress.push({
        ...student,
        isEnrolled: enr?.enrolled_at != null,
        completedMissions,
        totalMissions,
        progressPercentage,
        missionRequirementMet: eligibility.missionRequirementMet,
        hasSurveyResponse: enr ? enr.survey_response.length > 0 : false,
        hasCertificate,
        certificateNo: enr?.certificate[0]?.certificate_no ?? null,
        certificateIssuedAt:
          enr?.certificate[0]?.issue_date?.toISOString() ?? null,
      });
    }

    // Sort by progress descending, then by name
    studentsProgress.sort((a, b) => {
      if (b.progressPercentage !== a.progressPercentage) {
        return b.progressPercentage - a.progressPercentage;
      }

      return a.name.localeCompare(b.name, "th");
    });

    const issuedCertificates = studentsProgress.filter(
      (student) => student.hasCertificate,
    ).length;
    const pendingCertificates = studentsProgress.filter(
      (student) => student.isEnrolled && !student.hasCertificate,
    ).length;

    return NextResponse.json({
      campId,
      totalMissions,
      certificateEnabled,
      requireSurvey,
      summary: {
        totalStudents: studentsProgress.length,
        issuedCertificates,
        pendingCertificates,
      },
      students: studentsProgress,
    });
  } catch {
    //     console.error("Tracking API Error:", error);

    return NextResponse.json(
      { _error: "เกิดข้อผิดพลาดในการดึงข้อมูล" },
      { status: 500 },
    );
  }
}
