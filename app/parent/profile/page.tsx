"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import {
  UserCircle2,
  Phone,
  Save,
  ChevronLeft,
  AlertCircle,
} from "lucide-react";

import { ParentNavbar } from "@/components/ParentNavbar";

type ParentProfile = {
  parents_id: number;
  firstname: string;
  lastname: string;
  tel: string;
};

export default function ParentProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<ParentProfile | null>(null);
  const [form, setForm] = useState({ firstname: "", lastname: "", tel: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const submitInFlightRef = useRef(false);

  useEffect(() => {
    fetch("/api/parent/profile")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error || "ไม่สามารถโหลดโปรไฟล์ได้");
        setProfile(data.parent);
        if (data.parent) {
          setForm({
            firstname:
              data.parent.firstname === "รอระบุ" ? "" : data.parent.firstname,
            lastname:
              data.parent.lastname === "รอระบุ" ? "" : data.parent.lastname,
            tel: data.parent.tel === "0000000000" ? "" : data.parent.tel,
          });
        }
      })
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : "เกิดข้อผิดพลาด"),
      )
      .finally(() => setLoading(false));
  }, []);

  const update = (key: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setMessage("");
    setError("");
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitInFlightRef.current) return;
    setMessage("");
    setError("");
    const tel = form.tel.replace(/\D/g, "");

    if (!form.firstname.trim() || !form.lastname.trim()) {
      setError("กรุณากรอกชื่อและนามสกุล");
      return;
    }
    if (tel.length !== 10) {
      setError("เบอร์โทรต้องมี 10 หลัก");
      return;
    }

    submitInFlightRef.current = true;
    setSaving(true);
    try {
      const response = await fetch("/api/parent/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, tel }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "บันทึกข้อมูลไม่สำเร็จ");
      setProfile(data.parent);
      setForm({
        firstname: data.parent.firstname,
        lastname: data.parent.lastname,
        tel: data.parent.tel,
      });
      setMessage("บันทึกข้อมูลเรียบร้อยแล้ว");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "เกิดข้อผิดพลาด");
    } finally {
      submitInFlightRef.current = false;
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f2]">
      <ParentNavbar />
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex items-center gap-3">
          <Button
            isIconOnly
            aria-label="กลับหน้าหลัก"
            className="bg-white text-gray-700 shadow-sm"
            radius="lg"
            variant="flat"
            onPress={() => router.push("/parent/dashboard")}
          >
            <ChevronLeft size={20} />
          </Button>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#5d7c6f]">
              Parent profile
            </p>
            <h1 className="text-2xl font-bold text-gray-800">
              โปรไฟล์ผู้ปกครอง
            </h1>
          </div>
        </div>

        {loading ? (
          <div className="rounded-3xl bg-white p-10 text-center text-sm text-gray-500 shadow-sm">
            กำลังโหลดข้อมูล...
          </div>
        ) : (
          <form
            className="space-y-5 rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:p-7"
            onSubmit={handleSubmit}
          >
            <div className="relative -mx-5 -mt-5 overflow-hidden rounded-t-3xl bg-gradient-to-br from-[#4d6c5f] via-[#5d7c6f] to-[#365f4f] p-6 text-white shadow-md sm:-mx-7 sm:-mt-7 sm:p-8">
              <div className="relative z-10 flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-white/40 bg-white/20 text-3xl shadow-inner">
                  <UserCircle2 size={30} />
                </div>
                <div>
                  <h2 className="text-xl font-bold">ข้อมูลสำหรับการติดต่อ</h2>
                  <p className="mt-1 text-sm text-emerald-50/80">
                    ใช้สำหรับประสานงานระหว่างเข้าค่าย
                  </p>
                </div>
              </div>
              <UserCircle2
                className="absolute -bottom-8 -right-4 opacity-10"
                size={150}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {(["firstname", "lastname"] as const).map((key) => (
                <label
                  key={key}
                  className="space-y-1.5 text-sm font-medium text-gray-700"
                >
                  <span>
                    {key === "firstname" ? "ชื่อผู้ปกครอง" : "นามสกุลผู้ปกครอง"}
                  </span>
                  <input
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none transition focus:border-[#5d7c6f] focus:ring-2 focus:ring-[#5d7c6f]/20"
                    value={form[key]}
                    onChange={(event) => update(key, event.target.value)}
                  />
                </label>
              ))}
            </div>
            <label className="block space-y-1.5 text-sm font-medium text-gray-700">
              <span>เบอร์โทรศัพท์</span>
              <div className="relative">
                <Phone
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                  size={16}
                />
                <input
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-4 outline-none transition focus:border-[#5d7c6f] focus:ring-2 focus:ring-[#5d7c6f]/20"
                  maxLength={10}
                  type="tel"
                  value={form.tel}
                  onChange={(event) => update("tel", event.target.value)}
                />
              </div>
            </label>

            {error && (
              <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-600">
                <AlertCircle size={16} />
                {error}
              </div>
            )}
            {message && (
              <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">
                {message}
              </div>
            )}
            <Button
              className="w-full bg-[#5d7c6f] font-semibold text-white"
              isLoading={saving}
              isDisabled={saving}
              startContent={!saving && <Save size={16} />}
              type="submit"
            >
              บันทึกข้อมูล
            </Button>
            {profile && (
              <p className="text-center text-xs text-gray-400">
                ข้อมูลนี้แก้ไขได้เฉพาะโปรไฟล์ผู้ปกครองของบัญชีปัจจุบัน
              </p>
            )}
          </form>
        )}
      </main>
    </div>
  );
}
