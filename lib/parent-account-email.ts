import { createHash, randomBytes } from "node:crypto";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const PARENT_AUTH_TOKEN_TTL_MS = 30 * 60 * 1000;

export function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function isValidEmail(value: string): boolean {
  return value.length <= 255 && EMAIL_PATTERN.test(value);
}

export function createParentAuthToken(): {
  token: string;
  tokenHash: string;
} {
  const token = randomBytes(32).toString("base64url");

  return { token, tokenHash: hashParentAuthToken(token) };
}

export function hashParentAuthToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function resolvePasswordResetRecipient(options: {
  recipientEmailInput: string;
  storedParentEmail: string | null;
  parentEmailVerified: boolean;
  parentName: string;
  studentEmail: string;
  studentName: string;
}): { email: string; name: string } | null {
  const requestedEmail = normalizeEmail(options.recipientEmailInput);
  const studentEmail = normalizeEmail(options.studentEmail);

  if (requestedEmail) {
    const storedParentEmail = normalizeEmail(options.storedParentEmail);

    if (
      options.parentEmailVerified &&
      requestedEmail === storedParentEmail &&
      isValidEmail(storedParentEmail)
    ) {
      return { email: storedParentEmail, name: options.parentName };
    }

    return requestedEmail === studentEmail && isValidEmail(studentEmail)
      ? { email: studentEmail, name: options.studentName }
      : null;
  }

  return isValidEmail(studentEmail)
    ? { email: studentEmail, name: options.studentName }
    : null;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function emailShell(options: {
  heading: string;
  greeting: string;
  detail: string;
  actionLabel: string;
  actionUrl: string;
  expiryText: string;
}): string {
  const actionUrl = escapeHtml(options.actionUrl);

  return `<!doctype html>
<html lang="th">
  <body style="margin:0;background:#f6f3eb;font-family:Arial,'Noto Sans Thai',sans-serif;color:#334155">
    <div style="max-width:560px;margin:0 auto;padding:32px 16px">
      <div style="background:#ffffff;border-radius:18px;padding:32px;box-shadow:0 4px 20px rgba(15,23,42,.06)">
        <p style="margin:0 0 8px;color:#5d7c6f;font-size:13px;font-weight:700">KKS Camp</p>
        <h1 style="margin:0 0 20px;font-size:24px">${escapeHtml(options.heading)}</h1>
        <p style="margin:0 0 12px">${escapeHtml(options.greeting)}</p>
        <p style="margin:0 0 24px;line-height:1.7">${escapeHtml(options.detail)}</p>
        <a href="${actionUrl}" style="display:inline-block;border-radius:12px;background:#5d7c6f;padding:13px 20px;color:#fff;text-decoration:none;font-weight:700">${escapeHtml(options.actionLabel)}</a>
        <p style="margin:24px 0 0;color:#64748b;font-size:13px;line-height:1.6">ลิงก์นี้ใช้ได้ครั้งเดียวและจะหมดอายุภายใน ${escapeHtml(options.expiryText)} หากคุณไม่ได้ดำเนินการนี้ สามารถละเว้นอีเมลฉบับนี้ได้</p>
      </div>
    </div>
  </body>
</html>`;
}

export function createPasswordResetEmail(options: {
  recipientName: string;
  actionUrl: string;
}) {
  const greeting = `เรียน ${options.recipientName}`;
  const detail =
    "มีคำขอให้ตั้งรหัสผ่านบัญชีผู้ปกครองใหม่ กรุณากดปุ่มด้านล่างเพื่อดำเนินการ";

  return {
    subject: "ตั้งรหัสผ่านผู้ปกครองใหม่ | KKS Camp",
    html: emailShell({
      heading: "ตั้งรหัสผ่านใหม่",
      greeting,
      detail,
      actionLabel: "ตั้งรหัสผ่านใหม่",
      actionUrl: options.actionUrl,
      expiryText: "30 นาที",
    }),
    text: `${greeting}\n\n${detail}\n${options.actionUrl}\n\nลิงก์นี้ใช้ได้ครั้งเดียวและจะหมดอายุภายใน 30 นาที`,
  };
}

export function createParentEmailVerificationEmail(options: {
  recipientName: string;
  actionUrl: string;
}) {
  const greeting = `เรียน ${options.recipientName}`;
  const detail =
    "กรุณายืนยันอีเมลนี้เพื่อใช้รับลิงก์ตั้งรหัสผ่านบัญชีผู้ปกครองใหม่ในอนาคต";

  return {
    subject: "ยืนยันอีเมลผู้ปกครอง | KKS Camp",
    html: emailShell({
      heading: "ยืนยันอีเมลผู้ปกครอง",
      greeting,
      detail,
      actionLabel: "ยืนยันอีเมล",
      actionUrl: options.actionUrl,
      expiryText: "30 นาที",
    }),
    text: `${greeting}\n\n${detail}\n${options.actionUrl}\n\nลิงก์นี้ใช้ได้ครั้งเดียวและจะหมดอายุภายใน 30 นาที`,
  };
}
