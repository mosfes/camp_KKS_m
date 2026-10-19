// @ts-nocheck
import { NextResponse } from "next/server";

import { requireTeacher } from "@/lib/auth";
import { getBangkokDateAsUtcMidnight } from "@/lib/bangkok-date";
import { prisma } from "@/lib/db";

const recommendationPattern =
  /(จัด.*อีก|จัดต่อ|อยากให้.*อีก|ควร.*จัด|แนะนำ.*ค่าย|recommend)/i;
const emptyFeedback = new Set([
  "ไม่มี",
  "ไม่มีครับ",
  "ไม่มีค่ะ",
  "ไม่มีคะ",
  "ไม่มีอะไร",
  "ไม่มีอะไรเพิ่มเติม",
  "ไม่มีเพิ่มเติม",
  "ไม่มีข้อเสนอแนะ",
  "ไม่มีความคิดเห็น",
  "ไม่มีความคิดเห็นเพิ่มเติม",
  "none",
  "no",
  "n/a",
]);

function isMeaningfulFeedback(value) {
  const normalized = value
    .trim()
    .replace(/\s+/g, "")
    .replace(/[.!。]+$/g, "")
    .toLowerCase();

  return (
    normalized.length > 0 &&
    !/^[-–—_.]+$/.test(normalized) &&
    !emptyFeedback.has(normalized)
  );
}

function round(value, digits = 0) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;

  return Math.round(value * factor) / factor;
}

function average(values) {
  const valid = values.filter(Number.isFinite);

  return valid.length
    ? valid.reduce((sum, value) => sum + value, 0) / valid.length
    : null;
}

function uniqueSamples(values, limit = 3) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
    .map((value) => (value.length > 160 ? `${value.slice(0, 157)}...` : value))
    .slice(0, limit);
}

function getRecommendation(score, sufficient) {
  if (!sufficient || score === null) {
    return { key: "INSUFFICIENT", label: "ข้อมูลยังไม่เพียงพอ" };
  }
  if (score >= 80) return { key: "CONTINUE", label: "ควรจัดต่อ" };
  if (score >= 60) {
    return { key: "IMPROVE", label: "จัดต่อ แต่ควรปรับปรุง" };
  }

  return { key: "REVIEW", label: "ควรทบทวนก่อนจัดต่อ" };
}

function buildCampInsight(camp) {
  const survey = camp.survey?.[0];
  const responseCount = survey?.survey_response?.length || 0;
  const enrollmentCount = camp.student_enrollment.length;
  const responseRate =
    enrollmentCount > 0 ? (responseCount / enrollmentCount) * 100 : 0;
  const scaleQuestions = (survey?.survey_question || []).filter(
    (question) => question.question_type === "scale",
  );
  const normalizedQuestionScores = scaleQuestions.map((question) => {
    const values = question.survey_answer
      .map((answer) => answer.scale_value)
      .filter(Number.isFinite);
    const max = question.scale_max || 5;
    const score = average(values);

    return {
      text: question.question_text,
      score: score === null ? null : (score / max) * 100,
      count: values.length,
    };
  });
  const recommendationScores = normalizedQuestionScores
    .filter((question) => recommendationPattern.test(question.text))
    .map((question) => question.score);
  const surveyScore = average(
    normalizedQuestionScores.map((question) => question.score),
  );
  const recommendationScore = average(recommendationScores);
  const missions = camp.station.flatMap((station) => station.mission);
  const completedMissionKeys = new Set(
    missions.flatMap((mission) =>
      mission.mission_result
        .filter((result) => result.status === "completed")
        .map(
          (result) => `${mission.mission_id}:${result.student_enrollment_id}`,
        ),
    ),
  );
  const missionOpportunities = enrollmentCount * missions.length;
  const missionCompletion =
    missionOpportunities > 0
      ? (completedMissionKeys.size / missionOpportunities) * 100
      : null;
  const weightedMetrics = [
    { value: surveyScore, weight: 70 },
    { value: missionCompletion, weight: 30 },
  ].filter((metric) => metric.value !== null);
  const availableWeight = weightedMetrics.reduce(
    (sum, metric) => sum + metric.weight,
    0,
  );
  const healthScore = availableWeight
    ? weightedMetrics.reduce(
        (sum, metric) => sum + metric.value * metric.weight,
        0,
      ) / availableWeight
    : null;
  const dataSufficient =
    responseCount >= 3 && responseRate >= 30 && surveyScore !== null;
  const textAnswers = (survey?.survey_question || [])
    .filter((question) => question.question_type === "text")
    .flatMap((question) =>
      question.survey_answer
        .map((answer) => answer.text_answer)
        .filter((answer) => typeof answer === "string" && answer.trim()),
    );
  const comments = uniqueSamples(textAnswers.filter(isMeaningfulFeedback), 6);

  return {
    campId: camp.camp_id,
    name: camp.name,
    startDate: camp.start_date,
    endDate: camp.end_date,
    healthScore: round(healthScore),
    surveyScore: round(surveyScore),
    missionCompletion: round(missionCompletion),
    recommendationScore: round(recommendationScore),
    responseRate: round(responseRate),
    responseCount,
    dataSufficient,
    recommendation: getRecommendation(round(healthScore), dataSufficient),
    feedback: { comments },
  };
}

