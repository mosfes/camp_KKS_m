"use client";
import { useStatusModal } from "@/components/StatusModalProvider";
import {
    Tabs,
    Tab,
    Card,
    CardBody,
    Button,
    Table,
    TableHeader,
    TableColumn,
    TableBody,
    TableRow,
    TableCell,
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Input,
    useDisclosure,
    Select,
    SelectItem,
    Checkbox,
    Pagination
} from "@heroui/react";
import { useState, useEffect, useRef } from "react";
import { Trash2, Trash, Archive, SquarePen, Settings } from 'lucide-react';
import TrashManager from "./TrashManager";
import studentService from "@/app/service/adminService";
import { PlusIcon } from "./Icons";

function ClassroomLoadingTable() {
    const columns = [
        "ระดับชั้น",
        "ประเภทห้อง",
        "ครูประจำชั้น",
        "ปีการศึกษา",
        "จำนวนนักเรียน",
        "ดำเนินการ",
    ];

    return (
        <div
            aria-label="กำลังโหลดข้อมูลห้องเรียน"
            className="min-w-[800px] overflow-hidden rounded-xl border border-gray-100 bg-white"
            role="status"
        >
            <div className="grid grid-cols-[0.8fr_1fr_1.8fr_1fr_1fr_0.7fr] gap-4 border-b border-gray-100 bg-gray-50/50 px-4 py-4">
                {columns.map((column) => (
                    <span className="text-sm font-semibold text-gray-800" key={column}>
                        {column}
                    </span>
                ))}
            </div>

            {Array.from({ length: 6 }, (_, index) => (
                <div
                    className="grid grid-cols-[0.8fr_1fr_1.8fr_1fr_1fr_0.7fr] items-center gap-4 border-b border-gray-100 px-4 py-5 last:border-b-0"
                    key={index}
                >
                    <div className="h-4 w-12 animate-pulse rounded bg-gray-200" />
                    <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
                    <div className="space-y-2">
                        <div className="h-4 w-40 animate-pulse rounded bg-gray-200" />
                        <div className="h-3 w-28 animate-pulse rounded bg-gray-200" />
                    </div>
                    <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
                    <div className="h-4 w-16 animate-pulse rounded bg-gray-200" />
                    <div className="flex gap-3">
                        <div className="h-5 w-5 animate-pulse rounded bg-gray-200" />
                        <div className="h-5 w-5 animate-pulse rounded bg-gray-200" />
                    </div>
                </div>
            ))}
        </div>
    );
}

