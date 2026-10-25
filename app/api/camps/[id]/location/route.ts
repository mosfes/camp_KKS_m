import { NextResponse } from "next/server";
import { z } from "zod";

import {
  getCampLocationAccess,
  getCampLocationViewer,
} from "@/lib/camp-location-auth";
import { prisma } from "@/lib/db";
import { activeCampEnrollmentWhere } from "@/lib/active-camp-student";
import { getBangkokDateKey, isBangkokDateBefore } from "@/lib/bangkok-date";
import { getParentSession } from "@/lib/parent-auth";
import { resolveParentStudent } from "@/lib/parent-student-access";

const coordinateSchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
});

const settingsSchema = z.object({
  destination: coordinateSchema
    .extend({
      name: z.string().trim().min(1).max(255),
      address: z.string().trim().max(500).optional().nullable(),
    })
    .nullable()
    .optional(),
  sharingEnabled: z.boolean().optional(),
  updateIntervalMinutes: z.union([z.literal(5), z.literal(10)]).optional(),
});

const updateSchema = coordinateSchema.extend({
  accuracy: z.number().finite().min(0).max(100000).optional().nullable(),
});

const LOCATION_NOTICE_VERSION = "2026-07-16";

const studentSharingSchema = z.object({
  enabled: z.boolean(),
  noticeVersion: z.literal(LOCATION_NOTICE_VERSION).optional(),
});

async function authorize(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const campId = Number(id);

  if (!Number.isInteger(campId) || campId <= 0) {
    return {
      error: NextResponse.json(
        { error: "รหัสค่ายไม่ถูกต้อง" },
        { status: 400 },
      ),
    };
  }

  let viewer = await getCampLocationViewer();

  if (!viewer) {
    return {
      error: NextResponse.json(
        { error: "กรุณาเข้าสู่ระบบก่อน" },
        { status: 401 },
      ),
    };
  }

  if (viewer.kind === "parent") {
    const parent = await getParentSession();
    if (!parent) {
      return {
        error: NextResponse.json({ error: "กรุณาเข้าสู่ระบบก่อน" }, { status: 401 }),
      };
    }
    const selected = await resolveParentStudent(request, parent);
    if (selected.error) return { error: selected.error };
    viewer = { kind: "parent", studentId: selected.studentId };
  }

  const access = await getCampLocationAccess(campId, viewer);

  if (!access.exists) {
    return {
      error: NextResponse.json({ error: "ไม่พบค่าย" }, { status: 404 }),
    };
  }

  if (!access.canView) {
    return {
      error: NextResponse.json(
        { error: "ไม่มีสิทธิ์ดูตำแหน่งค่ายนี้" },
        { status: 403 },
      ),
    };
  }

  return { campId, viewer, access };
}

function studentName(student: {
  prefix_name: string | null;
  firstname: string;
  lastname: string;
}) {
  return `${student.prefix_name ?? ""}${student.firstname} ${student.lastname}`;
}

