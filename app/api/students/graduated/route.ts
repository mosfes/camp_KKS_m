import { requireTeacher } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const { teacher, error } = await requireTeacher();

  if (error) return error;
  if (teacher.role !== "ADMIN") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.min(
    100,
    Math.max(1, Number(searchParams.get("limit")) || 20),
  );
  const yearValue = searchParams.get("year");
  const year = yearValue && yearValue !== "all" ? Number(yearValue) : null;
  const roomTypeValue = searchParams.get("roomType");
  const roomType =
    roomTypeValue && roomTypeValue !== "all" ? Number(roomTypeValue) : null;
  const search = searchParams.get("search")?.trim() || "";

  const studentFilter = search
    ? {
        OR: [
          { firstname: { contains: search } },
          { lastname: { contains: search } },
          ...(Number.isInteger(Number(search))
            ? [{ students_id: Number(search) }]
            : []),
        ],
      }
    : undefined;
  const where = {
    outcome: "GRADUATED" as const,
    ...(year ? { run: { from_year: year } } : {}),
    ...(roomType ? { source_classroom: { type_classroom: roomType } } : {}),
    ...(studentFilter ? { student: studentFilter } : {}),
  };

  try {
    const [rows, total, years, rooms] = await Promise.all([
      prisma.promotion_item.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          student: true,
          run: true,
          source_classroom: { include: { classroom_types: true } },
        },
        orderBy: [{ run: { from_year: "desc" } }, { student_id: "asc" }],
      }),
      prisma.promotion_item.count({ where }),
      prisma.promotion_run.findMany({
        where: { items: { some: { outcome: "GRADUATED" } } },
        distinct: ["from_year"],
        select: { from_year: true },
        orderBy: { from_year: "desc" },
      }),
      prisma.classroom_types.findMany({
        where: {
          classrooms: {
            some: {
              promotion_sources: { some: { outcome: "GRADUATED" } },
            },
          },
        },
        select: { classroom_type_id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);

    return Response.json({
      data: rows.map((row) => ({
        graduationId: row.promotion_item_id,
        studentId: row.student_id,
        prefixName: row.student.prefix_name,
        firstname: row.student.firstname,
        lastname: row.student.lastname,
        academicYear: row.run.from_year,
        classroom: row.source_classroom
          ? `ม.6 ห้อง ${row.source_classroom.classroom_types.name}`
          : "ม.6",
        graduatedAt: row.created_at,
      })),
      years: years.map((item) => item.from_year),
      rooms: rooms.map((room) => ({
        id: room.classroom_type_id,
        name: room.name,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch {
    return Response.json(
      { error: "โหลดรายชื่อนักเรียนที่จบแล้วไม่สำเร็จ" },
      { status: 500 },
    );
  }
}
