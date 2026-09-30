import { NextResponse } from "next/server";
import { z } from "zod";

import { requireTeacher } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  activeCampEnrollmentWhere,
  activeCampStudentWhere,
} from "@/lib/active-camp-student";
import {
  normalizeProjectSummaryStandards,
  projectSummaryStandardsText,
} from "@/lib/project-summary-standards";

const textList = z.array(z.string().trim().max(5000)).max(50);

const resultRow = z.object({
  indicator: z.string().trim().max(5000),
  target: z.string().trim().max(5000),
  result: z.string().trim().max(5000),
  status: z.string().trim().max(100),
  valueType: z.enum(["TEXT", "PERCENT"]).optional().default("TEXT"),
  locked: z.boolean().optional().default(false),
});

const standardSubItemSchema = z.object({
  code: z.string().trim().max(100),
  title: z.string().trim().max(5000),
  relatedItems: z.string().trim().max(1000).optional().default(""),
  achieved: z.boolean().optional().default(false),
});

const standardAlignmentSchema = z.object({
  title: z.string().trim().max(5000),
  relatedItems: z.string().trim().max(1000).optional().default(""),
  achieved: z.boolean().optional().default(false),
  subItems: z.array(standardSubItemSchema).max(50),
});

const evaluationRow = z.object({
  topic: z.string().trim().max(5000),
  average: z.coerce.number().min(0).max(5).nullable().optional(),
  sd: z.coerce.number().min(0).max(5).nullable().optional(),
  interpretation: z.string().trim().max(500),
  locked: z.boolean().optional().default(false),
});

const assessmentSchema = z
  .object({
    quantitativeStatus: z.string().trim().max(100),
    quantitativePercent: z.coerce.number().min(0).max(1000),
    qualitativeStatus: z.string().trim().max(100),
    qualitativePercent: z.coerce.number().min(0).max(1000),
    personnel: z.string().trim().max(100),
    cooperation: z.string().trim().max(100),
    projectAppropriateness: z.string().trim().max(100),
    location: z.string().trim().max(100),
    schedule: z.string().trim().max(100),
    budget: z.string().trim().max(100),
  })
  .passthrough();

const signatorySchema = z
  .object({
    role: z.string().trim().min(1).max(255),
    personnelId: z.coerce.number().int().positive().optional(),
    name: z.string().trim().max(500).optional(),
  })
  .passthrough();

const summarySchema = z.object({
  fiscal_year: z.coerce.number().int().min(2500).max(3000),
  project_name: z.string().trim().min(1).max(500),
  project_code: z.string().trim().max(100).optional().nullable(),
  activity_name: z.string().trim().max(500).optional().nullable(),
  activity_order: z.string().trim().max(100).optional().nullable(),
  project_nature: z.enum([
    "NEW",
    "CONTINUING",
    "IN_EVALUATION_PLAN",
    "OUTSIDE_ACTION_PLAN",
  ]),
  project_type: z.enum(["NEW", "CONTINUING"]),
  plan_alignment: z.enum(["IN_EVALUATION_PLAN", "OUTSIDE_ACTION_PLAN"]),
  standards: z.string().trim().max(10000).optional().nullable(),
  standard_alignments: z.array(standardAlignmentSchema).max(20),
  strategy: z.string().trim().max(10000).optional().nullable(),
  responsible_people: z.string().trim().max(5000).optional().nullable(),
  department: z.string().trim().max(500).optional().nullable(),
  objectives: textList,
  execution_status: z.string().trim().max(30),
  duration_text: z.string().trim().max(500).optional().nullable(),
  location_text: z.string().trim().max(500).optional().nullable(),
  budget_received: z.coerce.number().min(0).max(100000000),
  budget_spent: z.coerce.number().min(0).max(100000000),
  budget_source: z.string().trim().max(100).optional().nullable(),
  quantitative_results: z.array(resultRow).max(50),
  qualitative_results: z.array(resultRow).max(50),
  success_indicators: z.array(resultRow).max(100),
  evaluation_results: z.array(evaluationRow).max(50),
  evaluation_summary: z.string().trim().max(50000).optional().nullable(),
  overall_average: z.coerce.number().min(0).max(5).nullable().optional(),
  overall_sd: z.coerce.number().min(0).max(5).nullable().optional(),
  top_strengths: textList,
  suggestions: textList,
  operation_assessment: assessmentSchema,
  problems: z.string().trim().max(50000).optional().nullable(),
  recommendations: z.string().trim().max(50000).optional().nullable(),
  continuation_reason: z.string().trim().max(50000).optional().nullable(),
  signatories: z.array(signatorySchema).max(12),
  status: z.enum(["DRAFT", "FINALIZED"]).default("DRAFT"),
});

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function isMeaningfulText(value: unknown) {
  return !/^[-–—\s]*$/.test(clean(value));
}

