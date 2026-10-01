"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { ArrowLeft, KeyRound, Mail } from "lucide-react";

export default function ParentForgotPasswordPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const submitInFlightRef = useRef(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitInFlightRef.current) return;
    if (!username.trim()) {
      setError("กรุณากรอกรหัสนักเรียน");

      return;
    }

    submitInFlightRef.current = true;
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/auth/parent/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          recipientEmail: recipientEmail.trim(),
        }),
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "ดำเนินการไม่สำเร็จ");
      setMessage(data.message);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "เกิดข้อผิดพลาด");
    } finally {
      submitInFlightRef.current = false;
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f6f3eb] px-4 py-8">
      <div className="w-full max-w-[440px] rounded-2xl bg-white p-8 shadow-[0_4px_25px_rgba(0,0,0,0.04)]">
        <div className="mb-6 flex flex-col items-center">
          <Image
            priority
            unoptimized
            alt="KKS Camp Logo"
            height={76}
            src="/images/logoKKS.png"
            width={76}
          />
          <h1 className="mt-2 text-2xl font-bold text-slate-700">
            ลืมรหัสผ่าน
          </h1>
          <p className="mt-2 text-center text-sm leading-6 text-slate-500">
            กรอกได้ทั้งอีเมลผู้ปกครองที่ยืนยันแล้วหรืออีเมลนักเรียน หากเว้นว่าง
            ระบบจะส่งไปยังอีเมลนักเรียนอัตโนมัติ
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <Input
            isRequired
            classNames={{ inputWrapper: "h-12 rounded-xl bg-[#f1f3f5]" }}
            label="รหัสนักเรียน"
            labelPlacement="outside"
            placeholder="กรอกรหัสนักเรียน"
            value={username}
            onValueChange={(value) => {
              setUsername(value);
              setError("");
            }}
          />
          <Input
            classNames={{ inputWrapper: "h-12 rounded-xl bg-[#f1f3f5]" }}
            description="ต้องเป็นอีเมลผู้ปกครองหรืออีเมลนักเรียนที่บันทึกไว้ในระบบ"
            label="อีเมลสำหรับรับลิงก์ (ไม่บังคับ)"
            labelPlacement="outside"
            placeholder="parent@example.com"
            startContent={<Mail className="text-slate-400" size={17} />}
            type="email"
            value={recipientEmail}
            onValueChange={(value) => {
              setRecipientEmail(value);
              setError("");
            }}
          />

          {error && (
            <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">
              {error}
            </p>
          )}
          {message && (
            <p className="rounded-xl bg-emerald-50 p-3 text-sm leading-6 text-emerald-700">
              {message}
            </p>
          )}

          <Button
            className="h-12 w-full rounded-xl bg-[#6b857a] font-bold text-white"
            isDisabled={loading}
            isLoading={loading}
            startContent={!loading && <KeyRound size={17} />}
            type="submit"
          >
            ส่งลิงก์ตั้งรหัสผ่านใหม่
          </Button>
          <button
            className="flex w-full items-center justify-center gap-2 text-xs font-semibold text-slate-400 transition-colors hover:text-slate-600"
            type="button"
            onClick={() => router.push("/login")}
          >
            <ArrowLeft size={14} /> กลับหน้าเข้าสู่ระบบ
          </button>
        </form>
      </div>
    </div>
  );
}
