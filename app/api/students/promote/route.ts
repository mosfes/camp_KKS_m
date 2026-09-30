import { Prisma } from "@prisma/client";
import { z } from "zod";

import { requireTeacher } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  classroomKey,
  defaultOutcome,
  expectedTargetGrade,
  gradeLabel,
  outcomeNeedsTarget,
  outcomeRequiresNote,
  PROMOTION_OUTCOMES,
  roomSelectionKey,
  studentStatusForOutcome,
  supportsGrade,
  validateOutcomeForGrade,
  validatePromotionYearStatuses,
  type GradeLevelValue,
  type PromotionOutcomeValue,
} from "@/lib/student-promotion";

const executeSchema = z.object({
  fromYearId: z.coerce.number().int(),
  toYearId: z.coerce.number().int(),
  decisions: z
    .array(
      z.object({
        studentId: z.coerce.number().int(),
        outcome: z.enum(PROMOTION_OUTCOMES),
        targetRoomKey: z.string().min(1).nullable().optional(),
        note: z.string().trim().max(500).nullable().optional(),
      }),
    )
    .min(1),
});

class PromotionError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

async function requireAdmin() {
  const { teacher, error } = await requireTeacher();

  if (error) return { teacher: null, error };
  if (teacher.role !== "ADMIN") {
    return {
      teacher: null,
      error: Response.json(
        { error: "เฉพาะผู้ดูแลระบบเท่านั้นที่เลื่อนชั้นได้" },
        { status: 403 },
      ),
    };
  }

  return { teacher, error: null };
}

function parseYears(request: Request) {
  const { searchParams } = new URL(request.url);
  const fromYearId = Number(searchParams.get("fromYearId"));
  const toYearId = Number(searchParams.get("toYearId"));

  if (!Number.isInteger(fromYearId) || !Number.isInteger(toYearId)) {
    throw new PromotionError("กรุณาระบุปีการศึกษาต้นทางและปลายทาง");
  }
  if (toYearId !== fromYearId + 1) {
    throw new PromotionError("ปีการศึกษาปลายทางต้องเป็นปีถัดไปเท่านั้น");
  }

  return { fromYearId, toYearId };
}

const classroomInclude = {
  classroom_types: true,
  teacher: true,
  classroom_teacher: { include: { teacher: true } },
  classroom_students: {
    where: { student: { deletedAt: null } },
    include: { student: true },
  },
} satisfies Prisma.classroomsInclude;

function teacherNames(room: any) {
  const teachers = [
    room.teacher,
    ...room.classroom_teacher.map((item: any) => item.teacher),
  ];

  return teachers
    .map(
      (teacher: any) =>
        `${teacher.prefix_name ?? ""}${teacher.firstname} ${teacher.lastname}`,
    )
    .join(", ");
}

function inactiveTeacherNames(room: any) {
  return [
    room.teacher,
    ...room.classroom_teacher.map((item: any) => item.teacher),
  ]
    .filter((teacher: any) => teacher?.deletedAt)
    .map(
      (teacher: any) =>
        `${teacher.prefix_name ?? ""}${teacher.firstname} ${teacher.lastname}`,
    );
}

function roomDto(
  room: any,
  isNew: boolean,
  sourceRoomId: number | null = null,
  gradeOverride: GradeLevelValue | null = null,
) {
  const grade = gradeOverride ?? (room.grade as GradeLevelValue);
  const id = isNew ? null : room.classroom_id;

  return {
    key: roomSelectionKey(id, grade, room.type_classroom),
    classroomId: id,
    sourceRoomId,
    grade,
    gradeLabel: gradeLabel(grade),
    typeId: room.type_classroom,
    typeName: room.classroom_types.name,
    teacherNames: teacherNames(room),
    isNew,
  };
}

