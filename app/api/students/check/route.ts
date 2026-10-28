// @ts-nocheck
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function POST(req) {
  const { error: authError } = await requireAdmin();

  if (authError) return authError;

  try {
    const body = await req.json();
    const { ids } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json([]);
    }

    const parsedIds = ids.map((id) => parseInt(id)).filter((id) => !isNaN(id));

    if (parsedIds.length === 0) {
      return NextResponse.json([]);
    }

    const existingStudents = await prisma.students.findMany({
      where: {
        students_id: { in: parsedIds },
      },
      select: {
        students_id: true,
        deletedAt: true,
      },
    });

    return NextResponse.json(existingStudents);
  } catch {
    //     console.error("Check existing students error:", error);

    return NextResponse.json(
      { _error: "Failed to verify students" },
      { status: 500 },
    );
  }
}
