"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import { useEffect, useState, useMemo, useId } from "react";
import { useRouter } from "next/navigation";
import {
  User,
  Phone,
  Mail,
  Shield,
  Pencil,
  ChevronLeft,
  AlertCircle,
  ExternalLink,
  Lock,
} from "lucide-react";

import { SectionCard } from "./SectionCard";
import { InfoItem } from "./InfoItem";
import { PrefixSelect } from "./PrefixSelect";
import { PhoneInput, formatPhoneNumber } from "./PhoneInput";
import { CopyableBadge } from "./CopyableBadge";
import { TeacherProfileSkeleton } from "./TeacherProfileSkeleton";

import { useMountedModal } from "@/hooks/useMountedModal";

const ProfileErrorAlert = dynamic(
  () => import("./TeacherProfileMotion").then((module) => module.ProfileErrorAlert),
  { ssr: false },
);
const ProfileEditorControls = dynamic(
  () => import("./TeacherProfileMotion").then((module) => module.ProfileEditorControls),
  { ssr: false },
);

export interface TeacherProfile {
  teachers_id: number;
  prefix_name: string | null;
  firstname: string;
  lastname: string;
  email: string;
  tel: string;
  profile_image_url: string | null;
  role: "TEACHER" | "ADMIN" | "CAMP_LEADER";
}

interface TeacherProfileViewProps {
  backUrl?: string;
  backLabel?: string;
  initialProfile?: TeacherProfile | null;
}

const roleConfig: Record<
  string,
  { label: string; bg: string; text: string; border: string; desc: string }
> = {
  ADMIN: {
    label: "ผู้ดูแลระบบ (Admin)",
    bg: "bg-purple-50",
    text: "text-purple-700",
    border: "border-purple-200",
    desc: "มีสิทธิ์จัดการข้อมูลและตั้งค่าระบบทั้งหมด",
  },
  CAMP_LEADER: {
    label: "หัวหน้าค่าย (Camp Leader)",
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    desc: "มีสิทธิ์ดูแลกิจกรรม กำกับฐาน และข้อมูลค่าย",
  },
  HEADTEACHER: {
    label: "ครูหัวหน้าค่าย (Headteacher)",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    desc: "มีสิทธิ์ดูแลกิจกรรม กำกับฐาน และข้อมูลค่าย",
  },
  TEACHER: {
    label: "ครูประจำชั้น (Teacher)",
    bg: "bg-teal-50",
    text: "text-teal-700",
    border: "border-teal-200",
    desc: "มีสิทธิ์ดูแลนักเรียนในห้องเรียนที่รับผิดชอบ",
  },
};

