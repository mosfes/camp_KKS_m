// @ts-nocheck
// app/api/academic_years/route.js
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const years = await prisma.academic_years.findMany({
      orderBy: { year: "desc" },
    });

    return NextResponse.json(years);
  } catch {
    return NextResponse.json({ error: "ดึงข้อมูลไม่สำเร็จ" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const year = parseInt(body.year);
    const status = body.status || "Draft";

    const existing = await prisma.academic_years.findFirst({
      where: { year: year },
    });

    if (existing) {
      return NextResponse.json(
        { error: "มีปีการศึกษานี้อยู่แล้ว" },
        { status: 400 },
      );
    }

    const newYear = await prisma.academic_years.create({
      data: { year: year, status: status },
    });

    return NextResponse.json(newYear, { status: 201 });
  } catch {
    //     console.error("Error adding academic year:", error);

    return NextResponse.json(
      { _error: "เกิดข้อผิดพลาดภายในระบบ" },
      { status: 500 },
    );
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id)
      return NextResponse.json({ error: "ID required" }, { status: 400 });

    const yearId = parseInt(id);

    const relatedClassrooms = await prisma.classrooms.count({
      where: { academic_years_years_id: yearId },
    });

    if (relatedClassrooms > 0) {
      return NextResponse.json(
        {
          error: `ไม่สามารถลบได้ เนื่องจากมีห้องเรียนในระบบ ${relatedClassrooms} ห้อง ที่ใช้ปีการศึกษานี้อยู่`,
        },
        { status: 400 },
      );
    }

    await prisma.academic_years.delete({
      where: { year: yearId },
    });

    return NextResponse.json({ message: "Deleted successfully" });
  } catch {
    //     console.error("Error deleting academic year:", error);

    return NextResponse.json(
      { _error: "เกิดข้อผิดพลาดภายในระบบ" },
      { status: 500 },
    );
  }
}
