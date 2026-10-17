import type { CertificateRenderManifest } from "@/lib/certificate-renderer";

import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireStudent } from "@/lib/auth";
import { getCertificateEligibility } from "@/lib/certificate-eligibility";
import { activeCampStudentWhere } from "@/lib/active-camp-student";
import { buildCertificateVerificationUrl } from "@/lib/certificate-verification";

// In-memory rate limiter to prevent rapid spam requests
const rateLimitMap = new Map<string, { count: number; lastReset: number }>();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 5;

// แปลงเลขอาราบิกเป็นเลขไทย
function toThaiNumerals(str: string): string {
  const thaiDigits = ["๐", "๑", "๒", "๓", "๔", "๕", "๖", "๗", "๘", "๙"];

  return str.replace(/[0-9]/g, (d) => thaiDigits[parseInt(d)]);
}

// สร้างข้อความเลขที่จากคำนำหน้าและปีการศึกษาที่กำหนด
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

export async function GET(request: Request, context: any) {
  const { student, error } = await requireStudent();

  if (error) return error;

  const params = await context.params;
  const campId = Number(params.id);

  if (isNaN(campId)) {
    return NextResponse.json({ error: "Invalid camp id" }, { status: 400 });
  }

  // Check Rate Limit
  const rateLimitKey = `cert_${student.students_id}_${campId}`;
  const now = Date.now();
  const limitRecord = rateLimitMap.get(rateLimitKey);

  if (limitRecord) {
    if (now - limitRecord.lastReset > RATE_LIMIT_WINDOW_MS) {
      rateLimitMap.set(rateLimitKey, { count: 1, lastReset: now });
    } else {
      if (limitRecord.count >= MAX_REQUESTS_PER_WINDOW) {
        return NextResponse.json(
          {
            error:
              "ระบบจำกัดการดาวน์โหลดที่ 5 ครั้งต่อนาที กรุณารอสักครู่ก่อนดาวน์โหลดใหม่",
          },
          { status: 429 },
        );
      }
      limitRecord.count += 1;
    }
  } else {
    rateLimitMap.set(rateLimitKey, { count: 1, lastReset: now });
  }

  try {
    const enrollment = await prisma.student_enrollment.findFirst({
      where: {
        student_students_id: Number(student.students_id),
        camp_camp_id: campId,
        student: activeCampStudentWhere(campId),
        camp: { deletedAt: null },
      },
      include: {
        camp: {
          include: {
            station: {
              where: { deletedAt: null },
              select: {
                mission: {
                  where: { deletedAt: null },
                  select: { mission_id: true },
                },
              },
            },
          },
        },
        student: true,
        survey_response: {
          take: 1,
        },
        certificate: {
          select: { certificate_no: true },
          take: 1,
        },
        mission_result: {
          where: { status: "completed" },
          select: { mission_mission_id: true },
        },
      },
    });

    if (!enrollment) {
      return NextResponse.json(
        { error: "Student not enrolled in this camp" },
        { status: 403 },
      );
    }

    const camp = enrollment.camp;

    if (!camp.img_certificate_url) {
      return NextResponse.json(
        { error: "This camp does not have a certificate template." },
        { status: 404 },
      );
    }

    const missionIds = new Set(
      camp.station.flatMap((station) =>
        station.mission.map((mission) => mission.mission_id),
      ),
    );
    const eligibility = getCertificateEligibility({
      totalMissions: missionIds.size,
      completedMissionIds: enrollment.mission_result
        .map((result) => result.mission_mission_id)
        .filter((missionId) => missionIds.has(missionId)),
      missionPercent: camp.cert_mission_completion_percent,
      requireSurvey: camp.cert_require_survey,
      hasSurveyResponse: enrollment.survey_response.length > 0,
      hasIssuedCertificate: enrollment.certificate.length > 0,
    });

    if (!eligibility.eligible) {
      const error = !eligibility.missionRequirementMet
        ? `กรุณาทำภารกิจให้ครบอย่างน้อย ${eligibility.requiredMissions} จาก ${missionIds.size} ภารกิจก่อนดาวน์โหลดเกียรติบัตร`
        : "กรุณาทำแบบประเมินให้เสร็จสิ้นก่อนดาวน์โหลดเกียรติบัตร";

      return NextResponse.json({ error }, { status: 403 });
    }

    // ---- ระบบเลขที่เกียรติบัตรแบบรัน ----
    let assignedCertNo: number | null = null;
    let isOverflow = false;
    let overflowAmount = 0;

    if (camp.cert_show_number && camp.cert_number_start != null) {
      if (enrollment.certificate[0]?.certificate_no != null) {
        // นักเรียนเคยได้รับเลขที่แล้ว ใช้เลขเดิม
        assignedCertNo = enrollment.certificate[0].certificate_no;
      } else {
        // ออกเลขใหม่ด้วย Pessimistic Transaction (รองรับ TiDB Serverless)
        // ใช้ retry loop สำหรับ write conflict บน TiDB OCC
        const MAX_RETRIES = 5;
        let lastError: any;

        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
          try {
            // ตรวจสอบก่อนว่า record ถูก insert ไปแล้วหรือยัง (จาก retry รอบก่อน)
            const existing = await prisma.certificate.findUnique({
              where: {
                student_enrollment_id: enrollment.student_enrollment_id,
              },
              select: { certificate_no: true },
            });

            if (existing?.certificate_no != null) {
              assignedCertNo = existing.certificate_no;
              break;
            }

            assignedCertNo = await prisma.$transaction(
              async (tx) => {
                // เปิด Pessimistic mode บน TiDB เพื่อให้ FOR UPDATE block จริงๆ
                // (TiDB default คือ Optimistic ซึ่ง FOR UPDATE ไม่ block)
                await tx.$executeRaw`SET @@tidb_txn_mode = 'pessimistic'`;

                // ล็อก camp row — เป็น existing row ที่ TiDB lock ได้ทันที
                await tx.$queryRaw`
                  SELECT camp_id FROM camp
                  WHERE camp_id = ${campId}
                  FOR UPDATE`;

                // หา certificate_no ทั้งหมดในค่ายนี้ เฉพาะตั้งแต่ cert_number_start เป็นต้นไป
                const usedCertificates: any[] = await tx.$queryRaw`
                  SELECT c.certificate_no
                  FROM certificate c
                  INNER JOIN student_enrollment se
                    ON c.student_enrollment_id = se.student_enrollment_id
                  WHERE se.camp_camp_id = ${campId}
                    AND c.certificate_no >= ${camp.cert_number_start}`;

                const usedSet = new Set(
                  usedCertificates
                    .map((r) => r.certificate_no)
                    .filter((n) => n != null)
                    .map(Number),
                );

                let newNo = camp.cert_number_start!;

                while (usedSet.has(newNo)) {
                  newNo++;
                }

                // บันทึกเลขที่ใหม่ — unique constraint คือ safety net สุดท้าย
                await tx.certificate.upsert({
                  where: {
                    student_enrollment_id: enrollment.student_enrollment_id,
                  },
                  update: {
                    certificate_no: newNo,
                    certificate_no_star: newNo,
                  },
                  create: {
                    certificate_no: newNo,
                    certificate_no_star: newNo,
                    file_url: "",
                    student_enrollment_id: enrollment.student_enrollment_id,
                  },
                });

                return newNo;
              },
              { isolationLevel: "ReadCommitted" },
            );
            break; // สำเร็จ ออกจาก loop
          } catch (txError: any) {
            lastError = txError;
            const errMsg = String(txError?.message ?? "");

            // กรณี unique constraint ชน (enrollment_id ซ้ำ) — นักเรียนคนนี้มีเลขแล้ว
            if (
              errMsg.includes("Unique constraint") ||
              errMsg.includes("unique") ||
              errMsg.includes("P2002")
            ) {
              const existingCert = await prisma.certificate.findUnique({
                where: {
                  student_enrollment_id: enrollment.student_enrollment_id,
                },
                select: { certificate_no: true },
              });

              if (existingCert?.certificate_no != null) {
                assignedCertNo = existingCert.certificate_no;
                lastError = null;
                break;
              }
            }

            // กรณี TiDB write conflict (OCC retry) — รอสักครู่แล้วลองใหม่
            if (
              errMsg.includes("Write conflict") ||
              errMsg.includes("9007") ||
              errMsg.includes("Deadlock")
            ) {
              await new Promise((r) => setTimeout(r, 20 + attempt * 30));
              continue;
            }

            // Error อื่นๆ ให้ throw ออกไปเลย
            throw txError;
          }
        }

        if (assignedCertNo == null && lastError) {
          throw lastError;
        }

        // ตรวจสอบว่าเกินช่วงที่กำหนดไหม
        if (
          camp.cert_number_end != null &&
          assignedCertNo! > camp.cert_number_end
        ) {
          isOverflow = true;
          overflowAmount = assignedCertNo! - camp.cert_number_end;
        }
      }
    }
    const prefix = enrollment.student.prefix_name?.trim() || "";
    const fullName = `${prefix}${enrollment.student.firstname.trim()} ${enrollment.student.lastname.trim()}`;
    const showNumber = camp.cert_show_number && assignedCertNo != null;
    const numberText = showNumber
      ? buildCertNumberText(
          camp.cert_number_prefix || "",
          assignedCertNo!,
          camp.cert_number_is_thai,
          camp.cert_year,
        )
      : null;
    const showQr = camp.cert_show_qr && assignedCertNo != null;
    const verificationUrl = showQr
      ? buildCertificateVerificationUrl(
          new URL(request.url).origin,
          enrollment.public_id,
        )
      : null;

    // การออกเลขและบันทึกสถานะยังเกิดบน server ส่วน browser จะเป็นผู้ render
    // เทมเพลต ชื่อ เลข และ QR เป็น PNG/PDF จาก manifest นี้
    if (enrollment.certificate.length === 0) {
      await prisma.certificate.upsert({
        where: {
          student_enrollment_id: enrollment.student_enrollment_id,
        },
        update: {},
        create: {
          certificate_no: assignedCertNo,
          certificate_no_star: assignedCertNo,
          file_url: "",
          student_enrollment_id: enrollment.student_enrollment_id,
        },
      });
    }

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
      {
        certificate,
        certificateNo: assignedCertNo,
        overflowAmount: isOverflow ? overflowAmount : 0,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      },
    );
  } catch (error) {
    console.error("Error preparing certificate:", error);

    return NextResponse.json(
      { error: "Failed to prepare certificate." },
      { status: 500 },
    );
  }
}