function cleanSuggestionText(value: unknown) {
  return clean(value)
    .split("\n")
    .map(clean)
    .filter(isMeaningfulText)
    .join("\n");
}

function asArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function attendanceIndicator(source: any) {
  const percentage = Number(source?.attendance?.percentage || 0);
  const hasAttendance = Number(source?.attendance?.enrolled || 0) > 0;

  return {
    indicator: "ร้อยละของผู้ลงทะเบียนที่เข้าร่วมโครงการ",
    target: "100",
    result: percentage.toFixed(2).replace(/\.00$/, ""),
    status: hasAttendance
      ? percentage >= 100
        ? "บรรลุเป้าหมาย"
        : "ต่ำกว่าเป้าหมาย"
      : "ยังไม่ประเมิน",
    valueType: "PERCENT",
    locked: true,
  };
}

function successIndicators(value: unknown, source: any) {
  const rows = asArray(value);
  const existingAttendance = rows.find(
    (row, index) =>
      (index === 0 && row?.locked) ||
      clean(row?.indicator) === "ร้อยละของผู้ลงทะเบียนที่เข้าร่วมโครงการ",
  );
  const remaining = rows.filter((row, index) => {
    if (index === 0 && row?.locked) return false;

    return clean(row?.indicator) !== "ร้อยละของผู้ลงทะเบียนที่เข้าร่วมโครงการ";
  });
  const automaticAttendance = attendanceIndicator(source);
  const savedTarget = clean(existingAttendance?.target);
  const savedResult = clean(existingAttendance?.result);
  const target = savedTarget || automaticAttendance.target;
  const result = savedResult || automaticAttendance.result;
  const numericTarget = Number(target);
  const numericResult = Number(result);
  const status =
    Number.isFinite(numericTarget) && Number.isFinite(numericResult)
      ? numericResult >= numericTarget
        ? "บรรลุเป้าหมาย"
        : "ต่ำกว่าเป้าหมาย"
      : automaticAttendance.status;

  return [
    {
      ...automaticAttendance,
      indicator:
        clean(existingAttendance?.indicator) ||
        "ร้อยละของผู้ลงทะเบียนที่เข้าร่วมโครงการ",
      target,
      result,
      status,
    },
    ...remaining,
  ];
}

function reporterSignatories(value: unknown) {
  const signatories = asArray(value);
  const explicitReporters = signatories.filter((item) =>
    clean(item?.role).includes("ผู้รายงาน"),
  );
  const reportSources = explicitReporters.length
    ? explicitReporters
    : signatories.filter((item) =>
        ["ผู้เสนอ", "ผู้รับผิดชอบ"].some((label) =>
          clean(item?.role).includes(label),
        ),
      );

  return (reportSources.length ? reportSources : signatories.slice(0, 2)).map(
    (item) => ({ ...item, role: "ผู้รายงาน" }),
  );
}

function formatThaiDate(value: Date) {
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  }).format(value);
}

function interpretation(average: number) {
  if (average >= 4.5) return "ดีเยี่ยม";
  if (average >= 3.5) return "ดี";
  if (average >= 2.5) return "ปานกลาง";
  if (average >= 1.5) return "พอใช้";

  return "ควรปรับปรุง";
}

function stats(values: number[]) {
  if (!values.length) return { average: null, sd: null };
  const average =
    values.reduce((total, value) => total + value, 0) / values.length;
  const variance =
    values.length > 1
      ? values.reduce((total, value) => total + (value - average) ** 2, 0) /
        (values.length - 1)
      : 0;

  return {
    average: Number(average.toFixed(2)),
    sd: Number(Math.sqrt(variance).toFixed(3)),
  };
}

async function getAuthorizedCamp(campId: number, teacher: any) {
  const camp = await prisma.camp.findFirst({
    where: { camp_id: campId, deletedAt: null },
    include: {
      created_by: {
        select: { prefix_name: true, firstname: true, lastname: true },
      },
      project_document: true,
      project_summary_document: {
        include: { photos: { orderBy: { sort_order: "asc" } } },
      },
    },
  });

  if (!camp) return { camp: null, status: 404 };
  if (
    teacher.role !== "ADMIN" &&
    camp.created_by_teacher_id !== teacher.teachers_id
  ) {
    return { camp: null, status: 403 };
  }

  return { camp, status: 200 };
}

