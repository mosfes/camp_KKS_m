import { NextResponse } from "next/server";

import { requireTeacher } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ACTIVE_CAMP_COOKIE, getCleanCampPath } from "@/lib/client-active-camp";
import { teacherCampAccessWhere } from "@/lib/teacher-camp-access";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ publicId: string }> },
) {
  const { teacher, error } = await requireTeacher();
  if (error) return error;
  const { publicId } = await params;
  const camp = await prisma.camp.findFirst({
    where: {
      public_id: publicId,
      ...teacherCampAccessWhere(teacher.teachers_id, teacher.role),
    },
    select: { camp_id: true },
  });
  if (!camp) return NextResponse.redirect(new URL("/headteacher/dashboard?tab=camp", request.url));
  const response = NextResponse.redirect(new URL(getCleanCampPath(), request.url));
  response.cookies.set(ACTIVE_CAMP_COOKIE, String(camp.camp_id), {
    httpOnly: false,
    sameSite: "lax",
    secure: new URL(request.url).protocol === "https:",
    path: "/headteacher/dashboard/camp",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
