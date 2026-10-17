export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireParentSession } from "@/lib/parent-auth";
import { resolveParentStudent } from "@/lib/parent-student-access";

/**
 * GET /api/auth/parent/me
 * อ่าน parent_session cookie → คืนข้อมูลนักเรียนพร้อมห้องเรียนและค่าย
 */
export async function GET(request: Request) {
  try {
    const auth = await requireParentSession();
    if (auth.error) return auth.error;
    const { parentId } = auth.session;
    const { studentId, error } = await resolveParentStudent(request, auth.session);
    if (error) return error;

    // ตรวจสอบว่ามีข้อมูลผู้ปกครองแล้วหรือยัง
    const parentRecord = await prisma.parents.findFirst({
      where: { parents_id: parentId },
      select: { parents_id: true, firstname: true, lastname: true, tel: true },
    });

    const student = await prisma.students.findFirst({
      where: {
        students_id: studentId,
        deletedAt: null,
      },
      select: {
        students_id: true,
        prefix_name: true,
        firstname: true,
        lastname: true,
        profile_image_url: true,
        tel: true,
        classroom_students: {
          orderBy: {
            classroom: {
              academic_years_years_id: "desc",
            },
          },
          take: 1,
          select: {
            classroom: {
              select: {
                classroom_id: true,
                grade: true,
                academic_years_years_id: true,
                classroom_types: {
                  select: { name: true },
                },
                // ครูคนที่ 1 (เก็บใน classrooms.teachers_teachers_id)
                teacher: {
                  select: {
                    prefix_name: true,
                    firstname: true,
                    lastname: true,
                    tel: true,
                    email: true,
                  },
                },
                // ครูคนที่ 2+ (เก็บใน classroom_teacher many-to-many)
                classroom_teacher: {
                  select: {
                    teacher: {
                      select: {
                        prefix_name: true,
                        firstname: true,
                        lastname: true,
                        tel: true,
                        email: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        student_enrollment: {
          where: {
            enrolled_at: { not: null },
            camp: { deletedAt: null },
          },
          select: {
            student_enrollment_id: true,
            enrolled_at: true,
            shirt_size: true,
            camp: {
              select: {
                camp_id: true,
                name: true,
                start_date: true,
                end_date: true,
                location: true,
                status: true,
                img_camp_url: true,
                // สถานีและภารกิจทั้งหมดในค่าย (เพื่อนับจำนวนทั้งหมด)
                station: {
                  where: { deletedAt: null },
                  select: {
                    station_id: true,
                    name: true,
                    mission: {
                      where: { deletedAt: null },
                      select: {
                        mission_id: true,
                        title: true,
                        type: true,
                      },
                    },
                  },
                },
              },
            },
            // ผลภารกิจที่นักเรียนทำแล้ว
            mission_result: {
              select: {
                mission_result_id: true,
                status: true,
                submitted_at: true,
                mission: {
                  select: {
                    mission_id: true,
                    title: true,
                    type: true,
                    station: {
                      select: {
                        station_id: true,
                        name: true,
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: {
            enrolled_at: "desc",
          },
        },
      },
    });

    if (!student) {
      return NextResponse.json(
        { error: "ไม่พบข้อมูลนักเรียน" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        student,
        hasParentProfile: !!(parentRecord && parentRecord.firstname !== "รอระบุ"),
        parentProfile: parentRecord ?? null,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    //     console.error("Parent me error:", error);

    return NextResponse.json({ _error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