export function TeacherProfileView({
  backUrl,
  backLabel = "กลับสู่ระบบ",
  initialProfile,
}: TeacherProfileViewProps) {
  const router = useRouter();
  const firstnameId = useId();
  const lastnameId = useId();
  const [profile, setProfile] = useState<TeacherProfile | null>(initialProfile || null);
  const [loading, setLoading] = useState(!initialProfile);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successToast, setSuccessToast] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [apiError, setApiError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const mountErrorAlert = useMountedModal(Boolean(apiError));
  const mountEditorControls = useMountedModal(
    editing || successToast || showCancelModal,
  );

  // Form state
  const [form, setForm] = useState({
    prefix_name: initialProfile?.prefix_name ?? "",
    firstname: initialProfile?.firstname ?? "",
    lastname: initialProfile?.lastname ?? "",
    tel: initialProfile?.tel ?? "",
  });

  // Initial load
  useEffect(() => {
    if (initialProfile) return;
    fetch("/api/teacher/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: TeacherProfile | null) => {
        if (data) {
          setProfile(data);
          setForm({
            prefix_name: data.prefix_name ?? "",
            firstname: data.firstname ?? "",
            lastname: data.lastname ?? "",
            tel: data.tel ?? "",
          });
        }
      })
      .catch(() => {
        setApiError("ไม่สามารถโหลดข้อมูลโปรไฟล์ได้ กรุณาลองใหม่");
      })
      .finally(() => setLoading(false));
  }, [initialProfile]);

  // Check if form was changed
  const isFormDirty = useMemo(() => {
    if (!profile) return false;

    return (
      form.prefix_name !== (profile.prefix_name ?? "") ||
      form.firstname !== profile.firstname ||
      form.lastname !== profile.lastname ||
      form.tel !== (profile.tel ?? "")
    );
  }, [form, profile]);

  const validate = () => {
    const errors: Record<string, string> = {};

    if (!form.firstname.trim()) errors.firstname = "กรุณาระบุชื่อจริง";
    if (!form.lastname.trim()) errors.lastname = "กรุณาระบุนามสกุล";
    const cleanTel = form.tel.replace(/\D/g, "");

    if (cleanTel && cleanTel.length !== 10) {
      errors.tel = "เบอร์โทรศัพท์ต้องมี 10 หลัก";
    }

    return errors;
  };

  const handleSave = async () => {
    setApiError("");
    const errors = validate();

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSaving(true);
    try {
      const res = await fetch("/api/teacher/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        setApiError(data.error ?? "ไม่สามารถบันทึกข้อมูลได้");

        return;
      }

      // Refresh
      const refreshed = await fetch("/api/teacher/profile").then((r) =>
        r.ok ? r.json() : null,
      );

      if (refreshed) {
        setProfile(refreshed);
      }

      setEditing(false);
      setSuccessToast(true);
      setTimeout(() => setSuccessToast(false), 3500);
    } catch {
      setApiError("เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง");
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
    if (profile) {
      setForm({
        prefix_name: profile.prefix_name ?? "",
        firstname: profile.firstname ?? "",
        lastname: profile.lastname ?? "",
        tel: profile.tel ?? "",
      });
    }
    setFieldErrors({});
    setApiError("");
    setEditing(false);
    setShowCancelModal(false);
  };

  const handleBack = () => {
    if (backUrl) {
      router.push(backUrl);
    } else {
      router.back();
    }
  };

  if (loading) {
    return <TeacherProfileSkeleton backLabel={backLabel} />;
  }

  if (!profile) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mb-4">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-lg font-bold text-gray-800">ไม่พบข้อมูลโปรไฟล์</h2>
        <p className="text-sm text-gray-500 max-w-sm mt-1 mb-6">
          อาจเกิดจากเซสชันหมดอายุหรือไม่พบข้อมูลในระบบ
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

  const roleMeta = roleConfig[profile.role] || roleConfig.TEACHER;
  const fullName = `${profile.prefix_name ?? ""}${profile.firstname} ${profile.lastname}`;
  const initials =
    `${profile.firstname?.[0] || ""}${profile.lastname?.[0] || ""}` || "ครู";

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* ── Top Bar / Breadcrumb ── */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            className="w-10 h-10 rounded-xl bg-white border border-gray-200/80 shadow-xs flex items-center justify-center text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-all cursor-pointer group"
            title={backLabel}
            type="button"
            onClick={handleBack}
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
              จัดการข้อมูลส่วนตัวและการตั้งค่าบัญชี
            </p>
          </div>
        </div>

        {/* Quick Edit Button on top right if in view mode */}
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

      {/* ── Alerts & Error Feedback ── */}
      {mountErrorAlert && (
        <ProfileErrorAlert error={apiError} onDismiss={() => setApiError("")} />
      )}

      {/* ── Hero Profile Identity Card ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#4d6c5f] via-[#5d7c6f] to-[#365f4f] p-6 sm:p-8 text-white shadow-md">
        {/* Background decorative geometry */}
        <div className="absolute -right-12 -top-12 w-64 h-64 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        <div className="absolute right-10 -bottom-16 w-48 h-48 rounded-full bg-black/10 blur-xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          {/* Avatar & Core Identity */}
          <div className="flex items-center gap-4 sm:gap-5">
            <div className="relative">
              <div className="relative flex h-20 w-20 select-none items-center justify-center overflow-hidden rounded-2xl border-2 border-white/40 bg-white/20 text-3xl font-bold tracking-tight shadow-inner backdrop-blur-md sm:h-24 sm:w-24 sm:text-4xl">
                {profile.profile_image_url ? (
                  <Image
                    fill
                    alt={`รูปโปรไฟล์ของ ${fullName}`}
                    className="object-cover"
                    sizes="(max-width: 640px) 80px, 96px"
                    src={profile.profile_image_url}
                  />
                ) : (
                  initials
                )}
              </div>
              <span
                className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-400 border-2 border-[#5d7c6f] shadow-xs flex items-center justify-center"
                title="สถานะ: เข้าสู่ระบบอยู่"
              >
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
                  {fullName}
                </h2>
                <span
                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-md shadow-xs ${
                    profile.role === "ADMIN"
                      ? "bg-purple-900/40 text-purple-100 border border-purple-300/30"
                      : "bg-white/20 text-white border border-white/30"
                  }`}
                >
                  <Shield size={12} />
                  {roleMeta.label}
                </span>
              </div>

              <p className="text-xs sm:text-sm text-emerald-100/80 flex items-center gap-2">
                <Mail className="shrink-0 opacity-80" size={14} />
                <span className="truncate max-w-[240px] sm:max-w-xs">
                  {profile.email}
                </span>
              </p>

              {profile.tel && (
                <p className="text-xs sm:text-sm text-emerald-100/80 flex items-center gap-2 font-mono">
                  <Phone className="shrink-0 opacity-80" size={14} />
                  <span>{formatPhoneNumber(profile.tel)}</span>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Content Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column / Details (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Section 1: Personal Info */}
          <SectionCard
            icon={<User size={18} />}
            iconBgColor="bg-[#5d7c6f]/10"
            iconColor="text-[#5d7c6f]"
            subtitle="ชื่อ นามสกุล และคำนำหน้าชื่อ"
            title="ข้อมูลส่วนตัว"
          >
            {editing ? (
              <div className="space-y-4 pt-1">
                <PrefixSelect
                  label="คำนำหน้าชื่อ"
                  value={form.prefix_name}
                  onChange={(v) => setForm((f) => ({ ...f, prefix_name: v }))}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label
                      className="block text-xs font-semibold text-gray-700"
                      htmlFor={firstnameId}
                    >
                      ชื่อจริง <span className="text-rose-500">*</span>
                    </label>
                    <input
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-gray-800 outline-none transition-all ${
                        fieldErrors.firstname
                          ? "bg-rose-50/40 border-rose-300 focus:border-rose-500 focus:ring-3 focus:ring-rose-500/15"
                          : "bg-white border-gray-200 focus:border-[#5d7c6f] focus:ring-3 focus:ring-[#5d7c6f]/15"
                      }`}
                      id={firstnameId}
                      placeholder="ระบุชื่อจริง"
                      type="text"
                      value={form.firstname}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, firstname: e.target.value }))
                      }
                    />
                    {fieldErrors.firstname && (
                      <p className="text-rose-600 text-xs flex items-center gap-1">
                        <AlertCircle size={12} /> {fieldErrors.firstname}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label
                      className="block text-xs font-semibold text-gray-700"
                      htmlFor={lastnameId}
                    >
                      นามสกุล <span className="text-rose-500">*</span>
                    </label>
                    <input
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-gray-800 outline-none transition-all ${
                        fieldErrors.lastname
                          ? "bg-rose-50/40 border-rose-300 focus:border-rose-500 focus:ring-3 focus:ring-rose-500/15"
                          : "bg-white border-gray-200 focus:border-[#5d7c6f] focus:ring-3 focus:ring-[#5d7c6f]/15"
                      }`}
                      id={lastnameId}
                      placeholder="ระบุนามสกุล"
                      type="text"
                      value={form.lastname}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, lastname: e.target.value }))
                      }
                    />
                    {fieldErrors.lastname && (
                      <p className="text-rose-600 text-xs flex items-center gap-1">
                        <AlertCircle size={12} /> {fieldErrors.lastname}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <InfoItem
                  icon={<User size={15} />}
                  label="คำนำหน้าชื่อ"
                  value={profile.prefix_name || "ไม่ระบุ"}
                />
                <InfoItem
                  icon={<User size={15} />}
                  label="ชื่อจริง"
                  value={profile.firstname}
                />
                <InfoItem
                  icon={<User size={15} />}
                  label="นามสกุล"
                  value={profile.lastname}
                />
              </div>
            )}
          </SectionCard>

          {/* Section 2: Contact Info */}
          <SectionCard
            icon={<Phone size={18} />}
            iconBgColor="bg-blue-50"
            iconColor="text-blue-600"
            subtitle="ช่องทางติดต่อสำหรับการทำงานและประสานงานค่าย"
            title="ข้อมูลติดต่อ"
          >
            {editing ? (
              <div className="pt-1">
                <PhoneInput
                  error={fieldErrors.tel}
                  helperText="เบอร์โทรศัพท์ 10 หลัก สำหรับติดต่อฉุกเฉินและประสานงาน"
                  label="เบอร์โทรศัพท์"
                  placeholder="08X-XXX-XXXX"
                  value={form.tel}
                  onChange={(v) => setForm((f) => ({ ...f, tel: v }))}
                />
              </div>
            ) : (
              <div className="space-y-3">
                <InfoItem
                  copyValue={profile.tel || undefined}
                  icon={<Phone size={15} />}
                  label="เบอร์โทรศัพท์"
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
                  copyValue={profile.email}
                  icon={<Mail size={15} />}
                  label="อีเมลติดต่อ"
                  value={profile.email}
                />
              </div>
            )}
          </SectionCard>
        </div>

        {/* Right Column / Account & Security (1 Col) */}
        <div className="space-y-6">
          <SectionCard
            icon={<Shield size={18} />}
            iconBgColor="bg-purple-50"
            iconColor="text-purple-600"
            subtitle="ข้อมูลบัญชีผู้ใช้งานในระบบ"
            title="สิทธิ์และความปลอดภัย"
          >
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 font-medium">
                    สิทธิ์การใช้งาน (Role)
                  </span>
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${roleMeta.bg} ${roleMeta.text} ${roleMeta.border}`}
                  >
                    {profile.role}
                  </span>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">
                  {roleMeta.desc}
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-gray-50/80 border border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mail className="text-gray-400" size={14} />
                    <span className="text-xs text-gray-500">อีเมลล็อกอิน</span>
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
              </div>

              {/* Readonly info notice */}
              <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/60 flex items-start gap-2.5 text-amber-800">
                <Lock className="text-amber-600 shrink-0 mt-0.5" size={14} />
                <p className="text-[11px] leading-relaxed text-amber-700">
                  อีเมลและสิทธิ์การใช้งานถูกกำหนดโดยผู้ดูแลระบบ
                  หากต้องการเปลี่ยนแปลงกรุณาติดต่อผู้ดูแลระบบ
                </p>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>

      {mountEditorControls && (
        <ProfileEditorControls
          editing={editing}
          isFormDirty={isFormDirty}
          saving={saving}
          successToast={successToast}
          showCancelModal={showCancelModal}
          onCancel={handleCancelClick}
          onSave={handleSave}
          onDismissCancel={() => setShowCancelModal(false)}
          onConfirmCancel={revertAndCloseEdit}
        />
      )}
    </div>
  );
}
