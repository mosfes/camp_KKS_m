// @ts-nocheck

import { NextResponse } from "next/server";

import { requireCampOwner } from "@/lib/camp-management-auth";
import { prisma } from "@/lib/db";

export async function POST(request) {
  try {
    const body = await request.json();
    const { name, description, campId } = body;

    if (!name || !campId) {
      return NextResponse.json(
        { error: "Name and Camp ID are required" },
        { status: 400 },
      );
    }

    const parsedCampId = parseInt(campId);
    const { error } = await requireCampOwner(parsedCampId);

    if (error) return error;
    if (name.length > 255) {
      return NextResponse.json(
        { error: "ชื่อฐานกิจกรรมต้องไม่เกิน 255 ตัวอักษร" },
        { status: 400 },
      );
    }

    if (description && description.length > 255) {
      return NextResponse.json(
        { error: "รายละเอียดต้องไม่เกิน 255 ตัวอักษร" },
        { status: 400 },
      );
    }

    const newStation = await prisma.station.create({
      data: {
        name,
        description: description || "",
        camp_camp_id: parsedCampId,
      },
    });

    return NextResponse.json(newStation, { status: 201 });
  } catch (error) {
    console.error("Error creating station:", error);

    return NextResponse.json(
      {
        _error: "Failed to create station",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