const ClassroomManager = () => {
    const { showSuccess, showError, showConfirm } = useStatusModal();
    const [isLoading, setIsLoading] = useState(true);
    const { isOpen, onOpen, onOpenChange } = useDisclosure();
    const [classrooms, setClassrooms] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [years, setYears] = useState([]);
    const [selectedYear, setSelectedYear] = useState("all");
    const [selectedGrade, setSelectedGrade] = useState("all");
    const [selectedRoomType, setSelectedRoomType] = useState("all");
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [totalClassrooms, setTotalClassrooms] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const submitInFlightRef = useRef(false);

    const [isEditing, setIsEditing] = useState(false);
    const [editId, setEditId] = useState(null);
    const [showTrash, setShowTrash] = useState(false);



    const [newYearInput, setNewYearInput] = useState("");

    const { isOpen: isSettingsOpen, onOpen: onSettingsOpen, onOpenChange: onSettingsChange } = useDisclosure();
    const [classroomTypes, setClassroomTypes] = useState([]);
    const [newTypeData, setNewTypeData] = useState({ name: "", valid_grades: [] });
    const [isEditingType, setIsEditingType] = useState(false);
    const [editTypeId, setEditTypeId] = useState(null);

    const handleOpenSettings = async () => {
        setIsLoading(true);
        try {
            const types = await studentService.getClassroomTypes();
            setClassroomTypes(types);
            setIsEditingType(false);
            setEditTypeId(null);
            setNewTypeData({ name: "", valid_grades: [] });
            onSettingsOpen();
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddClassroomType = async () => {
        if (!newTypeData.name) return showError("ข้อมูลไม่ครบ", "กรุณาระบุชื่อประเภท");
        if (newTypeData.valid_grades.length === 0) return showError("ข้อมูลไม่ครบ", "กรุณาเลือกอย่างน้อย 1 ระดับชั้น");

        try {
            if (isEditingType) {
                await studentService.updateClassroomType({
                    classroom_type_id: editTypeId,
                    name: newTypeData.name,
                    valid_grades: newTypeData.valid_grades.join(",")
                });
                showSuccess("สำเร็จ", "แก้ไขข้อมูลสำเร็จ");
            } else {
                await studentService.addClassroomType({
                    name: newTypeData.name,
                    valid_grades: newTypeData.valid_grades.join(",")
                });
                showSuccess("สำเร็จ", "เพิ่มข้อมูลสำเร็จ");
            }
            setNewTypeData({ name: "", valid_grades: [] });
            setIsEditingType(false);
            setEditTypeId(null);
            const types = await studentService.getClassroomTypes();
            setClassroomTypes(types);
        } catch (e) {
            showError("เกิดข้อผิดพลาด", e.message);
        }
    };

    const handleEditType = (type) => {
        setIsEditingType(true);
        setEditTypeId(type.classroom_type_id);
        setNewTypeData({
            name: type.name,
            valid_grades: type.valid_grades.split(',')
        });
    };

    const handleDeleteClassroomType = (id) => {
        showConfirm(
            "ลบประเภทห้องเรียน",
            "ยืนยันการลบประเภทห้องเรียนนี้?",
            async () => {
                try {
                    await studentService.deleteClassroomType(id);
                    const types = await studentService.getClassroomTypes();
                    setClassroomTypes(types);
                    showSuccess("สำเร็จ", "ลบข้อมูลสำเร็จ");
                } catch (e) {
                    showError("เกิดข้อผิดพลาด", e.message);
                }
            },
            "ลบ"
        );
    };

    const handleToggleLevel = (level) => {
        const middle = ['1', '2', '3'];
        const high = ['4', '5', '6'];
        const targetGrades = level === 'middle' ? middle : high;

        setNewTypeData(prev => {
            const allSelected = targetGrades.every(g => prev.valid_grades.includes(g));
            let newGrades;
            if (allSelected) {

                newGrades = prev.valid_grades.filter(g => !targetGrades.includes(g));
            } else {
                newGrades = [...new Set([...prev.valid_grades, ...targetGrades])].sort();
            }
            return { ...prev, valid_grades: newGrades };
        });
    };

    const handleAddAcademicYear = async () => {
        const cleanInput = newYearInput.trim();
        if (!cleanInput || cleanInput.length !== 4) {
            return showError("ข้อมูลไม่ถูกต้อง", "กรุณาระบุปีให้ถูกต้อง (4 หลัก)");
        }

        let yearToSend = parseInt(cleanInput);
        if (isNaN(yearToSend)) return showError("ข้อมูลไม่ถูกต้อง", "กรุณาระบุปีเป็นตัวเลข");

        if (yearToSend > 2400) {
            yearToSend = yearToSend - 543;
        }

        try {
            await studentService.addAcademicYear(yearToSend);
            showSuccess("สำเร็จ", `เพิ่มปีการศึกษา ${yearToSend + 543} สำเร็จ`);
            setNewYearInput("");
            fetchData();
        } catch (e) {
            showError("เกิดข้อผิดพลาด", e.message);
        }
    };

    const handleDeleteAcademicYear = (id) => {
        showConfirm(
            "ลบปีการศึกษา",
            "ยืนยันการลบปีการศึกษา? ข้อมูลที่เกี่ยวข้องอาจได้รับผลกระทบ",
            async () => {
                try {
                    await studentService.deleteAcademicYear(id);
                    showSuccess("สำเร็จ", "ลบข้อมูลสำเร็จ");
                    fetchData();
                } catch (e) {
                    showError("เกิดข้อผิดพลาด", e.message);
                }
            },
            "ลบ"
        );
    };

    const [formData, setFormData] = useState({
        grade: "",
        type_classroom: "",
        teacher_id: "",
        teacher_id_2: "",
        academic_year_id: ""
    });

    const gradeOptions = [
        { key: "Level_1", label: "ม.1", value: 1 },
        { key: "Level_2", label: "ม.2", value: 2 },
        { key: "Level_3", label: "ม.3", value: 3 },
        { key: "Level_4", label: "ม.4", value: 4 },
        { key: "Level_5", label: "ม.5", value: 5 },
        { key: "Level_6", label: "ม.6", value: 6 },
    ];

    const handleEditClassroom = (room) => {
        setIsEditing(true);
        setEditId(room.classroom_id);
        const secondTeacherId = room.classroom_teacher && room.classroom_teacher.length > 0
            ? room.classroom_teacher[0].teacher_teachers_id.toString()
            : "";
        setFormData({
            grade: room.grade,
            type_classroom: room.type_classroom ? room.type_classroom.toString() : "",
            teacher_id: room.teachers_teachers_id ? room.teachers_teachers_id.toString() : "",
            teacher_id_2: secondTeacherId,
            academic_year_id: room.academic_years_years_id ? room.academic_years_years_id.toString() : ""
        });
        onOpen();
    };

    const handleDeleteClassroom = (classroom) => {

        const gradeLabel = gradeOptions.find(g => g.key === classroom.grade)?.label || classroom.grade;
        const yearLabel = classroom.academic_years ? parseInt(classroom.academic_years.year) + 543 : "";
        const roomType = displayRoomName(classroom.type_classroom);

        showConfirm(
            "ลบห้องเรียน",
            `คุณต้องการลบข้อมูลห้องเรียน "${gradeLabel} - ${roomType} (ปีการศึกษา ${yearLabel})" ใช่หรือไม่?`,
            async () => {
                try {
                    await studentService.deleteClassroom(classroom.classroom_id);
                    showSuccess("สำเร็จ", "ลบสำเร็จ");
                    setPage(1);
                    fetchClassrooms(1);
                } catch (error) {
                    showError("เกิดข้อผิดพลาด", error.message);
                }
            },
            "ลบ"
        );
    };

    const getRoomOptions = (gradeKey) => {
        const gradeLevel = gradeOptions.find(g => g.key === gradeKey)?.value || 0;
        if (!gradeLevel) return [];

        const existingTypesInYearGrade = classrooms
            .filter(c =>
                c.academic_years_years_id?.toString() === formData.academic_year_id?.toString() &&
                c.grade === gradeKey &&
                c.classroom_id !== editId
            )
            .map(c => c.type_classroom?.toString());

        return classroomTypes
            .filter(type => {
                if (!type.valid_grades) return false;
                const validGrades = type.valid_grades.split(',').map(Number);
                const isValidGrade = validGrades.includes(gradeLevel);

                return isValidGrade && !existingTypesInYearGrade.includes(type.classroom_type_id.toString());
            })
            .map(type => ({ key: type.classroom_type_id.toString(), label: type.name }));
    };

    const getAvailableTeachers = () => {
        if (!formData.academic_year_id) return teachers;

        const assignedTeacherIds = classrooms
            .filter(c =>
                c.academic_years_years_id?.toString() === formData.academic_year_id?.toString() &&
                c.classroom_id !== editId
            )
            .flatMap(c => {
                const ids = [];
                if (c.teachers_teachers_id) ids.push(c.teachers_teachers_id.toString());
                if (c.classroom_teacher && c.classroom_teacher.length > 0) {
                    ids.push(c.classroom_teacher[0].teacher_teachers_id.toString());
                }
                return ids;
            });

        return teachers.filter(t => !assignedTeacherIds.includes(t.teachers_id.toString()));
    };

    const fetchClassrooms = async (pageNum = 1) => {
        setIsLoading(true);
        try {
            const result = await studentService.getClassroomsPaginated(selectedYear, pageNum, 20);
            const newData = Array.isArray(result) ? result : (result.data || []);
            
            setClassrooms(newData);
            
            if (result.pagination) {
                setHasMore(pageNum < result.pagination.totalPages);
                setTotalPages(result.pagination.totalPages || 1);
                setTotalClassrooms(result.pagination.total);
            } else {
                setHasMore(false);
                setTotalPages(1);
                setTotalClassrooms(newData.length);
            }
        } catch (error) {
            console.error("Error fetching classrooms:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchData = async (isInitial = false) => {
        setIsLoading(true);
        try {
            const [tchData, yearData, typeData] = await Promise.all([
                studentService.getTeachers(),
                studentService.getAcademicYears(),
                studentService.getClassroomTypes()
            ]);
            setTeachers(tchData);
            setYears(yearData);
            setClassroomTypes(typeData);

            if (yearData && yearData.length > 0 && yearData[0]?.year && !formData.academic_year_id) {
                setFormData(prev => ({ ...prev, academic_year_id: yearData[0].year.toString() }));
            }
            
            if (isInitial && yearData && yearData.length > 0) {
                const latestYear = Math.max(...yearData.map(y => parseInt(y.year))).toString();
                setSelectedYear(latestYear);
            } else {
                await fetchClassrooms(1);
            }
        } catch (error) {
            console.error("Error fetching data:", error);
            setIsLoading(false);
        }
    };

    useEffect(() => {
        setPage(1);
        if (teachers.length === 0) {
            fetchData(true);
        } else {
            fetchClassrooms(1);
        }
    }, [selectedYear]);

    const handleSelectChange = (key, value) => {
        setFormData(prev => {
            const newData = { ...prev, [key]: value };
            if (key === 'grade') {
                newData.type_classroom = "";
            } else if (key === 'academic_year_id') {
                newData.grade = "";
                newData.type_classroom = "";
            }
            return newData;
        });
    };

    const displayRoomName = (typeKey) => {
        const found = classroomTypes.find(t => t.classroom_type_id.toString() === typeKey?.toString());
        return found ? found.name : typeKey;
    };

    const handleSubmit = async (onClose) => {
        if (!formData.grade || !formData.teacher_id || !formData.type_classroom) {
            showError("ข้อมูลไม่ครบ", "กรุณากรอกข้อมูลให้ครบ");
            return;
        }

        if (formData.teacher_id === formData.teacher_id_2) {
            showError("ข้อมูลไม่ถูกต้อง", "ไม่สามารถเลือกครูประจำชั้นคนที่ 2 ซ้ำกับคนที่ 1 ได้");
            return;
        }

        if (submitInFlightRef.current) return;

        submitInFlightRef.current = true;
        setIsSubmitting(true);

        const payload = {
            ...formData,
            type_classroom: parseInt(formData.type_classroom),
            teacher_id_2: formData.teacher_id_2 === "none" ? "" : formData.teacher_id_2
        };

        try {
            if (isEditing) {
                await studentService.updateClassroom({ ...payload, classroom_id: editId });
                showSuccess("สำเร็จ", "แก้ไขข้อมูลห้องเรียนสำเร็จ!");
            } else {
                await studentService.addClassroom(payload);
                showSuccess("สำเร็จ", "เพิ่มข้อมูลห้องเรียนสำเร็จ!");
            }
            setPage(1);
            fetchClassrooms(1);
            onClose();
        } catch (error) {
            showError("เกิดข้อผิดพลาด", error.message);
        } finally {
            submitInFlightRef.current = false;
            setIsSubmitting(false);
        }
    };
    const handleOpenAdd = () => {
        setIsEditing(false);
        setEditId(null);
        setFormData({
            grade: "",
            type_classroom: "",
            teacher_id: "",
            teacher_id_2: "",
            academic_year_id: (years && years.length > 0 && years[0]?.year) ? years[0].year.toString() : ""
        });
        onOpen();
    };




    if (showTrash) {
        return <TrashManager type="classroom" onBack={() => { setShowTrash(false); setPage(1); fetchClassrooms(1); }} />;
    }

    return (
        <div className="flex flex-col gap-6 w-full pt-4">
            <Card className="border border-gray-100 shadow-sm rounded-2xl bg-white" radius="none">
                <CardBody className="p-4 md:p-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
                        <div>
                            <h3 className="text-gray-800 font-semibold text-lg">
                                ข้อมูลห้องเรียนและครูประจำชั้น ({totalClassrooms})
                            </h3>
                            <p className="text-sm text-gray-500 mt-1">
                                ตรวจสอบและจัดการรายชื่อครูประจำชั้นในแต่ละห้อง
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto overflow-hidden">
                            <div className="flex items-center gap-2 min-w-[120px] max-w-[140px] md:min-w-[160px] md:max-w-none flex-1">
                                <Select
                                    aria-label="Select Academic Year"
                                    placeholder="ปีการศึกษา"
                                    className="max-w-xs"
                                    size="sm"
                                    selectedKeys={new Set([selectedYear])}
                                    onChange={(e) => { setSelectedYear(e.target.value); setSelectedGrade("all"); setSelectedRoomType("all"); }}
                                >
                                    <SelectItem key="all" textValue="ปีการศึกษา: ทั้งหมด">ทั้งหมด</SelectItem>
                                    {years.map((y) => (
                                        <SelectItem key={y.year.toString()} textValue={`ปีการศึกษา: ${(parseInt(y.year) + 543).toString()}`}>
                                            {parseInt(y.year) + 543}
                                        </SelectItem>
                                    ))}
                                </Select>
                            </div>
                            <div className="flex items-center gap-2 min-w-[110px] max-w-[130px] md:min-w-[140px] md:max-w-none flex-1">
                                <Select
                                    aria-label="Select Grade"
                                    placeholder="ระดับชั้น"
                                    className="max-w-xs"
                                    size="sm"
                                    selectedKeys={new Set([selectedGrade])}
                                    onChange={(e) => setSelectedGrade(e.target.value)}
                                >
                                    <SelectItem key="all" textValue="ระดับชั้น: ทั้งหมด">ทั้งหมด</SelectItem>
                                    {gradeOptions.map((g) => (
                                        <SelectItem key={g.key} textValue={g.label}>{g.label}</SelectItem>
                                    ))}
                                </Select>
                            </div>
                            <div className="flex items-center gap-2 min-w-[110px] max-w-[130px] md:min-w-[150px] md:max-w-none flex-1">
                                <Select
                                    aria-label="Select Room Type"
                                    placeholder="ประเภทห้อง"
                                    className="max-w-xs"
                                    size="sm"
                                    selectedKeys={new Set([selectedRoomType])}
                                    onChange={(e) => setSelectedRoomType(e.target.value)}
                                >
                                    <SelectItem key="all" textValue="ประเภทห้อง: ทั้งหมด">ทั้งหมด</SelectItem>
                                    {Array.from(new Set(classrooms.map(c => c.type_classroom).filter(Boolean)))
                                        .map(typeId => {
                                            const found = classroomTypes.find(t => t.classroom_type_id.toString() === typeId.toString());
                                            return { key: typeId.toString(), label: found ? found.name : typeId.toString() };
                                        })
                                        .map((opt) => (
                                            <SelectItem key={opt.key} textValue={`ประเภท: ${opt.label}`}>{opt.label}</SelectItem>
                                        ))
                                    }
                                </Select>
                            </div>
                            <Button
                                onPress={handleOpenSettings}
                                size="sm"
                                isIconOnly
                                variant="light"
                                className="text-[#E84A5F] opacity-70 hover:opacity-100 hover:text-[#FF847C] hover:bg-[#E84A5F]/10 rounded-full"
                            >
                                <Settings size={20} />
                            </Button>
                            <Button onPress={handleOpenAdd} size="sm" className="bg-sage text-white hover:bg-sage-dark shadow-sm rounded-full">
                                <PlusIcon />
                                <span className="ml-1">เพิ่มห้องเรียน</span>
                            </Button>
                            <Button
                                size="sm"
                                variant="bordered"
                                className="bg-white text-gray-600 border-gray-300 hover:bg-gray-50 shadow-sm rounded-full"
                                onPress={() => setShowTrash(true)}
                            >
                                <Archive size={16} />
                                <span className="ml-1 font-medium hidden sm:inline">รายการที่ลบ</span>
                            </Button>
                        </div>
                    </div>

                    <div className="overflow-x-auto w-full">
                        {isLoading ? (
                            <ClassroomLoadingTable />
                        ) : (
                        <Table aria-label="Classroom Table" shadow="none"
                            classNames={{
                                wrapper: "border border-gray-100 rounded-xl p-0 overflow-hidden min-w-[800px] md:min-w-full",
                                th: "bg-gray-50/50 border-b border-gray-100 text-gray-800 font-semibold py-4",
                                td: "py-4 border-b border-gray-50/50",
                            }}
                        >
                            <TableHeader>
                                <TableColumn>ระดับชั้น</TableColumn>
                                <TableColumn>ประเภทห้อง</TableColumn>
                                <TableColumn>ครูประจำชั้น</TableColumn>
                                <TableColumn>ปีการศึกษา</TableColumn>
                                <TableColumn>จำนวนนักเรียน</TableColumn>
                                <TableColumn>ดำเนินการ</TableColumn>
                            </TableHeader>
                            <TableBody
                                emptyContent="ยังไม่ได้กำหนดห้องเรียนในปีนี้"
                            >
                                {classrooms
                                    .filter(room =>
                                        (selectedGrade === "all" || room.grade === selectedGrade) &&
                                        (selectedRoomType === "all" || room.type_classroom?.toString() === selectedRoomType)
                                    )
                                    .map((room) => (
                                    <TableRow key={room.classroom_id}>
                                        <TableCell>{gradeOptions.find(g => g.key === room.grade)?.label || room.grade}</TableCell>
                                        <TableCell>{displayRoomName(room.type_classroom)}</TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span>{room.teacher?.prefix_name || ''}{room.teacher?.firstname} {room.teacher?.lastname}</span>
                                                {room.classroom_teacher && room.classroom_teacher.length > 0 && (
                                                    <span className="text-sm text-gray-500">
                                                        {room.classroom_teacher[0].teacher?.prefix_name || ''}{room.classroom_teacher[0].teacher?.firstname} {room.classroom_teacher[0].teacher?.lastname}
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>{room.academic_years?.year + 543}</TableCell>
                                        <TableCell>{room._count?.classroom_students || 0} คน</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <span
                                                    className="cursor-pointer active:opacity-50 text-sage hover:text-sage-dark"
                                                    onClick={() => handleEditClassroom(room)}
                                                >
                                                    <SquarePen size={18} />
                                                </span>
                                                <span
                                                    className="cursor-pointer active:opacity-50 text-[#E84A5F] hover:text-[#FF847C] transition-colors"
                                                    onClick={() => handleDeleteClassroom(room)}
                                                >
                                                    <Trash2 size={18} />
                                                </span>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        )}
                    </div>

                    <div className="flex flex-col md:flex-row items-center mt-6 gap-4 px-2 w-full relative">
                        <div className="text-sm text-gray-500 order-2 md:order-1 md:absolute md:left-2">
                            แสดง {classrooms.length} จาก {totalClassrooms} รายการ
                        </div>
                        <div className="flex-1 flex justify-center order-1 md:order-2 w-full">
                        {totalPages > 1 && (
                                <Pagination
                                    isCompact
                                    showControls
                                    total={totalPages}
                                    page={page}
                                    onChange={(newPage) => {
                                        setPage(newPage);
                                        fetchClassrooms(newPage);
                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                    }}
                                    className="overflow-x-auto"
                                    classNames={{
                                        cursor: "bg-[#5d7c6f] text-white",
                                    }}
                                />
                        )}
                        </div>
                    </div>
                </CardBody>
            </Card>

            <Modal isOpen={isSettingsOpen} onOpenChange={onSettingsChange} size="2xl">
                <ModalContent className="bg-white text-gray-800">
                    {(onClose) => (
                        <>
                            <ModalHeader>ตั้งค่าข้อมูลพื้นฐาน</ModalHeader>
                            <ModalBody>
                                <Tabs aria-label="Settings Options">
                                    <Tab key="years" title="ปีการศึกษา">
                                        <div className="flex gap-2 mb-4">
                                            <Input
                                                placeholder="ระบุปีการศึกษา (เช่น 2568)"
                                                value={newYearInput}
                                                onChange={(e) => setNewYearInput(e.target.value)}
                                            />
                                            <Button onClick={handleAddAcademicYear} className="bg-sage text-white shadow-sm rounded-full">เพิ่ม</Button>
                                        </div>
                                        <div className="grid grid-cols-4 gap-2">
                                            {years.map(y => (
                                                <div key={y.year} className="p-2 border rounded-xl flex justify-between items-center text-sm">
                                                    <span>{(parseInt(y.year) + 543)}</span>
                                                    <span
                                                        className="text-[#E84A5F] cursor-pointer hover:bg-[#E84A5F]/10 hover:text-[#FF847C] p-1 rounded transition-colors"
                                                        onClick={() => handleDeleteAcademicYear(y.year)}
                                                    >
                                                        <Trash2 size={14} />
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </Tab>
                                    <Tab key="types" title="ประเภทห้องเรียน">
                                        <div className="border p-4 rounded-lg mb-4 bg-gray-50">
                                            <h4 className="font-semibold mb-2">{isEditingType ? "แก้ไขประเภทห้อง" : "เพิ่มประเภทห้องใหม่"}</h4>
                                            <div className="flex gap-2 mb-2">
                                                <Input
                                                    placeholder="ชื่อประเภท (เช่น ห้อง Gifted)"
                                                    value={newTypeData.name}
                                                    onChange={(e) => setNewTypeData({ ...newTypeData, name: e.target.value })}
                                                />
                                                <Button onClick={handleAddClassroomType} className="bg-sage text-white shadow-sm rounded-full">
                                                    {isEditingType ? "แก้ไข" : "บันทึก"}
                                                </Button>
                                                {isEditingType && (
                                                    <Button 
                                                        variant="light" 
                                                        onClick={() => {
                                                            setIsEditingType(false);
                                                            setEditTypeId(null);
                                                            setNewTypeData({ name: "", valid_grades: [] });
                                                        }} 
                                                        className="rounded-full"
                                                    >
                                                        ยกเลิก
                                                    </Button>
                                                )}
                                            </div>
                                            <div className="flex gap-4">
                                                <span className="text-sm pt-1">ใช้กับระดับชั้น:</span>
                                                <div className="flex gap-4">
                                                    <Checkbox
                                                        isSelected={['1', '2', '3'].every(g => newTypeData.valid_grades.includes(g))}
                                                        onValueChange={() => handleToggleLevel('middle')}
                                                    >
                                                        ม.ต้น
                                                    </Checkbox>
                                                    <Checkbox
                                                        isSelected={['4', '5', '6'].every(g => newTypeData.valid_grades.includes(g))}
                                                        onValueChange={() => handleToggleLevel('high')}
                                                    >
                                                        ม.ปลาย
                                                    </Checkbox>
                                                </div>
                                            </div>
                                        </div>

                                        <Table aria-label="Classroom Types">
                                            <TableHeader>
                                                <TableColumn>ชื่อประเภท</TableColumn>
                                                <TableColumn>ใช้กับระดับชั้น</TableColumn>
                                                <TableColumn>จัดการ</TableColumn>
                                            </TableHeader>
                                            <TableBody>
                                                {classroomTypes.map(type => (
                                                    <TableRow key={type.classroom_type_id}>
                                                        <TableCell>{type.name}</TableCell>
                                                        <TableCell>
                                                            {type.valid_grades.split(',').map(g => `ม.${g}`).join(', ')}
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex items-center gap-3">
                                                                <span
                                                                    className="text-sage cursor-pointer hover:text-sage-dark transition-colors"
                                                                    onClick={() => handleEditType(type)}
                                                                >
                                                                    <SquarePen size={16} />
                                                                </span>
                                                                <span
                                                                    className="text-[#E84A5F] cursor-pointer hover:text-[#FF847C] transition-colors"
                                                                    onClick={() => handleDeleteClassroomType(type.classroom_type_id)}
                                                                >
                                                                    <Trash2 size={16} />
                                                                </span>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </Tab>
                                </Tabs>
                            </ModalBody>
                            <ModalFooter>
                                <Button color="danger" variant="light" onPress={onClose} className="rounded-full">ปิด</Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>

            <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
                <ModalContent className="bg-white p-4 text-gray-800">
                    {(onClose) => (
                        <>
                            <ModalHeader>ตั้งค่าห้องเรียน</ModalHeader>
                            <ModalBody className="gap-4">
                                {/* ส่วนจัดการปีการศึกษา */}
                                <Select
                                    label="ปีการศึกษา"
                                    placeholder="เลือกปีการศึกษา"
                                    defaultSelectedKeys={formData.academic_year_id ? [formData.academic_year_id] : []}
                                    selectedKeys={formData.academic_year_id ? [formData.academic_year_id] : []}
                                    onChange={(e) => handleSelectChange("academic_year_id", e.target.value)}
                                >
                                    {years.map((y) => (
                                        <SelectItem
                                            key={y.year}
                                            value={y.year}
                                            textValue={`${parseInt(y.year) + 543}`}
                                        >
                                            {parseInt(y.year) + 543}
                                        </SelectItem>
                                    ))}
                                </Select>

                                <div className="grid grid-cols-2 gap-4">
                                    <Select
                                        label="ระดับชั้น"
                                        placeholder="เลือกระดับชั้น"
                                        isDisabled={!formData.academic_year_id}
                                        selectedKeys={formData.grade ? [formData.grade] : []}
                                        onChange={(e) => handleSelectChange("grade", e.target.value)}
                                    >
                                        {gradeOptions.map((g) => (
                                            <SelectItem key={g.key} value={g.key}>{g.label}</SelectItem>
                                        ))}
                                    </Select>

                                    <Select
                                        label="ประเภทห้อง"
                                        placeholder={formData.grade ? "เลือกประเภทห้อง" : "กรุณาเลือกระดับชั้นก่อน"}
                                        isDisabled={!formData.grade || !formData.academic_year_id}
                                        selectedKeys={formData.type_classroom ? [formData.type_classroom] : []}
                                        onChange={(e) => handleSelectChange("type_classroom", e.target.value)}
                                    >
                                        {getRoomOptions(formData.grade).map((r) => (
                                            <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>
                                        ))}
                                    </Select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <Select
                                        label="ครูประจำชั้น (คนที่ 1)"
                                        placeholder="เลือกครู"
                                        selectedKeys={formData.teacher_id ? [formData.teacher_id.toString()] : []}
                                        onChange={(e) => handleSelectChange("teacher_id", e.target.value)}
                                        classNames={{ listbox: "max-h-[300px] overflow-y-auto" }}
                                    >
                                        {getAvailableTeachers().map((t) => {
                                            const idStr = t.teachers_id.toString();
                                            return (
                                                <SelectItem
                                                    key={idStr}
                                                    value={idStr}
                                                    textValue={`${t.prefix_name || ''}${t.firstname} ${t.lastname}`}
                                                >
                                                    {t.prefix_name || ''}{t.firstname} {t.lastname}
                                                </SelectItem>
                                            );
                                        })}
                                    </Select>

                                    <Select
                                        label="ครูประจำชั้น (คนที่ 2)"
                                        placeholder="ไม่มี"
                                        selectedKeys={formData.teacher_id_2 ? [formData.teacher_id_2.toString()] : ["none"]}
                                        onChange={(e) => handleSelectChange("teacher_id_2", e.target.value)}
                                        classNames={{ listbox: "max-h-[300px] overflow-y-auto" }}
                                    >
                                        <SelectItem key="none" value="" textValue="ไม่มี">
                                            ไม่มี
                                        </SelectItem>
                                        {getAvailableTeachers()
                                            .filter(t => t.teachers_id.toString() !== formData.teacher_id?.toString())
                                            .map((t) => {
                                                const idStr = t.teachers_id.toString();
                                                return (
                                                    <SelectItem
                                                        key={idStr}
                                                        value={idStr}
                                                        textValue={`${t.prefix_name || ''}${t.firstname} ${t.lastname}`}
                                                    >
                                                        {t.prefix_name || ''}{t.firstname} {t.lastname}
                                                    </SelectItem>
                                                );
                                            })}
                                    </Select>
                                </div>

                            </ModalBody>
                            <ModalFooter className="p-6 pt-2 flex gap-2">
                                <Button
                                    fullWidth
                                    className="font-medium text-gray-600"
                                    isDisabled={isSubmitting}
                                    variant="light"
                                    onPress={onClose}
                                >
                                    ยกเลิก
                                </Button>
                                <Button
                                    fullWidth
                                    className="bg-[#6b857a] text-white rounded-xl font-bold shadow-sm hover:bg-[#5a7268]"
                                    isDisabled={isSubmitting}
                                    isLoading={isSubmitting}
                                    onPress={() => handleSubmit(onClose)}
                                >
                                    บันทึก
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
        </div>
    );
};

export default ClassroomManager;
