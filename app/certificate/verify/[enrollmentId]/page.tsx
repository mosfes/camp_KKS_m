import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import Image from "next/image";
import {
  Ban,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  Hash,
  ShieldCheck,
  ShieldX,
  Target,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import * as QRCode from "qrcode";

import { prisma } from "@/lib/db";
import {
  buildCertificateVerificationUrl,
  signCertificateEnrollment,
  verifyCertificateSignature,
} from "@/lib/certificate-verification";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ตรวจสอบเกียรติบัตร",
  robots: { index: false, follow: false },
};

type PageProps = {
  params: Promise<{ enrollmentId: string }>;
  searchParams: Promise<{ signature?: string | string[] }>;
};

// Same font and anchoring the certificate renderer draws with (lib/certificate-renderer.ts).
const CERTIFICATE_FONT_STACK = "CertificateTHSarabunNew, THSarabunNew, sans-serif";
const CERTIFICATE_FONT_FACE = `@font-face{font-family:"CertificateTHSarabunNew";src:url("/fonts/THSarabunNew.ttf");font-display:block}`;

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

function InfoTile({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
      <dt className="flex items-center gap-2 text-xs font-semibold text-gray-500">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-[#1a3a32] shadow-sm ring-1 ring-gray-100">
          <Icon aria-hidden="true" size={15} />
        </span>
        {label}
      </dt>
      <dd className="mt-2.5 text-base font-bold text-gray-900">{children}</dd>
    </div>
  );
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
  const StatusIcon = isActive ? ShieldCheck : isRevoked ? Ban : ShieldX;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f3f5f2] px-4 py-8 sm:py-14">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-gradient-to-b from-[#1a3a32]/10 to-transparent"
      />
      <div className="relative mx-auto w-full max-w-2xl">
        <section className="overflow-hidden rounded-[2rem] bg-white shadow-2xl shadow-[#1a3a32]/15 ring-1 ring-black/5">
          <header
            className={`relative overflow-hidden px-6 pb-14 pt-9 text-center text-white ${
              isActive
                ? "bg-gradient-to-br from-[#1a3a32] via-[#235245] to-[#2f6b57]"
                : "bg-gradient-to-br from-red-800 via-red-700 to-red-600"
            }`}
          >
            <div
              aria-hidden="true"
              className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10"
            />
            <div
              aria-hidden="true"
              className="absolute -bottom-24 -left-10 h-56 w-56 rounded-full bg-white/[0.07]"
            />
            <div className="relative flex flex-col items-center">
              <div className="mb-5 rounded-full bg-white p-1.5 shadow-lg ring-4 ring-white/25">
                <Image
                  priority
                  unoptimized
                  alt="KKS Camp"
                  className="h-16 w-16 object-contain"
                  height={64}
                  src="/images/logoKKS.png"
                  width={64}
                />
              </div>
              <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
                {isActive
                  ? "เกียรติบัตรถูกต้อง"
                  : isRevoked
                    ? "เกียรติบัตรถูกเพิกถอน"
                    : "ไม่พบเกียรติบัตรที่ถูกต้อง"}
              </h1>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-white/75">
                {isActive
                  ? "ข้อมูลนี้ออกและยืนยันโดยระบบ KKS Camp"
                  : isRevoked
                    ? "เกียรติบัตรใบนี้มีอยู่จริง แต่ไม่สามารถใช้งานได้แล้ว"
                    : "ลิงก์ไม่ถูกต้อง ถูกแก้ไข ไม่มีเลขที่ หรือยังไม่เคยออกเกียรติบัตร"}
              </p>
            </div>
          </header>

          <div className="relative px-5 pb-8 sm:px-9">
            <div
              className={`relative -mt-9 mx-auto flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-white shadow-xl ring-8 ring-white ${
                isActive ? "text-emerald-600" : "text-red-600"
              }`}
            >
              <span
                className={`absolute inset-1.5 rounded-full ${isActive ? "bg-emerald-50" : "bg-red-50"}`}
              />
              <StatusIcon aria-hidden="true" className="relative" size={34} />
            </div>
            {children}
          </div>
        </section>

        <p className="mt-6 text-center text-xs text-gray-400">
          KKS Camp · ระบบตรวจสอบเกียรติบัตรอิเล็กทรอนิกส์
        </p>
      </div>
    </main>
  );
}

