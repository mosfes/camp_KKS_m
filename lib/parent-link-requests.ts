import { prisma } from "@/lib/db";

export const PARENT_LINK_REQUEST_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const PARENT_LINK_RETRY_COOLDOWN_MS = 10 * 60 * 1000;

export async function expireParentLinkRequests() {
  const now = new Date();

  await prisma.parent_student_link_requests.updateMany({
    where: { status: "PENDING", expires_at: { lte: now } },
    data: { status: "EXPIRED", responded_at: now },
  });
}

export function maskParentPhone(value: string) {
  if (!value || value === "0000000000") return "";

  return value.length >= 4 ? `••••••${value.slice(-4)}` : "ไม่ระบุ";
}
