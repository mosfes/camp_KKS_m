import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireParentSession } from "@/lib/parent-auth";

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ studentId: string }> },
) {
  const auth = await requireParentSession();

  if (auth.error) return auth.error;

  const rawStudentId = (await params).studentId;
  const studentId = Number(rawStudentId);

  if (!/^[1-9]\d*$/.test(rawStudentId) || !Number.isSafeInteger(studentId)) {
    return NextResponse.json(
      { error: "รหัสนักเรียนไม่ถูกต้อง" },
      { status: 400 },
    );
  }

  const dismissed = await prisma.parent_student_link_requests.updateMany({
    where: {
      parents_id: auth.session.parentId,
      students_id: studentId,
      status: "REJECTED",
      dismissed_at: null,
    },
    data: { dismissed_at: new Date() },
  });

  if (dismissed.count === 0) {
    return NextResponse.json(
      { error: "ไม่พบคำขอที่ถูกปฏิเสธ" },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true });
}
