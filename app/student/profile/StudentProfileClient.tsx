"use client";

import { useEffect, useState, useRef, useMemo, useId } from "react";
import { useRouter } from "next/navigation";
import {
  User,
  Heart,
  CalendarDays,
  MessageSquare,
  ChevronLeft,
  Camera,
  CheckCircle2,
  AlertCircle,
  Phone,
  Mail,
  GraduationCap,
  Sparkles,
  Save,
  Pencil,
  X,
  Hash,
  ExternalLink,
  Info,
} from "lucide-react";

import { BANGKOK_TIME_ZONE, getBangkokDateKey } from "@/lib/bangkok-date";
import { SectionCard } from "@/components/profile/SectionCard";
import { InfoItem } from "@/components/profile/InfoItem";
import { PhoneInput, formatPhoneNumber } from "@/components/profile/PhoneInput";
import { CopyableBadge } from "@/components/profile/CopyableBadge";
import { StudentProfileSkeleton } from "@/components/profile/StudentProfileSkeleton";
import { ConfirmModal } from "@/components/profile/ConfirmModal";
import { FoodAllergySelector } from "@/components/profile/FoodAllergySelector";
import { ChronicDiseaseSelector } from "@/components/profile/ChronicDiseaseSelector";

// ─── Types ───────────────────────────────────────────────────────────────────
interface StudentProfile {
  students_id: number;
  prefix_name: string | null;
  firstname: string;
  lastname: string;
  nickname: string | null;
  profile_image_url: string | null;
  email: string;
  birthday: string | null;
  food_allergy: string | null;
  chronic_disease: string | null;
  remark: string | null;
  tel: string | null;
  parents: {
    parents_id: number;
    firstname: string;
    lastname: string;
    tel: string;
  }[];
  classroom?: {
    grade_label?: string;
    class_name?: string;
    homeroom_teacher?: string;
  } | null;
}

interface FormData {
  nickname: string;
  chronic_disease: string;
  food_allergy: string;
  birthday: string;
  student_tel: string;
  parent_tel: string;
  remark: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const thaiMonths = [
  { value: "01", label: "มกราคม" },
  { value: "02", label: "กุมภาพันธ์" },
  { value: "03", label: "มีนาคม" },
  { value: "04", label: "เมษายน" },
  { value: "05", label: "พฤษภาคม" },
  { value: "06", label: "มิถุนายน" },
  { value: "07", label: "กรกฎาคม" },
  { value: "08", label: "สิงหาคม" },
  { value: "09", label: "กันยายน" },
  { value: "10", label: "ตุลาคม" },
  { value: "11", label: "พฤศจิกายน" },
  { value: "12", label: "ธันวาคม" },
];

const formatBirthdayThai = (iso: string | null) => {
  if (!iso) return "ไม่ระบุ";
  try {
    return new Date(iso).toLocaleDateString("th-TH", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: BANGKOK_TIME_ZONE,
    });
  } catch {
    return iso;
  }
};

