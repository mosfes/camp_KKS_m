"use client";
import { useStatusModal } from "@/components/StatusModalProvider";
import {
    Card,
    CardBody,
    Button,
    Table,
    TableHeader,
    TableColumn,
    TableBody,
    TableRow,
    TableCell,
    Chip,
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Input,
    useDisclosure,
    Select,
    SelectItem,
    Autocomplete,
    AutocompleteItem,
    Pagination,
    Textarea,
    Tooltip
} from "@heroui/react";
import { useState, useEffect, useRef } from "react";
import { Trash2, Trash, Archive, SquarePen, Search, ClipboardPaste, HelpCircle } from 'lucide-react';
import TrashManager from "./TrashManager";
import studentService from "@/app/service/adminService";
import { PlusIcon } from "./Icons";

function TeacherTableSkeleton() {
    return (
        <div aria-label="กำลังโหลดข้อมูลครู" className="flex w-full flex-col gap-3 p-4" role="status">
            {Array.from({ length: 6 }, (_, index) => (
                <div className="grid grid-cols-1 gap-3 rounded-xl border border-gray-100 p-3 sm:grid-cols-5 sm:items-center" key={index}>
                    <div className="h-4 w-40 animate-pulse rounded bg-gray-200" />
                    <div className="h-4 w-48 animate-pulse rounded bg-gray-200" />
                    <div className="h-4 w-28 animate-pulse rounded bg-gray-200" />
                    <div className="h-6 w-24 animate-pulse rounded-full bg-gray-200" />
                    <div className="flex gap-3">
                        <div className="h-5 w-5 animate-pulse rounded bg-gray-200" />
                        <div className="h-5 w-5 animate-pulse rounded bg-gray-200" />
                    </div>
                </div>
            ))}
        </div>
    );
}

