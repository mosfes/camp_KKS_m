"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { CheckCircle2, KeyRound } from "lucide-react";

export default function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const submitInFlightRef = useRef(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitInFlightRef.current || !token) return;
    submitInFlightRef.current = true;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/parent/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword, confirmPassword }),
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "ตั้งรหัสผ่านไม่สำเร็จ");
      setSuccess(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "เกิดข้อผิดพลาด");
    } finally {
      submitInFlightRef.current = false;
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f6f3eb] px-4 py-8">
      <div className="w-full max-w-[420px] rounded-2xl bg-white p-8 shadow-[0_4px_25px_rgba(0,0,0,0.04)]">
        {success ? (
          <div className="space-y-5 text-center">
            <CheckCircle2 className="mx-auto text-emerald-600" size={48} />
            <div>
              <h1 className="text-2xl font-bold text-slate-700">
                ตั้งรหัสผ่านเรียบร้อยแล้ว
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                เข้าสู่ระบบด้วยรหัสผ่านใหม่ได้ทันที
              </p>
            </div>
            <Button
              className="w-full bg-[#6b857a] font-bold text-white"
              onPress={() => router.replace("/login")}
            >
              ไปหน้าเข้าสู่ระบบ
            </Button>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="mb-6 text-center">
              <KeyRound className="mx-auto text-[#5d7c6f]" size={42} />
              <h1 className="mt-3 text-2xl font-bold text-slate-700">
                ตั้งรหัสผ่านใหม่
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร
              </p>
            </div>
            <Input
              isRequired
              label="รหัสผ่านใหม่"
              labelPlacement="outside"
              type="password"
              value={newPassword}
              onValueChange={setNewPassword}
            />
            <Input
              isRequired
              label="ยืนยันรหัสผ่านใหม่"
              labelPlacement="outside"
              type="password"
              value={confirmPassword}
              onValueChange={setConfirmPassword}
            />
            {!token && (
              <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">
                ลิงก์ตั้งรหัสผ่านไม่ถูกต้อง
              </p>
            )}
            {error && (
              <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">
                {error}
              </p>
            )}
            <Button
              className="h-12 w-full bg-[#6b857a] font-bold text-white"
              isDisabled={!token || loading}
              isLoading={loading}
              type="submit"
            >
              บันทึกรหัสผ่านใหม่
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