async function loadPromotionData(fromYearId: number, toYearId: number) {
  const [years, sourceClassrooms, targetClassrooms, existingRun] =
    await Promise.all([
      prisma.academic_years.findMany({
        where: { year: { in: [fromYearId, toYearId] } },
      }),
      prisma.classrooms.findMany({
        where: { academic_years_years_id: fromYearId, deletedAt: null },
        include: classroomInclude,
        orderBy: [{ grade: "asc" }, { type_classroom: "asc" }],
      }),
      prisma.classrooms.findMany({
        where: { academic_years_years_id: toYearId, deletedAt: null },
        include: classroomInclude,
        orderBy: [{ grade: "asc" }, { type_classroom: "asc" }],
      }),
      prisma.promotion_run.findUnique({
        where: {
          from_year_to_year: { from_year: fromYearId, to_year: toYearId },
        },
        select: { promotion_run_id: true, executed_at: true },
      }),
    ]);

  if (years.length !== 2) {
    throw new PromotionError("ไม่พบปีการศึกษาต้นทางหรือปลายทาง", 404);
  }
  if (sourceClassrooms.length === 0) {
    throw new PromotionError("ไม่พบห้องเรียนในปีการศึกษาต้นทาง", 404);
  }

  const sourceYear = years.find((year) => year.year === fromYearId)!;
  const targetYear = years.find((year) => year.year === toYearId)!;
  const activeYearCount = await prisma.academic_years.count({
    where: { status: "Active" },
  });

  return {
    sourceClassrooms,
    targetClassrooms,
    existingRun,
    sourceYear,
    targetYear,
    activeYearCount,
  };
}

