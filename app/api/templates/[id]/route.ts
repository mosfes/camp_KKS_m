// @ts-nocheck

import { NextResponse } from "next/server";

import { requireTeacher } from "@/lib/auth";
import { requireCampTemplateOwner } from "@/lib/camp-management-auth";
import { prisma } from "@/lib/db";

/**
 * GET - ดึงข้อมูลเต็มของ template (เฉพาะตัวที่เลือก)
 */
export async function GET(request, { params }) {
  const { error } = await requireTeacher();

  if (error) return error;

  try {
    const resolvedParams = await params;
    const templateId = parseInt(resolvedParams.id);

    const template = await prisma.camp_template.findUnique({
      where: {
        camp_template_id: templateId,
      },
      include: {
        camp: {
          select: {
            camp_id: true,
            name: true,
            location: true,
            description: true,
            has_shirt: true,
            has_transport: true,
            camp_classroom: {
              select: {
                classroom_classroom_id: true,
                classroom: {
                  select: {
                    classroom_id: true,
                    grade: true,
                    type_classroom: true,
                    teacher: {
                      select: {
                        firstname: true,
                        lastname: true,
                      },
                    },
                  },
                },
              },
            },
            camp_daily_schedule: {
              select: {
                day: true,
                time_slots: {
                  select: {
                    startTime: true,
                    endTime: true,
                    activity: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!template) {
      return NextResponse.json({ error: "ไม่พบ Template" }, { status: 404 });
    }

    return NextResponse.json(template);
  } catch {
    //     console.error("Error fetching template:", error);

    return NextResponse.json(
      {
        _error: "ไม่สามารถดึงข้อมูล Template ได้",
      },
      { status: 500 },
    );
  }
}

/**
 * DELETE - ลบ Template
 */
export async function DELETE(request, { params }) {
  const resolvedParams = await params;
  const templateId = parseInt(resolvedParams.id);
  const { error } = await requireCampTemplateOwner(templateId);

  if (error) return error;

  try {
    await prisma.camp_template.delete({
      where: {
        camp_template_id: templateId,
      },
    });

    return NextResponse.json({ message: "ลบ Template สำเร็จ" });
  } catch {
    //     console.error("Error deleting template:", error);

    return NextResponse.json(
      { _error: "ไม่สามารถลบ Template ได้" },
      { status: 500 },
    );
  }
}

/**
 * PUT - แก้ไขชื่อ Template
 */
export async function PUT(request, { params }) {
  const resolvedParams = await params;
  const templateId = parseInt(resolvedParams.id);
  const { error } = await requireCampTemplateOwner(templateId);

  if (error) return error;

  try {
    const body = await request.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json(
        { error: "กรุณาระบุชื่อ Template" },
        { status: 400 },
      );
    }

    const updatedTemplate = await prisma.camp_template.update({
      where: {
        camp_template_id: templateId,
      },
      data: {
        name: name,
      },
    });

    return NextResponse.json(updatedTemplate);
  } catch {
    //     console.error("Error updating template:", error);

    return NextResponse.json(
      { _error: "ไม่สามารถแก้ไข Template ได้" },
      { status: 500 },
    );
  }
}
