import type { Prisma } from "@prisma/client";

import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  deletePrimaryParentAccount,
  revokeAdditionalParentLink,
} from "@/lib/parent-link-access";
import {
  expireParentLinkRequests,
  maskParentPhone,
} from "@/lib/parent-link-requests";
import { formatParentUsername } from "@/lib/parent-username";

const PAGE_SIZE = 30;
const studentSelect = {
  students_id: true,
  firstname: true,
  lastname: true,
  nickname: true,
  profile_image_url: true,
} satisfies Prisma.studentsSelect;

function studentFields(
  row: Prisma.studentsGetPayload<{ select: typeof studentSelect }>,
) {
  return {
    studentId: row.students_id,
    studentName: `${row.firstname} ${row.lastname}`.trim(),
    studentNickname: row.nickname,
    studentImage: row.profile_image_url,
  };
}

function searchFilters(search: string) {
  const number = /^[1-9]\d*$/.test(search) ? Number(search) : null;
  const parent: Prisma.parentsWhereInput = search
    ? {
        OR: [
          { firstname: { contains: search } },
          { lastname: { contains: search } },
          { tel: { contains: search } },
          ...(number && Number.isSafeInteger(number)
            ? [{ parents_id: number }]
            : []),
        ],
      }
    : {};
  const student: Prisma.studentsWhereInput = search
    ? {
        OR: [
          { firstname: { contains: search } },
          { lastname: { contains: search } },
          { nickname: { contains: search } },
          ...(number && Number.isSafeInteger(number)
            ? [{ students_id: number }]
            : []),
        ],
      }
    : {};

  return { parent, student };
}

