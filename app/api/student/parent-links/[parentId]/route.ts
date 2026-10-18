import { NextResponse } from "next/server";

import { requireStudent } from "@/lib/auth";
import { revokeAdditionalParentLink } from "@/lib/parent-link-access";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ parentId: string }> },
) {
  const { student, error } = await requireStudent();

  if (error) return error;

  const parentId = Number((await params).parentId);

  if (!Number.isSafeInteger(parentId) || parentId <= 0) {
    return NextResponse.json(
      { error: "บัญชีผู้ปกครองไม่ถูกต้อง" },
      { status: 400 },
    );
  }

  const result = await revokeAdditionalParentLink({
    parentId,
    studentId: student.students_id,
    actorType: "STUDENT",
    actorId: student.students_id,
  });

  if (result === "primary") {
    return NextResponse.json(
      { error: "บัญชีหลักต้องติดต่อผู้ดูแลระบบเพื่อเปลี่ยนข้อมูล" },
      { status: 403 },
    );
  }
  if (result === "missing") {
    return NextResponse.json({ error: "ไม่พบสิทธิ์นี้" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
