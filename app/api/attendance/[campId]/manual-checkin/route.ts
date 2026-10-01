// @ts-nocheck
import { NextResponse } from "next/server";

import { requireCampTeacher } from "@/lib/attendance-auth";
import { recordStudentAttendanceOnce } from "@/lib/attendance-record";
import { prisma } from "@/lib/db";
import { activeCampStudentWhere } from "@/lib/active-camp-student";

// POST /api/attendance/[campId]/manual-checkin
export async function POST(req, { params }) {
  const { campId } = await params;
  const cid = parseInt(campId);
  const { error: authError } = await requireCampTeacher(cid);

  if (authError) return authError;

  try {
    const body = await req.json();
    const { roundId, studentId, action } = body;

    if (!roundId || !studentId || !action) {
      return NextResponse.json({ error: "ข้อมูลไม่ครบถ้วน" }, { status: 400 });
    }

    // หา teacherSession ที่ตรงกับ roundId
    const teacherSession = await prisma.attendance_teachers.findFirst({
      where: { camp_camp_id: cid, round_id: roundId },
    });

    if (!teacherSession) {
      return NextResponse.json(
        { error: "ไม่พบรอบการเช็คชื่อ" },
        { status: 404 },
      );
    }

    if (action === "checkin") {
      const enrollment = await prisma.student_enrollment.findFirst({
        where: {
          camp_camp_id: cid,
          student_students_id: Number(studentId),
          enrolled_at: { not: null },
          student: activeCampStudentWhere(cid),
        },
        select: { student_enrollment_id: true },
      });

      if (!enrollment) {
        return NextResponse.json(
          { error: "นักเรียนไม่ได้อยู่ในค่ายนี้แล้ว" },
          { status: 403 },
        );
      }

      await recordStudentAttendanceOnce({
        sessionId: teacherSession.session_id,
        studentId,
      });
    } else if (action === "uncheck") {
      await prisma.attendance_record_student.deleteMany({
        where: {
          attendance_teacher_session_id: teacherSession.session_id,
          student_students_id: studentId,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Manual check-in error:", e);

    return NextResponse.json(
      { _error: "เกิดข้อผิดพลาดในการเช็คชื่อ" },
      { status: 500 },
    );
  }
}
