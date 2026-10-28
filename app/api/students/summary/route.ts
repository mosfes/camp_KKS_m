import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET - ตัวเลขสรุปนักเรียนของปีการศึกษาที่เลือก สำหรับการ์ดด้านบนหน้านักเรียน
 */
export async function GET(request: Request) {
  const { error } = await requireAdmin();

  if (error) return error;

  const yearValue = new URL(request.url).searchParams.get("yearId");
  const year = Number(yearValue);

  if (!Number.isInteger(year) || year <= 0) {
    return Response.json({ error: "ปีการศึกษาไม่ถูกต้อง" }, { status: 400 });
  }

  try {
    // ใช้คำสั่งเดียวเพื่อลดรอบไป-กลับฐานข้อมูล นักเรียนหนึ่งคนมีได้ไม่เกินหนึ่งห้องต่อปี
    // (unique student + academic_year) จึงนับจาก LEFT JOIN ได้โดยไม่ซ้ำ
    const [row] = await prisma.$queryRaw<
      {
        yearStudents: bigint;
        lowerStudents: number | null;
        upperStudents: number | null;
        unassigned: number | null;
        activeTotal: number | null;
      }[]
    >`
      SELECT
        COUNT(cs.student_students_id) AS yearStudents,
        SUM(c.grade IN ('1', '2', '3')) AS lowerStudents,
        SUM(c.grade IN ('4', '5', '6')) AS upperStudents,
        SUM(s.status = 'ACTIVE' AND cs.student_students_id IS NULL) AS unassigned,
        SUM(s.status = 'ACTIVE') AS activeTotal
      FROM students s
      LEFT JOIN classroom_students cs
        ON cs.student_students_id = s.students_id AND cs.academic_year = ${year}
      LEFT JOIN classrooms c ON c.classroom_id = cs.classroom_classroom_id
      WHERE s.deletedAt IS NULL
    `;

    return Response.json({
      yearStudents: Number(row.yearStudents),
      lowerStudents: Number(row.lowerStudents ?? 0),
      upperStudents: Number(row.upperStudents ?? 0),
      unassigned: Number(row.unassigned ?? 0),
      activeTotal: Number(row.activeTotal ?? 0),
    });
  } catch {
    return Response.json(
      { error: "ไม่สามารถดึงข้อมูลสรุปได้" },
      { status: 500 },
    );
  }
}
