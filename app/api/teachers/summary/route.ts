import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET - ตัวเลขสรุปครู สำหรับการ์ดด้านบนหน้าครู
 * นับครูประจำชั้นจากปีการศึกษาที่ Active (ถ้าไม่มีใช้ปีล่าสุด)
 */
export async function GET() {
  const { error } = await requireAdmin();

  if (error) return error;

  try {
    const [row] = await prisma.$queryRaw<
      {
        total: bigint;
        admins: number | null;
        homeroom: number | null;
        year: number | null;
      }[]
    >`
      SELECT
        COUNT(*) AS total,
        SUM(t.role = 'ADMIN') AS admins,
        SUM(
          EXISTS (
            SELECT 1 FROM classrooms c
            WHERE c.deletedAt IS NULL
              AND c.academic_years_years_id = y.year
              AND c.teachers_teachers_id = t.teachers_id
          )
          OR EXISTS (
            SELECT 1 FROM classroom_teacher ct
            JOIN classrooms c ON c.classroom_id = ct.classroom_classroom_id
            WHERE c.deletedAt IS NULL
              AND c.academic_years_years_id = y.year
              AND ct.teacher_teachers_id = t.teachers_id
          )
        ) AS homeroom,
        MAX(y.year) AS year
      FROM teachers t
      LEFT JOIN (
        SELECT year FROM academic_years
        ORDER BY (status = 'Active') DESC, year DESC
        LIMIT 1
      ) y ON TRUE
      WHERE t.deletedAt IS NULL
    `;

    const total = Number(row.total);
    const admins = Number(row.admins ?? 0);

    return Response.json({
      total,
      // ครู = ทุกบัญชีที่ไม่ใช่ผู้ดูแลระบบ (รวม CAMP_LEADER) ให้ผลรวมตรงกับทั้งหมด
      teachers: total - admins,
      admins,
      homeroom: Number(row.homeroom ?? 0),
      year: row.year === null ? null : Number(row.year),
    });
  } catch {
    return Response.json(
      { error: "ไม่สามารถดึงข้อมูลสรุปได้" },
      { status: 500 },
    );
  }
}
