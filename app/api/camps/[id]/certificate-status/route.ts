import { NextResponse } from "next/server";

import { requireCampOwner } from "@/lib/camp-management-auth";
import { prisma } from "@/lib/db";
import { activeCampEnrollmentWhere } from "@/lib/active-camp-student";

export async function GET(request: Request, context: any) {
  const params = await context.params;
  const campId = Number(params.id);
  const { error: authError } = await requireCampOwner(campId);

  if (authError) return authError;

  try {
    const camp = await prisma.camp.findFirst({
      where: { camp_id: campId, deletedAt: null },
      select: {
        cert_show_number: true,
        cert_number_start: true,
        cert_number_end: true,
      },
    });

    if (!camp) {
      return NextResponse.json({ error: "ไม่พบค่าย" }, { status: 404 });
    }

    // นับจำนวนเกียรติบัตรที่ออกไปแล้วในค่ายนี้
    const issuedCount = await prisma.certificate.count({
      where: {
        student_enrollment: {
          camp_camp_id: campId,
        },
      },
    });

    // หาค่าสูงสุดของ certificate_no ในค่ายนี้
    const maxResult = await prisma.certificate.aggregate({
      where: {
        student_enrollment: {
          camp_camp_id: campId,
        },
      },
      _max: { certificate_no: true },
    });

    // นับนักเรียนที่ลงทะเบียน
    const enrolledCount = await prisma.student_enrollment.count({
      where: {
        ...activeCampEnrollmentWhere(campId),
        enrolled_at: { not: null },
      },
    });

    const rangeCount =
      camp.cert_number_start != null && camp.cert_number_end != null
        ? camp.cert_number_end - camp.cert_number_start + 1
        : null;

    const latestNo = maxResult._max.certificate_no;
    const overflowAmount =
      camp.cert_number_end != null &&
      latestNo != null &&
      latestNo > camp.cert_number_end
        ? latestNo - camp.cert_number_end
        : 0;

    return NextResponse.json({
      cert_show_number: camp.cert_show_number,
      cert_number_start: camp.cert_number_start,
      cert_number_end: camp.cert_number_end,
      range_count: rangeCount,
      issued_count: issuedCount,
      enrolled_count: enrolledCount,
      latest_cert_no: latestNo,
      overflow_amount: overflowAmount,
      is_overflow: overflowAmount > 0,
    });
  } catch (error) {
    console.error("Error fetching certificate status:", error);

    return NextResponse.json(
      { error: "ไม่สามารถดึงข้อมูลสถานะเกียรติบัตรได้" },
      { status: 500 },
    );
  }
}
