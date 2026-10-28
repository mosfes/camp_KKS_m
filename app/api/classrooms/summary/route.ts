import { Prisma } from "@prisma/client";

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET - ตัวเลขสรุปห้องเรียนของปีการศึกษาที่เลือก (ไม่ส่ง yearId = ทุกปี)
 */
export async function GET(request: Request) {
  const { error } = await requireAdmin();

  if (error) return error;

  const yearValue = new URL(request.url).searchParams.get("yearId") || "all";

  if (yearValue !== "all" && !/^\d+$/.test(yearValue)) {
    return Response.json({ error: "ปีการศึกษาไม่ถูกต้อง" }, { status: 400 });
  }

  const year = yearValue === "all" ? null : Number(yearValue);
  const inYear = (alias: string) =>
    year === null
      ? Prisma.empty
      : Prisma.sql`AND ${Prisma.raw(alias)}.academic_years_years_id = ${year}`;

  try {
    const [row] = await prisma.$queryRaw<
      {
        rooms: bigint;
        lowerRooms: number | null;
        upperRooms: number | null;
        students: number | null;
        emptyRooms: number | null;
        teachers: bigint;
      }[]
    >`
      SELECT
        COUNT(*) AS rooms,
        SUM(c.grade IN ('1', '2', '3')) AS lowerRooms,
        SUM(c.grade IN ('4', '5', '6')) AS upperRooms,
        SUM(COALESCE(sc.n, 0)) AS students,
        SUM(COALESCE(sc.n, 0) = 0) AS emptyRooms,
        (
          SELECT COUNT(DISTINCT x.tid) FROM (
            SELECT c2.teachers_teachers_id AS tid FROM classrooms c2
            WHERE c2.deletedAt IS NULL ${inYear("c2")}
            UNION
            SELECT ct.teacher_teachers_id FROM classroom_teacher ct
            JOIN classrooms c3 ON c3.classroom_id = ct.classroom_classroom_id
            WHERE c3.deletedAt IS NULL ${inYear("c3")}
          ) x
        ) AS teachers
      FROM classrooms c
      LEFT JOIN (
        SELECT cs.classroom_classroom_id AS id, COUNT(*) AS n
        FROM classroom_students cs
        JOIN students s ON s.students_id = cs.student_students_id AND s.deletedAt IS NULL
        GROUP BY cs.classroom_classroom_id
      ) sc ON sc.id = c.classroom_id
      WHERE c.deletedAt IS NULL ${inYear("c")}
    `;

    return Response.json({
      rooms: Number(row.rooms),
      lowerRooms: Number(row.lowerRooms ?? 0),
      upperRooms: Number(row.upperRooms ?? 0),
      students: Number(row.students ?? 0),
      emptyRooms: Number(row.emptyRooms ?? 0),
      teachers: Number(row.teachers),
    });
  } catch {
    return Response.json(
      { error: "ไม่สามารถดึงข้อมูลสรุปได้" },
      { status: 500 },
    );
  }
}