export async function GET(request: Request) {
  const access = await requireAdmin();

  if (access.error) return access.error;

  try {
    const { fromYearId, toYearId } = parseYears(request);
    const {
      sourceClassrooms,
      targetClassrooms,
      existingRun,
      sourceYear,
      targetYear,
      activeYearCount,
    } = await loadPromotionData(fromYearId, toYearId);
    const warnings: Array<{
      code: string;
      message: string;
      studentId?: number;
    }> = [];
    const sourceRoomByKey = new Map<string, any>();
    const targetRoomByKey = new Map<string, any>();
    const yearStatusError = validatePromotionYearStatuses(
      sourceYear.status,
      targetYear.status,
      activeYearCount,
    );

    if (yearStatusError && !existingRun) {
      warnings.push({ code: "INVALID_YEAR_STATUS", message: yearStatusError });
    }

    for (const room of sourceClassrooms) {
      const key = classroomKey(room.grade, room.type_classroom);
      const inactiveTeachers = inactiveTeacherNames(room);

      if (inactiveTeachers.length > 0) {
        warnings.push({
          code: "INACTIVE_TEACHER",
          message: `ห้อง ${gradeLabel(room.grade)} ${room.classroom_types.name} มีครูที่ถูกปิดใช้งาน: ${inactiveTeachers.join(", ")}`,
        });
      }

      if (sourceRoomByKey.has(key)) {
        warnings.push({
          code: "DUPLICATE_SOURCE_ROOM",
          message: `พบห้อง ${gradeLabel(room.grade)} ${room.classroom_types.name} ซ้ำในปีต้นทาง`,
        });
      } else sourceRoomByKey.set(key, room);
    }
    for (const room of targetClassrooms) {
      const key = classroomKey(room.grade, room.type_classroom);

      if (targetRoomByKey.has(key)) {
        warnings.push({
          code: "DUPLICATE_TARGET_ROOM",
          message: `พบห้อง ${gradeLabel(room.grade)} ${room.classroom_types.name} ซ้ำในปีปลายทาง`,
        });
      } else targetRoomByKey.set(key, room);
    }

    const availableRooms = targetClassrooms.map((room) => roomDto(room, false));

    for (const sourceRoom of sourceClassrooms) {
      const key = classroomKey(sourceRoom.grade, sourceRoom.type_classroom);

      if (!targetRoomByKey.has(key)) {
        availableRooms.push(roomDto(sourceRoom, true, sourceRoom.classroom_id));
      }
    }
    const availableRoomKeys = new Set(
      availableRooms.map((room) => classroomKey(room.grade, room.typeId)),
    );

    for (const sourceRoom of sourceClassrooms) {
      const nextGrade = expectedTargetGrade(sourceRoom.grade, "PROMOTED");

      if (!nextGrade) continue;
      if (!supportsGrade(sourceRoom.classroom_types.valid_grades, nextGrade))
        continue;
      const key = classroomKey(nextGrade, sourceRoom.type_classroom);
      if (availableRoomKeys.has(key)) continue;
      availableRooms.push(
        roomDto(sourceRoom, true, sourceRoom.classroom_id, nextGrade),
      );
      availableRoomKeys.add(key);
    }
    availableRooms.sort(
      (a, b) =>
        a.grade.localeCompare(b.grade) ||
        a.typeName.localeCompare(b.typeName, "th"),
    );

    const roomByClassKey = new Map(
      availableRooms.map((room) => [
        classroomKey(room.grade, room.typeId),
        room,
      ]),
    );
    const targetMembershipByStudent = new Map<number, number>();

    for (const room of targetClassrooms) {
      for (const membership of room.classroom_students) {
        targetMembershipByStudent.set(
          membership.student_students_id,
          room.classroom_id,
        );
      }
    }

    const seenStudents = new Set<number>();
    const groups = sourceClassrooms.map((room) => {
      const students = room.classroom_students.map((membership) => {
        const student = membership.student;
        const outcome = defaultOutcome(room.grade);
        const nextGrade = expectedTargetGrade(room.grade, outcome);
        const defaultTarget = nextGrade
          ? roomByClassKey.get(classroomKey(nextGrade, room.type_classroom))
          : null;

        if (seenStudents.has(student.students_id)) {
          warnings.push({
            code: "MULTIPLE_SOURCE_CLASSROOMS",
            studentId: student.students_id,
            message: `นักเรียน ${student.students_id} อยู่มากกว่าหนึ่งห้องในปีต้นทาง`,
          });
        }
        seenStudents.add(student.students_id);
        if (targetMembershipByStudent.has(student.students_id)) {
          warnings.push({
            code: "ALREADY_IN_TARGET_YEAR",
            studentId: student.students_id,
            message: `นักเรียน ${student.students_id} มีห้องในปีปลายทางแล้ว`,
          });
        }
        if (nextGrade && !defaultTarget) {
          warnings.push({
            code: "TARGET_ROOM_REQUIRED",
            studentId: student.students_id,
            message: `กรุณาเลือกห้องปลายทางให้ ${student.firstname} ${student.lastname}`,
          });
        }

        return {
          studentId: student.students_id,
          code: String(student.students_id),
          name: `${student.prefix_name ?? ""}${student.firstname} ${student.lastname}`,
          outcome,
          targetRoomKey: defaultTarget?.key ?? null,
        };
      });

      return {
        sourceRoomId: room.classroom_id,
        sourceGrade: room.grade,
        sourceGradeLabel: gradeLabel(room.grade),
        sourceTypeId: room.type_classroom,
        sourceTypeName: room.classroom_types.name,
        sourceTeacherNames: teacherNames(room),
        students,
      };
    });

    if (existingRun) {
      warnings.unshift({
        code: "ALREADY_PROMOTED",
        message: "ปีการศึกษาคู่นี้ถูกเลื่อนชั้นเรียบร้อยแล้ว",
      });
    }

    return Response.json({
      fromYearId,
      toYearId,
      existingRun,
      groups,
      availableRooms,
      warnings,
      summary: {
        classrooms: sourceClassrooms.length,
        students: seenStudents.size,
        graduates: groups.reduce(
          (sum, group) =>
            sum +
            group.students.filter((student) => student.outcome === "GRADUATED")
              .length,
          0,
        ),
        roomsToCreate: availableRooms.filter((room) => room.isNew).length,
      },
    });
  } catch (error) {
    const status = error instanceof PromotionError ? error.status : 500;
    const message =
      error instanceof PromotionError
        ? error.message
        : "ไม่สามารถตรวจสอบแผนการเลื่อนชั้นได้";

    return Response.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  const access = await requireAdmin();

  if (access.error || !access.teacher) return access.error;

  let requestedPromotion: {
    fromYearId: number;
    toYearId: number;
    decisions: Array<{
      studentId: number;
      outcome: PromotionOutcomeValue;
      targetRoomKey?: string | null;
      note?: string | null;
    }>;
  } | null = null;

  try {
    const parsed = executeSchema.safeParse(await request.json());

    if (!parsed.success) {
      return Response.json(
        {
          error: "ข้อมูลการเลื่อนชั้นไม่ถูกต้อง",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }
    const { fromYearId, toYearId, decisions } = parsed.data;
    requestedPromotion = {
      fromYearId,
      toYearId,
      decisions,
    };

    if (toYearId !== fromYearId + 1) {
      throw new PromotionError("ปีการศึกษาปลายทางต้องเป็นปีถัดไปเท่านั้น");
    }

    const result = await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`
        SELECT year FROM academic_years
        WHERE year IN (${fromYearId}, ${toYearId})
        ORDER BY year FOR UPDATE
      `;
        const years = await tx.academic_years.findMany({
          where: { year: { in: [fromYearId, toYearId] } },
        });

        if (years.length !== 2)
          throw new PromotionError("ไม่พบปีการศึกษาต้นทางหรือปลายทาง", 404);

        const existingRun = await tx.promotion_run.findUnique({
          where: {
            from_year_to_year: { from_year: fromYearId, to_year: toYearId },
          },
        });

        if (existingRun)
          throw new PromotionError("ปีการศึกษาคู่นี้ถูกเลื่อนชั้นแล้ว", 409);

        const activeYearCount = await tx.academic_years.count({
          where: { status: "Active" },
        });
        const sourceYear = years.find((year) => year.year === fromYearId)!;
        const targetYear = years.find((year) => year.year === toYearId)!;
        const yearStatusError = validatePromotionYearStatuses(
          sourceYear.status,
          targetYear.status,
          activeYearCount,
        );

        if (yearStatusError) throw new PromotionError(yearStatusError, 409);

        const sourceClassrooms = await tx.classrooms.findMany({
          where: { academic_years_years_id: fromYearId, deletedAt: null },
          include: classroomInclude,
        });
        const targetClassrooms = await tx.classrooms.findMany({
          where: { academic_years_years_id: toYearId, deletedAt: null },
          include: classroomInclude,
        });

        if (sourceClassrooms.length === 0)
          throw new PromotionError("ไม่พบห้องเรียนในปีต้นทาง", 404);

        const sourceStudentMap = new Map<number, { room: any; student: any }>();
        const sourceRoomKeys = new Set<string>();

        for (const room of sourceClassrooms) {
          const sourceRoomKey = classroomKey(room.grade, room.type_classroom);
          const inactiveTeachers = inactiveTeacherNames(room);

          if (inactiveTeachers.length > 0) {
            throw new PromotionError(
              `ห้อง ${gradeLabel(room.grade)} ${room.classroom_types.name} มีครูที่ถูกปิดใช้งาน: ${inactiveTeachers.join(", ")}`,
              409,
            );
          }

          if (sourceRoomKeys.has(sourceRoomKey)) {
            throw new PromotionError(
              `พบห้อง ${gradeLabel(room.grade)} ${room.classroom_types.name} ซ้ำในปีต้นทาง`,
              409,
            );
          }
          sourceRoomKeys.add(sourceRoomKey);

          for (const membership of room.classroom_students) {
            if (sourceStudentMap.has(membership.student_students_id)) {
              throw new PromotionError(
                `นักเรียน ${membership.student_students_id} อยู่มากกว่าหนึ่งห้องในปีต้นทาง`,
                409,
              );
            }
            sourceStudentMap.set(membership.student_students_id, {
              room,
              student: membership.student,
            });
          }
        }

        const decisionMap = new Map(
          decisions.map((item) => [item.studentId, item]),
        );

        if (
          decisionMap.size !== decisions.length ||
          decisionMap.size !== sourceStudentMap.size ||
          Array.from(sourceStudentMap.keys()).some(
            (studentId) => !decisionMap.has(studentId),
          )
        ) {
          throw new PromotionError(
            "ต้องระบุผลการพิจารณาของนักเรียนทุกคนในปีต้นทางและห้ามมีรายการซ้ำ",
          );
        }

        const targetByClassKey = new Map<string, any>();

        for (const room of targetClassrooms) {
          const key = classroomKey(room.grade, room.type_classroom);

          if (targetByClassKey.has(key)) {
            throw new PromotionError(
              `พบห้อง ${gradeLabel(room.grade)} ${room.classroom_types.name} ซ้ำในปีปลายทาง`,
              409,
            );
          }
          targetByClassKey.set(key, room);
        }

        let createdRooms = 0;
        const createTargetRoom = async (
          sourceRoom: any,
          targetGrade: GradeLevelValue,
        ) => {
          const key = classroomKey(targetGrade, sourceRoom.type_classroom);

          if (targetByClassKey.has(key)) return targetByClassKey.get(key);
          if (
            !supportsGrade(sourceRoom.classroom_types.valid_grades, targetGrade)
          ) {
            throw new PromotionError(
              `ประเภทห้อง ${sourceRoom.classroom_types.name} ไม่รองรับ ${gradeLabel(targetGrade)}`,
            );
          }
          const created = await tx.classrooms.create({
            data: {
              grade: targetGrade,
              type_classroom: sourceRoom.type_classroom,
              academic_years_years_id: toYearId,
              teachers_teachers_id: sourceRoom.teachers_teachers_id,
            },
            include: classroomInclude,
          });
          const secondaryTeacherIds: number[] = Array.from(
            new Set<number>(
              sourceRoom.classroom_teacher
                .map((item: any) => item.teacher_teachers_id)
                .filter(
                  (teacherId: number) =>
                    teacherId !== sourceRoom.teachers_teachers_id,
                ),
            ),
          );

          if (secondaryTeacherIds.length > 0) {
            await tx.classroom_teacher.createMany({
              data: secondaryTeacherIds.map((teacherId) => ({
                classroom_classroom_id: created.classroom_id,
                teacher_teachers_id: teacherId,
              })),
              skipDuplicates: true,
            });
          }
          const targetRoom = {
            ...created,
            classroom_types: sourceRoom.classroom_types,
          };

          targetByClassKey.set(key, targetRoom);
          createdRooms++;
          return targetRoom;
        };

        for (const sourceRoom of sourceClassrooms) {
          await createTargetRoom(sourceRoom, sourceRoom.grade);
        }

        for (const [studentId, source] of Array.from(
          sourceStudentMap.entries(),
        )) {
          const decision = decisionMap.get(studentId)!;
          const targetGrade = expectedTargetGrade(
            source.room.grade,
            decision.outcome as PromotionOutcomeValue,
          );

          if (targetGrade) await createTargetRoom(source.room, targetGrade);
        }

        const destinationMemberships = await tx.classroom_students.findMany({
          where: {
            student_students_id: { in: Array.from(sourceStudentMap.keys()) },
            classroom: { academic_years_years_id: toYearId },
          },
          select: { student_students_id: true },
        });

        if (destinationMemberships.length > 0) {
          throw new PromotionError(
            `มีนักเรียน ${destinationMemberships.length} คนที่มีห้องในปีปลายทางแล้ว กรุณาตรวจสอบก่อนเลื่อนชั้น`,
            409,
          );
        }

        const roomBySelectionKey = new Map<string, any>();

        for (const room of Array.from(targetByClassKey.values())) {
          roomBySelectionKey.set(
            roomSelectionKey(
              room.classroom_id,
              room.grade,
              room.type_classroom,
            ),
            room,
          );
          roomBySelectionKey.set(
            roomSelectionKey(null, room.grade, room.type_classroom),
            room,
          );
        }

        const membershipRows: Array<any> = [];
        const itemRows: Array<any> = [];
        const studentIdsByStatus = {
          ACTIVE: [] as number[],
          GRADUATED: [] as number[],
          TRANSFERRED: [] as number[],
          WITHDRAWN: [] as number[],
        };
        const counts = {
          promoted: 0,
          repeated: 0,
          graduated: 0,
          transferred: 0,
          withdrawn: 0,
        };

        for (const [studentId, source] of Array.from(
          sourceStudentMap.entries(),
        )) {
          const decision = decisionMap.get(studentId)!;
          const outcome = decision.outcome as PromotionOutcomeValue;
          let targetRoom: any = null;
          const outcomeError = validateOutcomeForGrade(
            source.room.grade,
            outcome,
          );

          if (outcomeError) {
            throw new PromotionError(`${outcomeError} (นักเรียน ${studentId})`);
          }
          if (outcomeRequiresNote(outcome) && !decision.note?.trim()) {
            throw new PromotionError(
              `กรุณาระบุเหตุผลสำหรับนักเรียน ${studentId}`,
            );
          }

          if (outcomeNeedsTarget(outcome)) {
            if (!decision.targetRoomKey) {
              throw new PromotionError(
                `กรุณาเลือกห้องปลายทางให้นักเรียน ${studentId}`,
              );
            }
            targetRoom = roomBySelectionKey.get(decision.targetRoomKey);
            if (!targetRoom)
              throw new PromotionError(
                `ห้องปลายทางของนักเรียน ${studentId} ไม่ถูกต้อง`,
              );
            const expectedGrade = expectedTargetGrade(
              source.room.grade,
              outcome,
            );

            if (targetRoom.grade !== expectedGrade) {
              throw new PromotionError(
                `ระดับชั้นปลายทางของนักเรียน ${studentId} ไม่ตรงกับผลการพิจารณา`,
              );
            }
            if (
              !supportsGrade(
                targetRoom.classroom_types.valid_grades,
                targetRoom.grade,
              )
            ) {
              throw new PromotionError(
                `ประเภทห้อง ${targetRoom.classroom_types.name} ไม่รองรับ ${gradeLabel(targetRoom.grade)}`,
              );
            }
            membershipRows.push({
              student_students_id: studentId,
              classroom_classroom_id: targetRoom.classroom_id,
              academic_year: toYearId,
            });
            if (outcome === "PROMOTED") counts.promoted++;
            if (outcome === "REPEAT") counts.repeated++;
          } else if (outcome === "GRADUATED") {
            if (source.room.grade !== "Level_6") {
              throw new PromotionError(
                `นักเรียน ${studentId} ยังไม่อยู่ ม.6 จึงบันทึกเป็นผู้จบไม่ได้`,
              );
            }
            counts.graduated++;
          } else if (outcome === "TRANSFERRED") {
            counts.transferred++;
          } else if (outcome === "WITHDRAWN") {
            counts.withdrawn++;
          }

          studentIdsByStatus[studentStatusForOutcome(outcome)].push(studentId);

          itemRows.push({
            student_id: studentId,
            source_classroom_id: source.room.classroom_id,
            target_classroom_id: targetRoom?.classroom_id ?? null,
            outcome,
            note: decision.note ?? null,
          });
        }

        if (membershipRows.length > 0) {
          await tx.classroom_students.createMany({
            data: membershipRows,
            skipDuplicates: true,
          });
        }
        const run = await tx.promotion_run.create({
          data: {
            from_year: fromYearId,
            to_year: toYearId,
            executed_by_id: Number(access.teacher.teachers_id),
          },
        });

        await tx.promotion_item.createMany({
          data: itemRows.map((item) => ({
            ...item,
            promotion_run_id: run.promotion_run_id,
          })),
        });
        for (const [status, studentIds] of Object.entries(studentIdsByStatus)) {
          if (studentIds.length === 0) continue;
          await tx.students.updateMany({
            where: { students_id: { in: studentIds } },
            data: {
              status: status as
                | "ACTIVE"
                | "GRADUATED"
                | "TRANSFERRED"
                | "WITHDRAWN",
            },
          });
        }
        await tx.academic_years.update({
          where: { year: fromYearId },
          data: { status: "Archived" },
        });
        await tx.academic_years.update({
          where: { year: toYearId },
          data: { status: "Active" },
        });

        return {
          runId: run.promotion_run_id,
          createdRooms,
          ...counts,
          total: sourceStudentMap.size,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 30_000,
      },
    );

    return Response.json({
      message: `เลื่อนชั้นสำเร็จ ${result.promoted} คน และบันทึกผู้จบ ${result.graduated} คน`,
      ...result,
    });
  } catch (error) {
    if (error instanceof PromotionError) {
      return Response.json({ error: error.message }, { status: error.status });
    }

    console.error("Unexpected student promotion error", error);

    if (requestedPromotion) {
      try {
        const completedRun = await prisma.promotion_run.findUnique({
          where: {
            from_year_to_year: {
              from_year: requestedPromotion.fromYearId,
              to_year: requestedPromotion.toYearId,
            },
          },
          include: {
            items: {
              select: {
                student_id: true,
                outcome: true,
                note: true,
                target_classroom: {
                  select: {
                    classroom_id: true,
                    grade: true,
                    type_classroom: true,
                  },
                },
              },
            },
          },
        });
        const requestedDecisionByStudent = new Map(
          requestedPromotion.decisions.map((decision) => [
            decision.studentId,
            decision,
          ]),
        );
        const isCompleted =
          completedRun &&
          completedRun.items.length === requestedDecisionByStudent.size &&
          completedRun.items.every((item) => {
            const requested = requestedDecisionByStudent.get(item.student_id);
            const actualTargetKey = item.target_classroom
              ? roomSelectionKey(
                  item.target_classroom.classroom_id,
                  item.target_classroom.grade,
                  item.target_classroom.type_classroom,
                )
              : null;
            const plannedTargetKey = item.target_classroom
              ? roomSelectionKey(
                  null,
                  item.target_classroom.grade,
                  item.target_classroom.type_classroom,
                )
              : null;
            const targetMatches =
              (requested?.targetRoomKey ?? null) === actualTargetKey ||
              (requested?.targetRoomKey ?? null) === plannedTargetKey;

            return (
              requested?.outcome === item.outcome &&
              (requested.note?.trim() || null) === item.note &&
              targetMatches
            );
          });

        if (isCompleted) {
          const counts = completedRun.items.reduce(
            (result, item) => {
              if (item.outcome === "PROMOTED") result.promoted++;
              else if (item.outcome === "REPEAT") result.repeated++;
              else if (item.outcome === "GRADUATED") result.graduated++;
              else if (item.outcome === "TRANSFERRED") result.transferred++;
              else if (item.outcome === "WITHDRAWN") result.withdrawn++;
              return result;
            },
            {
              promoted: 0,
              repeated: 0,
              graduated: 0,
              transferred: 0,
              withdrawn: 0,
            },
          );

          return Response.json({
            message: `เลื่อนชั้นสำเร็จ ${counts.promoted} คน และบันทึกผู้จบ ${counts.graduated} คน`,
            runId: completedRun.promotion_run_id,
            total: completedRun.items.length,
            recovered: true,
            ...counts,
          });
        }
      } catch (verificationError) {
        console.error(
          "Unable to verify student promotion result",
          verificationError,
        );
      }
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return Response.json(
        { error: "รายการนี้ถูกบันทึกแล้ว กรุณาโหลดข้อมูลใหม่" },
        { status: 409 },
      );
    }
    return Response.json(
      {
        error: "เกิดข้อผิดพลาดระหว่างเลื่อนชั้น ระบบยกเลิกการบันทึกทั้งหมด",
      },
      { status: 500 },
    );
  }
}