export async function GET(request: Request) {
  const { error } = await requireAdmin();

  if (error) return error;

  await expireParentLinkRequests();
  const params = new URL(request.url).searchParams;
  const view = params.get("view") || "active";
  const search = (params.get("search") || "").trim().slice(0, 100);
  const page = Math.max(
    1,
    Math.min(1000, Math.trunc(Number(params.get("page"))) || 1),
  );
  const skip = (page - 1) * PAGE_SIZE;
  const { parent, student } = searchFilters(search);

  if (view === "summary") {
    const activeStudent: Prisma.studentsWhereInput = { deletedAt: null };
    const [totalStudents, linkedStudents, pendingRequests, totalParents] =
      await Promise.all([
        prisma.students.count({ where: activeStudent }),
        prisma.students.count({
          where: {
            ...activeStudent,
            OR: [{ parents: { some: {} } }, { parent_links: { some: {} } }],
          },
        }),
        prisma.parent_student_link_requests.count({
          where: { status: "PENDING" },
        }),
        prisma.parents.count(),
      ]);

    return NextResponse.json(
      {
        totalStudents,
        linkedStudents,
        unlinkedStudents: totalStudents - linkedStudents,
        pendingRequests,
        totalParents,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }

  if (view === "requests") {
    const where: Prisma.parent_student_link_requestsWhereInput = search
      ? { OR: [{ parent }, { student }] }
      : {};
    const [rows, total] = await Promise.all([
      prisma.parent_student_link_requests.findMany({
        where,
        select: {
          request_id: true,
          status: true,
          requested_at: true,
          expires_at: true,
          responded_at: true,
          parent: {
            select: {
              parents_id: true,
              firstname: true,
              lastname: true,
              tel: true,
            },
          },
          student: { select: studentSelect },
        },
        orderBy: { requested_at: "desc" },
        skip,
        take: PAGE_SIZE,
      }),
      prisma.parent_student_link_requests.count({ where }),
    ]);

    return NextResponse.json(
      {
        rows: rows.map((row) => ({
          id: row.request_id,
          parentId: row.parent.parents_id,
          parentName: `${row.parent.firstname} ${row.parent.lastname}`.trim(),
          parentPhone: maskParentPhone(row.parent.tel),
          ...studentFields(row.student),
          status: row.status,
          requestedAt: row.requested_at,
          expiresAt: row.expires_at,
          respondedAt: row.responded_at,
        })),
        total,
        page,
        pageSize: PAGE_SIZE,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }

  if (view === "events") {
    const [rows, total] = await Promise.all([
      prisma.parent_student_link_events.findMany({
        orderBy: { created_at: "desc" },
        skip,
        take: PAGE_SIZE,
      }),
      prisma.parent_student_link_events.count(),
    ]);
    const [parents, students] = await Promise.all([
      prisma.parents.findMany({
        where: { parents_id: { in: rows.map((row) => row.parents_id) } },
        select: { parents_id: true, firstname: true, lastname: true },
      }),
      prisma.students.findMany({
        where: { students_id: { in: rows.map((row) => row.students_id) } },
        select: studentSelect,
      }),
    ]);
    const parentNames = new Map(
      parents.map((item) => [
        item.parents_id,
        `${item.firstname} ${item.lastname}`.trim(),
      ]),
    );
    const studentsById = new Map(
      students.map((item) => [item.students_id, studentFields(item)]),
    );

    return NextResponse.json(
      {
        rows: rows.map((row) => ({
          id: row.event_id,
          parentId: row.parents_id,
          parentName: parentNames.get(row.parents_id) ?? "บัญชีถูกลบ",
          studentId: row.students_id,
          studentName: "บัญชีถูกลบ",
          studentNickname: null,
          studentImage: null,
          ...studentsById.get(row.students_id),
          action: row.action,
          actorType: row.actor_type,
          actorId: row.actor_id,
          createdAt: row.created_at,
        })),
        total,
        page,
        pageSize: PAGE_SIZE,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const studentWhere: Prisma.studentsWhereInput = {
    deletedAt: null,
    ...(search
      ? {
          OR: [
            student,
            { parents: { some: parent } },
            { parent_links: { some: { parent } } },
          ],
        }
      : {}),
  };
  const [studentRows, total] = await Promise.all([
    prisma.students.findMany({
      where: studentWhere,
      select: {
        ...studentSelect,
        parents: {
          select: {
            parents_id: true,
            firstname: true,
            lastname: true,
            tel: true,
            account_no: true,
          },
          orderBy: { account_no: "asc" },
        },
        parent_links: {
          select: {
            parents_id: true,
            created_at: true,
            parent: {
              select: { firstname: true, lastname: true, tel: true },
            },
          },
          orderBy: { parents_id: "asc" },
        },
      },
      orderBy: { students_id: "asc" },
      skip,
      take: PAGE_SIZE,
    }),
    prisma.students.count({ where: studentWhere }),
  ]);
  const linkPairs = studentRows.flatMap((row) =>
    row.parent_links.map((link) => ({
      parents_id: link.parents_id,
      students_id: row.students_id,
    })),
  );
  const approvals = linkPairs.length
    ? await prisma.parent_student_link_requests.findMany({
        where: {
          OR: linkPairs.map((pair) => ({
            parents_id: pair.parents_id,
            students_id: pair.students_id,
            status: "APPROVED" as const,
          })),
        },
        select: { parents_id: true, students_id: true },
      })
    : [];
  const approved = new Set(
    approvals.map((row) => `${row.parents_id}:${row.students_id}`),
  );

  return NextResponse.json(
    {
      rows: studentRows.map((row) => {
        const primaryIds = new Set(row.parents.map((item) => item.parents_id));

        return {
          ...studentFields(row),
          accesses: [
            ...row.parents.map((item) => ({
              parentId: item.parents_id,
              parentName: `${item.firstname} ${item.lastname}`.trim(),
              parentPhone: maskParentPhone(item.tel),
              source: "PRIMARY",
              username: formatParentUsername(row.students_id, item.account_no),
              grantedAt: null,
              revocable: true,
            })),
            ...row.parent_links
              .filter((item) => !primaryIds.has(item.parents_id))
              .map((item) => ({
                parentId: item.parents_id,
                parentName:
                  `${item.parent.firstname} ${item.parent.lastname}`.trim(),
                parentPhone: maskParentPhone(item.parent.tel),
                source: approved.has(`${item.parents_id}:${row.students_id}`)
                  ? "STUDENT_APPROVED"
                  : "LEGACY",
                grantedAt: item.created_at,
                revocable: true,
              })),
          ],
        };
      }),
      total,
      page,
      pageSize: PAGE_SIZE,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

/**
 * Creates another parent account for a student, e.g. "28661-2", so a second
 * parent can sign in after the first account has changed its password. The
 * initial password is "kks" + student id and must be changed on first login.
 */
export async function POST(request: Request) {
  const { teacher, error } = await requireAdmin();

  if (error) return error;

  let body: Record<string, unknown>;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }
  const studentId = Number(body.studentId);

  if (!Number.isSafeInteger(studentId) || studentId <= 0) {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }

  const student = await prisma.students.findFirst({
    where: { students_id: studentId, deletedAt: null },
    select: { students_id: true },
  });

  if (!student) {
    return NextResponse.json({ error: "ไม่พบนักเรียน" }, { status: 404 });
  }

  const bcrypt = await import("bcryptjs");
  const passwordHash = await bcrypt.hash(`kks${studentId}`, 10);

  try {
    const account = await prisma.$transaction(async (tx) => {
      const last = await tx.parents.aggregate({
        where: { username_student_id: studentId },
        _max: { account_no: true },
      });
      const accountNo = (last._max.account_no ?? 0) + 1;
      const parent = await tx.parents.create({
        data: {
          firstname: "รอระบุ",
          lastname: "รอระบุ",
          tel: "0000000000",
          password: passwordHash,
          username_student_id: studentId,
          account_no: accountNo,
        },
        select: { parents_id: true, account_no: true },
      });

      await tx.parent_student_link_events.create({
        data: {
          parents_id: parent.parents_id,
          students_id: studentId,
          action: "ACCOUNT_CREATED",
          actor_type: "ADMIN",
          actor_id: teacher.teachers_id,
        },
      });

      return parent;
    });

    return NextResponse.json({
      success: true,
      parentId: account.parents_id,
      username: formatParentUsername(studentId, account.account_no),
      initialPassword: `kks${studentId}`,
    });
  } catch (reason) {
    // Two admins creating an account at the same moment hit the unique index.
    if ((reason as { code?: string })?.code === "P2002") {
      return NextResponse.json(
        { error: "มีการสร้างบัญชีพร้อมกัน กรุณาลองใหม่อีกครั้ง" },
        { status: 409 },
      );
    }
    throw reason;
  }
}

export async function DELETE(request: Request) {
  const { teacher, error } = await requireAdmin();

  if (error) return error;

  let body: Record<string, unknown>;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }
  const parentId = Number(body.parentId);
  const studentId = Number(body.studentId);

  if (
    !Number.isSafeInteger(parentId) ||
    parentId <= 0 ||
    !Number.isSafeInteger(studentId) ||
    studentId <= 0
  ) {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }

  if (body.source === "PRIMARY") {
    const result = await deletePrimaryParentAccount({
      parentId,
      studentId,
      actorId: teacher.teachers_id,
    });

    if (result === "missing") {
      return NextResponse.json({ error: "ไม่พบบัญชีนี้" }, { status: 404 });
    }

    return NextResponse.json({ success: true, deletedAccount: true });
  }

  const result = await revokeAdditionalParentLink({
    parentId,
    studentId,
    actorType: "ADMIN",
    actorId: teacher.teachers_id,
  });

  if (result === "primary") {
    return NextResponse.json(
      { error: "สิทธิ์บัญชีหลักต้องจัดการที่บัญชีผู้ปกครอง" },
      { status: 403 },
    );
  }
  if (result === "missing") {
    return NextResponse.json({ error: "ไม่พบสิทธิ์นี้" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
