"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { LockKeyhole, CheckCircle2, AlertCircle } from "lucide-react";

export default function ParentChangePasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const submitInFlightRef = useRef(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitInFlightRef.current) return;
    submitInFlightRef.current = true;
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/parent/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword, confirmPassword }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "เปลี่ยนรหัสผ่านไม่สำเร็จ");

        return;
      }

      router.replace("/parent/dashboard");
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      submitInFlightRef.current = false;
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-[#f6f3eb] px-4 py-8">
      <section className="w-full max-w-[440px] overflow-hidden rounded-3xl bg-white shadow-[0_4px_25px_rgba(0,0,0,0.06)]">
        <div className="bg-gradient-to-br from-[#4d6c5f] via-[#5d7c6f] to-[#365f4f] px-6 py-8 text-white sm:px-8">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 shadow-inner">
              <LockKeyhole size={24} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-100/80">
                KKS Camp
              </p>
              <h1 className="text-xl font-bold">ตั้งรหัสผ่านใหม่</h1>
            </div>
          </div>
          <p className="text-sm leading-relaxed text-emerald-50/90">
            เพื่อความปลอดภัย
            กรุณาเปลี่ยนรหัสผ่านเริ่มต้นก่อนเข้าใช้งานระบบผู้ปกครอง
          </p>
        </div>

        <form className="space-y-5 p-6 sm:p-8" onSubmit={handleSubmit}>
          <label
            className="block space-y-1.5 text-sm font-semibold text-gray-700"
            htmlFor="parent-new-password"
          >
            <span>รหัสผ่านใหม่</span>
            <Input
              autoComplete="new-password"
              classNames={{
                inputWrapper: "h-12 rounded-xl bg-[#f1f3f5] border-none",
                input: "text-sm text-gray-700",
              }}
              id="parent-new-password"
              minLength={8}
              placeholder="อย่างน้อย 8 ตัวอักษร"
              type="password"
              value={newPassword}
              onValueChange={setNewPassword}
            />
          </label>

          <label
            className="block space-y-1.5 text-sm font-semibold text-gray-700"
            htmlFor="parent-confirm-password"
          >
            <span>ยืนยันรหัสผ่านใหม่</span>
            <Input
              autoComplete="new-password"
              classNames={{
                inputWrapper: "h-12 rounded-xl bg-[#f1f3f5] border-none",
                input: "text-sm text-gray-700",
              }}
              id="parent-confirm-password"
              minLength={8}
              placeholder="กรอกรหัสผ่านอีกครั้ง"
              type="password"
              value={confirmPassword}
              onValueChange={setConfirmPassword}
            />
          </label>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-600">
              <AlertCircle className="mt-0.5 shrink-0" size={16} />
              <span>{error}</span>
            </div>
          )}

          <Button
            className="h-12 w-full rounded-xl bg-[#5d7c6f] text-base font-bold text-white shadow-sm transition-colors hover:bg-[#4d695e]"
            isLoading={loading}
            isDisabled={loading}
            startContent={!loading && <CheckCircle2 size={17} />}
            type="submit"
          >
            บันทึกรหัสผ่านใหม่
          </Button>
        </form>
      </section>
    </main>
  );
}
