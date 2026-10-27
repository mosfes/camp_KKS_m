import type { CertificateRenderManifest } from "@/lib/certificate-renderer";

import { NextResponse } from "next/server";

import { activeCampEnrollmentWhere } from "@/lib/active-camp-student";
import { requireTeacher } from "@/lib/auth";
import { canViewCampTracking } from "@/lib/camp-tracking-auth";
import { buildCertificateVerificationUrl } from "@/lib/certificate-verification";
import { prisma } from "@/lib/db";

type RouteContext = {
  params: Promise<{ id: string; studentId: string }>;
};

function toThaiNumerals(str: string): string {
  const thaiDigits = ["๐", "๑", "๒", "๓", "๔", "๕", "๖", "๗", "๘", "๙"];

  return str.replace(/[0-9]/g, (d) => thaiDigits[parseInt(d)]);
}

function buildCertNumberText(
  prefix: string,
  certNo: number,
  isThai: boolean,
  certYear?: string | null,
): string {
  const padded = String(certNo).padStart(4, "0");
  let text = prefix ? `${prefix} ${padded}` : padded;

  if (certYear) {
    text = `${text}/${certYear}`;
  }

  return isThai ? toThaiNumerals(text) : text;
}

// Read-only: builds the render manifest for a certificate that was already
// issued. It never issues a certificate or reserves a number.
export async function GET(request: Request, context: RouteContext) {
  const { teacher, error: authError } = await requireTeacher();

  if (authError) return authError;

  const { id, studentId: rawStudentId } = await context.params;
  const campId = Number(id);
  const studentId = Number(rawStudentId);

  if (
    !Number.isInteger(campId) ||
    campId <= 0 ||
    !Number.isInteger(studentId) ||
    studentId <= 0
  ) {
    return NextResponse.json(
      { error: "ข้อมูลค่ายหรือนักเรียนไม่ถูกต้อง" },
      { status: 400 },
    );
  }

  try {
    if (!(await canViewCampTracking(campId, teacher))) {
      return NextResponse.json(
        { error: "ไม่มีสิทธิ์เข้าถึงข้อมูลนักเรียนในค่ายนี้" },
        { status: 403 },
      );
    }

    const [camp, enrollment] = await Promise.all([
      prisma.camp.findFirst({
        where: { camp_id: campId, deletedAt: null },
      }),
      prisma.student_enrollment.findFirst({
        where: {
          ...activeCampEnrollmentWhere(campId),
          student_students_id: studentId,
        },
        select: {
          public_id: true,
          student: {
            select: { prefix_name: true, firstname: true, lastname: true },
          },
          certificate: {
            select: { certificate_no: true },
            take: 1,
          },
        },
      }),
    ]);

    if (!camp?.img_certificate_url) {
      return NextResponse.json(
        { error: "ค่ายนี้ยังไม่ได้ตั้งค่ารูปภาพเกียรติบัตร" },
        { status: 404 },
      );
    }

    if (!enrollment || enrollment.certificate.length === 0) {
      return NextResponse.json(
        { error: "นักเรียนคนนี้ยังไม่ได้รับเกียรติบัตร" },
        { status: 404 },
      );
    }

    const prefix = enrollment.student.prefix_name?.trim() || "";
    const fullName = `${prefix}${enrollment.student.firstname.trim()} ${enrollment.student.lastname.trim()}`;
    const certNo = enrollment.certificate[0].certificate_no;
    const numberText =
      camp.cert_show_number && certNo != null
        ? buildCertNumberText(
            camp.cert_number_prefix || "",
            certNo,
            camp.cert_number_is_thai,
            camp.cert_year,
          )
        : null;
    const verificationUrl =
      camp.cert_show_qr && certNo != null
        ? buildCertificateVerificationUrl(
            new URL(request.url).origin,
            enrollment.public_id,
          )
        : null;

    const certificate: CertificateRenderManifest = {
      version: 1,
      template: {
        url: camp.img_certificate_url,
        format: camp.img_certificate_format,
      },
      fontUrl: "/fonts/THSarabunNew.ttf",
      nameStyle: {
        xPercent: camp.cert_name_x ?? 50,
        yPercent: camp.cert_name_y ?? 50,
        fontSize: camp.cert_font_size || 48,
        color: camp.cert_font_color || "#000000",
      },
      numberStyle: {
        xPercent: camp.cert_number_x ?? 50,
        yPercent: camp.cert_number_y ?? 10,
        fontSize: camp.cert_number_size || 36,
        color: camp.cert_number_color || "#000000",
      },
      qrStyle: {
        xPercent: camp.cert_qr_x ?? 90,
        yPercent: camp.cert_qr_y ?? 88,
        size: camp.cert_qr_size || 140,
      },
      recipients: [{ fullName, numberText, verificationUrl }],
    };

    return NextResponse.json(
      { certificate },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "โหลดเกียรติบัตรไม่สำเร็จ" },
      { status: 500 },
    );
  }
}