const calculateAge = (iso: string | null): number | null => {
  if (!iso) return null;
  try {
    const birthDate = new Date(iso);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();

    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    return age > 0 && age < 120 ? age : null;
  } catch {
    return null;
  }
};

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function StudentProfilePage({
  initialProfile,
}: {
  initialProfile: StudentProfile | null;
}) {
  const router = useRouter();
  const chronicId = useId();
  const allergyId = useId();
  const nicknameId = useId();
  const daySelectId = useId();
  const remarkId = useId();

  const [profile, setProfile] =
    useState<StudentProfile | null>(initialProfile);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    initialProfile?.profile_image_url ?? null,
  );
  const [loading, setLoading] = useState(initialProfile === null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [apiError, setApiError] = useState("");
  const [fieldError, setFieldError] = useState<Record<string, string>>({});

  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingImageUrl, setPendingImageUrl] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const [form, setForm] = useState<FormData>({
    nickname: "",
    chronic_disease: "",
    food_allergy: "",
    birthday: "",
    student_tel: "",
    parent_tel: "",
    remark: "",
  });

  const [bday, setBday] = useState({ day: "", month: "", year: "" });

  const currentYear = Number(getBangkokDateKey().slice(0, 4));
  const days = Array.from({ length: 31 }, (_, i) =>
    (i + 1).toString().padStart(2, "0"),
  );
  const years = Array.from({ length: 30 }, (_, i) =>
    (currentYear - (i + 5)).toString(),
  );

  useEffect(() => {
    fetch("/api/student/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: StudentProfile | null) => {
        if (data) {
          setProfile(data);
          const parentTel = data.parents?.[0]?.tel ?? "";
          const birthdayISO = data.birthday ? data.birthday.split("T")[0] : "";
          const parts = birthdayISO ? birthdayISO.split("-") : ["", "", ""];

          setBday({
            year: parts[0] ?? "",
            month: parts[1] ?? "",
            day: parts[2] ?? "",
          });
          setForm({
            nickname: data.nickname ?? "",
            chronic_disease: data.chronic_disease ?? "",
            food_allergy: data.food_allergy ?? "",
            birthday: birthdayISO,
            student_tel: data.tel ?? "",
            parent_tel: parentTel,
            remark: data.remark ?? "",
          });

          if (data.profile_image_url) {
            setAvatarUrl(data.profile_image_url);
          }
        }
      })
      .catch(() => {
        setApiError("ไม่สามารถโหลดข้อมูลโปรไฟล์นักเรียนได้");
      })
      .finally(() => setLoading(false));
  }, []);

  const updateBirthday = (type: "day" | "month" | "year", value: string) => {
    const next = { ...bday, [type]: value };

    setBday(next);
    if (next.year && next.month && next.day) {
      setForm((f) => ({
        ...f,
        birthday: `${next.year}-${next.month}-${next.day}`,
      }));
    } else {
      setForm((f) => ({ ...f, birthday: "" }));
    }
  };

  const isFormDirty = useMemo(() => {
    if (!profile) return false;
    const parentTel = profile.parents?.[0]?.tel ?? "";
    const birthdayISO = profile.birthday ? profile.birthday.split("T")[0] : "";

    return (
      form.nickname !== (profile.nickname ?? "") ||
      form.chronic_disease !== (profile.chronic_disease ?? "") ||
      form.food_allergy !== (profile.food_allergy ?? "") ||
      form.birthday !== birthdayISO ||
      form.student_tel !== (profile.tel ?? "") ||
      form.parent_tel !== parentTel ||
      form.remark !== (profile.remark ?? "") ||
      !!pendingImageUrl
    );
  }, [form, profile, pendingImageUrl]);

  const validate = () => {
    const errors: Record<string, string> = {};

    if (!form.chronic_disease.trim())
      errors.chronic_disease =
        "กรุณาเลือกข้อมูลโรคประจำตัว หรือเลือกไม่มีโรคประจำตัว";
    if (!form.food_allergy.trim())
      errors.food_allergy = "กรุณาเลือกข้อมูลการแพ้อาหาร หรือเลือกไม่แพ้อาหาร";
    if (!form.birthday) errors.birthday = "กรุณาระบุวัน/เดือน/ปีเกิดให้ครบถ้วน";

    const sTel = form.student_tel.replace(/\D/g, "");

    if (sTel && sTel.length !== 10) {
      errors.student_tel = "เบอร์โทรศัพท์นักเรียนต้องเป็นตัวเลข 10 หลัก";
    }

    const pTel = form.parent_tel.replace(/\D/g, "");

    if (pTel && pTel.length !== 10) {
      errors.parent_tel = "เบอร์โทรศัพท์ผู้ปกครองต้องเป็นตัวเลข 10 หลัก";
    }

    return errors;
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setApiError("กรุณาอัปโหลดไฟล์รูปภาพเท่านั้น (JPG, PNG, WEBP)");

      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setApiError("ขนาดไฟล์รูปภาพต้องไม่เกิน 5MB");

      return;
    }

    setApiError("");
    const objectUrl = URL.createObjectURL(file);

    setPreviewImage(objectUrl);
    setUploadingImage(true);
    setUploadProgress(0);

    try {
      const { uploadStudentProfileImage } = await import(
        "@/lib/student-profile-upload"
      );
      const uploaded = await uploadStudentProfileImage(file, (p) => {
        setUploadProgress(p);
      });

      setPendingImageUrl(uploaded.url);
      setUploadProgress(100);
    } catch (err: any) {
      const { getFriendlyUploadErrorMessage } = await import(
        "@/lib/student-profile-upload"
      );

      setApiError(getFriendlyUploadErrorMessage(err));
      setPreviewImage(null);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSave = async () => {
    setApiError("");
    const errors = validate();

    setFieldError(errors);
    if (Object.keys(errors).length > 0) return;

    setSaving(true);
    try {
      const submitData: any = { ...form };

      if (pendingImageUrl) {
        submitData.profile_image_url = pendingImageUrl;
      }

      const res = await fetch("/api/student/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submitData),
      });
      const data = await res.json();

      if (!res.ok) {
        setApiError(data.error ?? "เกิดข้อผิดพลาดในการบันทึกข้อมูล");

        return;
      }

      setShowToast(true);

      const refreshed = await fetch("/api/student/profile").then((r) =>
        r.ok ? r.json() : null,
      );

      if (refreshed) {
        setProfile(refreshed);
        if (pendingImageUrl) {
          setAvatarUrl(pendingImageUrl);
        }
      }
      setPendingImageUrl(null);
      if (previewImage) URL.revokeObjectURL(previewImage);
      setPreviewImage(null);
      setEditing(false);

      setTimeout(() => {
        setShowToast(false);
      }, 4000);
    } catch {
      setApiError("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelClick = () => {
    if (isFormDirty) {
      setShowCancelModal(true);
    } else {
      revertAndCloseEdit();
    }
  };

  const revertAndCloseEdit = () => {
    if (!profile) return;
    const parentTel = profile.parents?.[0]?.tel ?? "";
    const birthdayISO = profile.birthday ? profile.birthday.split("T")[0] : "";
    const parts = birthdayISO ? birthdayISO.split("-") : ["", "", ""];

    setBday({
      year: parts[0] ?? "",
      month: parts[1] ?? "",
      day: parts[2] ?? "",
    });
    setForm({
      nickname: profile.nickname ?? "",
      chronic_disease: profile.chronic_disease ?? "",
      food_allergy: profile.food_allergy ?? "",
      birthday: birthdayISO,
      student_tel: profile.tel ?? "",
      parent_tel: parentTel,
      remark: profile.remark ?? "",
    });
    setPendingImageUrl(null);
    setPreviewImage(null);
    setFieldError({});
    setApiError("");
    setEditing(false);
    setShowCancelModal(false);
  };

  if (loading) {
    return <StudentProfileSkeleton />;
  }

  if (!profile) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mb-4">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-lg font-bold text-gray-800">ไม่พบข้อมูลโปรไฟล์</h2>
        <p className="text-sm text-gray-500 max-w-sm mt-1 mb-6">
          กรุณาเข้าสู่ระบบใหม่อีกครั้งเพื่อโหลดข้อมูล
        </p>
        <button
          className="px-5 py-2.5 rounded-xl bg-[#5d7c6f] text-white font-medium text-sm hover:bg-[#4a6659] transition-all shadow-xs cursor-pointer"
          onClick={() => window.location.reload()}
        >
          ลองใหม่อีกครั้ง
        </button>
      </div>
    );
  }

  const displayName = `${profile.prefix_name ?? ""}${profile.firstname} ${profile.lastname}`;
  const initials =
    `${profile.firstname[0] || ""}${profile.lastname[0] || ""}` || "นร";
  const currentAvatarSrc = previewImage || pendingImageUrl || avatarUrl;
  const age = calculateAge(profile.birthday);
  const parentPhone = profile.parents?.[0]?.tel;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* ── Header / Breadcrumb ── */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            className="w-10 h-10 rounded-xl bg-white border border-gray-200/80 shadow-xs flex items-center justify-center text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-all cursor-pointer group"
            title="กลับสู่แดชบอร์ดนักเรียน"
            type="button"
            onClick={() => router.push("/student/dashboard")}
          >
            <ChevronLeft
              className="group-hover:-translate-x-0.5 transition-transform"
              size={20}
            />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
              โปรไฟล์ของฉัน
            </h1>
            <p className="text-xs sm:text-sm text-gray-500">
              ข้อมูลส่วนตัว สุขภาพ และข้อมูลติดต่อฉุกเฉิน
            </p>
          </div>
        </div>

        {!editing && (
          <button
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#5d7c6f] text-white text-xs sm:text-sm font-semibold hover:bg-[#4a6659] active:scale-98 transition-all shadow-sm cursor-pointer"
            type="button"
            onClick={() => setEditing(true)}
          >
            <Pencil size={15} />
            <span>แก้ไขข้อมูล</span>
          </button>
        )}
      </div>

      {/* ── API Error Banner ── */}
      {apiError && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-rose-800">
          <AlertCircle className="text-rose-600 shrink-0 mt-0.5" size={20} />
          <div className="text-xs sm:text-sm flex-1">
            <p className="font-semibold">เกิดข้อผิดพลาด</p>
            <p className="text-rose-700/90 mt-0.5">{apiError}</p>
          </div>
          <button
            className="p-1 rounded-lg text-rose-500 hover:bg-rose-100/60"
            onClick={() => setApiError("")}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* ── Hero Profile Identity Card ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#4d6c5f] via-[#5d7c6f] to-[#365f4f] p-6 sm:p-8 text-white shadow-md">
        <div className="absolute -right-12 -top-12 w-64 h-64 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        <div className="absolute right-10 -bottom-16 w-48 h-48 rounded-full bg-black/10 blur-xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          {/* Avatar & Core Identity */}
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="relative group">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-white/20 backdrop-blur-md border-2 border-white/40 flex items-center justify-center text-2xl sm:text-3xl font-bold tracking-tight shadow-inner select-none overflow-hidden shrink-0 relative">
                {currentAvatarSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt="รูปโปรไฟล์"
                    className="w-full h-full object-cover"
                    src={currentAvatarSrc}
                  />
                ) : (
                  <span>{initials}</span>
                )}

                {/* Upload percentage overlay */}
                {uploadingImage && (
                  <div className="absolute inset-0 bg-black/65 backdrop-blur-xs flex flex-col items-center justify-center text-white z-20">
                    <span className="text-sm sm:text-base font-bold font-mono tracking-tight text-emerald-300">
                      {uploadProgress}%
                    </span>
                    <span className="text-[9px] sm:text-[10px] text-white/90 font-medium mt-0.5">
                      กำลังอัปโหลด
                    </span>
                    <div className="w-12 h-1 bg-white/30 rounded-full mt-1.5 overflow-hidden">
                      <div
                        className="h-full bg-emerald-400 rounded-full transition-all duration-150 ease-out"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Upload image trigger */}
              {editing ? (
                <>
                  <button
                    className="absolute -bottom-1.5 -right-1.5 p-2 rounded-xl bg-white text-[#5d7c6f] shadow-md hover:bg-emerald-50 active:scale-95 transition-all cursor-pointer disabled:opacity-50 border border-gray-200"
                    disabled={uploadingImage}
                    title="เปลี่ยนรูปโปรไฟล์"
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploadingImage ? (
                      <div className="w-4 h-4 border-2 border-[#5d7c6f] border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Camera size={15} />
                    )}
                  </button>
                  <input
                    ref={fileInputRef}
                    accept="image/*"
                    className="hidden"
                    type="file"
                    onChange={handleImageUpload}
                  />
                </>
              ) : (
                <span
                  className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-400 border-2 border-[#5d7c6f] shadow-xs flex items-center justify-center"
                  title="สถานะ: เข้าสู่ระบบอยู่"
                >
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                </span>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
                  {displayName}
                </h2>
                {(profile.nickname || form.nickname) && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/40 text-emerald-100 border border-emerald-300/30 backdrop-blur-md">
                    น้อง{form.nickname || profile.nickname}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm text-emerald-100/90">
                <span className="flex items-center gap-1.5">
                  <Mail className="opacity-80" size={13} />
                  <span className="truncate max-w-[200px] sm:max-w-xs">
                    {profile.email}
                  </span>
                </span>

                {profile.classroom?.grade_label && (
                  <span className="flex items-center gap-1.5">
                    <GraduationCap className="opacity-80" size={13} />
                    <span>
                      ชั้น {profile.classroom.grade_label}
                      {profile.classroom.class_name
                        ? ` ห้อง ${profile.classroom.class_name}`
                        : ""}
                    </span>
                  </span>
                )}
              </div>

              {profile.tel && (
                <p className="text-xs text-emerald-100/80 font-mono flex items-center gap-1.5">
                  <Phone className="opacity-80" size={12} />
                  <span>{formatPhoneNumber(profile.tel)}</span>
                </p>
              )}
            </div>
          </div>

          {/* Quick Stats / Student ID */}
          <div className="flex sm:flex-col items-end gap-2 w-full sm:w-auto pt-3 sm:pt-0 border-t border-white/10 sm:border-t-0">
            <div className="flex items-center gap-2 bg-black/15 backdrop-blur-md rounded-xl px-3 py-1.5 text-xs text-white/90 border border-white/10">
              <Hash className="text-emerald-300" size={13} />
              <span>รหัสนักเรียน:</span>
              <span className="font-mono font-bold text-white">
                {profile.students_id}
              </span>
              <CopyableBadge
                iconOnly
                className="!bg-white/20 !text-white !border-white/20 hover:!bg-white/30"
                copyValue={String(profile.students_id)}
                label="รหัสนักเรียน"
                text=""
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Content Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols */}
        <div className="lg:col-span-2 space-y-6">
          {/* ── Section: Medical & Health ── */}
          <SectionCard
            icon={<Heart size={18} />}
            iconBgColor="bg-[#5d7c6f]/10"
            iconColor="text-[#5d7c6f]"
            subtitle="ข้อมูลโรคประจำตัวและการแพ้อาหาร"
            title="ข้อมูลสุขภาพ"
          >
            {editing ? (
              <div className="space-y-5 pt-1">
                {/* Chronic Disease Field */}
                <div className="space-y-2">
                  <label
                    className="block text-xs font-semibold text-gray-700"
                    htmlFor={chronicId}
                  >
                    โรคประจำตัว <span className="text-rose-500">*</span>
                  </label>
                  <ChronicDiseaseSelector
                    error={fieldError.chronic_disease}
                    id={chronicId}
                    value={form.chronic_disease}
                    onChange={(value) =>
                      setForm((f) => ({
                        ...f,
                        chronic_disease: value,
                      }))
                    }
                  />
                  {fieldError.chronic_disease && (
                    <p className="text-rose-600 text-xs flex items-center gap-1">
                      <AlertCircle size={12} /> {fieldError.chronic_disease}
                    </p>
                  )}
                </div>

                {/* Food Allergy Field */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label
                      className="block text-xs font-semibold text-gray-700"
                      htmlFor={allergyId}
                    >
                      การแพ้อาหาร <span className="text-rose-500">*</span>
                    </label>
                  </div>
                  <FoodAllergySelector
                    error={fieldError.food_allergy}
                    id={allergyId}
                    value={form.food_allergy}
                    onChange={(value) =>
                      setForm((f) => ({ ...f, food_allergy: value }))
                    }
                  />
                  {fieldError.food_allergy && (
                    <p className="text-rose-600 text-xs flex items-center gap-1">
                      <AlertCircle size={12} /> {fieldError.food_allergy}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <InfoItem
                  icon={<Heart size={15} />}
                  label="โรคประจำตัว"
                  value={profile.chronic_disease || "ไม่มี"}
                />
                <InfoItem
                  icon={<AlertCircle size={15} />}
                  label="การแพ้อาหาร"
                  value={profile.food_allergy || "ไม่มี"}
                />
              </div>
            )}
          </SectionCard>

          {/* ── Section: Personal Information & Nickname ── */}
          <SectionCard
            icon={<User size={18} />}
            iconBgColor="bg-[#5d7c6f]/10"
            iconColor="text-[#5d7c6f]"
            subtitle="ชื่อ นามสกุล และชื่อเล่นสำหรับเรียกในค่าย"
            title="ข้อมูลส่วนตัว"
          >
            {editing ? (
              <div className="space-y-4 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <span className="block text-xs font-semibold text-gray-700">
                      ชื่อ-นามสกุล
                    </span>
                    <input
                      disabled
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-100 text-gray-500 text-sm cursor-not-allowed"
                      type="text"
                      value={displayName}
                    />
                    <p className="text-[11px] text-gray-400">
                      ชื่อ-นามสกุลทางการล็อกโดยระบบทะเบียน
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label
                      className="block text-xs font-semibold text-gray-700"
                      htmlFor={nicknameId}
                    >
                      ชื่อเล่น (สำหรับป้ายชื่อค่าย)
                    </label>
                    <input
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 outline-none focus:border-[#5d7c6f] focus:ring-3 focus:ring-[#5d7c6f]/15 transition-all"
                      id={nicknameId}
                      placeholder="เช่น กุ๊กไก่, มินท์, ก้อง"
                      type="text"
                      value={form.nickname}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, nickname: e.target.value }))
                      }
                    />
                  </div>
                </div>

                {/* Birthday selector */}
                <div className="space-y-1.5">
                  <label
                    className="block text-xs font-semibold text-gray-700"
                    htmlFor={daySelectId}
                  >
                    วัน/เดือน/ปีเกิด <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <select
                      className="px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 outline-none focus:border-[#5d7c6f] focus:ring-3 focus:ring-[#5d7c6f]/15"
                      id={daySelectId}
                      value={bday.day}
                      onChange={(e) => updateBirthday("day", e.target.value)}
                    >
                      <option value="">วันที่</option>
                      {days.map((d) => (
                        <option key={d} value={d}>
                          {parseInt(d)}
                        </option>
                      ))}
                    </select>

                    <select
                      aria-label="เลือกเดือนเกิด"
                      className="px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 outline-none focus:border-[#5d7c6f] focus:ring-3 focus:ring-[#5d7c6f]/15"
                      value={bday.month}
                      onChange={(e) => updateBirthday("month", e.target.value)}
                    >
                      <option value="">เดือน</option>
                      {thaiMonths.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>

                    <select
                      aria-label="เลือกปีเกิด พ.ศ."
                      className="px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 outline-none focus:border-[#5d7c6f] focus:ring-3 focus:ring-[#5d7c6f]/15"
                      value={bday.year}
                      onChange={(e) => updateBirthday("year", e.target.value)}
                    >
                      <option value="">ปี (พ.ศ.)</option>
                      {years.map((y) => (
                        <option key={y} value={y}>
                          {parseInt(y) + 543}
                        </option>
                      ))}
                    </select>
                  </div>
                  {fieldError.birthday && (
                    <p className="text-rose-600 text-xs flex items-center gap-1">
                      <AlertCircle size={12} /> {fieldError.birthday}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <InfoItem
                  icon={<User size={15} />}
                  label="ชื่อ-นามสกุล"
                  value={displayName}
                />
                <InfoItem
                  icon={<Sparkles size={15} />}
                  label="ชื่อเล่น"
                  value={
                    profile.nickname ? (
                      <span className="font-semibold text-emerald-800">
                        น้อง{profile.nickname}
                      </span>
                    ) : (
                      "ไม่ระบุ"
                    )
                  }
                />
                <InfoItem
                  icon={<CalendarDays size={15} />}
                  label="วัน/เดือน/ปีเกิด"
                  subValue={age ? `อายุ ${age} ปี` : undefined}
                  value={formatBirthdayThai(profile.birthday)}
                />
              </div>
            )}
          </SectionCard>

          {/* ── Section: Emergency & Contact Info ── */}
          <SectionCard
            icon={<Phone size={18} />}
            iconBgColor="bg-blue-50"
            iconColor="text-blue-600"
            subtitle="สำหรับติดต่อสื่อสารและแจ้งเหตุฉุกเฉินระหว่างจัดค่าย"
            title="ข้อมูลติดต่อและเบอร์โทรฉุกเฉิน"
          >
            {editing ? (
              <div className="space-y-4 pt-1">
                <PhoneInput
                  error={fieldError.student_tel}
                  helperText="เบอร์โทรส่วนตัวของนักเรียนสำหรับติดต่อในค่าย"
                  label="เบอร์โทรศัพท์นักเรียน"
                  placeholder="08X-XXX-XXXX"
                  value={form.student_tel}
                  onChange={(v) => setForm((f) => ({ ...f, student_tel: v }))}
                />

                <PhoneInput
                  error={fieldError.parent_tel}
                  helperText="เบอร์โทรผู้ปกครองสำหรับการประสานงานฉุกเฉิน"
                  label="เบอร์โทรศัพท์ผู้ปกครอง (ติดต่อฉุกเฉิน)"
                  placeholder="08X-XXX-XXXX"
                  value={form.parent_tel}
                  onChange={(v) => setForm((f) => ({ ...f, parent_tel: v }))}
                />
              </div>
            ) : (
              <div className="space-y-3">
                <InfoItem
                  copyValue={profile.tel || undefined}
                  icon={<Phone size={15} />}
                  label="เบอร์โทรนักเรียน"
                  value={
                    profile.tel ? (
                      <div className="flex items-center gap-2 font-mono">
                        <span>{formatPhoneNumber(profile.tel)}</span>
                        <a
                          className="text-xs text-[#5d7c6f] hover:underline inline-flex items-center gap-0.5 ml-1 font-sans"
                          href={`tel:${profile.tel}`}
                        >
                          <ExternalLink size={12} /> โทร
                        </a>
                      </div>
                    ) : (
                      "ไม่ระบุ"
                    )
                  }
                />

                <InfoItem
                  badge={
                    parentPhone ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold">
                        ฉุกเฉิน
                      </span>
                    ) : null
                  }
                  copyValue={parentPhone || undefined}
                  icon={<Phone size={15} />}
                  label="เบอร์โทรผู้ปกครอง (ฉุกเฉิน)"
                  value={
                    parentPhone ? (
                      <div className="flex items-center gap-2 font-mono">
                        <span>{formatPhoneNumber(parentPhone)}</span>
                        <a
                          className="text-xs text-blue-600 hover:underline inline-flex items-center gap-0.5 ml-1 font-sans font-semibold"
                          href={`tel:${parentPhone}`}
                        >
                          <ExternalLink size={12} /> โทรฉุกเฉิน
                        </a>
                      </div>
                    ) : (
                      "ไม่ระบุ"
                    )
                  }
                />
              </div>
            )}
          </SectionCard>

          {/* ── Section: Remarks ── */}
          <SectionCard
            icon={<MessageSquare size={18} />}
            iconBgColor="bg-amber-50"
            iconColor="text-amber-600"
            subtitle="ข้อมูลอื่น ๆ ที่ต้องการแจ้งคุณครูหรือทีมงานค่าย"
            title="หมายเหตุและข้อมูลเพิ่มเติม"
          >
            {editing ? (
              <div className="pt-1 space-y-1.5">
                <label
                  className="block text-xs font-semibold text-gray-700"
                  htmlFor={remarkId}
                >
                  หมายเหตุเพิ่มเติม
                </label>
                <textarea
                  className="w-full px-3.5 py-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 outline-none transition-all focus:border-[#5d7c6f] focus:ring-3 focus:ring-[#5d7c6f]/15 resize-none leading-relaxed"
                  id={remarkId}
                  placeholder="เช่น ต้องการการดูแลพิเศษเรื่องการเดินทาง, ข้อจำกัดในการทำกิจกรรมกลางแจ้ง..."
                  rows={3}
                  value={form.remark}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, remark: e.target.value }))
                  }
                />
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-gray-50/80 border border-gray-100 text-sm text-gray-700 leading-relaxed">
                {profile.remark || (
                  <span className="text-gray-400">ไม่มีข้อมูลเพิ่มเติม</span>
                )}
              </div>
            )}
          </SectionCard>
        </div>

        {/* Right 1 Col */}
        <div className="space-y-6">
          {/* ── Section: Academic / Classroom Info ── */}
          <SectionCard
            icon={<GraduationCap size={18} />}
            iconBgColor="bg-teal-50"
            iconColor="text-teal-600"
            subtitle="ห้องเรียนและครูประจำชั้น"
            title="ข้อมูลการเรียนและชั้นเรียน"
          >
            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 font-medium">
                    ห้องเรียน
                  </span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-[#5d7c6f]/15 text-[#365f4f]">
                    ชั้น {profile.classroom?.grade_label || "ไม่ระบุ"}
                    {profile.classroom?.class_name
                      ? ` / ${profile.classroom.class_name}`
                      : ""}
                  </span>
                </div>
                {profile.classroom?.homeroom_teacher && (
                  <p className="text-xs text-gray-600 flex items-center gap-1.5 pt-1">
                    <User className="text-gray-400" size={13} />
                    <span>ครูประจำชั้น:</span>
                    <span className="font-semibold text-gray-800">
                      ครู{profile.classroom.homeroom_teacher}
                    </span>
                  </p>
                )}
              </div>

              <div className="p-3 rounded-xl bg-gray-50/80 border border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Hash className="text-gray-400" size={14} />
                  <span className="text-xs text-gray-500">รหัสนักเรียน</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-mono font-bold text-gray-800">
                    #{profile.students_id}
                  </span>
                  <CopyableBadge
                    iconOnly
                    copyValue={String(profile.students_id)}
                    label="รหัสนักเรียน"
                    text=""
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-gray-50/80 border border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="text-gray-400" size={14} />
                  <span className="text-xs text-gray-500">อีเมลนักเรียน</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-gray-800 truncate max-w-[120px]">
                    {profile.email}
                  </span>
                  <CopyableBadge
                    iconOnly
                    copyValue={profile.email}
                    label="อีเมล"
                    text=""
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-100 flex items-start gap-2 text-blue-800">
                <Info className="text-blue-600 shrink-0 mt-0.5" size={14} />
                <p className="text-[11px] leading-relaxed text-blue-700">
                  ข้อมูลห้องเรียนจะถูกอัปเดตตามปีการศึกษาปัจจุบันของโรงเรียน
                </p>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>

      {/* ── Floating / Sticky Action Bar in Edit Mode ── */}
      {editing && (
        <div className="sticky bottom-6 z-40 max-w-2xl mx-auto w-full px-4">
          <div className="p-3 bg-white/95 backdrop-blur-lg rounded-2xl border border-gray-200/90 shadow-xl flex items-center justify-between gap-3">
            <div className="hidden sm:flex items-center gap-2 pl-2">
              <span className="w-2 h-2 rounded-full bg-[#5d7c6f] animate-ping" />
              <span className="text-xs text-gray-600 font-medium">
                {isFormDirty
                  ? "มีการแก้ไขข้อมูลที่ยังไม่บันทึก"
                  : "กำลังอยู่ในโหมดแก้ไข"}
              </span>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto ml-auto">
              <button
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-700 text-xs sm:text-sm font-semibold hover:bg-gray-50 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                disabled={saving || uploadingImage}
                type="button"
                onClick={handleCancelClick}
              >
                <X size={16} />
                <span>ยกเลิก</span>
              </button>

              <button
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[#5d7c6f] text-white text-xs sm:text-sm font-semibold hover:bg-[#4a6659] active:scale-95 transition-all shadow-md cursor-pointer disabled:opacity-60"
                disabled={saving || uploadingImage}
                type="button"
                onClick={handleSave}
              >
                {saving || uploadingImage ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>
                      {uploadingImage
                        ? `กำลังอัปโหลดรูป... ${uploadProgress}%`
                        : "กำลังบันทึก..."}
                    </span>
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    <span>บันทึกข้อมูล</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Success Toast ── */}
      {showToast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-[#2d5d4b] text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-emerald-400/30">
          <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-white shrink-0">
            <CheckCircle2 size={18} />
          </div>
          <div>
            <p className="font-semibold text-sm">บันทึกข้อมูลโปรไฟล์สำเร็จ!</p>
            <p className="text-xs text-emerald-100/90">
              ข้อมูลของคุณได้รับการอัปเดตเรียบร้อยแล้ว
            </p>
          </div>
        </div>
      )}

      {/* ── Confirm Cancel Modal ── */}
      <ConfirmModal
        cancelText="แก้ไขต่อ"
        confirmText="ละทิ้งการแก้ไข"
        confirmVariant="danger"
        description="คุณมีข้อมูลที่แก้ไขแล้วและยังไม่ได้บันทึก หากยกเลิก ข้อมูลที่แก้ไขจะกลับไปเป็นค่าเดิม"
        isOpen={showCancelModal}
        title="ต้องการยกเลิกการแก้ไข?"
        onCancel={() => setShowCancelModal(false)}
        onConfirm={revertAndCloseEdit}
      />
    </div>
  );
}
