import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireTeacher } from "@/lib/auth";
import { requireCampOwner } from "@/lib/camp-management-auth";
import { getBangkokDateKey } from "@/lib/bangkok-date";
import { getRegistrationState } from "@/lib/camp-registration";

export const dynamic = "force-dynamic";

/** สัดส่วนผู้ลงทะเบียนที่ต่ำกว่านี้หลังปิดรับสมัคร จะขึ้นเตือนครู */
const LOW_REGISTRATION_RATE = 0.5;

function teacherAccessWhere(teacher: { teachers_id: number; role: string }) {
  if (String(teacher.role).toUpperCase() === "ADMIN") return {};
  const teacherId = Number(teacher.teachers_id);

  return {
    OR: [
      { created_by_teacher_id: teacherId },
      { teacher_enrollment: { some: { teacher_teachers_id: teacherId } } },
      {
        camp_classroom: {
          some: { classroom: { teachers_teachers_id: teacherId } },
        },
      },
      {
        camp_classroom: {
          some: {
            classroom: {
              classroom_teacher: { some: { teacher_teachers_id: teacherId } },
            },
          },
        },
      },
    ],
  };
}

// GET /api/camps/[id]/registration
// สถานะการรับสมัคร + จำนวนผู้ลงทะเบียนแยกตามห้อง
export async function GET(_request: Request, context: any) {
  const { teacher, error: authError } = await requireTeacher();

  if (authError || !teacher) return authError;

  const { id } = await context.params;
  const campId = Number(id);

  if (!Number.isInteger(campId) || campId <= 0) {
    return NextResponse.json({ error: "รหัสค่ายไม่ถูกต้อง" }, { status: 400 });
  }

  const camp = await prisma.camp.findFirst({
    where: {
      camp_id: campId,
      deletedAt: null,
      ...teacherAccessWhere(teacher as any),
    },
    select: {
      camp_id: true,
      status: true,
      created_by_teacher_id: true,
      start_regis_date: true,
      end_regis_date: true,
      start_date: true,
      end_date: true,
      camp_classroom: {
        where: { classroom: { deletedAt: null } },
        select: {
          classroom: {
            select: {
              classroom_id: true,
              grade: true,
              classroom_types: { select: { name: true } },
              classroom_students: {
                where: { student: { deletedAt: null } },
                select: { student_students_id: true },
              },
            },
          },
        },
      },
    },
  });

  if (!camp) {
    return NextResponse.json(
      { error: "ไม่พบค่าย หรือไม่มีสิทธิ์เข้าถึง" },
      { status: 403 },
    );
  }

  const enrolled = await prisma.student_enrollment.findMany({
    where: { camp_camp_id: campId, enrolled_at: { not: null } },
    select: { student_students_id: true },
  });
  const enrolledIds = new Set(enrolled.map((row) => row.student_students_id));
  const seen = new Set<number>();
  const classrooms = camp.camp_classroom.map(({ classroom }) => {
    const ids = classroom.classroom_students.map(
      (row) => row.student_students_id,
    );

    ids.forEach((studentId) => seen.add(studentId));

    return {
      classroomId: classroom.classroom_id,
      name: `${String(classroom.grade).replace("Level_", "ม.")}/${classroom.classroom_types?.name ?? "-"}`,
      total: ids.length,
      registered: ids.filter((studentId) => enrolledIds.has(studentId)).length,
    };
  });
  const total = seen.size;
  const registered = Array.from(seen).filter((studentId) =>
    enrolledIds.has(studentId),
  ).length;
  const registration = getRegistrationState(camp);
  const rate = total > 0 ? registered / total : 1;
  const isAdmin = String(teacher.role).toUpperCase() === "ADMIN";

  return NextResponse.json(
    {
      registration,
      startRegisDate: getBangkokDateKey(camp.start_regis_date),
      endRegisDate: getBangkokDateKey(camp.end_regis_date),
      startDate: getBangkokDateKey(camp.start_date),
      endDate: getBangkokDateKey(camp.end_date),
      total,
      registered,
      classrooms,
      // หมดเขต/ยังไม่เปิดในช่วงที่ค่ายยังไม่เริ่ม แต่ลงไม่ถึงครึ่ง → เตือนครู
      needsAttention:
        (registration.status === "paused" ||
          registration.status === "closed") &&
        rate < LOW_REGISTRATION_RATE,
      canExtend:
        isAdmin || camp.created_by_teacher_id === Number(teacher.teachers_id),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

const extendSchema = z.object({
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

// POST /api/camps/[id]/registration  { endDate: "YYYY-MM-DD" }
// ขยายวันปิดรับสมัคร (เฉพาะเจ้าของค่าย/แอดมิน)
export async function POST(request: Request, context: any) {
  const { id } = await context.params;
  const { campId, error } = await requireCampOwner(Number(id));

  if (error || !campId) return error;

  const parsed = extendSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "วันที่ไม่ถูกต้อง" }, { status: 400 });
  }

  const camp = await prisma.camp.findUnique({
    where: { camp_id: campId },
    select: { start_regis_date: true, start_date: true, end_date: true },
  });

  if (!camp) {
    return NextResponse.json({ error: "ไม่พบค่าย" }, { status: 404 });
  }

  const endKey = parsed.data.endDate;
  const todayKey = getBangkokDateKey();

  if (endKey < todayKey) {
    return NextResponse.json(
      { error: "วันปิดรับสมัครต้องไม่ก่อนวันนี้" },
      { status: 400 },
    );
  }
  if (endKey > getBangkokDateKey(camp.start_date)) {
    return NextResponse.json(
      { error: "วันปิดรับสมัครต้องไม่เกินวันเริ่มค่าย" },
      { status: 400 },
    );
  }

  // เก็บเป็นเที่ยงคืน UTC ของวันนั้น ให้ตรงกับรูปแบบที่ฟอร์มสร้างค่ายบันทึก
  const data: { end_regis_date: Date; start_regis_date?: Date } = {
    end_regis_date: new Date(`${endKey}T00:00:00.000Z`),
  };

  // ถ้าวันเปิดรับสมัครยังไม่ถึง ให้เปิดตั้งแต่วันนี้เลย
  if (
    camp.start_regis_date &&
    getBangkokDateKey(camp.start_regis_date) > todayKey
  ) {
    data.start_regis_date = new Date(`${todayKey}T00:00:00.000Z`);
  }

  await prisma.camp.update({ where: { camp_id: campId }, data });

  return NextResponse.json({ ok: true });
}