async function getSourceData(camp: any) {
  const campId = camp.camp_id;
  const [enrolled, sessions, survey] = await Promise.all([
    prisma.student_enrollment.count({
      where: {
        ...activeCampEnrollmentWhere(campId),
        enrolled_at: { not: null },
      },
    }),
    prisma.attendance_teachers.findMany({
      where: { camp_camp_id: campId },
      select: { session_id: true },
    }),
    prisma.survey.findUnique({
      where: { camp_camp_id: campId },
      include: {
        survey_response: {
          where: {
            student_enrollment: {
              student: activeCampStudentWhere(campId),
            },
          },
          select: { response_id: true },
        },
        survey_question: {
          orderBy: { question_id: "asc" },
          include: {
            survey_answer: {
              where: {
                survey_response: {
                  student_enrollment: {
                    student: activeCampStudentWhere(campId),
                  },
                },
              },
              select: { scale_value: true, text_answer: true },
            },
          },
        },
      },
    }),
  ]);

  const checkedRecords = sessions.length
    ? await prisma.attendance_record_student.findMany({
        where: {
          attendance_teacher_session_id: {
            in: sessions.map((s) => s.session_id),
          },
          student: activeCampStudentWhere(campId),
        },
        select: { student_students_id: true },
        distinct: ["student_students_id"],
      })
    : [];

  const scaleValues: number[] = [];
  const evaluationResults: any[] = [];
  const textAnswers: string[] = [];

  for (const question of survey?.survey_question ?? []) {
    const values = question.survey_answer
      .map((answer) => answer.scale_value)
      .filter((value): value is number => Number.isFinite(value));
    if (question.question_type === "text") {
      const texts = question.survey_answer
        .map((answer) => clean(answer.text_answer))
        .filter(isMeaningfulText);

      textAnswers.push(...texts);
    }
    if (question.question_type !== "scale" || !values.length) continue;

    scaleValues.push(...values);
    const questionStats = stats(values);
    evaluationResults.push({
      topic: question.question_text,
      average: questionStats.average,
      sd: questionStats.sd,
      interpretation: interpretation(questionStats.average || 0),
      locked: true,
    });
  }

  const overall = stats(scaleValues);
  const proposal = camp.project_document;
  const creatorName =
    `${camp.created_by.prefix_name || ""}${camp.created_by.firstname} ${camp.created_by.lastname}`.trim();

  return {
    creatorName,
    proposal,
    attendance: {
      enrolled,
      checkedIn: checkedRecords.length,
      percentage: enrolled
        ? Number(((checkedRecords.length / enrolled) * 100).toFixed(2))
        : 0,
    },
    survey: survey
      ? {
          title: survey.title,
          totalResponses: survey.survey_response.length,
          evaluationResults,
          overallAverage: overall.average,
          overallSd: overall.sd,
          textAnswers: Array.from(new Set(textAnswers)),
        }
      : null,
  };
}

function defaultAssessment() {
  return {
    quantitativeStatus: "เท่ากับเป้าหมาย",
    quantitativePercent: 100,
    qualitativeStatus: "เท่ากับเป้าหมาย",
    qualitativePercent: 100,
    personnel: "เหมาะสมดี",
    cooperation: "ได้รับความร่วมมือดีมาก",
    projectAppropriateness: "ดี",
    location: "ดี",
    schedule: "ตามระบุไว้ในแผน",
    budget: "เท่ากับงบประมาณที่ได้รับ",
  };
}

