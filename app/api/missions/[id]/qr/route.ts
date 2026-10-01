// @ts-nocheck
import { NextResponse } from "next/server";

import { requireMissionOwner } from "@/lib/camp-management-auth";
import { prisma } from "@/lib/db";

function generatePin() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function generateNonce() {
  return Math.random().toString(36).slice(2, 12);
}

async function getOrCreate(missionId) {
  const mission = await prisma.mission.findUnique({
    where: { mission_id: missionId },
  });

  if (!mission) return null;

  if (!mission.qr_pin || !mission.qr_nonce) {
    const updated = await prisma.mission.update({
      where: { mission_id: missionId },
      data: {
        qr_pin: generatePin(),
        qr_nonce: generateNonce(),
      },
    });

    return updated;
  }

  return mission;
}

function buildPayload(missionId, campId) {
  return `CAMP_MISSION:${missionId}:${campId}`;
}

// ─── Export helpers for qr-scan route ────────────────────────────
// Note: These helpers are now moved to the student scan route to avoid store issues
// and will fetch from the database directly there.

// ─── GET: ดึง QR+PIN ปัจจุบัน (สร้างใหม่ถ้าไม่มี) ───────────────
export async function GET(request, { params }) {
  const { id } = await params;
  const missionId = parseInt(id);
  const { error } = await requireMissionOwner(missionId);

  if (error) return error;

  try {
    const mission = await prisma.mission.findUnique({
      where: { mission_id: missionId },
      include: { station: true },
    });

    if (!mission)
      return NextResponse.json({ error: "Mission not found" }, { status: 404 });
    if (mission.type !== "QR_CODE_SCANNING")
      return NextResponse.json({ error: "Not a QR mission" }, { status: 400 });

    const campId = mission.station.camp_camp_id;
    const data = await getOrCreate(missionId);
    const qrPayload = buildPayload(missionId, campId);

    return NextResponse.json({
      missionId,
      campId,
      missionTitle: mission.title,
      qrPayload,
      pin: data.qr_pin,
      generatedAt: new Date(),
    });
  } catch (error) {
    console.error("QR GET error:", error);

    return NextResponse.json({ _error: "Failed to get QR" }, { status: 500 });
  }
}

// POST method removed as requested (no more regenerate)
