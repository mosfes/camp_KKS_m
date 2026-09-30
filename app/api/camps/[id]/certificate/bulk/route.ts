import type { CertificateRenderManifest } from "@/lib/certificate-renderer";

import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { buildEnrollmentSnapshotMap } from "@/lib/student-enrollment-snapshot";
import { requireTeacher } from "@/lib/auth";
import { getCertificateEligibility } from "@/lib/certificate-eligibility";
import { activeCampEnrollmentWhere } from "@/lib/active-camp-student";
import { buildCertificateVerificationUrl } from "@/lib/certificate-verification";

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

export async function GET(request: Request, context: any) {
  const { teacher, error } = await requireTeacher();

  if (error) return error;

  const params = await context.params;
  const campId = Number(params.id);
  const { searchParams } = new URL(request.url);
  const condition = searchParams.get("condition") || "all"; // all | all_students | passed_conditions

  if (isNaN(campId)) {
    return NextResponse.json({ error: "Invalid camp id" }, { status: 400 });
  }

  try {
    const camp = await prisma.camp.findUnique({
      where: { camp_id: campId, deletedAt: null },
      include: {
        station: {
          where: { deletedAt: null },
          include: {
            mission: {
              where: { deletedAt: null },
              select: { mission_id: true },
            },
          },
        },
      },
    });

    if (!camp) {
      return NextResponse.json({ error: "Camp not found" }, { status: 404 });
    }

    if (
      camp.created_by_teacher_id !== teacher.teachers_id &&
      teacher.role !== "ADMIN"
    ) {
      return NextResponse.json(
        { error: "ไม่มีสิทธิ์ดาวน์โหลดเกียรติบัตรแบบรวมสำหรับค่ายนี้" },
        { status: 403 },
      );
    }

    if (!camp.img_certificate_url) {
      return NextResponse.json(
        { error: "ค่ายนี้ยังไม่ได้ตั้งค่ารูปภาพเกียรติบัตร" },
        { status: 404 },
      );
    }

    if (condition === "all_students") {
      // นักเรียนที่อยู่ในห้องที่ผูกกับค่ายอาจยังไม่มี enrollment record
      // สร้าง record แบบยังไม่ลงทะเบียนไว้ เพื่อให้ certificate อ้างอิงได้
      const eligibleStudents = await prisma.classroom_students.findMany({
        where: {
          student: { deletedAt: null },
          classroom: {
            deletedAt: null,
            camp_classroom: {
              some: { camp_camp_id: campId },
            },
          },
        },
        select: { student_students_id: true },
        distinct: ["student_students_id"],
      });

      if (eligibleStudents.length > 0) {
        const studentIds = eligibleStudents.map(
          (student) => student.student_students_id,
        );
        const snapshots = await buildEnrollmentSnapshotMap(
          prisma,
          campId,
          studentIds,
        );
        await prisma.student_enrollment.createMany({
          data: eligibleStudents.map((student) => ({
            student_students_id: student.student_students_id,
            camp_camp_id: campId,
            enrolled_at: null,
            ...(snapshots.get(student.student_students_id) || {}),
          })),
          skipDuplicates: true,
        });
      }
    }

    let enrollments = await prisma.student_enrollment.findMany({
      where: activeCampEnrollmentWhere(campId),
      include: {
        student: true,
        survey_response: { take: 1 },
        certificate: {
          select: { certificate_no: true },
          take: 1,
        },
        mission_result: {
          where: { status: "completed" },
          select: { mission_mission_id: true },
        },
      },
      orderBy: {
        student: {
          students_id: "asc",
        },
      },
    });

    // "all" และ "passed_conditions" หมายถึงเฉพาะผู้ที่กดลงทะเบียนแล้ว
    // ส่วน "all_students" รวมผู้ที่ถูกเพิ่มเข้าค่ายไว้ล่วงหน้า (enrolled_at = null)
    if (condition !== "all_students") {
      enrollments = enrollments.filter((e) => e.enrolled_at != null);
    }

    if (condition === "passed_conditions") {
      const missionIds = new Set(
        camp.station.flatMap((station) =>
          station.mission.map((mission) => mission.mission_id),
        ),
      );

      enrollments = enrollments.filter((e) => {
        return getCertificateEligibility({
          totalMissions: missionIds.size,
          completedMissionIds: e.mission_result
            .map((result) => result.mission_mission_id)
            .filter((missionId) => missionIds.has(missionId)),
          missionPercent: camp.cert_mission_completion_percent,
          requireSurvey: camp.cert_require_survey,
          hasSurveyResponse: e.survey_response.length > 0,
          hasIssuedCertificate: e.certificate.length > 0,
        }).eligible;
      });
    }

    if (enrollments.length === 0) {
      const message =
        condition === "all_students"
          ? "ค่ายนี้ยังไม่มีนักเรียน กรุณาเพิ่มนักเรียนเข้าห้องหรือค่ายก่อนสร้างเกียรติบัตร"
          : condition === "passed_conditions"
            ? "ยังไม่มีนักเรียนที่ผ่านเงื่อนไขการรับเกียรติบัตร"
            : "ยังไม่มีนักเรียนที่ลงทะเบียนในค่ายนี้";

      return NextResponse.json({ error: message }, { status: 404 });
    }

    if (camp.cert_show_number && camp.cert_number_start != null) {
      const studentsWithoutCert = enrollments.filter(
        (e) => e.certificate[0]?.certificate_no == null,
      );

      if (studentsWithoutCert.length > 0) {
        const MAX_RETRIES = 5;
        let lastError: any;
        let success = false;

        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
          try {
            await prisma.$transaction(
              async (tx) => {
                await tx.$executeRaw`SET @@tidb_txn_mode = 'pessimistic'`;
                await tx.$queryRaw`SELECT camp_id FROM camp WHERE camp_id = ${campId} FOR UPDATE`;

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

                for (const student of studentsWithoutCert) {
                  while (usedSet.has(newNo)) {
                    newNo++;
                  }

                  await tx.certificate.upsert({
                    where: {
                      student_enrollment_id: student.student_enrollment_id,
                    },
                    update: {
                      certificate_no: newNo,
                      certificate_no_star: newNo,
                    },
                    create: {
                      certificate_no: newNo,
                      certificate_no_star: newNo,
                      file_url: "",
                      student_enrollment_id: student.student_enrollment_id,
                    },
                  });

                  student.certificate = [{ certificate_no: newNo }];
                  usedSet.add(newNo);
                  newNo++;
                }
              },
              { isolationLevel: "ReadCommitted" },
            );

            success = true;
            break;
          } catch (txError: any) {
            lastError = txError;
            const errMsg = String(txError?.message ?? "");

            if (
              errMsg.includes("Write conflict") ||
              errMsg.includes("9007") ||
              errMsg.includes("Deadlock") ||
              errMsg.includes("Unique constraint") ||
              errMsg.includes("P2002")
            ) {
              await new Promise((r) => setTimeout(r, 50 + attempt * 100));
              continue;
            }
            throw txError;
          }
        }

        if (!success && lastError) {
          console.error(
            "Bulk certificate assignment failed after retries:",
            lastError,
          );

          return NextResponse.json(
            {
              error:
                "เกิดข้อผิดพลาดในการรันเลขที่เกียรติบัตร กรุณาลองใหม่อีกครั้ง",
            },
            { status: 500 },
          );
        }
      }
    }

    if (!camp.cert_show_number || camp.cert_number_start == null) {
      const untrackedCertificates = enrollments
        .filter((enrollment) => enrollment.certificate.length === 0)
        .map((enrollment) => ({
          certificate_no: null,
          certificate_no_star: null,
          file_url: "",
          student_enrollment_id: enrollment.student_enrollment_id,
        }));

      if (untrackedCertificates.length > 0) {
        await prisma.certificate.createMany({
          data: untrackedCertificates,
          skipDuplicates: true,
        });
      }
    }

    const requestOrigin = new URL(request.url).origin;
    const recipients = enrollments.map((enrollment) => {
      const prefix = enrollment.student.prefix_name?.trim() || "";
      const fullName = `${prefix}${enrollment.student.firstname.trim()} ${enrollment.student.lastname.trim()}`;
      const assignedCertNo = enrollment.certificate[0]?.certificate_no ?? null;
      const numberText =
        camp.cert_show_number && assignedCertNo != null
          ? buildCertNumberText(
              camp.cert_number_prefix || "",
              assignedCertNo,
              camp.cert_number_is_thai,
              camp.cert_year,
            )
          : null;
      const verificationUrl =
        camp.cert_show_qr && camp.cert_show_number && assignedCertNo != null
          ? buildCertificateVerificationUrl(
              requestOrigin,
              enrollment.student_enrollment_id,
            )
          : null;

      return { fullName, numberText, verificationUrl };
    });

    // ส่งข้อมูลที่ผ่านการตรวจสิทธิ์และจองเลขแล้วให้ browser เป็นผู้สร้าง PDF
    // เพื่อตัดการ fetch รูป วาด QR และประกอบ PDF ออกจาก server request
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
      recipients,
    };

    return NextResponse.json(
      { certificate },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      },
    );
  } catch (error) {
    console.error("Error preparing bulk certificates:", error);

    return NextResponse.json(
      { error: "Failed to prepare certificates." },
      { status: 500 },
    );
  }
}