export default async function CertificateVerificationPage({
  params,
  searchParams,
}: PageProps) {
  const [{ enrollmentId: rawEnrollmentId }, resolvedSearchParams] =
    await Promise.all([params, searchParams]);
  const isLegacyId = /^[1-9]\d*$/.test(rawEnrollmentId);
  const signatureValue = resolvedSearchParams.signature;
  const signature = Array.isArray(signatureValue)
    ? signatureValue[0]
    : signatureValue || "";

  if (!verifyCertificateSignature(rawEnrollmentId, signature)) {
    return <VerificationCard status="invalid" />;
  }

  const enrollment = await prisma.student_enrollment.findFirst({
    where: isLegacyId
      ? { student_enrollment_id: Number(rawEnrollmentId) }
      : { public_id: rawEnrollmentId },
    select: { student_enrollment_id: true, public_id: true },
  });
  if (!enrollment) return <VerificationCard status="invalid" />;
  if (isLegacyId) {
    const publicSignature = signCertificateEnrollment(enrollment.public_id);
    redirect(
      `/certificate/verify/${enrollment.public_id}?signature=${encodeURIComponent(publicSignature)}`,
    );
  }

  const certificate = await prisma.certificate.findUnique({
    where: { student_enrollment_id: enrollment.student_enrollment_id },
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
              cert_show_number: true,
              cert_show_qr: true,
              cert_qr_x: true,
              cert_qr_y: true,
              cert_qr_size: true,
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
  const isActive = status === "active";
  const imageWidth = camp.img_certificate_width || 1000;
  const imageHeight = camp.img_certificate_height || 707;
  const qrSize = camp.cert_qr_size || 140;
  let qrDataUrl: string | null = null;

  if (camp.cert_show_qr) {
    const requestHeaders = await headers();
    const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
    const protocol =
      requestHeaders.get("x-forwarded-proto") ??
      (host?.startsWith("localhost") ? "http" : "https");

    if (host) {
      qrDataUrl = await QRCode.toDataURL(
        buildCertificateVerificationUrl(`${protocol}://${host}`, rawEnrollmentId),
        { errorCorrectionLevel: "M", margin: 1, width: Math.round(qrSize) },
      );
    }
  }
  const progressPercent = missionIds.size
    ? Math.min(100, Math.round((completedMissionCount / missionIds.size) * 100))
    : 0;

  return (
    <VerificationCard status={status}>
      <style>{CERTIFICATE_FONT_FACE}</style>
      <div className="mt-4 flex justify-center">
        <span
          className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-bold ring-1 ${
            isActive
              ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
              : "bg-red-50 text-red-700 ring-red-200"
          }`}
        >
          {isActive ? (
            <CheckCircle2 aria-hidden="true" size={16} />
          ) : (
            <Ban aria-hidden="true" size={16} />
          )}
          สถานะ: {isActive ? "ใช้งานได้" : "ถูกเพิกถอน"}
        </span>
      </div>

      <div className="mt-7 text-center">
        <p className="text-xs font-semibold tracking-wide text-gray-400">
          ชื่อผู้ได้รับ
        </p>
        <p className="mt-1.5 text-2xl font-black leading-tight text-gray-900 sm:text-3xl">
          {recipientName}
        </p>
        <div
          aria-hidden="true"
          className="mx-auto my-5 flex max-w-xs items-center gap-3 text-gray-300"
        >
          <span className="h-px flex-1 bg-gradient-to-r from-transparent to-gray-200" />
          <span className="h-1.5 w-1.5 rotate-45 bg-[#1a3a32]/40" />
          <span className="h-px flex-1 bg-gradient-to-l from-transparent to-gray-200" />
        </div>
        <p className="text-xs font-semibold tracking-wide text-gray-400">
          หลักสูตร / กิจกรรม
        </p>
        <p className="mt-1.5 text-lg font-bold leading-snug text-[#1a3a32]">
          {camp.name}
        </p>
      </div>

      <dl className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <InfoTile icon={Hash} label="เลขที่เกียรติบัตร">
          {certificateNumber}
        </InfoTile>
        <InfoTile icon={CalendarDays} label="วันที่ออก">
          {certificate.issue_date.toLocaleDateString("th-TH", {
            dateStyle: "long",
            timeZone: "Asia/Bangkok",
          })}
        </InfoTile>
        <div className="sm:col-span-2">
          <InfoTile icon={Target} label="ภารกิจที่ทำสำเร็จ">
            <div className="flex items-baseline justify-between gap-3">
              <span>
                {completedMissionCount} จาก {missionIds.size} ภารกิจ
              </span>
              <span className="text-sm font-semibold text-gray-500">
                {progressPercent}%
              </span>
            </div>
            <div
              aria-hidden="true"
              className="mt-2.5 h-2 overflow-hidden rounded-full bg-gray-200"
            >
              <div
                className={`h-full rounded-full ${
                  isActive
                    ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
                    : "bg-gray-400"
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </InfoTile>
        </div>
      </dl>

      {certificate.revocation_reason && (
        <div className="mt-3 rounded-2xl border border-red-100 bg-red-50 p-4">
          <p className="text-xs font-semibold text-red-500">เหตุผลที่เพิกถอน</p>
          <p className="mt-1 text-sm font-medium text-red-700">
            {certificate.revocation_reason}
          </p>
        </div>
      )}

      {camp.img_certificate_url && (
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-bold text-gray-800">
            ภาพตัวอย่างเกียรติบัตร
          </h2>
          <div className="rounded-2xl bg-gray-50 p-2 ring-1 ring-gray-100">
            <div
              className="relative w-full overflow-hidden rounded-xl bg-white shadow-md ring-1 ring-black/5"
              style={{ aspectRatio: `${imageWidth} / ${imageHeight}` }}
            >
              <Image
                fill
                alt={`เกียรติบัตรของ ${recipientName}`}
                className="object-cover"
                sizes="(max-width: 672px) 100vw, 608px"
                src={camp.img_certificate_url}
              />
              <svg
                aria-hidden="true"
                className="absolute inset-0 h-full w-full"
                viewBox={`0 0 ${imageWidth} ${imageHeight}`}
              >
                <text
                  fill={camp.cert_font_color || "#000000"}
                  fontFamily={CERTIFICATE_FONT_STACK}
                  fontSize={camp.cert_font_size || 48}
                  textAnchor="middle"
                  x={((camp.cert_name_x ?? 50) / 100) * imageWidth}
                  y={
                    ((camp.cert_name_y ?? 50) / 100) * imageHeight +
                    (camp.cert_font_size || 48) / 3
                  }
                >
                  {recipientName}
                </text>
                {camp.cert_show_number && (
                  <text
                    fill={camp.cert_number_color || "#000000"}
                    fontFamily={CERTIFICATE_FONT_STACK}
                    fontSize={camp.cert_number_size || 36}
                    textAnchor="middle"
                    x={((camp.cert_number_x ?? 50) / 100) * imageWidth}
                    y={
                      ((camp.cert_number_y ?? 10) / 100) * imageHeight +
                      (camp.cert_number_size || 36) / 3
                    }
                  >
                    {certificateNumber}
                  </text>
                )}
                {qrDataUrl && (
                  <image
                    height={qrSize}
                    href={qrDataUrl}
                    width={qrSize}
                    x={((camp.cert_qr_x ?? 90) / 100) * imageWidth - qrSize / 2}
                    y={((camp.cert_qr_y ?? 88) / 100) * imageHeight - qrSize / 2}
                  />
                )}
              </svg>
            </div>
          </div>
        </div>
      )}

      {certificate.file_url && (
        <a
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1a3a32] px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-[#1a3a32]/20 transition hover:bg-[#235245] active:scale-[0.99]"
          href={certificate.file_url}
          rel="noreferrer"
          target="_blank"
        >
          เปิดไฟล์เกียรติบัตร
          <ExternalLink aria-hidden="true" size={16} />
        </a>
      )}

      <p className="mt-6 rounded-2xl bg-amber-50/70 px-4 py-3 text-center text-xs leading-relaxed text-amber-800 ring-1 ring-amber-100">
        โปรดเปรียบเทียบชื่อ กิจกรรม และเลขที่ด้านบนกับข้อมูลบนเกียรติบัตร
      </p>
    </VerificationCard>
  );
}
