import type { Metadata } from "next";

import Image from "next/image";
import {
  Ban,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  ShieldX,
} from "lucide-react";

import { prisma } from "@/lib/db";
import { verifyCertificateSignature } from "@/lib/certificate-verification";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ตรวจสอบเกียรติบัตร",
  robots: { index: false, follow: false },
};

type PageProps = {
  params: Promise<{ enrollmentId: string }>;
  searchParams: Promise<{ signature?: string | string[] }>;
};

type VerificationStatus = "active" | "revoked" | "invalid";

function toThaiNumerals(value: string): string {
  const thaiDigits = "๐๑๒๓๔๕๖๗๘๙";

  return value.replace(/[0-9]/g, (digit) => thaiDigits[Number(digit)]);
}

function formatCertificateNumber({
  number,
  prefix,
  year,
  isThai,
}: {
  number: number;
  prefix: string | null;
  year: string | null;
  isThai: boolean;
}): string {
  const padded = String(number).padStart(4, "0");
  let value = prefix ? `${prefix} ${padded}` : padded;

  if (year) value = `${value}/${year}`;

  return isThai ? toThaiNumerals(value) : value;
}

function VerificationCard({
  status,
  children,
}: {
  status: VerificationStatus;
  children?: React.ReactNode;
}) {
  const isActive = status === "active";
  const isRevoked = status === "revoked";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f5f2] px-4 py-10">
      <section className="w-full max-w-2xl overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-xl shadow-[#1a3a32]/10">
        <div
          className={`flex flex-col items-center px-6 pb-6 pt-8 text-center ${isActive ? "bg-[#e8f1ed]" : "bg-red-50"}`}
        >
          <Image
            priority
            unoptimized
            alt="KKS Camp"
            className="mb-4 h-16 w-16 object-contain"
            height={64}
            src="/images/logoKKS.png"
            width={64}
          />
          {isActive ? (
            <ShieldCheck className="mb-2 text-emerald-600" size={44} />
          ) : isRevoked ? (
            <Ban className="mb-2 text-red-600" size={44} />
          ) : (
            <ShieldX className="mb-2 text-red-600" size={44} />
          )}
          <h1 className="text-xl font-black text-gray-900">
            {isActive
              ? "เกียรติบัตรถูกต้อง"
              : isRevoked
                ? "เกียรติบัตรถูกเพิกถอน"
                : "ไม่พบเกียรติบัตรที่ถูกต้อง"}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            {isActive
              ? "ข้อมูลนี้ออกและยืนยันโดยระบบ KKS Camp"
              : isRevoked
                ? "เกียรติบัตรใบนี้มีอยู่จริง แต่ไม่สามารถใช้งานได้แล้ว"
                : "ลิงก์ไม่ถูกต้อง ถูกแก้ไข ไม่มีเลขที่ หรือยังไม่เคยออกเกียรติบัตร"}
          </p>
        </div>
        {children}
      </section>
    </main>
  );
}