function defaultDocument(camp: any, source: any) {
  const proposal = source.proposal;
  const quantitative = asArray(proposal?.quantitative_targets).map((item) => ({
    indicator: clean(item),
    target: clean(item),
    result: "",
    status: "ยังไม่ประเมิน",
  }));
  const qualitative = asArray(proposal?.qualitative_targets).map((item) => ({
    indicator: clean(item),
    target: clean(item),
    result: "",
    status: "ยังไม่ประเมิน",
  }));
  const surveyEvaluations = source.survey?.evaluationResults || [];
  const proposalEvaluations = asArray(proposal?.evaluations).map((item) => ({
    topic: clean(item.indicator),
    average: null,
    sd: null,
    interpretation: "ยังไม่ประเมิน",
    locked: false,
  }));

  return {
    camp_project_summary_document_id: null,
    fiscal_year:
      proposal?.fiscal_year || new Date(camp.start_date).getFullYear() + 543,
    project_name: proposal?.project_name || camp.name,
    project_code: proposal?.project_code || "",
    activity_name: proposal?.activity_name || camp.name,
    activity_order: proposal?.activity_order || "",
    project_nature: proposal?.project_type === "NEW" ? "NEW" : "CONTINUING",
    project_type: proposal?.project_type === "NEW" ? "NEW" : "CONTINUING",
    plan_alignment: "IN_EVALUATION_PLAN",
    standards: proposal?.standards || "",
    standard_alignments: normalizeProjectSummaryStandards(
      [],
      proposal?.standards,
    ),
    strategy: proposal?.strategy || "",
    responsible_people: proposal?.responsible_people || source.creatorName,
    department: proposal?.department || "",
    objectives: asArray(proposal?.objectives).map(clean).filter(Boolean),
    execution_status: "COMPLETED",
    duration_text:
      proposal?.duration_text ||
      `ระหว่างวันที่ ${formatThaiDate(camp.start_date)} ถึง ${formatThaiDate(camp.end_date)}`,
    location_text: proposal?.location_text || camp.location,
    budget_received: Number(proposal?.budget_total || 0),
    budget_spent: 0,
    budget_source: proposal?.budget_source || "เงินอุดหนุน",
    quantitative_results: quantitative,
    qualitative_results: qualitative,
    success_indicators: successIndicators(
      [...quantitative, ...qualitative],
      source,
    ),
    evaluation_results: surveyEvaluations.length
      ? surveyEvaluations
      : proposalEvaluations,
    evaluation_summary: "",
    overall_average: source.survey?.overallAverage ?? null,
    overall_sd: source.survey?.overallSd ?? null,
    top_strengths: [],
    suggestions: [],
    operation_assessment: defaultAssessment(),
    problems: "",
    recommendations: "",
    continuation_reason: "",
    signatories: reporterSignatories(proposal?.signatories).map((item) => ({
      role: item.role || "",
      personnelId: item.personnelId,
      name: [item.prefixName, item.firstname, item.lastname]
        .filter(Boolean)
        .join(" "),
    })),
    status: "DRAFT",
  };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { teacher, error } = await requireTeacher();
  if (error) return error;

  const { id } = await context.params;
  const campId = Number(id);
  if (!Number.isInteger(campId)) {
    return NextResponse.json({ error: "รหัสค่ายไม่ถูกต้อง" }, { status: 400 });
  }

  const result = await getAuthorizedCamp(campId, teacher);
  if (!result.camp) {
    return NextResponse.json(
      {
        error:
          result.status === 404
            ? "ไม่พบค่าย"
            : "คุณไม่มีสิทธิ์จัดทำเอกสารสรุปของค่ายนี้",
      },
      { status: result.status },
    );
  }

  const sourceData = await getSourceData(result.camp);
  const surveyEvaluations = sourceData.survey?.evaluationResults || [];
  const surveyEvaluationTopics = new Set(
    surveyEvaluations.map((row: any) => clean(row.topic)),
  );
  const document = result.camp.project_summary_document
    ? {
        ...result.camp.project_summary_document,
        objectives: asArray(result.camp.project_summary_document.objectives)
          .length
          ? result.camp.project_summary_document.objectives
          : asArray(sourceData.proposal?.objectives).map(clean).filter(Boolean),
        project_nature:
          result.camp.project_summary_document.project_nature ||
          result.camp.project_summary_document.project_type ||
          "CONTINUING",
        standard_alignments: normalizeProjectSummaryStandards(
          result.camp.project_summary_document.standard_alignments,
          result.camp.project_summary_document.standards,
        ),
        success_indicators: successIndicators(
          result.camp.project_summary_document.success_indicators,
          sourceData,
        ),
        evaluation_results: surveyEvaluations.length
          ? [
              ...surveyEvaluations,
              ...asArray(
                result.camp.project_summary_document.evaluation_results,
              ).filter(
                (row) =>
                  !row.locked && !surveyEvaluationTopics.has(clean(row.topic)),
              ),
            ]
          : result.camp.project_summary_document.evaluation_results,
        overall_average: surveyEvaluations.length
          ? sourceData.survey?.overallAverage
          : result.camp.project_summary_document.overall_average,
        overall_sd: surveyEvaluations.length
          ? sourceData.survey?.overallSd
          : result.camp.project_summary_document.overall_sd,
        suggestions: asArray(result.camp.project_summary_document.suggestions)
          .map(clean)
          .filter(isMeaningfulText),
        recommendations: cleanSuggestionText(
          result.camp.project_summary_document.recommendations,
        ),
        signatories: reporterSignatories(
          result.camp.project_summary_document.signatories,
        ),
      }
    : defaultDocument(result.camp, sourceData);

  return NextResponse.json({
    document,
    sourceData,
    photos: result.camp.project_summary_document?.photos || [],
  });
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { teacher, error } = await requireTeacher();
  if (error) return error;

  const { id } = await context.params;
  const campId = Number(id);
  const result = await getAuthorizedCamp(campId, teacher);
  if (!result.camp) {
    return NextResponse.json(
      { error: "ไม่พบค่ายหรือคุณไม่มีสิทธิ์" },
      { status: result.status },
    );
  }

  const parsed = summarySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message || "ข้อมูลเอกสารสรุปไม่ถูกต้อง",
      },
      { status: 400 },
    );
  }

  const existing = result.camp.project_summary_document;
  if (existing?.status === "FINALIZED" && parsed.data.status === "FINALIZED") {
    return NextResponse.json(
      {
        error:
          "เอกสารฉบับสมบูรณ์ถูกยืนยันแล้ว กรุณาเปลี่ยนสถานะเป็นฉบับร่างก่อนแก้ไข",
      },
      { status: 409 },
    );
  }

  const personnelIds = Array.from(
    new Set(
      parsed.data.signatories
        .map((item) => item.personnelId)
        .filter((value): value is number => Number.isInteger(value)),
    ),
  );
  const people = personnelIds.length
    ? await prisma.document_personnel.findMany({
        where: { document_personnel_id: { in: personnelIds } },
      })
    : [];
  if (people.length !== personnelIds.length) {
    return NextResponse.json(
      { error: "มีรายชื่อผู้ลงนามที่ไม่ถูกต้อง" },
      { status: 400 },
    );
  }

  const peopleMap = new Map(
    people.map((person) => [person.document_personnel_id, person]),
  );
  const signatories = parsed.data.signatories.map((item) => {
    const person = item.personnelId ? peopleMap.get(item.personnelId) : null;
    return {
      role: item.role,
      personnelId: person?.document_personnel_id || item.personnelId || null,
      name:
        [person?.prefix_name, person?.firstname, person?.lastname]
          .filter(Boolean)
          .join(" ") ||
        item.name ||
        "",
    };
  });

  const status = parsed.data.status;
  const documentData: any = { ...parsed.data };

  delete documentData.signatories;
  delete documentData.status;

  const sourceData = await getSourceData(result.camp);
  const surveyEvaluations = sourceData.survey?.evaluationResults || [];

  if (surveyEvaluations.length) {
    const surveyEvaluationTopics = new Set(
      surveyEvaluations.map((row: any) => clean(row.topic)),
    );
    const manualEvaluations = parsed.data.evaluation_results.filter(
      (row) => !row.locked && !surveyEvaluationTopics.has(clean(row.topic)),
    );

    documentData.evaluation_results = [
      ...surveyEvaluations,
      ...manualEvaluations,
    ];
    documentData.overall_average = sourceData.survey?.overallAverage ?? null;
    documentData.overall_sd = sourceData.survey?.overallSd ?? null;
  }

  documentData.project_type =
    documentData.project_nature === "NEW" ? "NEW" : "CONTINUING";
  documentData.plan_alignment =
    documentData.project_nature === "OUTSIDE_ACTION_PLAN"
      ? "OUTSIDE_ACTION_PLAN"
      : "IN_EVALUATION_PLAN";
  documentData.standard_alignments = normalizeProjectSummaryStandards(
    documentData.standard_alignments,
    documentData.standards,
  );
  documentData.standards = projectSummaryStandardsText(
    documentData.standard_alignments,
  );
  documentData.success_indicators = successIndicators(
    documentData.success_indicators,
    sourceData,
  );
  documentData.suggestions = asArray(documentData.suggestions)
    .map(clean)
    .filter(isMeaningfulText);
  documentData.recommendations = cleanSuggestionText(
    documentData.recommendations,
  );
  const now = new Date();
  const prismaDocumentData = {
    ...documentData,
    operation_assessment: documentData.operation_assessment as any,
    signatories: signatories as any,
  } as any;
  const document = await prisma.camp_project_summary_document.upsert({
    where: { camp_camp_id: campId },
    create: {
      camp_camp_id: campId,
      ...prismaDocumentData,
      status,
      finalized_at: status === "FINALIZED" ? now : null,
      source_snapshot_at: now,
    },
    update: {
      ...prismaDocumentData,
      status,
      finalized_at:
        status === "FINALIZED" ? existing?.finalized_at || now : null,
      source_snapshot_at: now,
    },
  });

  return NextResponse.json({ document, photos: existing?.photos || [] });
}
