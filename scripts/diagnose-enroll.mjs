// ตรวจสอบ (อ่านอย่างเดียว) ว่าทำไมนักเรียนลงทะเบียนค่ายไม่ได้
// ใช้: DATABASE_URL="<prod url>" node scripts/diagnose-enroll.mjs [campId]
// ไม่ใส่ campId = ตรวจทุกค่าย status OPEN ที่ยังไม่จบ
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const bkk = (d) =>
  d
    ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(
        new Date(d),
      )
    : null;
const today = bkk(new Date());
const inRange = (s, e) => (!s || bkk(s) <= today) && (!e || today <= bkk(e));

const campIdArg = process.argv[2] ? Number(process.argv[2]) : null;

const camps = await prisma.camp.findMany({
  where: campIdArg
    ? { camp_id: campIdArg }
    : { deletedAt: null, status: "OPEN", end_date: { gte: new Date(Date.now() - 86400000) } },
  select: {
    camp_id: true,
    name: true,
    status: true,
    deletedAt: true,
    start_regis_date: true,
    end_regis_date: true,
    start_date: true,
    end_date: true,
    camp_classroom: {
      select: {
        classroom: {
          select: {
            classroom_id: true,
            grade: true,
            deletedAt: true,
            classroom_types: { select: { name: true } },
            classroom_students: {
              select: {
                student: {
                  select: {
                    students_id: true,
                    firstname: true,
                    lastname: true,
                    deletedAt: true,
                    status: true,
                  },
                },
              },
            },
          },
        },
      },
    },
  },
});

console.log(`วันนี้ (เวลาไทย): ${today}`);
if (camps.length === 0) console.log("ไม่พบค่ายที่ตรงเงื่อนไข");

for (const camp of camps) {
  const regisOk = inRange(camp.start_regis_date, camp.end_regis_date);
  const campOk = inRange(camp.start_date, camp.end_date);

  console.log("\n==============================");
  console.log(`ค่าย ${camp.camp_id}: ${camp.name}`);
  console.log(
    `  status=${camp.status} deleted=${!!camp.deletedAt}` +
      ` | ช่วงรับสมัคร ${bkk(camp.start_regis_date)} → ${bkk(camp.end_regis_date)} (${regisOk ? "อยู่ในช่วง" : "นอกช่วง"})` +
      ` | ช่วงค่าย ${bkk(camp.start_date)} → ${bkk(camp.end_date)} (${campOk ? "อยู่ในช่วง" : "นอกช่วง"})`,
  );
  if (camp.status !== "OPEN") console.log("  ❌ ค่ายไม่ได้ OPEN → ทุกคนลงไม่ได้");
  if (!regisOk && !campOk)
    console.log("  ❌ ไม่อยู่ในช่วงรับสมัครหรือช่วงค่าย → ทุกคนลงไม่ได้");

  const enrollments = await prisma.student_enrollment.findMany({
    where: { camp_camp_id: camp.camp_id },
    select: { student_students_id: true, enrolled_at: true },
  });
  const enrolledMap = new Map(
    enrollments.map((e) => [e.student_students_id, e.enrolled_at]),
  );

  for (const { classroom } of camp.camp_classroom) {
    const students = classroom.classroom_students.map((cs) => cs.student);
    const notEnrolled = students.filter(
      (s) => !enrolledMap.get(s.students_id),
    );

    console.log(
      `\n  ห้อง ${classroom.classroom_id} (ม.${classroom.grade}/${classroom.classroom_types?.name ?? "-"})` +
        `${classroom.deletedAt ? " ❌ ห้องถูกลบ → นักเรียนห้องนี้มองไม่เห็นค่าย" : ""}` +
        ` | นักเรียน ${students.length} | ลงแล้ว ${students.length - notEnrolled.length} | ยังไม่ลง ${notEnrolled.length}`,
    );
    for (const s of notEnrolled) {
      const flags = [];

      if (s.deletedAt) flags.push("บัญชีถูกลบ");
      if (s.status && s.status !== "ACTIVE") flags.push(`status=${s.status}`);
      if (enrolledMap.has(s.students_id)) flags.push("มีแถว enrollment แต่ enrolled_at ว่าง");
      console.log(
        `    - ${s.students_id} ${s.firstname} ${s.lastname}${flags.length ? "  ⚠️ " + flags.join(", ") : ""}`,
      );
    }
  }
}

await prisma.$disconnect();
