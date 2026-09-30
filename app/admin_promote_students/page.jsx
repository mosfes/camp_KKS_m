"use client";

import {
  Accordion,
  AccordionItem,
  Button,
  Card,
  CardBody,
  Chip,
  Input,
  Select,
  SelectItem,
  Textarea,
} from "@heroui/react";
import {
  ArrowLeft,
  ArrowRight,
  GraduationCap,
  Save,
  Search,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import studentService from "@/app/service/adminService";
import { HeadteacherNavbar } from "@/components/Headteacher";
import LoadingSpinner from "@/components/LoadingSpinner";
import {
  StatusModalProvider,
  useStatusModal,
} from "@/components/StatusModalProvider";
import { outcomeRequiresNote } from "@/lib/student-promotion";

const OUTCOME_OPTIONS = {
  regular: [
    { key: "PROMOTED", label: "เลื่อนชั้น" },
    { key: "REPEAT", label: "ซ้ำชั้น" },
    { key: "TRANSFERRED", label: "ย้ายสถานศึกษา" },
    { key: "WITHDRAWN", label: "ลาออก" },
  ],
  level6: [
    { key: "GRADUATED", label: "จบการศึกษา" },
    { key: "REPEAT", label: "ซ้ำชั้น" },
    { key: "TRANSFERRED", label: "ย้ายสถานศึกษา" },
    { key: "WITHDRAWN", label: "ลาออก" },
  ],
};

const NEXT_GRADE = {
  Level_1: "Level_2",
  Level_2: "Level_3",
  Level_3: "Level_4",
  Level_4: "Level_5",
  Level_5: "Level_6",
};

const needsTarget = (outcome) => outcome === "PROMOTED" || outcome === "REPEAT";

function expectedGrade(sourceGrade, outcome) {
  if (outcome === "REPEAT") return sourceGrade;
  if (outcome === "PROMOTED") return NEXT_GRADE[sourceGrade] || null;
  return null;
}

function PromoteStudentsContent() {
  const router = useRouter();
  const { showSuccess, showError, showConfirm } = useStatusModal();
  const [years, setYears] = useState([]);
  const [selection, setSelection] = useState({ fromYear: "", toYear: "" });
  const [preview, setPreview] = useState(null);
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [roomSearches, setRoomSearches] = useState({});

  const fetchYears = async () => {
    const data = await studentService.getAcademicYears();
    setYears(Array.isArray(data) ? data : []);
    return data;
  };

  useEffect(() => {
    fetchYears().catch(() =>
      showError("เกิดข้อผิดพลาด", "โหลดปีการศึกษาไม่สำเร็จ"),
    );
  }, []);

  const targetYearOptions = useMemo(() => {
    const source = years.find(
      (year) => String(year.year) === selection.fromYear,
    );
    if (!source) return [];
    const nextYear = Number(source.year) + 1;
    const existing = years.find((year) => Number(year.year) === nextYear);
    return existing
      ? [
          {
            key: String(existing.year),
            label: String(Number(existing.year) + 543),
          },
        ]
      : [{ key: "create_next", label: `สร้างปีการศึกษา ${nextYear + 543}` }];
  }, [selection.fromYear, years]);

  const loadPreview = async () => {
    if (!selection.fromYear || !selection.toYear) {
      showError("ข้อมูลไม่ครบ", "กรุณาเลือกปีการศึกษาต้นทางและปลายทาง");
      return;
    }

    setIsLoading(true);
    try {
      let toYear = selection.toYear;
      if (toYear === "create_next") {
        const nextYear = Number(selection.fromYear) + 1;
        await studentService.addAcademicYear(nextYear, "Draft");
        await fetchYears();
        toYear = String(nextYear);
        setSelection((current) => ({ ...current, toYear }));
      }

      const response = await fetch(
        `/api/students/promote?fromYearId=${selection.fromYear}&toYearId=${toYear}`,
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "ตรวจสอบข้อมูลไม่สำเร็จ");
      setPreview(data);
      setRoomSearches({});
      setStep(2);
    } catch (error) {
      showError("เกิดข้อผิดพลาด", error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const updateStudent = (groupIndex, studentIndex, changes) => {
    setPreview((current) => {
      const groups = current.groups.map((group, currentGroupIndex) => {
        if (currentGroupIndex !== groupIndex) return group;
        const students = group.students.map((student, currentStudentIndex) =>
          currentStudentIndex === studentIndex
            ? { ...student, ...changes }
            : student,
        );
        return { ...group, students };
      });
      return { ...current, groups };
    });
  };

  const changeOutcome = (groupIndex, studentIndex, outcome) => {
    const group = preview.groups[groupIndex];
    const student = group.students[studentIndex];
    const grade = expectedGrade(group.sourceGrade, outcome);
    const matchingRooms = preview.availableRooms.filter(
      (room) => room.grade === grade,
    );
    const sameTypeRoom = matchingRooms.find(
      (room) => room.typeId === group.sourceTypeId,
    );
    updateStudent(groupIndex, studentIndex, {
      outcome,
      targetRoomKey: needsTarget(outcome) ? (sameTypeRoom?.key ?? null) : null,
      note: outcomeRequiresNote(outcome) ? (student.note ?? "") : null,
    });
  };

  const validationErrors = useMemo(() => {
    if (!preview) return [];
    const errors = [];
    const fatalWarningCodes = new Set([
      "ALREADY_PROMOTED",
      "DUPLICATE_SOURCE_ROOM",
      "DUPLICATE_TARGET_ROOM",
      "MULTIPLE_SOURCE_CLASSROOMS",
      "ALREADY_IN_TARGET_YEAR",
      "INVALID_YEAR_STATUS",
      "INACTIVE_TEACHER",
    ]);
    for (const warning of preview.warnings) {
      if (fatalWarningCodes.has(warning.code)) errors.push(warning.message);
    }
    for (const group of preview.groups) {
      for (const student of group.students) {
        if (needsTarget(student.outcome) && !student.targetRoomKey) {
          errors.push(`กรุณาเลือกห้องปลายทางให้ ${student.name}`);
        }
        if (outcomeRequiresNote(student.outcome) && !student.note?.trim()) {
          errors.push(`กรุณาระบุเหตุผลให้ ${student.name}`);
        }
      }
    }
    return [...new Set(errors)];
  }, [preview]);

  const confirmPromotion = () => {
    if (validationErrors.length > 0) {
      showError("ยังยืนยันไม่ได้", validationErrors[0]);
      return;
    }

    const decisions = preview.groups.flatMap((group) =>
      group.students.map((student) => ({
        studentId: student.studentId,
        outcome: student.outcome,
        targetRoomKey: student.targetRoomKey,
        note: student.note?.trim() || null,
      })),
    );

    showConfirm(
      "ยืนยันการเลื่อนชั้น",
      `ระบบจะประมวลผลนักเรียน ${decisions.length} คน โดยเก็บข้อมูลปีเดิมและประวัติค่ายทั้งหมดไว้`,
      async () => {
        setIsLoading(true);
        try {
          const response = await fetch("/api/students/promote", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fromYearId: Number(selection.fromYear),
              toYearId: Number(selection.toYear),
              decisions,
            }),
          });
          const data = await response.json();
          if (!response.ok)
            throw new Error(data.error || "เลื่อนชั้นไม่สำเร็จ");
          showSuccess("เลื่อนชั้นสำเร็จ", data.message);
          window.location.assign("/admin_add_user?tab=student");
        } catch (error) {
          showError("เกิดข้อผิดพลาด", error.message);
        } finally {
          setIsLoading(false);
        }
      },
      "ยืนยัน",
    );
  };

  return (
    <div className="w-full p-4 md:p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            isIconOnly
            variant="light"
            className="rounded-full"
            onPress={() => router.back()}
          >
            <ArrowLeft size={20} />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              จัดการการเลื่อนชั้น
            </h1>
            <p className="text-sm text-gray-500">
              ครูอยู่ห้องระดับเดิม นักเรียนได้รับประวัติห้องของปีใหม่
            </p>
          </div>
        </div>
        <Button
          variant="flat"
          color="success"
          startContent={<GraduationCap size={18} />}
          onPress={() => router.push("/admin_graduated_students")}
        >
          รายชื่อนักเรียนที่จบแล้ว
        </Button>
      </div>

      <Card className="border border-[#EFECE5] bg-white shadow-sm">
        <CardBody className="p-5 md:p-6">
          {step === 1 ? (
            <div className="mx-auto max-w-xl space-y-5 py-4">
              <div className="rounded-lg border border-green-100 bg-green-50 p-4 text-sm text-green-800">
                ระบบจะเก็บห้องและประวัติของปีเดิมไว้ทั้งหมด
                พร้อมสร้างโครงสร้างห้องปีใหม่โดยให้ครูอยู่ระดับชั้นเดิม
              </div>
              <Select
                label="จากปีการศึกษา"
                placeholder="เลือกปีต้นทาง"
                variant="bordered"
                selectedKeys={selection.fromYear ? [selection.fromYear] : []}
                onChange={(event) => {
                  setSelection({ fromYear: event.target.value, toYear: "" });
                  setPreview(null);
                }}
              >
                {years.map((year) => (
                  <SelectItem
                    key={String(year.year)}
                    textValue={String(Number(year.year) + 543)}
                  >
                    {Number(year.year) + 543}
                  </SelectItem>
                ))}
              </Select>
              <Select
                label="ไปยังปีการศึกษา"
                placeholder="เลือกปีปลายทาง"
                variant="bordered"
                isDisabled={!selection.fromYear}
                selectedKeys={selection.toYear ? [selection.toYear] : []}
                onChange={(event) =>
                  setSelection((current) => ({
                    ...current,
                    toYear: event.target.value,
                  }))
                }
              >
                {targetYearOptions.map((option) => (
                  <SelectItem key={option.key} textValue={option.label}>
                    {option.label}
                  </SelectItem>
                ))}
              </Select>
              <div className="flex justify-end">
                <Button
                  className="rounded-full bg-sage text-white"
                  endContent={!isLoading && <ArrowRight size={16} />}
                  isLoading={isLoading}
                  onPress={loadPreview}
                >
                  ตรวจสอบก่อนเลื่อนชั้น
                </Button>
              </div>
            </div>
          ) : !preview ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner size="md" />
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  <Chip variant="flat">
                    นักเรียน {preview.summary.students} คน
                  </Chip>
                  <Chip color="success" variant="flat">
                    ผู้จบ {preview.summary.graduates} คน
                  </Chip>
                  <Chip color="primary" variant="flat">
                    สร้างห้อง {preview.summary.roomsToCreate} ห้อง
                  </Chip>
                </div>
                <Button size="sm" variant="light" onPress={() => setStep(1)}>
                  เปลี่ยนปีการศึกษา
                </Button>
              </div>

              {validationErrors.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <div className="mb-2 flex items-center gap-2 font-semibold">
                    <TriangleAlert size={18} /> ต้องแก้ไขก่อนยืนยัน
                  </div>
                  <ul className="list-disc space-y-1 pl-5">
                    {validationErrors.slice(0, 8).map((error) => (
                      <li key={error}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}

              <Accordion
                selectionMode="multiple"
                variant="splitted"
                className="px-0"
              >
                {preview.groups.map((group, groupIndex) => {
                  const roomKey = String(group.sourceRoomId);
                  const search = (roomSearches[roomKey] || "")
                    .trim()
                    .toLocaleLowerCase("th");
                  const searchTerms = search.split(/\s+/).filter(Boolean);
                  const visibleStudents = group.students
                    .map((student, studentIndex) => ({ student, studentIndex }))
                    .filter(({ student }) => {
                      const searchableText =
                        `${student.name || ""} ${student.code || ""}`.toLocaleLowerCase(
                          "th",
                        );
                      return searchTerms.every((term) =>
                        searchableText.includes(term),
                      );
                    });

                  return (
                    <AccordionItem
                      key={group.sourceRoomId}
                      title={`${group.sourceGradeLabel} ห้อง ${group.sourceTypeName}`}
                      subtitle={`ครูประจำห้อง: ${group.sourceTeacherNames || "ไม่ระบุ"} • นักเรียน ${group.students.length} คน`}
                    >
                      <div className="space-y-3 pb-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <Input
                            aria-label={`ค้นหานักเรียนใน ${group.sourceGradeLabel} ห้อง ${group.sourceTypeName}`}
                            className="min-w-[240px] flex-1"
                            classNames={{
                              inputWrapper: "border-gray-200 bg-white",
                            }}
                            isClearable
                            placeholder="ค้นหารหัส ชื่อ หรือนามสกุล"
                            size="sm"
                            startContent={
                              <Search size={16} className="text-gray-400" />
                            }
                            value={roomSearches[roomKey] || ""}
                            onClear={() =>
                              setRoomSearches((current) => ({
                                ...current,
                                [roomKey]: "",
                              }))
                            }
                            onValueChange={(value) =>
                              setRoomSearches((current) => ({
                                ...current,
                                [roomKey]: value,
                              }))
                            }
                          />
                          {search && (
                            <span className="text-xs text-gray-500">
                              พบ {visibleStudents.length} จาก{" "}
                              {group.students.length} คน
                            </span>
                          )}
                        </div>

                        {visibleStudents.map(({ student, studentIndex }) => {
                          const grade = expectedGrade(
                            group.sourceGrade,
                            student.outcome,
                          );
                          const roomOptions = preview.availableRooms.filter(
                            (room) => room.grade === grade,
                          );
                          const outcomes =
                            group.sourceGrade === "Level_6"
                              ? OUTCOME_OPTIONS.level6
                              : OUTCOME_OPTIONS.regular;
                          return (
                            <div
                              key={student.studentId}
                              className="grid gap-3 rounded-lg border border-gray-200 bg-white p-3 md:grid-cols-[minmax(220px,1fr)_190px_minmax(260px,1fr)] md:items-end"
                            >
                              <div>
                                <p className="font-medium text-gray-800">
                                  {student.name}
                                </p>
                                <p className="text-xs text-gray-500">
                                  รหัส {student.code}
                                </p>
                              </div>
                              <Select
                                size="sm"
                                label="ผลการพิจารณา"
                                variant="bordered"
                                selectedKeys={[student.outcome]}
                                onChange={(event) =>
                                  changeOutcome(
                                    groupIndex,
                                    studentIndex,
                                    event.target.value,
                                  )
                                }
                              >
                                {outcomes.map((outcome) => (
                                  <SelectItem
                                    key={outcome.key}
                                    textValue={outcome.label}
                                  >
                                    {outcome.label}
                                  </SelectItem>
                                ))}
                              </Select>
                              {needsTarget(student.outcome) ? (
                                <Select
                                  size="sm"
                                  label="ห้องปีการศึกษาใหม่"
                                  placeholder="เลือกห้องปลายทาง"
                                  variant="bordered"
                                  selectedKeys={
                                    student.targetRoomKey
                                      ? [student.targetRoomKey]
                                      : []
                                  }
                                  onChange={(event) =>
                                    updateStudent(groupIndex, studentIndex, {
                                      targetRoomKey: event.target.value || null,
                                    })
                                  }
                                >
                                  {roomOptions.map((room) => (
                                    <SelectItem
                                      key={room.key}
                                      textValue={`${room.gradeLabel} ห้อง ${room.typeName}`}
                                    >
                                      <div className="flex flex-col py-1">
                                        <span>
                                          {room.gradeLabel} ห้อง {room.typeName}
                                          {room.isNew ? " • สร้างใหม่" : ""}
                                        </span>
                                        <span className="text-xs text-gray-500">
                                          ครูประจำห้อง:{" "}
                                          {room.teacherNames || "ไม่ระบุ"}
                                        </span>
                                      </div>
                                    </SelectItem>
                                  ))}
                                </Select>
                              ) : (
                                <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">
                                  {student.outcome === "GRADUATED"
                                    ? "บันทึกในทะเบียนผู้จบของปีต้นทาง"
                                    : "ไม่เพิ่มห้องในปีการศึกษาใหม่"}
                                </div>
                              )}
                              {outcomeRequiresNote(student.outcome) && (
                                <Textarea
                                  className="md:col-span-3"
                                  isRequired
                                  label="เหตุผล"
                                  maxLength={500}
                                  minRows={2}
                                  placeholder="ระบุเหตุผลสำหรับผลการพิจารณานี้"
                                  size="sm"
                                  value={student.note || ""}
                                  variant="bordered"
                                  onValueChange={(value) =>
                                    updateStudent(groupIndex, studentIndex, {
                                      note: value,
                                    })
                                  }
                                />
                              )}
                            </div>
                          );
                        })}
                        {visibleStudents.length === 0 && (
                          <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
                            ไม่พบนักเรียนที่ตรงกับคำค้นหา
                          </div>
                        )}
                      </div>
                    </AccordionItem>
                  );
                })}
              </Accordion>

              <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
                <Button variant="light" onPress={() => router.back()}>
                  ยกเลิก
                </Button>
                <Button
                  className="rounded-full bg-sage text-white"
                  isDisabled={validationErrors.length > 0}
                  isLoading={isLoading}
                  startContent={!isLoading && <Save size={18} />}
                  onPress={confirmPromotion}
                >
                  ยืนยันการเลื่อนชั้น
                </Button>
              </div>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

export default function PromoteStudentsPage() {
  return (
    <StatusModalProvider>
      <HeadteacherNavbar />
      <PromoteStudentsContent />
    </StatusModalProvider>
  );
}
