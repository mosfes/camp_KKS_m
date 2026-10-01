"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { CheckCircle2, LoaderCircle, MailCheck, XCircle } from "lucide-react";

export default function VerifyEmailResult({ token }: { token: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading",
  );
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("ลิงก์ยืนยันอีเมลไม่ถูกต้อง");

      return;
    }

    fetch("/api/auth/parent/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (response) => {
        const data = await response.json();

        if (!response.ok) throw new Error(data.error || "ยืนยันอีเมลไม่สำเร็จ");
        setStatus("success");
      })
      .catch((reason) => {
        setStatus("error");
        setMessage(reason instanceof Error ? reason.message : "เกิดข้อผิดพลาด");
      });
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f6f3eb] px-4">
      <div className="w-full max-w-[420px] space-y-5 rounded-2xl bg-white p-8 text-center shadow-[0_4px_25px_rgba(0,0,0,0.04)]">
        {status === "loading" && (
          <LoaderCircle
            className="mx-auto animate-spin text-[#5d7c6f]"
            size={48}
          />
        )}
        {status === "success" && (
          <CheckCircle2 className="mx-auto text-emerald-600" size={48} />
        )}
        {status === "error" && (
          <XCircle className="mx-auto text-red-500" size={48} />
        )}
        <div>
          <h1 className="text-2xl font-bold text-slate-700">
            {status === "loading"
              ? "กำลังยืนยันอีเมล"
              : status === "success"
                ? "ยืนยันอีเมลแล้ว"
                : "ยืนยันอีเมลไม่สำเร็จ"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {status === "loading"
              ? "กรุณารอสักครู่"
              : status === "success"
                ? "อีเมลนี้สามารถใช้รับลิงก์ลืมรหัสผ่านได้แล้ว"
                : message}
          </p>
        </div>
        {status !== "loading" && (
          <Button
            className="w-full bg-[#6b857a] font-bold text-white"
            startContent={<MailCheck size={17} />}
            onPress={() =>
              router.replace(
                status === "success" ? "/login" : "/parent/forgot-password",
              )
            }
          >
            {status === "success" ? "ไปหน้าเข้าสู่ระบบ" : "ขอลิงก์ใหม่"}
          </Button>
        )}
      </div>
    </div>
  );
}