function isUnderTen(birthday: Date | null) {
  if (!birthday) return false;

  const [year, month, day] = getBangkokDateKey(birthday).split("-");
  const tenthBirthday = `${Number(year) + 10}-${month}-${day}`;

  return tenthBirthday > getBangkokDateKey();
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await authorize(request, context);

  if (auth.error) return auth.error;

  const { campId, viewer, access } = auth;
  const camp = await prisma.camp.findUnique({
    where: { camp_id: campId },
    select: {
      destination_name: true,
      destination_address: true,
      destination_latitude: true,
      destination_longitude: true,
      location_sharing_enabled: true,
      location_update_interval: true,
      end_date: true,
    },
  });

  if (!camp) {
    return NextResponse.json({ error: "ไม่พบค่าย" }, { status: 404 });
  }

  const isEnded = isBangkokDateBefore(camp.end_date);
  if (isEnded) {
    // A finished camp must not retain or resume student location tracking.
    await prisma.$transaction([
      prisma.camp.updateMany({
        where: { camp_id: campId, location_sharing_enabled: true },
        data: { location_sharing_enabled: false },
      }),
      prisma.student_enrollment.updateMany({
        where: { camp_camp_id: campId, location_sharing_enabled: true },
        data: { location_sharing_enabled: false },
      }),
      prisma.student_location_update.deleteMany({
        where: { camp_camp_id: campId },
      }),
    ]);
  }
  const sharingEnabled = !isEnded && camp.location_sharing_enabled;

  let students: Array<{
    studentId: number;
    name: string;
    nickname: string | null;
    profileImageUrl: string | null;
    initials: string;
    sharingEnabled: boolean;
    latest: {
      latitude: number;
      longitude: number;
      accuracy: number | null;
      recorded_at: Date;
    } | null;
  }> = [];
  let viewerPath: Array<{
    latitude: number;
    longitude: number;
    accuracy: number | null;
    recorded_at: Date;
  }> = [];
  let studentSharingEnabled = false;
  let hasActiveEnrollment = false;
  let requiresGuardianConsent = false;

  if (viewer.kind === "teacher") {
    const enrollments = await prisma.student_enrollment.findMany({
      where: {
        ...activeCampEnrollmentWhere(campId),
        enrolled_at: { not: null },
      },
      orderBy: { student_students_id: "asc" },
      select: {
        location_sharing_enabled: true,
        location_consent_at: true,
        location_consent_notice_version: true,
        student: {
          select: {
            students_id: true,
            prefix_name: true,
            firstname: true,
            lastname: true,
            nickname: true,
            profile_image_url: true,
            student_location_update: {
              where: { camp_camp_id: campId },
              orderBy: { recorded_at: "desc" },
              take: 1,
              select: {
                latitude: true,
                longitude: true,
                accuracy: true,
                recorded_at: true,
              },
            },
          },
        },
      },
    });

    students = enrollments.map(
      ({
        student,
        location_sharing_enabled,
        location_consent_at,
        location_consent_notice_version,
      }) => {
        const hasValidConsent =
          !isEnded && location_sharing_enabled &&
          location_consent_at != null &&
          location_consent_notice_version === LOCATION_NOTICE_VERSION;
        const latest = student.student_location_update[0] ?? null;

        return {
          studentId: student.students_id,
          name: studentName(student),
          nickname: student.nickname,
          profileImageUrl: student.profile_image_url,
          initials: `${student.firstname.charAt(0)}${student.lastname.charAt(0)}`,
          sharingEnabled: hasValidConsent,
          latest:
            sharingEnabled &&
            hasValidConsent &&
            latest &&
            latest.recorded_at >= location_consent_at
              ? latest
              : null,
        };
      },
    );
  } else {
    const enrollment = await prisma.student_enrollment.findUnique({
      where: {
        student_students_id_camp_camp_id: {
          student_students_id: viewer.studentId,
          camp_camp_id: campId,
        },
      },
      select: {
        location_sharing_enabled: true,
        location_consent_at: true,
        location_consent_notice_version: true,
        enrolled_at: true,
      },
    });

    studentSharingEnabled = Boolean(
      !isEnded && enrollment?.location_sharing_enabled &&
        enrollment.location_consent_at &&
        enrollment.location_consent_notice_version === LOCATION_NOTICE_VERSION,
    );
    hasActiveEnrollment = enrollment?.enrolled_at != null;

    const student = await prisma.students.findUnique({
      where: { students_id: viewer.studentId },
      select: {
        students_id: true,
        prefix_name: true,
        firstname: true,
        lastname: true,
        nickname: true,
        profile_image_url: true,
        birthday: true,
      },
    });

    if (student) {
      requiresGuardianConsent = isUnderTen(student.birthday);

      if (sharingEnabled && studentSharingEnabled) {
        viewerPath = await prisma.student_location_update.findMany({
          where: {
            camp_camp_id: campId,
            student_students_id: viewer.studentId,
            recorded_at: { gte: enrollment!.location_consent_at! },
          },
          orderBy: { recorded_at: "desc" },
          take: 1,
          select: {
            latitude: true,
            longitude: true,
            accuracy: true,
            recorded_at: true,
          },
        });
      }

      students = [
        {
          studentId: student.students_id,
          name: studentName(student),
          nickname: student.nickname,
          profileImageUrl: student.profile_image_url,
          initials: `${student.firstname.charAt(0)}${student.lastname.charAt(0)}`,
          sharingEnabled: studentSharingEnabled,
          latest: viewerPath.at(-1) ?? null,
        },
      ];
    }
  }

  return NextResponse.json(
    {
      destination:
        camp.destination_latitude != null &&
        camp.destination_longitude != null &&
        camp.destination_name
          ? {
              name: camp.destination_name,
              address: camp.destination_address,
              latitude: camp.destination_latitude,
              longitude: camp.destination_longitude,
            }
          : null,
      sharingEnabled,
      isEnded,
      studentSharingEnabled,
      updateIntervalMinutes: [5, 10].includes(camp.location_update_interval)
        ? camp.location_update_interval
        : 10,
      students,
      viewerPath,
      permissions: {
        canConfigure: access.canConfigure,
        canSubmitStudentLocation: access.canSubmitStudentLocation,
        canManageStudentSharing:
          (viewer.kind === "student" &&
            access.canSubmitStudentLocation &&
            !requiresGuardianConsent) ||
          (viewer.kind === "parent" && hasActiveEnrollment && !isEnded),
      },
      privacy: {
        noticeVersion: LOCATION_NOTICE_VERSION,
        purpose:
          "ใช้เพื่อดูแลความปลอดภัยและประสานงานระหว่างการเดินทางของค่ายนี้เท่านั้น",
        recipients: "ครูที่เกี่ยวข้องกับค่ายและผู้ปกครองของนักเรียน",
        retention: "ระบบเก็บเฉพาะพิกัดล่าสุด และลบเมื่อปิดแชร์หรือปิดการติดตาม",
        requiresGuardianConsent,
      },
      trackingLabel:
        viewer.kind === "teacher"
          ? "ตำแหน่งล่าสุดของนักเรียนที่ลงทะเบียน"
          : viewer.kind === "parent"
            ? "ตำแหน่งล่าสุดของบุตรหลาน"
            : "ตำแหน่งของฉันที่ผู้ปกครองและครูมองเห็น",
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await authorize(request, context);

  if (auth.error) return auth.error;
  if (!auth.access.canConfigure) {
    return NextResponse.json(
      { error: "เฉพาะผู้สร้างค่ายหรือผู้ดูแลระบบเท่านั้นที่ตั้งค่าจุดหมายได้" },
      { status: 403 },
    );
  }

  try {
    const body = settingsSchema.parse(await request.json());
    if (body.sharingEnabled === true && auth.access.isEnded) {
      return NextResponse.json(
        { error: "ค่ายสิ้นสุดแล้ว ไม่สามารถเปิดติดตามตำแหน่งได้" },
        { status: 409 },
      );
    }
    const existing = await prisma.camp.findUnique({
      where: { camp_id: auth.campId },
      select: { destination_latitude: true, destination_longitude: true },
    });
    const willHaveDestination =
      body.destination !== null &&
      (body.destination !== undefined ||
        (existing?.destination_latitude != null &&
          existing.destination_longitude != null));

    if (body.sharingEnabled === true && !willHaveDestination) {
      return NextResponse.json(
        { error: "กรุณาปักหมุดจุดหมายก่อนเปิดแชร์ตำแหน่ง" },
        { status: 400 },
      );
    }

    const destinationData =
      body.destination === undefined
        ? {}
        : body.destination === null
          ? {
              destination_name: null,
              destination_address: null,
              destination_latitude: null,
              destination_longitude: null,
              location_sharing_enabled: false,
            }
          : {
              destination_name: body.destination.name,
              destination_address: body.destination.address || null,
              destination_latitude: body.destination.latitude,
              destination_longitude: body.destination.longitude,
            };

    await prisma.$transaction(async (tx) => {
      await tx.camp.update({
        where: { camp_id: auth.campId },
        data: {
          ...destinationData,
          ...(body.sharingEnabled !== undefined && {
            location_sharing_enabled: body.sharingEnabled,
          }),
          ...(body.updateIntervalMinutes !== undefined && {
            location_update_interval: body.updateIntervalMinutes,
          }),
        },
      });

      if (body.sharingEnabled === false || body.destination === null) {
        await tx.student_location_update.deleteMany({
          where: { camp_camp_id: auth.campId },
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "ข้อมูลตำแหน่งไม่ถูกต้อง" },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "บันทึกการตั้งค่าไม่สำเร็จ" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await authorize(request, context);

  if (auth.error) return auth.error;
  if (auth.viewer.kind === "teacher") {
    return NextResponse.json(
      { error: "ไม่มีสิทธิ์ตั้งค่าการแชร์ตำแหน่งของนักเรียน" },
      { status: 403 },
    );
  }
  const studentId = auth.viewer.studentId;
  const consentBy = auth.viewer.kind;

  try {
    const body = studentSharingSchema.parse(await request.json());
    if (body.enabled && auth.access.isEnded) {
      return NextResponse.json(
        { error: "ค่ายสิ้นสุดแล้ว ไม่สามารถเปิดแชร์ตำแหน่งได้" },
        { status: 409 },
      );
    }
    const enrollment = await prisma.student_enrollment.findUnique({
      where: {
        student_students_id_camp_camp_id: {
          student_students_id: studentId,
          camp_camp_id: auth.campId,
        },
      },
      select: { enrolled_at: true },
    });

    if (enrollment?.enrolled_at == null) {
      return NextResponse.json(
        { error: "นักเรียนต้องลงทะเบียนค่ายก่อนตั้งค่าการแชร์ตำแหน่ง" },
        { status: 403 },
      );
    }

    if (body.enabled && body.noticeVersion !== LOCATION_NOTICE_VERSION) {
      return NextResponse.json(
        { error: "กรุณารับทราบรายละเอียดการใช้ข้อมูลตำแหน่งก่อน" },
        { status: 400 },
      );
    }

    if (body.enabled && consentBy === "student") {
      const student = await prisma.students.findUnique({
        where: { students_id: studentId },
        select: { birthday: true },
      });

      if (isUnderTen(student?.birthday ?? null)) {
        return NextResponse.json(
          { error: "นักเรียนอายุต่ำกว่า 10 ปีต้องให้ผู้ปกครองเป็นผู้เปิดแชร์" },
          { status: 403 },
        );
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.student_enrollment.update({
        where: {
          student_students_id_camp_camp_id: {
            student_students_id: studentId,
            camp_camp_id: auth.campId,
          },
        },
        data: {
          location_sharing_enabled: body.enabled,
          location_consent_at: body.enabled ? new Date() : null,
          location_consent_by: body.enabled ? consentBy : null,
          location_consent_notice_version: body.enabled
            ? LOCATION_NOTICE_VERSION
            : null,
        },
      });

      if (!body.enabled) {
        await tx.student_location_update.deleteMany({
          where: {
            camp_camp_id: auth.campId,
            student_students_id: studentId,
          },
        });
      }
    });

    return NextResponse.json({
      success: true,
      studentSharingEnabled: body.enabled,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "สถานะการแชร์ตำแหน่งไม่ถูกต้อง" },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "บันทึกสถานะการแชร์ตำแหน่งไม่สำเร็จ" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await authorize(request, context);

  if (auth.error) return auth.error;
  if (auth.access.isEnded) {
    return NextResponse.json(
      { error: "ค่ายสิ้นสุดแล้ว ไม่สามารถส่งตำแหน่งได้" },
      { status: 409 },
    );
  }
  if (auth.viewer.kind !== "student" || !auth.access.canSubmitStudentLocation) {
    return NextResponse.json(
      { error: "เฉพาะนักเรียนที่ลงทะเบียนค่ายเท่านั้นที่ส่งตำแหน่งได้" },
      { status: 403 },
    );
  }
  const studentId = auth.viewer.studentId;

  try {
    const body = updateSchema.parse(await request.json());
    const camp = await prisma.camp.findUnique({
      where: { camp_id: auth.campId },
      select: { location_sharing_enabled: true },
    });

    if (!camp?.location_sharing_enabled) {
      return NextResponse.json(
        { error: "ครูยังไม่ได้เปิดการติดตามตำแหน่ง" },
        { status: 409 },
      );
    }

    const enrollment = await prisma.student_enrollment.findUnique({
      where: {
        student_students_id_camp_camp_id: {
          student_students_id: studentId,
          camp_camp_id: auth.campId,
        },
      },
      select: {
        location_sharing_enabled: true,
        location_consent_at: true,
        location_consent_notice_version: true,
      },
    });

    if (
      !enrollment?.location_sharing_enabled ||
      !enrollment.location_consent_at ||
      enrollment.location_consent_notice_version !== LOCATION_NOTICE_VERSION
    ) {
      return NextResponse.json(
        { error: "นักเรียนปิดการแชร์ตำแหน่งอยู่" },
        { status: 409 },
      );
    }

    const update = await prisma.$transaction(async (tx) => {
      await tx.student_location_update.deleteMany({
        where: {
          camp_camp_id: auth.campId,
          student_students_id: studentId,
        },
      });

      return tx.student_location_update.create({
        data: {
          camp_camp_id: auth.campId,
          student_students_id: studentId,
          latitude: body.latitude,
          longitude: body.longitude,
          accuracy: body.accuracy ?? null,
        },
        select: {
          latitude: true,
          longitude: true,
          accuracy: true,
          recorded_at: true,
        },
      });
    });

    return NextResponse.json({ success: true, update }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "พิกัด GPS ไม่ถูกต้อง" },
        { status: 400 },
      );
    }

    return NextResponse.json({ error: "ส่งตำแหน่งไม่สำเร็จ" }, { status: 500 });
  }
}
