"use client";

import type { DateValue } from "@internationalized/date";

import React, { useState, useEffect, useRef } from "react";
import {
  ChevronRight,
  ChevronLeft,
  ImageOff,
  X,
  Trash2,
  FileText,
  Shirt,
  Calendar,
  Clock,
  Info,
  Check,
} from "lucide-react";
import { Select, SelectItem } from "@heroui/react";
import { DateRangePicker } from "@heroui/react";
import { parseDate, today } from "@internationalized/date";

import { useStatusModal } from "@/components/StatusModalProvider";
import { BANGKOK_TIME_ZONE, getBangkokDateKey } from "@/lib/bangkok-date";
import CampDestinationField, {
  type CampDestination,
} from "@/components/camp-location/CampDestinationField";

interface TimeSlot {
  startTime: string;
  endTime: string;
  activity: string;
}

interface DaySchedule {
  day: number;
  timeSlots: TimeSlot[];
}

interface FormData {
  name: string;
  location: string;
  gradeLevel: string;
  classroomType: string;
  registrationStartDate: string;
  registrationEndDate: string;
  campStartDate: string;
  campEndDate: string;
  description: string;
  hasShirt: boolean;
  hasTransport: boolean;
  shirtStartDate: string;
  shirtEndDate: string;
  dailySchedule: DaySchedule[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  campData: any;
  isLoading?: boolean;
  initialStep?: number;
  targetSection?: "info" | "schedule" | "shirt" | "all";
}

function dateValueToString(date: DateValue) {
  return `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}

function formatDateWithOffset(startDateStr: string, dayOffset: number) {
  if (!startDateStr) return "";
  const date = new Date(startDateStr);

  date.setUTCDate(date.getUTCDate() + dayOffset);

  return date.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: BANGKOK_TIME_ZONE,
  });
}

function revokePreviewUrl(url: string | null) {
  if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
}

export default function EditCampModal({
  isOpen,
  onClose,
  onSubmit,
  campData,
  isLoading,
  initialStep = 1,
  targetSection = "all",
}: Props) {
  const { showWarning } = useStatusModal();
  const submitInFlightRef = useRef(false);
  const isSingleSection =
    targetSection === "info" ||
    targetSection === "schedule" ||
    targetSection === "shirt";

  const getEffectiveStep = () => {
    if (targetSection === "info") return 1;
    if (targetSection === "schedule") return 2;
    if (targetSection === "shirt") return 3;
    return initialStep || 1;
  };

  const [classrooms, setClassrooms] = useState<any[]>([]);
  const [filteredClassrooms, setFilteredClassrooms] = useState<any[]>([]);
  const [selectedGrades, setSelectedGrades] = useState<string[]>([]);
  const [selectedClassroomIds, setSelectedClassroomIds] = useState<number[]>(
    [],
  );
  const [shirtImages, setShirtImages] = useState<(string | null)[]>([
    null,
    null,
    null,
  ]);
  const [shirtImageFiles, setShirtImageFiles] = useState<(File | null)[]>([
    null,
    null,
    null,
  ]);
  const [campImage, setCampImage] = useState<string | null>(null);
  const [campImageFile, setCampImageFile] = useState<File | null>(null);
  const [destination, setDestination] = useState<CampDestination | null>(null);
  const [locationTrackingEnabled, setLocationTrackingEnabled] = useState(false);
  const [currentStep, setCurrentStep] = useState(getEffectiveStep());

  useEffect(() => {
    if (isOpen) {
      setCurrentStep(getEffectiveStep());
    }
  }, [isOpen, targetSection, initialStep]);

  const [formData, setFormData] = useState<FormData>({
    name: "",
    location: "",
    gradeLevel: "",
    classroomType: "",
    registrationStartDate: "",
    registrationEndDate: "",
    campStartDate: "",
    campEndDate: "",
    description: "",
    hasShirt: false,
    hasTransport: false,
    shirtStartDate: "",
    shirtEndDate: "",
    dailySchedule: [
      {
        day: 1,
        timeSlots: [{ startTime: "", endTime: "", activity: "" }],
      },
    ],
  });

  const [dateErrors, setDateErrors] = useState({
    registration: "",
    shirt: "",
    camp: "",
  });

  const validateDates = (data: FormData) => {
    const errors = {
      registration: "",
      shirt: "",
      camp: "",
    };

    const regisStart = data.registrationStartDate
      ? new Date(data.registrationStartDate)
      : null;
    const regisEnd = data.registrationEndDate
      ? new Date(data.registrationEndDate)
      : null;
    const shirtStart = data.shirtStartDate
      ? new Date(data.shirtStartDate)
      : null;
    const shirtEnd = data.shirtEndDate ? new Date(data.shirtEndDate) : null;
    const campStart = data.campStartDate ? new Date(data.campStartDate) : null;

    // 1. Registration Logic
    if (regisEnd) {
      if (campStart && regisEnd > campStart) {
        errors.registration = "วันสิ้นสุดรับสมัคร ต้องไม่เกิน วันเริ่มค่าย";
      }
    }

    // 2. Shirt Logic
    if (data.hasShirt && shirtStart && shirtEnd) {
      if (campStart && shirtEnd >= campStart) {
        errors.shirt = "วันสิ้นสุดจองเสื้อ ต้องมาก่อน วันเริ่มค่าย";
      }
    }

    // 3. Camp Logic
    if (campStart) {
      if (data.hasShirt && shirtEnd && campStart <= shirtEnd) {
        errors.camp = "วันเริ่มค่าย ต้องมาหลัง วันปิดจองเสื้อ";
      }
      if (regisEnd && campStart < regisEnd) {
        errors.camp = "วันเริ่มค่าย ต้องไม่มาก่อน วันปิดรับสมัคร";
      }
    }

    setDateErrors(errors);

    return !errors.registration && !errors.shirt && !errors.camp;
  };

  // Re-validate whenever relevant form data changes
  useEffect(() => {
    validateDates(formData);
  }, [
    formData.registrationStartDate,
    formData.registrationEndDate,
    formData.shirtStartDate,
    formData.shirtEndDate,
    formData.campStartDate,
    formData.campEndDate,
    formData.hasShirt,
  ]);

  // Fetch classrooms
  useEffect(() => {
    async function fetchClassrooms() {
      try {
        const res = await fetch("/api/classrooms");
        const data = await res.json();

        setClassrooms(data);
      } catch (err) {
        console.error("Failed to fetch classrooms:", err);
      }
    }
    if (isOpen) {
      fetchClassrooms();
    }
  }, [isOpen]);

  // โหลดข้อมูลค่ายที่จะแก้ไข
  useEffect(() => {
    if (isOpen && campData) {
      console.log("=== Loading Camp Data for Edit ===");
      console.log("campData:", campData);

      // แปลง date จาก ISO string เป็น YYYY-MM-DD
      const formatDateForInput = (dateString: string) => {
        if (!dateString) return "";

        return getBangkokDateKey(dateString);
      };

      // ดึง grade_level ทุกชั้นจาก camp_classroom
      if (campData.camp_classroom && campData.camp_classroom.length > 0) {
        const gradesSet = new Set<string>();

        campData.camp_classroom.forEach((cc: any) => {
          if (cc.classroom?.grade) {
            gradesSet.add(cc.classroom.grade);
          }
        });
        const gradesArray = Array.from(gradesSet);

        setSelectedGrades(gradesArray);
      } else {
        setSelectedGrades([]);
      }

      // ดึง classroom IDs
      if (campData.camp_classroom && campData.camp_classroom.length > 0) {
        const classroomIds = campData.camp_classroom.map(
          (cc: any) => cc.classroom.classroom_id,
        );

        setSelectedClassroomIds(classroomIds);
      }

      // ดึง daily_schedule
      let dailySchedule: DaySchedule[] = [];

      if (
        campData.camp_daily_schedule &&
        campData.camp_daily_schedule.length > 0
      ) {
        dailySchedule = campData.camp_daily_schedule
          .sort((a: any, b: any) => a.day - b.day)
          .map((schedule: any) => ({
            day: schedule.day,
            timeSlots:
              schedule.time_slots && schedule.time_slots.length > 0
                ? schedule.time_slots.map((slot: any) => ({
                    startTime: (
                      slot.startTime ||
                      slot.start_time ||
                      ""
                    ).replace(".", ":"),
                    endTime: (slot.endTime || slot.end_time || "").replace(
                      ".",
                      ":",
                    ),
                    activity: slot.activity || "",
                  }))
                : [{ startTime: "", endTime: "", activity: "" }],
          }));
      }

      // ตั้งค่า formData
      setFormData({
        name: campData.name || "",
        location: campData.location || "",
        gradeLevel: Array.from(
          new Set(
            campData.camp_classroom?.map((cc: any) => cc.classroom.grade) || [],
          ),
        ).join(","),
        classroomType: campData.plan_type?.name || "",
        registrationStartDate: formatDateForInput(campData.start_regis_date),
        registrationEndDate: formatDateForInput(campData.end_regis_date),
        campStartDate: formatDateForInput(campData.start_date),
        campEndDate: formatDateForInput(campData.end_date),
        description: campData.description || "",
        hasShirt: campData.has_shirt || false,
        hasTransport: Boolean(
          campData.has_transport || campData.location_sharing_enabled,
        ),
        shirtStartDate: formatDateForInput(campData.start_shirt_date),
        shirtEndDate: formatDateForInput(campData.end_shirt_date),
        dailySchedule:
          dailySchedule.length > 0
            ? dailySchedule
            : [
                {
                  day: 1,
                  timeSlots: [{ startTime: "", endTime: "", activity: "" }],
                },
              ],
      });
      setDestination(
        campData.destination_latitude != null &&
          campData.destination_longitude != null
          ? {
              name: campData.destination_name || "จุดหมายค่าย",
              address: campData.destination_address || "",
              latitude: campData.destination_latitude,
              longitude: campData.destination_longitude,
            }
          : null,
      );
      setLocationTrackingEnabled(Boolean(campData.location_sharing_enabled));

      // ตั้งค่ารูปเสื้อ (จาก JSON array ถ้ามี)
      if (campData.img_shirt_url) {
        try {
          const parsed = JSON.parse(campData.img_shirt_url);

          if (Array.isArray(parsed)) {
            const initialImages = [null, null, null];

            parsed.forEach((url, i) => {
              if (i < 3) initialImages[i] = url;
            });
            setShirtImages(initialImages);
          } else {
            setShirtImages([campData.img_shirt_url, null, null]);
          }
        } catch (e) {
          // Fallback สำหรับค่ายเก่าที่เก็บเป็น string ธรรมดา
          setShirtImages([campData.img_shirt_url, null, null]);
        }
      } else {
        setShirtImages([null, null, null]);
      }

      // ตั้งค่ารูปปกค่าย
      if (campData.img_camp_url) {
        setCampImage(campData.img_camp_url);
      }
    }
  }, [isOpen, campData]);

  // Filter classrooms by grade
  useEffect(() => {
    if (selectedGrades.length > 0) {
      const filtered = classrooms.filter((c) =>
        selectedGrades.includes(c.grade),
      );

      setFilteredClassrooms(filtered);
    } else {
      setFilteredClassrooms([]);
    }
  }, [selectedGrades, classrooms]);

  // Auto-generate schedule days based on Camp Period
  useEffect(() => {
    if (formData.campStartDate && formData.campEndDate) {
      const start = new Date(formData.campStartDate);
      const end = new Date(formData.campEndDate);

      // Calculate difference in days (inclusive)
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

      if (diffDays > 0 && diffDays !== formData.dailySchedule.length) {
        setFormData((prev) => {
          const currentSchedule = [...prev.dailySchedule];

          if (diffDays > currentSchedule.length) {
            // Add missing days
            for (let i = currentSchedule.length; i < diffDays; i++) {
              currentSchedule.push({
                day: i + 1,
                timeSlots: [{ startTime: "", endTime: "", activity: "" }],
              });
            }
          } else {
            // Remove extra days
            currentSchedule.splice(diffDays);
          }

          return { ...prev, dailySchedule: currentSchedule };
        });
      }
    }
  }, [formData.campStartDate, formData.campEndDate]);

  const grades = Array.from(new Set(classrooms.map((c) => c.grade))).sort();

  if (!isOpen) return null;

  const handleChange = (field: keyof FormData, value: any) => {
    setFormData((prev) => {
      const newData = { ...prev, [field]: value };

      if (field === "registrationStartDate") {
        if (
          !prev.shirtStartDate ||
          prev.shirtStartDate === prev.registrationStartDate
        ) {
          newData.shirtStartDate = value;
        }
      } else if (field === "registrationEndDate") {
        if (
          !prev.shirtEndDate ||
          prev.shirtEndDate === prev.registrationEndDate
        ) {
          newData.shirtEndDate = value;
        }
      }

      return newData;
    });
  };

  const addDay = () => {
    setFormData((prev) => ({
      ...prev,
      dailySchedule: [
        ...prev.dailySchedule,
        {
          day: prev.dailySchedule.length + 1,
          timeSlots: [{ startTime: "", endTime: "", activity: "" }],
        },
      ],
    }));
  };

  const removeDay = (dayIndex: number) => {
    if (formData.dailySchedule.length <= 1) return;
    const newSchedule = formData.dailySchedule
      .filter((_, i) => i !== dayIndex)
      .map((day, idx) => ({ ...day, day: idx + 1 }));

    setFormData({ ...formData, dailySchedule: newSchedule });
  };

  const addTimeSlot = (dayIndex: number) => {
    const newSchedule = [...formData.dailySchedule];

    newSchedule[dayIndex].timeSlots.push({
      startTime: "",
      endTime: "",
      activity: "",
    });
    setFormData({ ...formData, dailySchedule: newSchedule });
  };

  const updateTimeSlot = (
    dayIndex: number,
    slotIndex: number,
    field: keyof TimeSlot,
    value: string,
  ) => {
    const newSchedule = [...formData.dailySchedule];

    newSchedule[dayIndex].timeSlots[slotIndex][field] = value;
    setFormData({ ...formData, dailySchedule: newSchedule });
  };

  const removeTimeSlot = (dayIndex: number, slotIndex: number) => {
    const newSchedule = [...formData.dailySchedule];

    if (newSchedule[dayIndex].timeSlots.length > 1) {
      newSchedule[dayIndex].timeSlots = newSchedule[dayIndex].timeSlots.filter(
        (_, i) => i !== slotIndex,
      );
      setFormData({ ...formData, dailySchedule: newSchedule });
    }
  };

  const handleShirtImageChange =
    (index: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];

      if (file) {
        if (!file.type.startsWith("image/")) {
          showWarning("ไฟล์ไม่ถูกต้อง", "กรุณาเลือกไฟล์รูปภาพเท่านั้น");

          return;
        }

        if (file.size > 10 * 1024 * 1024) {
          showWarning("ขนาดไฟล์เกิน", "ขนาดไฟล์ต้องไม่เกิน 10MB");

          return;
        }

        const newFiles = [...shirtImageFiles];

        newFiles[index] = file;
        setShirtImageFiles(newFiles);

        const newImages = [...shirtImages];

        revokePreviewUrl(newImages[index]);
        newImages[index] = URL.createObjectURL(file);
        setShirtImages(newImages);
      }
    };

  const removeShirtImage = (index: number) => {
    const newImages = [...shirtImages];
    const newFiles = [...shirtImageFiles];

    revokePreviewUrl(newImages[index]);
    newImages[index] = null;
    newFiles[index] = null;
    setShirtImages(newImages);
    setShirtImageFiles(newFiles);
  };

  const handleCampImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (file) {
      if (!file.type.startsWith("image/")) {
        showWarning("ไฟล์ไม่ถูกต้อง", "กรุณาเลือกไฟล์รูปภาพเท่านั้น");

        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        showWarning("ขนาดไฟล์เกิน", "ขนาดไฟล์ต้องไม่เกิน 10MB");

        return;
      }
      setCampImageFile(file);
      revokePreviewUrl(campImage);
      setCampImage(URL.createObjectURL(file));
    }
  };

  const removeCampImage = () => {
    revokePreviewUrl(campImage);
    setCampImage(null);
    setCampImageFile(null);
  };

  const validateStep1 = () => {
    if (!formData.name.trim()) {
      showWarning("ข้อมูลไม่ครบถ้วน", "กรุณากรอกชื่อค่าย");
      return false;
    }
    if (selectedClassroomIds.length === 0) {
      showWarning("ข้อมูลไม่ครบถ้วน", "กรุณาเลือกห้องเรียนอย่างน้อย 1 ห้อง");
      return false;
    }
    if (!formData.location.trim()) {
      showWarning("ข้อมูลไม่ครบถ้วน", "กรุณากรอกสถานที่จัดค่าย");
      return false;
    }
    if (locationTrackingEnabled && !destination) {
      showWarning(
        "ยังไม่ได้ปักหมุด",
        "กรุณาค้นหาสถานที่หรือคลิกบนแผนที่เพื่อปักหมุดจุดหมาย",
      );
      return false;
    }
    if (!formData.registrationStartDate || !formData.registrationEndDate) {
      showWarning("ข้อมูลไม่ครบถ้วน", "กรุณาเลือกช่วงเวลารับสมัคร");
      return false;
    }
    if (!formData.campStartDate || !formData.campEndDate) {
      showWarning("ข้อมูลไม่ครบถ้วน", "กรุณาเลือกวันจัดค่าย");
      return false;
    }
    if (dateErrors.registration || dateErrors.camp) {
      showWarning(
        "วันที่ไม่ถูกต้อง",
        dateErrors.registration || dateErrors.camp,
      );
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    const hasInvalidSchedule = formData.dailySchedule.some((day) =>
      day.timeSlots.some(
        (slot) =>
          slot.startTime && slot.endTime && slot.startTime > slot.endTime,
      ),
    );

    if (hasInvalidSchedule) {
      showWarning(
        "ข้อมูลไม่ถูกต้อง",
        "กรุณาตรวจสอบเวลาในกำหนดการรายวัน (เวลาสิ้นสุดต้องไม่ก่อนเวลาเริ่ม)",
      );
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isLoading || submitInFlightRef.current) return;

    if (targetSection === "info" || !targetSection || targetSection === "all") {
      if (!validateStep1()) {
        if (!isSingleSection) setCurrentStep(1);
        return;
      }
    }

    if (targetSection === "schedule" || !targetSection || targetSection === "all") {
      if (!validateStep2()) {
        if (!isSingleSection) setCurrentStep(2);
        return;
      }
    }

    if (targetSection === "shirt" || !targetSection || targetSection === "all") {
      if (formData.hasShirt) {
        if (!formData.shirtEndDate || !formData.campStartDate) {
          showWarning(
            "ข้อมูลไม่ครบถ้วน",
            "กรุณากรอกวันที่สิ้นสุดการจองเสื้อ และวันเริ่มค่าย",
          );
          if (!isSingleSection) setCurrentStep(3);
          return;
        }
        if (new Date(formData.shirtEndDate) >= new Date(formData.campStartDate)) {
          showWarning(
            "วันที่ไม่ถูกต้อง",
            "วันสิ้นสุดการจองเสื้อต้องเป็นวันก่อนเริ่มค่ายเท่านั้น",
          );
          if (!isSingleSection) setCurrentStep(3);
          return;
        }
      }
    }

    const payload = {
      name: formData.name,
      location: formData.location,
      start_date: formData.campStartDate,
      end_date: formData.campEndDate,
      start_regis_date: formData.registrationStartDate,
      end_regis_date: formData.registrationEndDate,
      start_shirt_date: formData.shirtStartDate,
      end_shirt_date: formData.shirtEndDate,
      description: formData.description,
      has_shirt: formData.hasShirt,
      status: "OPEN",
      classroom_ids: selectedClassroomIds,
      gradeLevel: selectedGrades.join(","),
      dailySchedule: formData.dailySchedule,
      shirtImages: shirtImages,
      shirtImageFiles: shirtImageFiles,
      campImage: campImage,
      campImageFile: campImageFile,
      camp_id: campData.camp_id,
      destination,
      location_sharing_enabled: locationTrackingEnabled,
      has_transport: formData.hasTransport || locationTrackingEnabled,
    };

    submitInFlightRef.current = true;
    try {
      await onSubmit(payload);
    } finally {
      submitInFlightRef.current = false;
    }
  };

  const steps = [
    { id: 1, title: "ข้อมูลค่าย", desc: "ข้อมูลทั่วไป & วันจัดค่าย", icon: <Info size={16} /> },
    { id: 2, title: "กำหนดการ", desc: "ตารางกิจกรรมรายวัน", icon: <Clock size={16} /> },
    { id: 3, title: "เสื้อค่าย", desc: "การจอง & แบบเสื้อ", icon: <Shirt size={16} /> },
  ];

  const getHeaderInfo = () => {
    if (targetSection === "info") {
      return {
        title: "แก้ไขข้อมูลค่าย",
        subtitle: "แก้ไขข้อมูลทั่วไป ระดับชั้น ห้องเรียน สถานที่ และช่วงเวลาจัดค่าย",
      };
    }
    if (targetSection === "schedule") {
      return {
        title: "แก้ไขกำหนดการค่าย",
        subtitle: "จัดการช่วงเวลาและกิจกรรมในแต่ละวันของค่าย",
      };
    }
    if (targetSection === "shirt") {
      return {
        title: "แก้ไขการจองเสื้อค่าย",
        subtitle: "ตั้งค่าเปิด/ปิดการจองเสื้อ ช่วงเวลาจอง และรูปตัวอย่างเสื้อ",
      };
    }
    return {
      title: "แก้ไขรายละเอียดค่าย",
      subtitle: `อัปเดตรายละเอียดของค่าย (${steps[currentStep - 1]?.title || "ข้อมูลค่าย"})`,
    };
  };

  const headerInfo = getHeaderInfo();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        role="presentation"
        onClick={() => {
          if (!isLoading) onClose();
        }}
      />
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b bg-white flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{headerInfo.title}</h2>
            <p className="text-xs sm:text-sm text-gray-500">{headerInfo.subtitle}</p>
          </div>
          <button
            aria-label="ปิดหน้าต่างแก้ไขค่าย"
            className="p-2 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
            disabled={isLoading}
            type="button"
            onClick={onClose}
          >
            <X className="text-gray-400" size={24} />
          </button>
        </div>

        {/* Step Indicator Bar - Show only when editing all steps */}
        {!isSingleSection && (
          <div className="px-4 sm:px-6 py-3 bg-gray-50 border-b border-gray-100">
            <div className="flex items-center justify-between max-w-2xl mx-auto">
              {steps.map((s, idx) => {
                const isActive = currentStep === s.id;
                const isPassed = currentStep > s.id;
                return (
                  <React.Fragment key={s.id}>
                    {idx > 0 && (
                      <div
                        className={`flex-1 h-0.5 mx-2 sm:mx-4 transition-colors ${
                          isPassed ? "bg-[#6b857a]" : "bg-gray-200"
                        }`}
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (s.id < currentStep) {
                          setCurrentStep(s.id);
                        } else if (s.id === 2 && currentStep === 1) {
                          if (validateStep1()) setCurrentStep(2);
                        } else if (s.id === 3 && currentStep === 1) {
                          if (validateStep1() && validateStep2()) setCurrentStep(3);
                        } else if (s.id === 3 && currentStep === 2) {
                          if (validateStep2()) setCurrentStep(3);
                        }
                      }}
                      className="flex items-center gap-2 group cursor-pointer focus:outline-none"
                    >
                      <div
                        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                          isActive
                            ? "bg-[#6b857a] text-white shadow-md ring-4 ring-[#6b857a]/20"
                            : isPassed
                            ? "bg-[#6b857a] text-white"
                            : "bg-gray-200 text-gray-500 group-hover:bg-gray-300"
                        }`}
                      >
                        {isPassed ? <Check size={14} /> : s.id}
                      </div>
                      <div className="hidden sm:flex flex-col text-left">
                        <span
                          className={`text-xs font-bold ${
                            isActive
                              ? "text-[#6b857a]"
                              : isPassed
                              ? "text-gray-800"
                              : "text-gray-400"
                          }`}
                        >
                          {s.title}
                        </span>
                        <span className="text-[10px] text-gray-400">{s.desc}</span>
                      </div>
                    </button>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        )}

        {/* Form Body - Paginated by Step */}
        <div className="overflow-y-auto p-5 sm:p-6 flex-1">
          {/* STEP 1: ข้อมูลค่าย & ช่วงเวลา */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2 mb-1">
                  <span className="w-1.5 h-6 bg-[#6b857a] rounded-full" />
                  ข้อมูลทั่วไปและช่วงเวลา
                </h3>
                <p className="text-xs text-gray-500">
                  กรอกข้อมูลพื้นฐาน ระดับชั้นที่เปิดรับ และช่วงเวลาจัดกิจกรรม
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="edit-camp-name">
                    ชื่อค่าย <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    id="edit-camp-name"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6b857a] outline-none"
                    placeholder="เช่น MSEC Camp 2025"
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleChange("name", e.target.value)}
                  />
                </div>

                {/* Grade Selection */}
                <div>
                  <div className="block text-sm font-medium text-gray-700 mb-1">
                    <p>
                    เลือกระดับชั้น (เลือกได้มากกว่า 1) <span className="text-red-500">*</span>
                    </p>
                    <Select
                      isRequired
                      classNames={{
                        trigger: "border-gray-300",
                      }}
                      label="ระดับชั้น"
                      placeholder="-- เลือกระดับชั้น --"
                      selectedKeys={new Set(selectedGrades)}
                      selectionMode="multiple"
                      onSelectionChange={(keys) => {
                        const grades = Array.from(keys) as string[];

                        setSelectedGrades(grades);
                        handleChange("gradeLevel", grades.join(","));
                      }}
                    >
                      {grades.map((grade) => (
                        <SelectItem key={grade}>
                          {grade.replace("Level_", "ม.")}
                        </SelectItem>
                      ))}
                    </Select>
                  </div>
                </div>

                {/* Classroom Selection */}
                <div>
                  <p className="block text-sm font-medium text-gray-700 mb-1">
                    เลือกห้องเรียน <span className="text-red-500">*</span>
                    {selectedClassroomIds.length > 0 && (
                      <span className="ml-2 text-xs text-[#6b857a]">
                        (เลือกแล้ว {selectedClassroomIds.length} ห้อง)
                      </span>
                    )}
                  </p>
                  <div className="w-full px-4 py-2 border border-gray-300 rounded-lg max-h-40 overflow-y-auto bg-white">
                    {selectedGrades.length === 0 ? (
                      <p className="text-sm text-gray-400">
                        กรุณาเลือกระดับชั้นก่อน
                      </p>
                    ) : filteredClassrooms.length === 0 ? (
                      <p className="text-sm text-gray-400">
                        ไม่มีห้องเรียนสำหรับระดับชั้นนี้
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {filteredClassrooms.map((classroom) => (
                          <label
                            key={classroom.classroom_id}
                            className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors"
                          >
                            <input
                              checked={selectedClassroomIds.includes(
                                classroom.classroom_id,
                              )}
                              className="w-4 h-4 rounded border-gray-300 text-[#6b857a] focus:ring-[#6b857a]"
                              type="checkbox"
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedClassroomIds([
                                    ...selectedClassroomIds,
                                    classroom.classroom_id,
                                  ]);
                                } else {
                                  setSelectedClassroomIds(
                                    selectedClassroomIds.filter(
                                      (id) => id !== classroom.classroom_id,
                                    ),
                                  );
                                }
                              }}
                            />
                            <span className="text-sm">
                              {classroom.grade?.replace("Level_", "ม.")}{" "}
                              {classroom.classroom_types?.name ||
                                classroom.type_classroom}{" "}
                              -{" "}
                              <span className="text-gray-400">
                                {classroom.teacher.firstname}{" "}
                                {classroom.teacher.lastname}
                                {classroom.classroom_teacher &&
                                  classroom.classroom_teacher.length > 0 && (
                                    <>
                                      {", "}
                                      {classroom.classroom_teacher
                                        .map(
                                          (ct: any) =>
                                            `${ct.teacher.firstname} ${ct.teacher.lastname}`,
                                        )
                                        .join(", ")}
                                    </>
                                  )}
                              </span>
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="edit-camp-location">
                    สถานที่ <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    id="edit-camp-location"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6b857a] outline-none"
                    placeholder="อาคารวิทยวิภาส คณะวิทยาศาสตร์ มข."
                    type="text"
                    value={formData.location}
                    onChange={(e) => handleChange("location", e.target.value)}
                  />
                </div>

                <CampDestinationField
                  destination={destination}
                  enabled={locationTrackingEnabled}
                  hasTransport={formData.hasTransport}
                  onDestinationChange={setDestination}
                  onEnabledChange={(enabled) => {
                    setLocationTrackingEnabled(enabled);
                    if (enabled) handleChange("hasTransport", true);
                  }}
                  onHasTransportChange={(hasTransport) =>
                    handleChange("hasTransport", hasTransport)
                  }
                />

                {/* Camp Image Upload */}
                <div className="md:col-span-2">
                  <p className="block text-sm font-medium text-gray-700 mb-1">
                    รูปภาพหน้าปกค่าย
                  </p>
                  {!campImage ? (
                    <label className="block w-full cursor-pointer mt-1">
                      <input
                        accept="image/*"
                        className="hidden"
                        type="file"
                        onChange={handleCampImageChange}
                      />
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-[#6b857a] hover:bg-gray-50 transition-all">
                        <ImageOff
                          className="mx-auto text-gray-400 mb-2"
                          size={28}
                        />
                        <p className="text-sm text-gray-500 font-medium">
                          คลิกเพื่ออัปโหลดรูปปกค่าย
                        </p>
                      </div>
                    </label>
                  ) : (
                    <div className="relative rounded-xl overflow-hidden mt-2 border border-gray-200 shadow-sm max-w-3xl mx-auto">
                      <img
                        alt="Camp cover"
                        className="w-full h-64 object-cover bg-gray-50"
                        src={campImage}
                      />
                      <button
                        className="absolute top-3 right-3 p-2 bg-red-500/90 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg backdrop-blur-sm"
                        type="button"
                        onClick={removeCampImage}
                      >
                        <X size={18} />
                      </button>
                    </div>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="edit-camp-description">
                    รายละเอียด
                  </label>
                  <textarea
                    id="edit-camp-description"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6b857a] outline-none"
                    placeholder="รายละเอียดของค่าย..."
                    rows={3}
                    value={formData.description}
                    onChange={(e) => handleChange("description", e.target.value)}
                  />
                </div>
              </div>

              {/* Dates Section inside Step 1 */}
              <div className="border-t pt-6 space-y-4">
                <h4 className="text-base font-semibold text-gray-800">
                  ช่วงเวลารับสมัครและจัดค่าย
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Registration Period */}
                  <div>
                    <p className="block text-xs font-bold text-gray-500 uppercase mb-1">
                      ช่วงเวลารับสมัคร <span className="text-red-500">*</span>
                    </p>
                    <DateRangePicker
                      aria-label="Registration Period"
                      className="w-full h-[56px]"
                      errorMessage={dateErrors.registration}
                      isInvalid={!!dateErrors.registration}
                      minValue={today(BANGKOK_TIME_ZONE)}
                      value={
                        formData.registrationStartDate &&
                        formData.registrationEndDate
                          ? {
                              start: parseDate(formData.registrationStartDate),
                              end: parseDate(formData.registrationEndDate),
                            }
                          : null
                      }
                      onChange={(range) => {
                        if (!range) return;
                        handleChange(
                          "registrationStartDate",
                          dateValueToString(range.start),
                        );
                        handleChange(
                          "registrationEndDate",
                          dateValueToString(range.end),
                        );
                      }}
                    />
                  </div>

                  {/* Camp Period */}
                  <div>
                    <p className="block text-xs font-bold text-[#6b857a] uppercase mb-1">
                      วันจัดค่าย <span className="text-red-500">*</span>
                    </p>
                    <DateRangePicker
                      aria-label="Camp Period"
                      className="w-full h-[56px]"
                      errorMessage={dateErrors.camp}
                      isInvalid={!!dateErrors.camp}
                      value={
                        formData.campStartDate && formData.campEndDate
                          ? {
                              start: parseDate(formData.campStartDate),
                              end: parseDate(formData.campEndDate),
                            }
                          : null
                      }
                      onChange={(range) => {
                        if (!range) return;
                        handleChange(
                          "campStartDate",
                          dateValueToString(range.start),
                        );
                        handleChange("campEndDate", dateValueToString(range.end));
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: กำหนดการรายวัน */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2 mb-1">
                    <span className="w-1.5 h-6 bg-[#6b857a] rounded-full" />
                    กำหนดการรายวัน
                  </h3>
                  <p className="text-xs text-gray-500">
                    จัดการช่วงเวลาและกิจกรรมในแต่ละวันของค่าย (จำนวนวันสร้างตามวันจัดค่าย)
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {formData.dailySchedule.map((day, dayIndex) => (
                  <div
                    key={dayIndex}
                    className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm"
                  >
                    {/* Day Header */}
                    <div className="bg-gray-50 px-4 py-3 border-b flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center font-semibold text-gray-700 border border-gray-200">
                          {day.day}
                        </div>
                        <span className="font-medium text-gray-700">
                          วันที่ {day.day}
                          {formData.campStartDate && (
                            <span className="ml-2 text-gray-500 font-normal">
                              :{" "}
                              {formatDateWithOffset(
                                formData.campStartDate,
                                dayIndex,
                              )}
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-gray-700"
                          type="button"
                          onClick={() => addTimeSlot(dayIndex)}
                        >
                          <span className="text-base leading-none">+</span>
                          เพิ่มช่วงเวลา
                        </button>
                      </div>
                    </div>

                    {/* Time Slots */}
                    <div className="divide-y divide-gray-100">
                      {day.timeSlots.map((slot, slotIndex) => (
                        <div
                          key={slotIndex}
                          className="p-4 hover:bg-gray-50/50 transition-colors"
                        >
                          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                            {/* Start Time */}
                            <div className="min-w-0 md:col-span-3">
                              <label className="block text-xs text-gray-500 mb-1" htmlFor={`edit-start-${dayIndex}-${slotIndex}`}>
                                เวลาเริ่ม
                              </label>
                              <input
                                id={`edit-start-${dayIndex}-${slotIndex}`}
                                className="w-full min-w-0 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6b857a] focus:border-transparent"
                                type="time"
                                value={slot.startTime}
                                onChange={(e) =>
                                  updateTimeSlot(
                                    dayIndex,
                                    slotIndex,
                                    "startTime",
                                    e.target.value,
                                  )
                                }
                              />
                            </div>

                            {/* End Time */}
                            <div className="min-w-0 md:col-span-3">
                              <label className="block text-xs text-gray-500 mb-1" htmlFor={`edit-end-${dayIndex}-${slotIndex}`}>
                                เวลาสิ้นสุด
                              </label>
                              <input
                                id={`edit-end-${dayIndex}-${slotIndex}`}
                                className="w-full min-w-0 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6b857a] focus:border-transparent"
                                type="time"
                                value={slot.endTime}
                                onChange={(e) =>
                                  updateTimeSlot(
                                    dayIndex,
                                    slotIndex,
                                    "endTime",
                                    e.target.value,
                                  )
                                }
                              />
                            </div>

                            {/* Activity */}
                            <div className="min-w-0 md:col-span-5">
                              <label className="block text-xs text-gray-500 mb-1" htmlFor={`edit-activity-${dayIndex}-${slotIndex}`}>
                                กิจกรรม
                              </label>
                              <input
                                id={`edit-activity-${dayIndex}-${slotIndex}`}
                                className="w-full min-w-0 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6b857a] focus:border-transparent"
                                placeholder="ชื่อกิจกรรม เช่น ลงทะเบียน, กิจกรรมกลุ่ม"
                                type="text"
                                value={slot.activity}
                                onChange={(e) =>
                                  updateTimeSlot(
                                    dayIndex,
                                    slotIndex,
                                    "activity",
                                    e.target.value,
                                  )
                                }
                              />
                            </div>

                            {/* Delete Button */}
                            <div className="flex justify-end md:col-span-1">
                              {day.timeSlots.length > 1 && (
                                <button
                                  className="p-2 text-[#E84A5F] opacity-70 hover:opacity-100 hover:text-[#FF847C] hover:bg-[#E84A5F]/10 rounded transition-colors"
                                  type="button"
                                  onClick={() =>
                                    removeTimeSlot(dayIndex, slotIndex)
                                  }
                                >
                                  <Trash2 size={18} />
                                </button>
                              )}
                            </div>
                          </div>
                          {slot.startTime &&
                            slot.endTime &&
                            slot.startTime > slot.endTime && (
                              <p className="text-red-500 text-xs mt-2 px-1">
                                * เวลาสิ้นสุดต้องไม่ก่อนเวลาเริ่ม
                              </p>
                            )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 3: เสื้อค่าย */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2 mb-1">
                  <span className="w-1.5 h-6 bg-[#6b857a] rounded-full" />
                  เสื้อค่าย
                </h3>
                <p className="text-xs text-gray-500">
                  เลือกเปิดหรือปิดการรับจองเสื้อ และอัปโหลดตัวอย่างเสื้อค่าย
                </p>
              </div>

              {/* Option Cards: มีเสื้อ vs ไม่มีเสื้อ */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Option 1: มีเสื้อค่าย */}
                <button
                  className={`cursor-pointer rounded-2xl p-5 border-2 transition-all flex items-start gap-4 ${
                    formData.hasShirt
                      ? "border-[#6b857a] bg-[#6b857a]/5 shadow-sm"
                      : "border-gray-200 hover:border-gray-300 bg-white"
                  }`}
                  type="button"
                  onClick={() => handleChange("hasShirt", true)}
                >
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      formData.hasShirt
                        ? "bg-[#6b857a] text-white"
                        : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    <Shirt size={22} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-gray-900 text-sm">
                        เปิดให้จองเสื้อค่าย
                      </h4>
                      <input
                        type="radio"
                        name="hasShirt"
                        checked={formData.hasShirt}
                        onChange={() => handleChange("hasShirt", true)}
                        className="w-4 h-4 text-[#6b857a] focus:ring-[#6b857a]"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      นักเรียนสามารถเลือกขนาดเสื้อและจองเสื้อได้ตอนสมัครค่าย
                    </p>
                  </div>
                </button>

                {/* Option 2: ไม่มีเสื้อค่าย */}
                <button
                  className={`cursor-pointer rounded-2xl p-5 border-2 transition-all flex items-start gap-4 ${
                    !formData.hasShirt
                      ? "border-[#6b857a] bg-[#6b857a]/5 shadow-sm"
                      : "border-gray-200 hover:border-gray-300 bg-white"
                  }`}
                  type="button"
                  onClick={() => handleChange("hasShirt", false)}
                >
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      !formData.hasShirt
                        ? "bg-[#6b857a] text-white"
                        : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    <X size={22} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-gray-900 text-sm">ไม่มีเสื้อค่าย</h4>
                      <input
                        type="radio"
                        name="hasShirt"
                        checked={!formData.hasShirt}
                        onChange={() => handleChange("hasShirt", false)}
                        className="w-4 h-4 text-[#6b857a] focus:ring-[#6b857a]"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      ค่ายนี้ไม่มีเสื้อแจกหรือเปิดรับจองเสื้อ
                    </p>
                  </div>
                </button>
              </div>

              {/* Detail if hasShirt is true */}
              {formData.hasShirt ? (
                <div className="space-y-6 p-5 border border-gray-200 rounded-2xl bg-gray-50/50">
                  <div>
                    <p className="block text-xs font-bold text-gray-600 uppercase mb-2">
                      ช่วงเวลาจองเสื้อ
                    </p>
                    <DateRangePicker
                      aria-label="Shirt Reservation Period"
                      className="w-full h-[56px] bg-white rounded-lg"
                      errorMessage={dateErrors.shirt}
                      isInvalid={!!dateErrors.shirt}
                      minValue={today(BANGKOK_TIME_ZONE)}
                      value={
                        formData.shirtStartDate && formData.shirtEndDate
                          ? {
                              start: parseDate(formData.shirtStartDate),
                              end: parseDate(formData.shirtEndDate),
                            }
                          : null
                      }
                      onChange={(range) => {
                        if (!range) return;
                        handleChange(
                          "shirtStartDate",
                          dateValueToString(range.start),
                        );
                        handleChange(
                          "shirtEndDate",
                          dateValueToString(range.end),
                        );
                      }}
                    />
                    <p className="text-[11px] text-gray-400 mt-1.5">
                      * วันสิ้นสุดการจองเสื้อต้องเป็นวันก่อนเริ่มค่าย
                    </p>
                  </div>

                  {/* Shirt Image Upload - max 3 images */}
                  <div>
                    <p className="block text-xs font-bold text-gray-600 uppercase mb-1">
                      ตัวอย่างเสื้อ (สูงสุด 3 รูป)
                    </p>
                    <p className="text-xs text-gray-400 mb-3">
                      อัปโหลดรูปภาพตัวอย่างเสื้อค่ายสำหรับให้นักเรียนดู
                    </p>

                    <div className="grid grid-cols-3 gap-3">
                      {[0, 1, 2].map((index) => (
                        <div key={index}>
                          {!shirtImages[index] ? (
                            <label className="block w-full cursor-pointer">
                              <input
                                accept="image/*"
                                className="hidden"
                                type="file"
                                onChange={handleShirtImageChange(index)}
                              />
                              <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center hover:border-[#6b857a] hover:bg-white transition-all aspect-square flex flex-col items-center justify-center bg-white/70">
                                <Shirt className="text-gray-400 mb-1" size={24} />
                                <p className="text-xs text-gray-400 font-medium">
                                  รูปที่ {index + 1}
                                </p>
                              </div>
                            </label>
                          ) : (
                            <div className="relative border-2 border-gray-200 rounded-xl overflow-hidden aspect-square shadow-sm bg-white">
                              <img
                                alt={`Shirt ${index + 1}`}
                                className="w-full h-full object-cover bg-gray-50"
                                src={shirtImages[index]!}
                              />
                              <button
                                className="absolute top-1.5 right-1.5 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow"
                                type="button"
                                onClick={() => removeShirtImage(index)}
                              >
                                <X size={14} />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 border border-dashed border-gray-200 rounded-2xl text-center bg-gray-50/50">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3 text-gray-400">
                    <Shirt size={28} />
                  </div>
                  <h4 className="font-semibold text-gray-700 text-sm mb-1">
                    ไม่ได้เปิดรับจองเสื้อค่าย
                  </h4>
                  <p className="text-xs text-gray-400 max-w-sm mx-auto mb-4">
                    หากต้องการเปิดรับจองเสื้อและให้ผู้สมัครเลือกขนาดเสื้อ
                    สามารถคลิกเปิดใช้งานด้านบนได้ตลอดเวลา
                  </p>
                  <button
                    type="button"
                    className="px-4 py-2 text-xs font-semibold text-[#6b857a] bg-white border border-[#6b857a] rounded-lg hover:bg-[#6b857a] hover:text-white transition-all shadow-sm"
                    onClick={() => handleChange("hasShirt", true)}
                  >
                    + เปิดให้จองเสื้อค่าย
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Navigation Buttons */}
        <div className="p-4 sm:p-5 border-t bg-gray-50 flex items-center justify-between gap-3">
          <button
            className="px-5 sm:px-6 py-2.5 sm:py-3 bg-white text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-100 transition-all font-semibold text-sm cursor-pointer"
            disabled={isLoading}
            onClick={onClose}
            type="button"
          >
            ยกเลิก
          </button>

          {!isSingleSection && (
            <div className="text-xs text-gray-400 font-medium hidden sm:block">
              หน้า {currentStep} จาก {steps.length}
            </div>
          )}

          {isSingleSection ? (
            <button
              className="px-6 sm:px-8 py-2.5 sm:py-3 bg-[#6b857a] text-white rounded-xl hover:bg-[#5a7268] transition-all font-semibold shadow-sm flex items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              disabled={isLoading}
              onClick={handleSubmit}
              type="button"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <FileText size={16} />
                  <span>
                    {targetSection === "info"
                      ? "บันทึกข้อมูลค่าย"
                      : targetSection === "schedule"
                      ? "บันทึกกำหนดการ"
                      : "บันทึกการจองเสื้อ"}
                  </span>
                </>
              )}
            </button>
          ) : currentStep === 1 ? (
            <button
              className="px-6 sm:px-8 py-2.5 sm:py-3 bg-[#6b857a] text-white rounded-xl hover:bg-[#5a7268] transition-all font-semibold shadow-sm flex items-center gap-1.5 text-sm cursor-pointer"
              onClick={() => {
                if (validateStep1()) setCurrentStep(2);
              }}
              type="button"
            >
              <span>ถัดไป: กำหนดการ</span>
              <ChevronRight size={16} />
            </button>
          ) : currentStep === 2 ? (
            <div className="flex items-center gap-2">
              <button
                className="px-5 sm:px-6 py-2.5 sm:py-3 bg-white text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-100 transition-all font-semibold flex items-center gap-1.5 text-sm cursor-pointer"
                disabled={isLoading}
                onClick={() => setCurrentStep(1)}
                type="button"
              >
                <ChevronLeft size={16} />
                <span>ก่อนหน้า</span>
              </button>
              <button
                className="px-6 sm:px-8 py-2.5 sm:py-3 bg-[#6b857a] text-white rounded-xl hover:bg-[#5a7268] transition-all font-semibold shadow-sm flex items-center gap-1.5 text-sm cursor-pointer"
                onClick={() => {
                  if (validateStep2()) setCurrentStep(3);
                }}
                type="button"
              >
                <span>ถัดไป: เสื้อค่าย</span>
                <ChevronRight size={16} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                className="px-5 sm:px-6 py-2.5 sm:py-3 bg-white text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-100 transition-all font-semibold flex items-center gap-1.5 text-sm cursor-pointer"
                disabled={isLoading}
                onClick={() => setCurrentStep(2)}
                type="button"
              >
                <ChevronLeft size={16} />
                <span>ก่อนหน้า</span>
              </button>
              <button
                className="px-6 sm:px-8 py-2.5 sm:py-3 bg-[#6b857a] text-white rounded-xl hover:bg-[#5a7268] transition-all font-semibold shadow-sm flex items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                disabled={isLoading}
                onClick={handleSubmit}
                type="button"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <FileText size={16} />
                    <span>บันทึกการแก้ไข</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
