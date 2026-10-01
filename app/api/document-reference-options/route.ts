import { NextResponse } from "next/server";
import { z } from "zod";

import { requireTeacher } from "@/lib/auth";
import { prisma } from "@/lib/db";

const indicatorSchema = z.object({
  code: z.string().trim().max(100).default(""),
  label: z.string().trim().min(1).max(1000),
  clauseCode: z.string().trim().max(100).default(""),
  clauseLabel: z.string().trim().max(1000).default(""),
});

const optionSchema = z.object({
  category: z.enum(["STANDARD", "STRATEGY"]),
  label: z.string().trim().min(1).max(700),
  indicators: z.array(indicatorSchema).max(50).optional(),
  is_active: z.boolean().optional(),
  sort_order: z.coerce.number().int().min(0).max(10000).optional(),
});

const reorderSchema = z.object({
  orderedIds: z.array(z.coerce.number().int().positive()).min(1).max(500),
});

export async function GET(request: Request) {
  const { teacher, error } = await requireTeacher();

  if (error) return error;
  const { searchParams } = new URL(request.url);
  const includeInactive =
    teacher.role === "ADMIN" && searchParams.get("includeInactive") === "true";

  const options = await prisma.document_reference_option.findMany({
    where: includeInactive ? undefined : { is_active: true },
    orderBy: [{ category: "asc" }, { sort_order: "asc" }, { label: "asc" }],
  });

  return NextResponse.json(options);
}

export async function POST(request: Request) {
  const { teacher, error } = await requireTeacher();

  if (error) return error;
  if (teacher.role !== "ADMIN") {
    return NextResponse.json(
      { error: "คุณไม่มีสิทธิ์เพิ่มตัวเลือกเอกสาร" },
      { status: 403 },
    );
  }

  const parsed = optionSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "ข้อมูลไม่ถูกต้อง" },
      { status: 400 },
    );
  }

  try {
    const maxOrder = await prisma.document_reference_option.aggregate({
      where: { category: parsed.data.category },
      _max: { sort_order: true },
    });
    const option = await prisma.document_reference_option.create({
      data: {
        ...parsed.data,
        indicators:
          parsed.data.category === "STANDARD"
            ? (parsed.data.indicators ?? [])
            : [],
        is_active: parsed.data.is_active ?? true,
        sort_order:
          parsed.data.sort_order ?? (maxOrder._max.sort_order ?? 0) + 10,
      },
    });

    return NextResponse.json(option, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "มีตัวเลือกนี้อยู่ในหมวดเดียวกันแล้ว" },
      { status: 409 },
    );
  }
}

export async function PUT(request: Request) {
  const { teacher, error } = await requireTeacher();

  if (error) return error;
  if (teacher.role !== "ADMIN") {
    return NextResponse.json(
      { error: "คุณไม่มีสิทธิ์จัดลำดับตัวเลือกเอกสาร" },
      { status: 403 },
    );
  }

  const parsed = reorderSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "ลำดับข้อมูลไม่ถูกต้อง" },
      { status: 400 },
    );
  }

  const uniqueIds = Array.from(new Set(parsed.data.orderedIds));

  if (uniqueIds.length !== parsed.data.orderedIds.length) {
    return NextResponse.json({ error: "พบรายการซ้ำในลำดับ" }, { status: 400 });
  }

  const existingOptions = await prisma.document_reference_option.findMany({
    where: { document_reference_option_id: { in: uniqueIds } },
    select: { category: true },
  });

  if (
    existingOptions.length !== uniqueIds.length ||
    new Set(existingOptions.map((option) => option.category)).size !== 1
  ) {
    return NextResponse.json(
      { error: "มีตัวเลือกที่ไม่ถูกต้อง" },
      { status: 400 },
    );
  }

  await prisma.$transaction(
    uniqueIds.map((id, index) =>
      prisma.document_reference_option.update({
        where: { document_reference_option_id: id },
        data: { sort_order: (index + 1) * 10 },
      }),
    ),
  );

  return NextResponse.json({ message: "จัดลำดับเรียบร้อยแล้ว" });
}