export default async function CertificateVerificationPage({
  params,
  searchParams,
}: PageProps) {
  const [{ enrollmentId: rawEnrollmentId }, resolvedSearchParams] =
    await Promise.all([params, searchParams]);
  const enrollmentId = Number(rawEnrollmentId);
  const signatureValue = resolvedSearchParams.signature;
  const signature = Array.isArray(signatureValue)
    ? signatureValue[0]
    : signatureValue || "";

  if (!verifyCertificateSignature(enrollmentId, signature)) {
    return <VerificationCard status="invalid" />;
  }

  const certificate = await prisma.certificate.findUnique({
    where: { student_enrollment_id: enrollmentId },
    select: {
      issue_date: true,
      certificate_no: true,
      file_url: true,
      revoked_at: true,
      revocation_reason: true,
      student_enrollment: {
        select: {
          student: {
            select: { prefix_name: true, firstname: true, lastname: true },
          },
          mission_result: {
            where: { status: "completed" },
            select: { mission_mission_id: true },
          },
          camp: {
            select: {
              name: true,
              cert_number_prefix: true,
              cert_number_is_thai: true,
              cert_year: true,
              deletedAt: true,
              img_certificate_url: true,
              img_certificate_width: true,
              img_certificate_height: true,
              cert_name_x: true,
              cert_name_y: true,
              cert_font_size: true,
              cert_font_color: true,
              cert_number_x: true,
              cert_number_y: true,
              cert_number_size: true,
              cert_number_color: true,
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
        },
      },
    },
  });

  // A signed enrollment URL is not enough: verification requires an issued,
  // numbered certificate. This also prevents old unnumbered records opening QR.
  if (
    !certificate ||
    certificate.certificate_no == null ||
    certificate.student_enrollment.camp.deletedAt
  ) {
    return <VerificationCard status="invalid" />;
  }

  const {
    student,
    camp,
    mission_result: missionResults,
  } = certificate.student_enrollment;
  const recipientName = `${student.prefix_name?.trim() || ""}${student.firstname.trim()} ${student.lastname.trim()}`;
  const certificateNumber = formatCertificateNumber({
    number: certificate.certificate_no,
    prefix: camp.cert_number_prefix,
    year: camp.cert_year,
    isThai: camp.cert_number_is_thai,
  });
  const missionIds = new Set(
    camp.station.flatMap((station) =>
      station.mission.map((mission) => mission.mission_id),
    ),
  );
  const completedMissionCount = new Set(
    missionResults
      .map((result) => result.mission_mission_id)
      .filter((missionId) => missionIds.has(missionId)),
  ).size;
  const status: VerificationStatus = certificate.revoked_at
    ? "revoked"
    : "active";
  const imageWidth = camp.img_certificate_width || 1000;
  const imageHeight = camp.img_certificate_height || 707;

  return (
    <VerificationCard status={status}>
      <div className="px-6 py-5 sm:px-8">
        <div
          className={`mb-5 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-bold ${
            status === "active"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {status === "active" ? (
            <CheckCircle2 aria-hidden="true" size={20} />
          ) : (
            <Ban aria-hidden="true" size={20} />
          )}
          สถานะ: {status === "active" ? "ใช้งานได้" : "ถูกเพิกถอน"}
        </div>

        <dl className="divide-y divide-gray-100">
          <div className="py-4">
            <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              ชื่อผู้ได้รับ
            </dt>
            <dd className="mt-1 text-lg font-bold text-gray-900">
              {recipientName}
            </dd>
          </div>
          <div className="py-4">
            <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              หลักสูตร / กิจกรรม
            </dt>
            <dd className="mt-1 font-semibold text-gray-800">{camp.name}</dd>
          </div>
          <div className="grid grid-cols-1 gap-4 py-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                เลขที่เกียรติบัตร
              </dt>
              <dd className="mt-1 font-semibold text-gray-800">
                {certificateNumber}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                วันที่ออก
              </dt>
              <dd className="mt-1 font-semibold text-gray-800">
                {certificate.issue_date.toLocaleDateString("th-TH", {
                  dateStyle: "long",
                  timeZone: "Asia/Bangkok",
                })}
              </dd>
            </div>
          </div>
          <div className="py-4">
            <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              ภารกิจที่ทำสำเร็จ
            </dt>
            <dd className="mt-1 font-semibold text-gray-800">
              {completedMissionCount} จาก {missionIds.size} ภารกิจ
            </dd>
          </div>
          {certificate.revocation_reason && (
            <div className="py-4">
              <dt className="text-xs font-semibold uppercase tracking-wide text-red-400">
                เหตุผลที่เพิกถอน
              </dt>
              <dd className="mt-1 text-sm font-medium text-red-700">
                {certificate.revocation_reason}
              </dd>
            </div>
          )}
        </dl>

        {camp.img_certificate_url && (
          <div className="mt-5 border-t border-gray-100 pt-5">
            <h2 className="mb-3 text-sm font-bold text-gray-800">
              ภาพตัวอย่างเกียรติบัตร
            </h2>
            <div
              className="relative w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-50 shadow-sm"
              style={{
                aspectRatio: `${imageWidth} / ${imageHeight}`,
                containerType: "inline-size",
              }}
            >
              <Image
                fill
                alt={`เกียรติบัตรของ ${recipientName}`}
                className="object-cover"
                sizes="(max-width: 672px) 100vw, 608px"
                src={camp.img_certificate_url}
              />
              <span
                className="absolute z-10 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap"
                style={{
                  color: camp.cert_font_color || "#000000",
                  fontFamily: "THSarabunNew, Sarabun, sans-serif",
                  fontSize: `${((camp.cert_font_size || 48) / imageWidth) * 100}cqi`,
                  left: `${camp.cert_name_x ?? 50}%`,
                  top: `${camp.cert_name_y ?? 50}%`,
                }}
              >
                {recipientName}
              </span>
              <span
                className="absolute z-10 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap"
                style={{
                  color: camp.cert_number_color || "#000000",
                  fontFamily: "THSarabunNew, Sarabun, sans-serif",
                  fontSize: `${((camp.cert_number_size || 36) / imageWidth) * 100}cqi`,
                  left: `${camp.cert_number_x ?? 50}%`,
                  top: `${camp.cert_number_y ?? 10}%`,
                }}
              >
                {certificateNumber}
              </span>
            </div>
          </div>
        )}

        {certificate.file_url && (
          <a
            className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[#1a3a32] underline-offset-4 hover:underline"
            href={certificate.file_url}
            rel="noreferrer"
            target="_blank"
          >
            เปิดไฟล์เกียรติบัตร
            <ExternalLink aria-hidden="true" size={16} />
          </a>
        )}
      </div>
      <p className="border-t border-gray-100 px-6 py-4 text-center text-xs leading-relaxed text-gray-500 sm:px-8">
        โปรดเปรียบเทียบชื่อ กิจกรรม และเลขที่ด้านบนกับข้อมูลบนเกียรติบัตร
      </p>
    </VerificationCard>
  );
}
