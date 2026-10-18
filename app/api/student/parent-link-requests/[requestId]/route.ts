import { NextResponse } from "next/server";

import { requireStudent } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { applyStudentParentLinkDecision } from "@/lib/parent-link-decision";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const { student, error } = await requireStudent();

  if (error) return error;

  const requestId = Number((await params).requestId);

  if (!Number.isSafeInteger(requestId) || requestId <= 0) {
    return NextResponse.json({ error: "คำขอไม่ถูกต้อง" }, { status: 400 });
  }

  let decision: unknown;

  try {
    decision = (await request.json()).decision;
  } catch {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }
  if (decision !== "approve" && decision !== "reject") {
    return NextResponse.json(
      { error: "การตัดสินใจไม่ถูกต้อง" },
      { status: 400 },
    );
  }

  const linkRequest = await prisma.parent_student_link_requests.findFirst({
    where: {
      request_id: requestId,
      students_id: student.students_id,
      status: "PENDING",
      expires_at: { gt: new Date() },
    },
    select: { parents_id: true },
  });

  if (!linkRequest) {
    return NextResponse.json(
      { error: "คำขอนี้ถูกดำเนินการหรือหมดอายุแล้ว" },
      { status: 409 },
    );
  }

  const now = new Date();
  const claimed = await prisma.$transaction((tx) =>
    applyStudentParentLinkDecision(tx, {
      requestId,
      parentId: linkRequest.parents_id,
      studentId: student.students_id,
      decision,
      now,
    }),
  );

  if (!claimed) {
    return NextResponse.json(
      { error: "คำขอนี้ถูกดำเนินการหรือหมดอายุแล้ว" },
      { status: 409 },
    );
  }

  return NextResponse.json({ success: true });
}
