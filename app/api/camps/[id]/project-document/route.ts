import { NextResponse } from "next/server";
import { z } from "zod";

import { requireTeacher } from "@/lib/auth";
import { prisma } from "@/lib/db";

const stringList = z.array(z.string().trim().max(5000)).max(30);

const documentSchema = z.object({
  fiscal_year: z.coerce.number().int().min(2500).max(3000),
  project_name: z.string().trim().min(1).max(500),
  project_code: z.string().trim().max(100).optional().nullable(),
  activity_name: z.string().trim().max(500).optional().nullable(),
  activity_order: z.string().trim().max(100).optional().nullable(),
  project_type: z.enum(["NEW", "CONTINUING"]),
  standards: z.string().trim().max(10000).optional().nullable(),
  strategy: z.string().trim().max(10000).optional().nullable(),
  responsible_people: z.string().trim().max(5000).optional().nullable(),
  department: z.string().trim().max(500).optional().nullable(),
  rationale: z.string().trim().max(50000).optional().nullable(),
  objectives: stringList,
  quantitative_targets: stringList,
  qualitative_targets: stringList,
  procedures: z
    .array(
      z.object({
        step: z.string().trim().max(500),
        method: z.string().trim().max(10000),
        period: z.string().trim().max(500),
        budget: z.coerce.number().min(0).max(100000000),
        responsible: z.string().trim().max(1000),
      }),
    )
    .max(30),
  duration_text: z.string().trim().max(500).optional().nullable(),
  location_text: z.string().trim().max(500).optional().nullable(),
  budget_total: z.coerce.number().min(0).max(100000000),
  budget_source: z.string().trim().max(100).optional().nullable(),
  budget_items: z
    .array(
      z.object({
        description: z.string().trim().max(3000),
        compensation: z.coerce.number().min(0).max(100000000),
        expenses: z.coerce.number().min(0).max(100000000),
        materials: z.coerce.number().min(0).max(100000000),
        responsible: z.string().trim().max(1000),
      }),
    )
    .max(50),
  evaluations: z
    .array(
      z.object({
        indicator: z.string().trim().max(5000),
        method: z.string().trim().max(1000),
        tool: z.string().trim().max(1000),
      }),
    )
    .max(30),
  expected_results: stringList,
  signatories: z
    .array(
      z.object({
        role: z.string().trim().min(1).max(255),
        personnelId: z.coerce.number().int().positive(),
      }),
    )
    .max(12),
  status: z.enum(["DRAFT", "FINALIZED"]),
  creator_name: z.string().optional().nullable(),
});

function formatThaiDate(value: Date) {
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  }).format(value);
}

