import AdminPageContent from "./AdminPageContent";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

async function getInitialTeachers() {
  const { teacher } = await requireAdmin();
  if (!teacher) return null;

  const where = { deletedAt: null };
  const [data, total] = await Promise.all([
    prisma.teachers.findMany({
      where,
      select: {
        teachers_id: true,
        prefix_name: true,
        firstname: true,
        lastname: true,
        email: true,
        tel: true,
        role: true,
        classrooms: {
          where: { deletedAt: null },
          select: { classroom_id: true },
        },
        classroom_teacher: {
          where: { classroom: { deletedAt: null } },
          select: { classroom_teacher_id: true },
        },
        camp: {
          where: { deletedAt: null },
          select: { camp_id: true },
        },
      },
      orderBy: { teachers_id: "asc" },
      take: 20,
    }),
    prisma.teachers.count({ where }),
  ]);

  return {
    data,
    pagination: { page: 1, limit: 20, total, totalPages: Math.ceil(total / 20) },
  };
}

async function getInitialClassrooms() {
  const { teacher } = await requireAdmin();
  if (!teacher) return null;

  const [years, types, teachers] = await Promise.all([
    prisma.academic_years.findMany({ orderBy: { year: "desc" } }),
    prisma.classroom_types.findMany({ orderBy: { name: "asc" } }),
    prisma.teachers.findMany({
      where: { deletedAt: null },
      select: { teachers_id: true, prefix_name: true, firstname: true, lastname: true, role: true },
      orderBy: { teachers_id: "asc" },
    }),
  ]);
  const selectedYear = years.length ? String(years[0].year) : "all";
  const where = {
    deletedAt: null,
    ...(selectedYear !== "all" ? { academic_years_years_id: Number(selectedYear) } : {}),
  };
  const [data, total] = await Promise.all([
    prisma.classrooms.findMany({
      where,
      select: {
        classroom_id: true,
        grade: true,
        type_classroom: true,
        academic_years_years_id: true,
        teachers_teachers_id: true,
        academic_years: { select: { year: true } },
        teacher: { select: { teachers_id: true, prefix_name: true, firstname: true, lastname: true } },
        classroom_teacher: {
          select: {
            teacher_teachers_id: true,
            teacher: { select: { teachers_id: true, prefix_name: true, firstname: true, lastname: true } },
          },
        },
        _count: { select: { classroom_students: true } },
      },
      orderBy: { grade: "asc" },
      take: 20,
    }),
    prisma.classrooms.count({ where }),
  ]);

  return JSON.parse(JSON.stringify({
    data,
    years,
    types,
    teachers,
    selectedYear,
    pagination: { page: 1, limit: 20, total, totalPages: Math.ceil(total / 20) },
  }));
}

export default async function AdminPage({ searchParams }) {
  const params = await searchParams;
  const tab = typeof params?.tab === "string" ? params.tab : "overview";
  const initialTeachers = tab === "teacher" ? await getInitialTeachers() : null;
  const initialClassrooms = tab === "classroom" ? await getInitialClassrooms() : null;

  return <AdminPageContent tab={tab} initialTeachers={initialTeachers} initialClassrooms={initialClassrooms} />;
}
