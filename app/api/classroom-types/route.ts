// @ts-nocheck
import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const { error } = await requireAdmin();

  if (error) return error;

  try {
    const types = await prisma.classroom_types.findMany({
      orderBy: { name: "asc" },
    });

    return NextResponse.json(types);
  } catch {
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดภายในระบบ" },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  const { error } = await requireAdmin();

  if (error) return error;

  try {
    const body = await request.json();
    const { name, valid_grades } = body;

    const newType = await prisma.classroom_types.create({
      data: {
        name,
        valid_grades,
      },
    });

    return NextResponse.json(newType);
  } catch {
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดภายในระบบ" },
      { status: 500 },
    );
  }
}

export async function DELETE(request) {
  const { error: authError } = await requireAdmin();

  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id)
      return NextResponse.json({ error: "ID required" }, { status: 400 });

    await prisma.classroom_types.delete({
      where: { classroom_type_id: parseInt(id) },
    });

    return NextResponse.json({ message: "Deleted successfully" });
  } catch (error) {
    //     console.error("Delete type error:", error);
    if (error.code === "P2003") {
      return NextResponse.json(
        { error: "ไม่สามารถลบได้เนื่องจากมีการใช้งานประเภทห้องเรียนนี้อยู่" },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดภายในระบบ" },
      { status: 500 },
    );
  }
}

export async function PATCH(request) {
  const { error: authError } = await requireAdmin();

  if (authError) return authError;

  try {
    const body = await request.json();
    const { classroom_type_id, name, valid_grades } = body;

    if (!classroom_type_id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 });
    }

    const updatedType = await prisma.classroom_types.update({
      where: { classroom_type_id: parseInt(classroom_type_id) },
      data: {
        name,
        valid_grades,
      },
    });

    return NextResponse.json(updatedType);
  } catch (error) {
    // console.error("Update type error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดภายในระบบ" },
      { status: 500 },
    );
  }
}