function campSourceData(camp: any, ownerName: string) {
  return {
    fiscal_year: new Date(camp.start_date).getFullYear() + 543,
    project_name: camp.name,
    activity_name: camp.name,
    responsible_people: ownerName,
    rationale: camp.description || "",
    duration_text: `ระหว่างวันที่ ${formatThaiDate(camp.start_date)} ถึง ${formatThaiDate(camp.end_date)}`,
    location_text: camp.location || "",
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

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { teacher, error } = await requireTeacher();

  if (error) return error;
  const { id } = await context.params;
  const campId = Number(id);

  if (!Number.isInteger(campId))
    return NextResponse.json({ error: "รหัสค่ายไม่ถูกต้อง" }, { status: 400 });

  const result = await getAuthorizedCamp(campId, teacher);

  if (!result.camp) {
    return NextResponse.json(
      {
        error:
          result.status === 404
            ? "ไม่พบค่าย"
            : "คุณไม่มีสิทธิ์จัดทำเอกสารของค่ายนี้",
      },
      { status: result.status },
    );
  }
  const camp = result.camp;
  const ownerName =
    `${camp.created_by.prefix_name || ""}${camp.created_by.firstname} ${camp.created_by.lastname}`.trim();
  const campSource = campSourceData(camp, ownerName);

  if (camp.project_document) {
    return NextResponse.json({
      ...camp.project_document,
      fiscal_year: camp.project_document.fiscal_year || campSource.fiscal_year,
      project_name:
        camp.project_document.project_name || campSource.project_name,
      activity_name:
        camp.project_document.activity_name || campSource.activity_name,
      responsible_people:
        camp.project_document.responsible_people ||
        campSource.responsible_people,
      rationale: camp.project_document.rationale || campSource.rationale,
      duration_text:
        camp.project_document.duration_text || campSource.duration_text,
      location_text:
        camp.project_document.location_text || campSource.location_text,
      creator_name: ownerName,
      camp_source: campSource,
    });
  }

  return NextResponse.json({
    camp_project_document_id: null,
    creator_name: ownerName,
    camp_source: campSource,
    fiscal_year: campSource.fiscal_year,
    project_name: campSource.project_name,
    project_code: "",
    activity_name: campSource.activity_name,
    activity_order: "",
    project_type: "CONTINUING",
    standards: "",
    strategy: "",
    responsible_people: campSource.responsible_people,
    department: "",
    rationale: campSource.rationale,
    objectives: [""],
    quantitative_targets: [""],
    qualitative_targets: [""],
    procedures: [
      {
        step: "1. วางแผน (Plan)",
        method: "ประชุมวางแผนและแต่งตั้งคณะทำงาน",
        period: "",
        budget: 0,
        responsible: ownerName,
      },
      {
        step: "2. ดำเนินการ (Do)",
        method: "ดำเนินกิจกรรมตามโครงการ",
        period: "",
        budget: 0,
        responsible: ownerName,
      },
      {
        step: "3. ตรวจสอบ (Check)",
        method: "ติดตามและตรวจสอบผลการดำเนินงาน",
        period: "",
        budget: 0,
        responsible: ownerName,
      },
      {
        step: "4. ประเมินผล (Action)",
        method: "ประเมิน สรุป และรายงานโครงการ",
        period: "",
        budget: 0,
        responsible: ownerName,
      },
    ],
    duration_text: campSource.duration_text,
    location_text: campSource.location_text,
    budget_total: 0,
    budget_source: "เงินอุดหนุน",
    budget_items: [
      {
        description: camp.name,
        compensation: 0,
        expenses: 0,
        materials: 0,
        responsible: ownerName,
      },
    ],
    evaluations: [{ indicator: "", method: "แบบสอบถาม", tool: "แบบสอบถาม" }],
    expected_results: [""],
    signatories: [],
    status: "DRAFT",
    finalized_at: null,
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

  const parsed = documentSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "ข้อมูลเอกสารไม่ถูกต้อง" },
      { status: 400 },
    );
  }

  const existing = result.camp.project_document;

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
    new Set(parsed.data.signatories.map((item) => item.personnelId)),
  );
  const people = await prisma.document_personnel.findMany({
    where: { document_personnel_id: { in: personnelIds } },
  });

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
    const person = peopleMap.get(item.personnelId)!;

    return {
      role: item.role,
      personnelId: person.document_personnel_id,
      prefixName: person.prefix_name,
      firstname: person.firstname,
      lastname: person.lastname,
      position: person.position,
    };
  });

  const status = parsed.data.status;
  const documentData: any = { ...parsed.data };

  delete documentData.signatories;
  delete documentData.creator_name;
  delete documentData.status;

  const now = new Date();
  const document = await prisma.camp_project_document.upsert({
    where: { camp_camp_id: campId },
    create: {
      camp_camp_id: campId,
      ...documentData,
      signatories,
      status,
      finalized_at: status === "FINALIZED" ? now : null,
    },
    update: {
      ...documentData,
      signatories,
      status,
      finalized_at:
        status === "FINALIZED" ? existing?.finalized_at || now : null,
    },
  });

  const ownerName =
    `${result.camp.created_by.prefix_name || ""}${result.camp.created_by.firstname} ${result.camp.created_by.lastname}`.trim();
  const campSource = campSourceData(result.camp, ownerName);

  return NextResponse.json({
    ...document,
    creator_name: ownerName,
    camp_source: campSource,
  });
}