const TeacherManager = () => {
    const { showSuccess, showError, showConfirm } = useStatusModal();
    const { isOpen, onOpen, onOpenChange } = useDisclosure();
    const [teachers, setTeachers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [showTrash, setShowTrash] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [totalPages, setTotalPages] = useState(1);
    const [totalTeachers, setTotalTeachers] = useState(0);
    const [isOtherPrefix, setIsOtherPrefix] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const submitInFlightRef = useRef(false);

    // Paste Import State
    const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
    const [pasteText, setPasteText] = useState("");
    const [importPreviewData, setImportPreviewData] = useState([]);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isLoadingImport, setIsLoadingImport] = useState(false);
    const [selectedImportKeys, setSelectedImportKeys] = useState(new Set(["all"]));


    // ตัวเลือกคำนำหน้าครู
    const prefixOptions = [
        { key: "นาย", label: "นาย" },
        { key: "นาง", label: "นาง" },
        { key: "นางสาว", label: "นางสาว" },
        { key: "ดร.", label: "ดร." },
        { key: "ว่าที่ร้อยตรี", label: "ว่าที่ร้อยตรี" },
        { key: "ว่าที่ร้อยตรีหญิง", label: "ว่าที่ร้อยตรีหญิง" },
        { key: "อื่นๆ", label: "อื่นๆ (ระบุเอง)" },
    ];

    const [formData, setFormData] = useState({
        teachers_id: "",
        prefix_name: "",
        firstname: "",
        lastname: "",
        email: "",
        tel: "",
        role: "TEACHER"
    });


    const handleTelChange = (e) => {
        const { name, value } = e.target;


        if (/^(0\d*)?$/.test(value)) {
            handleChange(e);

        }
    };

    useEffect(() => {
        setPage(1);
        fetchTeachers(1);
    }, [searchTerm]);

    const fetchTeachers = async (pageNum = 1) => {
        setIsLoading(true);
        try {
            const result = await studentService.getTeachersPaginated(pageNum, 20, searchTerm);
            const newData = Array.isArray(result) ? result : (result.data || []);

            setTeachers(newData);

            if (result.pagination) {
                setHasMore(pageNum < result.pagination.totalPages);
                setTotalPages(result.pagination.totalPages || 1);
                setTotalTeachers(result.pagination.total);
            } else {
                setHasMore(false);
                setTotalPages(1);
                setTotalTeachers(newData.length);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };


    const openAddModal = () => {
        setIsEditing(false);
        setFormData({ prefix_name: "", firstname: "", lastname: "", email: "", tel: "", role: "TEACHER" });
        setIsOtherPrefix(false);
        onOpen();
    };

    const handleEdit = (teacher) => {
        setIsEditing(true);
        const prefixInList = prefixOptions.find(p => p.key === teacher.prefix_name && p.key !== "อื่นๆ");
        setFormData({
            teachers_id: teacher.teachers_id,
            prefix_name: teacher.prefix_name || "",
            firstname: teacher.firstname,
            lastname: teacher.lastname,
            email: teacher.email || "",
            tel: teacher.tel || "",
            role: teacher.role || "TEACHER"
        });
        setIsOtherPrefix(teacher.prefix_name && !prefixInList);
        onOpen();
    };


    const handleDelete = (teacher) => {
        showConfirm(
            "ลบข้อมูลครู",
            `คุณต้องการลบข้อมูลครู "${teacher.firstname} ${teacher.lastname}" ใช่หรือไม่?`,
            async () => {
                try {
                    await studentService.deleteTeacher(teacher.teachers_id);
                    showSuccess("สำเร็จ", "ลบข้อมูลสำเร็จ");
                    setPage(1);
                    fetchTeachers(1);
                } catch (error) {
                    showError("เกิดข้อผิดพลาด", error.message);
                }
            },
            "ลบ"
        );
    };

    const handleSubmit = async (onClose) => {
        if (submitInFlightRef.current) return;
        if (!formData.firstname || !formData.email) {
            showError("ข้อมูลไม่ครบ", "กรุณากรอกชื่อและอีเมล");
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
            showError("รูปแบบอีเมลไม่ถูกต้อง", "กรุณาตรวจสอบรูปแบบอีเมลอีกครั้ง");
            return;
        }

        submitInFlightRef.current = true;
        setIsSubmitting(true);
        try {
            if (isEditing) {
                await studentService.updateTeacher(formData);
                showSuccess("สำเร็จ", "แก้ไขข้อมูลครูสำเร็จ!");
            } else {
                await studentService.addTeacher(formData);
                showSuccess("สำเร็จ", "เพิ่มข้อมูลครูสำเร็จ!");
            }

            setFormData({ prefix_name: "", firstname: "", lastname: "", email: "", tel: "", role: "TEACHER" });
            setPage(1);
            fetchTeachers(1);
            onClose();
        } catch (error) {
            showError("เกิดข้อผิดพลาด", error.message);
        } finally {
            submitInFlightRef.current = false;
            setIsSubmitting(false);
        }
    };

    const openPasteModal = () => {
        setPasteText("");
        setIsPasteModalOpen(true);
    };

    const handlePastePreview = async () => {
        if (!pasteText.trim()) {
            showError("ไม่มีข้อมูล", "กรุณาวางข้อมูลก่อนตรวจสอบ");
            return;
        }

        const lines = pasteText.split('\n').filter(line => line.trim() !== '');
        if (lines.length === 0) return;

        let emailsToCheck = [];
        const validDataPrep = lines.map((line, index) => {
            const cols = line.split('\t').map(c => c.trim());
            if (cols.length < 2) return null;

            let prefix_name = "";
            let firstname = "";
            let lastname = "";
            let email = "";
            let tel = "";

            const knownPrefixes = ["เด็กชาย", "เด็กหญิง", "นางสาว", "นาย", "นาง", "ดร.", "ว่าที่ร้อยตรีหญิง", "ว่าที่ร้อยตรี"];
            const extractPrefix = (name) => {
                for (const prefix of knownPrefixes) {
                    if (name.startsWith(prefix)) {
                        return { prefix_name: prefix, cleanName: name.slice(prefix.length).trim() };
                    }
                }
                return { prefix_name: "", cleanName: name };
            };

            if (cols.length >= 4 && cols[3].includes('@')) {
                prefix_name = cols[0];
                firstname = cols[1];
                lastname = cols[2];
                email = cols[3];
                tel = cols[4] || "";
            } else if (cols.length >= 3 && cols[2].includes('@')) {
                const extracted = extractPrefix(cols[0]);
                prefix_name = extracted.prefix_name;
                firstname = extracted.cleanName;
                lastname = cols[1];
                email = cols[2];
                tel = cols[3] || "";
            } else {
                const combined = cols[0];
                const extracted = extractPrefix(combined);
                prefix_name = extracted.prefix_name;
                const nameParts = extracted.cleanName.split(' ');
                firstname = nameParts[0];
                lastname = nameParts.slice(1).join(' ');
                email = cols[1];
                tel = cols[2] || "";
            }

            if (!firstname || !email) return null;

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            const isEmailValid = emailRegex.test(email);

            if (isEmailValid) {
                emailsToCheck.push(email);
            }

            return {
                id: index,
                prefix_name: prefix_name,
                firstname: firstname,
                lastname: lastname,
                email: email,
                tel: tel,
                role: "TEACHER",
                isEmailValid: isEmailValid
            };
        }).filter(item => item !== null);

        if (validDataPrep.length === 0) {
            showError("ไม่พบข้อมูลที่ถูกต้อง", "กรุณาตรวจสอบข้อมูลที่วาง (ต้องมีอย่างน้อยชื่อและอีเมลคั่นด้วย Tab)");
            return;
        }

        let existingInDb = [];
        try {
            if (emailsToCheck.length > 0) {
                existingInDb = await studentService.checkTeachersExist(emailsToCheck);
            }
        } catch (error) {
            console.error("Check existence error:", error);
        }

        const dbEmailSet = new Set(existingInDb.map(t => String(t.email)));
        const trashEmailSet = new Set(existingInDb.filter(t => t.deletedAt).map(t => String(t.email)));
        const seenEmails = new Set();

        const validData = validDataPrep.map(item => {
            const isDbDuplicate = item.isEmailValid ? dbEmailSet.has(item.email) : false;
            const isInTrash = item.isEmailValid ? trashEmailSet.has(item.email) : false;

            let isInternalDuplicate = false;
            if (item.isEmailValid) {
                if (seenEmails.has(item.email)) {
                    isInternalDuplicate = true;
                } else {
                    seenEmails.add(item.email);
                }
            }

            const isDuplicate = isDbDuplicate || isInternalDuplicate;

            return {
                ...item,
                isDuplicate: isDuplicate,
                isInTrash: isInTrash,
                suggestion: isInTrash ? "ครูคนนี้อยู่ในถังขยะ จะถูกกู้คืนและอัพเดทข้อมูลอัตโนมัติ" : ""
            };
        });

        setImportPreviewData(validData);

        const validKeys = new Set(
            validData.filter(item => !item.isDuplicate && item.isEmailValid).map(item => String(item.id))
        );

        setSelectedImportKeys(validKeys);
        setIsPasteModalOpen(false);
        setIsImportModalOpen(true);
    };

    const confirmImport = async () => {
        setIsLoadingImport(true);

        const isAllSelected = selectedImportKeys === "all";
        const teachersToImport = importPreviewData.filter(item => {
            if (isAllSelected) return !item.isDuplicate && item.isEmailValid;
            return selectedImportKeys.has(String(item.id));
        });

        if (teachersToImport.length === 0) {
            showError("เตือน", "กรุณาเลือกรายการที่ต้องการนำเข้าอย่างน้อย 1 รายการ");
            setIsLoadingImport(false);
            return;
        }

        try {
            const payloadArray = teachersToImport.map(t => ({
                prefix_name: t.prefix_name || "",
                firstname: t.firstname,
                lastname: t.lastname,
                email: t.email,
                tel: t.tel,
                role: t.role
            }));

            const result = await studentService.addTeachersBulk(payloadArray);

            setIsLoadingImport(false);
            setIsImportModalOpen(false);
            setImportPreviewData([]);
            setPage(1);
            fetchTeachers(1);

            showSuccess("สำเร็จ", `เพิ่มข้อมูลครูสำเร็จทั้งหมด ${result.count || payloadArray.length} รายการ `);
        } catch (error) {
            setIsLoadingImport(false);
            showError("เกิดข้อผิดพลาด", "การนำเข้าข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง หรือตรวจสอบไฟล์ของคุณ");
        }
    };



    if (showTrash) {
        return <TrashManager type="teacher" onBack={() => { setShowTrash(false); setPage(1); fetchTeachers(1); }} />;
    }

    return (
        <div className="flex flex-col gap-6 w-full pt-4 light">
            <Card className="border border-gray-100 shadow-sm rounded-2xl bg-white" radius="none">
                <CardBody className="p-4 md:p-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4 w-full">
                        <div>
                            <h3 className="text-gray-800 font-semibold">
                                การจัดการครู ({totalTeachers})
                            </h3>
                            <p className="text-sm text-gray-500 mt-1">เพิ่มและจัดการข้อมูลครู</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-start sm:justify-end">
                            <div className="flex items-center gap-2 min-w-[150px] flex-1 sm:flex-none">
                                <Input
                                    aria-label="Search teachers"
                                    placeholder="ค้นหา..."
                                    size="sm"
                                    isClearable
                                    startContent={<Search size={14} className="text-gray-400" />}
                                    value={searchTerm}
                                    onValueChange={(val) => setSearchTerm(val)}
                                    onClear={() => setSearchTerm("")}
                                    classNames={{ inputWrapper: "bg-white border-gray-200" }}
                                />
                            </div>

                            <Button
                                size="sm"
                                variant="bordered"
                                className="bg-white text-gray-600 border-gray-300 hover:bg-gray-50 shadow-sm rounded-full"
                                onPress={openPasteModal}
                            >
                                <ClipboardPaste size={16} />
                                <span className="ml-1 font-medium hidden sm:inline">นำเข้ารายชื่อ (วางข้อมูล)</span>
                            </Button>

                            <Button
                                onPress={openAddModal}
                                size="sm"
                                className="bg-sage text-white hover:bg-sage-dark shadow-sm rounded-full"
                            >
                                <PlusIcon />
                                <span className="ml-1 hidden sm:inline">เพิ่มครูใหม่</span>
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
                        <Table
                            aria-label="Teacher Table"
                            shadow="none"
                            isHeaderSticky
                            classNames={{
                                wrapper: "bg-white text-gray-800 border border-gray-100 rounded-xl p-0 overflow-hidden min-w-[700px] md:min-w-full",
                                th: "bg-gray-50/50 border-b border-gray-100 text-gray-800 font-semibold py-4",
                                td: "py-4 border-b border-gray-50/50 text-gray-800 bg-white",
                                tr: "bg-white",
                            }}
                        >
                            <TableHeader>
                                <TableColumn>ชื่อ-นามสกุล</TableColumn>
                                <TableColumn>อีเมล</TableColumn>
                                <TableColumn>เบอร์โทร</TableColumn>
                                <TableColumn>ตำแหน่ง</TableColumn>
                                <TableColumn>ดำเนินการ</TableColumn>
                            </TableHeader>
                            <TableBody
                                emptyContent={"ไม่มีข้อมูลครู"}
                                isLoading={isLoading}
                                loadingContent={<TeacherTableSkeleton />}
                            >
                                {teachers.map((t) => (
                                    <TableRow key={t.teachers_id} className="bg-white text-gray-800 border-b border-gray-300 last:border-b-0 hover:bg-gray-50">
                                        <TableCell>{t.prefix_name ? `${t.prefix_name}${t.firstname}` : t.firstname} {t.lastname}</TableCell>
                                        <TableCell>{t.email}</TableCell>
                                        <TableCell>{t.tel || "-"}</TableCell>
                                        <TableCell>
                                            <Chip
                                                size="sm"
                                                variant="flat"
                                                className={`border font-medium ${t.role?.toUpperCase() === "ADMIN"
                                                        ? "bg-[#f7f2fa] text-[#8e6ba8] border-[#e9dff2]"
                                                        : "bg-[#eff2f0] text-[#5d7c6f] border-[#dbe6e1]"
                                                    }`}
                                            >
                                                {t.role?.toUpperCase() === "ADMIN"
                                                    ? "ผู้ดูแลระบบ"
                                                    : ((t.classrooms && t.classrooms.length > 0) ||
                                                        (t.classroom_teacher && t.classroom_teacher.length > 0))
                                                        ? "ครูประจำชั้น"
                                                        : (t.camp && t.camp.length > 0)
                                                            ? "ครูหัวหน้าค่าย"
                                                            : "ครู"
                                                }
                                            </Chip>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <span
                                                    className="cursor-pointer active:opacity-50 text-sage hover:text-sage-dark"
                                                    onClick={() => handleEdit(t)}
                                                >
                                                    <SquarePen size={18} />
                                                </span>
                                                <span
                                                    className="cursor-pointer active:opacity-50 text-[#E84A5F] hover:text-[#FF847C] transition-colors"
                                                    onClick={() => handleDelete(t)}
                                                >
                                                    <Trash2 size={18} />
                                                </span>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    <div className="flex flex-col md:flex-row items-center mt-6 gap-4 px-2 w-full relative">
                        <div className="text-sm text-gray-500 order-2 md:order-1 md:absolute md:left-2">
                            แสดง {teachers.length} จาก {totalTeachers} รายการ
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
                                        fetchTeachers(newPage);
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


            <Modal isOpen={isOpen} onOpenChange={onOpenChange} placement="center" backdrop="blur" size="lg">
                <ModalContent className="bg-white rounded-2xl shadow-medium border border-gray-100 text-gray-800 p-2">
                    {(onClose) => (
                        <>
                            <ModalHeader>{isEditing ? "แก้ไขข้อมูลครู" : "เพิ่มครูใหม่"}</ModalHeader>
                            <ModalBody className="gap-4">
                                <div className="flex flex-col gap-1">
                                    <label className="text-sm font-medium text-gray-700">คำนำหน้า</label>
                                    <Select
                                        placeholder="เลือกคำนำหน้า"
                                        variant="bordered"
                                        radius="lg"
                                        selectedKeys={isOtherPrefix ? ["อื่นๆ"] : (formData.prefix_name ? [formData.prefix_name] : [])}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === "อื่นๆ") {
                                                setIsOtherPrefix(true);
                                            } else {
                                                setIsOtherPrefix(false);
                                                setFormData(prev => ({ ...prev, prefix_name: val }));
                                            }
                                        }}
                                        classNames={{ trigger: "bg-white" }}
                                    >
                                        {prefixOptions.map((p) => (
                                            <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>
                                        ))}
                                    </Select>
                                </div>

                                {isOtherPrefix && (
                                    <div className="flex flex-col gap-1">
                                        <label className="text-sm font-medium text-gray-700">ระบุคำนำหน้าอื่นๆ</label>
                                        <Input
                                            placeholder="เช่น ดร., ว่าที่ ร.ต."
                                            variant="bordered"
                                            radius="lg"
                                            value={formData.prefix_name === "อื่นๆ" ? "" : formData.prefix_name}
                                            onChange={(e) => setFormData(prev => ({ ...prev, prefix_name: e.target.value }))}
                                            classNames={{ inputWrapper: "bg-white" }}
                                        />
                                    </div>
                                )}
                                <div className="flex gap-4">
                                    <div className="flex flex-col gap-1 w-full">
                                        <label className="text-sm font-medium text-gray-700">ชื่อจริง</label>
                                        <Input
                                            name="firstname"
                                            value={formData.firstname}
                                            onChange={handleChange}
                                            variant="bordered"
                                            radius="lg"
                                            placeholder="กรอกชื่อจริง"
                                            classNames={{ inputWrapper: "bg-white" }}
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1 w-full">
                                        <label className="text-sm font-medium text-gray-700">นามสกุล</label>
                                        <Input
                                            name="lastname"
                                            value={formData.lastname}
                                            onChange={handleChange}
                                            variant="bordered"
                                            radius="lg"
                                            placeholder="กรอกนามสกุล"
                                            classNames={{ inputWrapper: "bg-white" }}
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-col gap-1">
                                    <label className="text-sm font-medium text-gray-700">อีเมล</label>
                                    <Input
                                        name="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        variant="bordered"
                                        radius="lg"
                                        placeholder="email@school.ac.th"
                                        classNames={{ inputWrapper: "bg-white" }}
                                    />
                                </div>

                                <div className="flex flex-col gap-1">
                                    <label className="text-sm font-medium text-gray-700">เบอร์โทร</label>
                                    <Input
                                        name="tel"
                                        value={formData.tel}
                                        onChange={(e) => {

                                            handleTelChange(e);
                                        }}
                                        isInvalid={formData.tel.length > 0 && formData.tel.length < 10}

                                        errorMessage="เบอร์โทรศัพท์ต้องมี 10 หลัก"
                                        variant="bordered"
                                        radius="lg"
                                        placeholder="0xxxxxxxxx"
                                        maxLength={10}
                                        type="tel"
                                        classNames={{ inputWrapper: "bg-white" }}
                                    />
                                </div>

                                <div className="flex flex-col gap-1">
                                    <label className="text-sm font-medium text-gray-700">ตำแหน่ง</label>
                                    <Select
                                        name="role"
                                        selectedKeys={[formData.role]}
                                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                        variant="bordered"
                                        radius="lg"
                                        placeholder="เลือกตำแหน่ง"
                                        disallowEmptySelection
                                        classNames={{ trigger: "bg-white" }}
                                    >
                                        <SelectItem key="TEACHER" value="TEACHER">ครู (Teacher)</SelectItem>
                                        <SelectItem key="ADMIN" value="ADMIN">ผู้ดูแลระบบ (Admin)</SelectItem>
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

            {/* Paste Data Modal */}
            <Modal isOpen={isPasteModalOpen} onOpenChange={setIsPasteModalOpen} placement="center" backdrop="blur" size="2xl">
                <ModalContent className="bg-white rounded-2xl shadow-medium border border-gray-100 text-gray-800 p-2">
                    {(onClosePaste) => (
                        <>
                            <ModalHeader>นำเข้ารายชื่อครู</ModalHeader>
                            <ModalBody className="gap-4">
                                <div className="flex flex-col gap-1">
                                    <label className="text-sm font-medium text-gray-700">วางข้อมูลครู (คัดลอกจาก Excel)</label>
                                    <Textarea
                                        placeholder={`ก๊อปปี้ข้อมูลมาจากไฟล์ Excel แล้วนำมาวางที่นี่ได้เลย (ชื่อ และ อีเมล จำเป็นต้องมี)\n\nตัวอย่าง:\nนาย\tสมชาย\tใจดี\tsomchai@school.ac.th\t0812345678\nนายสมหญิง ดีมาก\tsomying@school.ac.th\nดร.\tสมศตวรรษ\tใจปอง\tsomsatwat@school.ac.th`}
                                        variant="bordered"
                                        minRows={8}
                                        value={pasteText}
                                        onChange={(e) => setPasteText(e.target.value)}
                                        classNames={{ inputWrapper: "bg-white" }}
                                    />
                                </div>
                            </ModalBody>
                            <ModalFooter className="p-6 pt-2 flex gap-2">
                                <Button
                                    fullWidth
                                    className="font-medium text-gray-600"
                                    variant="light"
                                    onPress={onClosePaste}
                                >
                                    ยกเลิก
                                </Button>
                                <Button
                                    fullWidth
                                    className="bg-[#6b857a] text-white rounded-xl font-bold shadow-sm hover:bg-[#5a7268]"
                                    onPress={handlePastePreview}
                                >
                                    ตรวจสอบข้อมูล
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>

            {/* Import Preview Modal */}
            <Modal isOpen={isImportModalOpen} onOpenChange={setIsImportModalOpen} size="5xl" scrollBehavior="inside">
                <ModalContent>
                    {(onClose) => {
                        const isAllSelected = selectedImportKeys === "all";
                        const selectedCount = isAllSelected
                            ? importPreviewData.filter(item => !item.isDuplicate && item.isEmailValid).length
                            : selectedImportKeys.size;

                        return (
                            <>
                                <ModalHeader>ยืนยันการนำเข้าข้อมูล (เลือก {selectedCount} จาก {importPreviewData.length} รายการ)</ModalHeader>
                                <ModalBody>
                                    <div className="overflow-x-auto w-full">
                                        <Table
                                            aria-label="Import Preview"
                                            selectionMode="multiple"
                                            selectedKeys={selectedImportKeys}
                                            onSelectionChange={setSelectedImportKeys}
                                            disabledKeys={importPreviewData.filter(item => item.isDuplicate || !item.isEmailValid).map(item => String(item.id))}
                                            color="primary"
                                            classNames={{ 
                                                wrapper: "bg-white text-gray-800 min-w-fit",
                                                th: "bg-gray-50 text-gray-800",
                                                td: "bg-white text-gray-800",
                                                tr: "bg-white",
                                            }}
                                        >
                                            <TableHeader>
                                                <TableColumn>ชื่อ-นามสกุล</TableColumn>
                                                <TableColumn>อีเมล</TableColumn>
                                                <TableColumn>เบอร์โทร</TableColumn>
                                                <TableColumn>สถานะ</TableColumn>
                                            </TableHeader>
                                            <TableBody>
                                                {importPreviewData.map((t) => (
                                                    <TableRow key={t.id} className="bg-white text-gray-800 border-b border-gray-100">
                                                        <TableCell>
                                                            <div className="whitespace-nowrap">
                                                                {t.prefix_name ? `${t.prefix_name}${t.firstname}` : t.firstname} {t.lastname}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className={!t.isEmailValid ? "text-red-500" : ""}>{t.email}</TableCell>
                                                        <TableCell>{t.tel || "-"}</TableCell>
                                                        <TableCell>
                                                            {!t.isEmailValid ? (
                                                                <span className="text-orange-500 text-xs bg-orange-50 px-2 py-1 rounded-md font-medium whitespace-nowrap">
                                                                    รูปแบบอีเมลไม่ถูกต้อง
                                                                </span>
                                                            ) : t.isDuplicate ? (
                                                                <span className="text-red-500 text-xs bg-red-50 px-2 py-1 rounded-md font-medium whitespace-nowrap">
                                                                    มีอีเมลนี้แล้ว
                                                                </span>
                                                            ) : (
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-green-600 text-xs bg-green-50 px-2 py-1 rounded-md font-medium whitespace-nowrap">
                                                                        พร้อมนำเข้า
                                                                    </span>
                                                                    {t.suggestion && (
                                                                        <Tooltip content={t.suggestion} color="warning" className="text-white">
                                                                            <span className="cursor-help text-orange-400 hover:text-orange-600">
                                                                                <HelpCircle size={16} />
                                                                            </span>
                                                                        </Tooltip>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </ModalBody>
                                <ModalFooter className="p-6 pt-2 flex gap-2">
                                    <Button
                                        fullWidth
                                        className="font-medium text-gray-600"
                                        variant="light"
                                        onPress={onClose}
                                    >
                                        ยกเลิก
                                    </Button>
                                    <Button
                                        fullWidth
                                        className="bg-[#6b857a] text-white rounded-xl font-bold shadow-sm hover:bg-[#5a7268]"
                                        onPress={confirmImport}
                                        isLoading={isLoadingImport}
                                    >
                                        ยืนยันนำเข้า
                                    </Button>
                                </ModalFooter>
                            </>
                        );
                    }}
                </ModalContent>
            </Modal>

        </div >
    );
};

export default TeacherManager;