export async function GET(request) {
  const { teacher, error: authError } = await requireTeacher();

  if (authError) return authError;
  if (String(teacher.role).toUpperCase() !== "ADMIN") {
    return NextResponse.json(
      { error: "เฉพาะผู้ดูแลระบบเท่านั้น" },
      { status: 403 },
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const yearId = searchParams.get("yearId");

    if (!yearId) {
      return NextResponse.json({ error: "Missing yearId" }, { status: 400 });
    }

    const year = parseInt(yearId, 10);

    // 1. Total Teachers (Active)
    const totalTeachers = await prisma.teachers.count({
      where: { deletedAt: null },
    });

    // 2. Total Classrooms (Active & specific year)
    const totalClassrooms = await prisma.classrooms.count({
      where: {
        deletedAt: null,
        academic_years_years_id: year,
      },
    });

    // 3. Total Students (Active)
    const totalStudents = await prisma.students.count({
      where: { deletedAt: null },
    });

    // 4. Total Camps (Active)
    const totalCamps = await prisma.camp.count({
      where: { deletedAt: null },
    });

    // 5. Camp operations overview (all active camps)
    const today = getBangkokDateAsUtcMidnight();
    const [
      activeCamps,
      upcomingCamps,
      completedCamps,
      totalEnrollments,
      campsWithoutStations,
      focusCamps,
    ] = await Promise.all([
      prisma.camp.count({
        where: {
          deletedAt: null,
          start_date: { lte: today },
          end_date: { gte: today },
        },
      }),
      prisma.camp.count({
        where: { deletedAt: null, start_date: { gt: today } },
      }),
      prisma.camp.count({
        where: { deletedAt: null, end_date: { lt: today } },
      }),
      prisma.student_enrollment.count({
        where: { enrolled_at: { not: null }, camp: { deletedAt: null } },
      }),
      prisma.camp.count({
        where: { deletedAt: null, station: { none: {} } },
      }),
      prisma.camp.findMany({
        where: { deletedAt: null, start_date: { gt: today } },
        orderBy: { start_date: "asc" },
        take: 3,
        select: {
          camp_id: true,
          name: true,
          start_date: true,
          end_date: true,
          location: true,
          _count: {
            select: {
              student_enrollment: { where: { enrolled_at: { not: null } } },
              station: true,
            },
          },
        },
      }),
    ]);

    // 6. Students by Grade Level (for specific year)
    const activeClassrooms = await prisma.classrooms.findMany({
      where: {
        deletedAt: null,
        academic_years_years_id: year,
      },
      include: {
        classroom_students: true,
      },
    });

    const studentDataObj = {
      "ม.1": 0,
      "ม.2": 0,
      "ม.3": 0,
      "ม.4": 0,
      "ม.5": 0,
      "ม.6": 0,
    };

    activeClassrooms.forEach((c) => {
      let gradeName = "";

      if (c.grade === "Level_1") gradeName = "ม.1";
      else if (c.grade === "Level_2") gradeName = "ม.2";
      else if (c.grade === "Level_3") gradeName = "ม.3";
      else if (c.grade === "Level_4") gradeName = "ม.4";
      else if (c.grade === "Level_5") gradeName = "ม.5";
      else if (c.grade === "Level_6") gradeName = "ม.6";

      if (gradeName) {
        studentDataObj[gradeName] += c.classroom_students.length;
      }
    });

    const studentData = Object.keys(studentDataObj).map((key) => ({
      name: key,
      students: studentDataObj[key],
    }));

    // 7. Class Types (for specific year)
    const classroomsWithType = await prisma.classrooms.findMany({
      where: {
        deletedAt: null,
        academic_years_years_id: year,
      },
      include: {
        classroom_types: true,
      },
    });

    const classTypesObj = {};

    classroomsWithType.forEach((c) => {
      if (c.classroom_types && c.classroom_types.name) {
        const typeName = c.classroom_types.name;

        classTypesObj[typeName] = (classTypesObj[typeName] || 0) + 1;
      }
    });

    const typeColors = [
      "#8e6ba8",
      "#e07a5f",
      "#5a9da0",
      "#f4a261",
      "#2a9d8f",
      "#e76f51",
    ];
    let colorIndex = 0;
    const classTypesData = Object.keys(classTypesObj).map((key) => {
      const color = typeColors[colorIndex % typeColors.length];

      colorIndex++;

      return {
        name: key,
        value: classTypesObj[key],
        color,
      };
    });

    // 8. Teacher Roles
    // get all active teachers and their classrooms for the year to see if they are homeroom teachers
    const activeTeachers = await prisma.teachers.findMany({
      where: { deletedAt: null },
      include: {
        classrooms: {
          where: {
            deletedAt: null,
            academic_years_years_id: year,
          },
        },
      },
    });

    let adminCount = 0;
    let homeroomCount = 0;
    let normalTeacherCount = 0;

    activeTeachers.forEach((t) => {
      if (t.role === "ADMIN") {
        adminCount++;
      } else {
        if (t.classrooms && t.classrooms.length > 0) {
          homeroomCount++;
        } else {
          normalTeacherCount++;
        }
      }
    });

    const teacherRolesData = [
      { name: "ครูทั่วไป", value: normalTeacherCount, color: "#5d7c6f" },
      { name: "ครูประจำชั้น", value: homeroomCount, color: "#4a90e2" },
      { name: "ผู้ดูแลระบบ", value: adminCount, color: "#8e6ba8" },
    ].filter((r) => r.value > 0);

    const yearStart = new Date(Date.UTC(year, 0, 1));
    const yearEnd = new Date(Date.UTC(year + 1, 0, 1));
    const qualityCamps = await prisma.camp.findMany({
      where: {
        deletedAt: null,
        start_date: { gte: yearStart, lt: yearEnd },
      },
      orderBy: { start_date: "desc" },
      select: {
        camp_id: true,
        name: true,
        start_date: true,
        end_date: true,
        student_enrollment: {
          where: { enrolled_at: { not: null } },
          select: { student_enrollment_id: true },
        },
        station: {
          where: { deletedAt: null },
          select: {
            mission: {
              where: { deletedAt: null },
              select: {
                mission_id: true,
                mission_result: {
                  select: {
                    status: true,
                    student_enrollment_id: true,
                  },
                },
              },
            },
          },
        },
        survey: {
          select: {
            survey_response: { select: { response_id: true } },
            survey_question: {
              select: {
                question_text: true,
                question_type: true,
                scale_max: true,
                survey_answer: {
                  select: { scale_value: true, text_answer: true },
                },
              },
            },
          },
        },
      },
    });
    const campInsights = qualityCamps.map(buildCampInsight).sort((a, b) => {
      if (a.healthScore === null) return 1;
      if (b.healthScore === null) return -1;

      return b.healthScore - a.healthScore;
    });
    const sufficientInsights = campInsights.filter(
      (camp) => camp.dataSufficient,
    );
    const qualityOverview = {
      evaluatedCamps: sufficientInsights.length,
      averageHealth: round(
        average(sufficientInsights.map((camp) => camp.healthScore)),
      ),
      averageSurveyScore: round(
        average(sufficientInsights.map((camp) => camp.surveyScore)),
      ),
      averageMissionCompletion: round(
        average(sufficientInsights.map((camp) => camp.missionCompletion)),
      ),
      averageResponseRate: round(
        average(sufficientInsights.map((camp) => camp.responseRate)),
      ),
      continueCount: sufficientInsights.filter(
        (camp) => camp.recommendation.key === "CONTINUE",
      ).length,
      improveCount: sufficientInsights.filter(
        (camp) => camp.recommendation.key === "IMPROVE",
      ).length,
      reviewCount: sufficientInsights.filter(
        (camp) => camp.recommendation.key === "REVIEW",
      ).length,
      insufficientCount: campInsights.filter((camp) => !camp.dataSufficient)
        .length,
    };

    return NextResponse.json({
      totalTeachers,
      totalClassrooms,
      totalStudents,
      totalCamps,
      campOverview: {
        activeCamps,
        upcomingCamps,
        completedCamps,
        totalEnrollments,
        campsWithoutStations,
        focusCamps,
      },
      studentData,
      classTypesData,
      teacherRolesData,
      qualityOverview,
      campInsights,
    });
  } catch {
    //     console.error("Overview API Error:", error);

    return NextResponse.json(
      { _error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
