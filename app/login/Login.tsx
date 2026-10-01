"use client";

import Image from "next/image";
import { Card, CardBody } from "@heroui/card";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Users, ArrowLeft } from "lucide-react";

export default function ParentLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setError("กรุณากรอกข้อมูลให้ครบ");

      return;
    }
    try {
      setLoading(true);
      setError("");
      const res = await fetch("/api/auth/parent/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          password: password.trim(),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "เข้าสู่ระบบไม่สำเร็จ");

        return;
      }
      router.replace(
        data.mustChangePassword
          ? "/parent/change-password"
          : "/parent/dashboard",
      );
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#f6f3eb] flex flex-col items-center justify-center px-4 relative">
      <Card className="w-full max-w-[420px] rounded-2xl bg-white border-none shadow-[0_4px_25px_rgba(0,0,0,0.04)] overflow-hidden">
        <CardBody className="p-8 space-y-5">
          <div className="flex flex-col items-center mb-1">
            <div className="mb-3">
              <Image
                priority
                unoptimized
                alt="KKS Camp Logo"
                height={90}
                src="/images/logoKKS.png"
                width={90}
              />
            </div>
            <h1 className="text-2xl font-bold text-[#334155] tracking-tight">
              KKS Camp
            </h1>
          </div>

          <div className="w-full h-[1px] bg-gray-100" />

          {/* Header */}
          <div className="flex items-center gap-3 mt-1">
            <div className="w-10 h-10 rounded-full bg-[#eff4f2] flex items-center justify-center text-[#5d7c6f]">
              <Users size={20} />
            </div>
            <h2 className="text-lg font-bold text-[#334155]">
              เข้าสู่ระบบผู้ปกครอง
            </h2>
          </div>

          <div className="space-y-4">
            <div>
              <label
                className="block text-xs font-semibold text-gray-500 mb-1.5 ml-0.5"
                htmlFor="parent-username"
              >
                ชื่อผู้ใช้ (รหัสนักเรียน)
              </label>
              <Input
                classNames={{
                  inputWrapper: "h-12 bg-[#f1f3f5] border-none rounded-xl",
                  input:
                    "text-sm text-gray-700 placeholder:text-gray-400 font-medium",
                }}
                id="parent-username"
                placeholder="รหัสนักเรียน"
                type="text"
                value={username}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                onValueChange={(v) => {
                  setUsername(v);
                  setError("");
                }}
              />
            </div>

            <div>
              <label
                className="block text-xs font-semibold text-gray-500 mb-1.5 ml-0.5"
                htmlFor="parent-password"
              >
                รหัสผ่าน
              </label>
              <Input
                classNames={{
                  inputWrapper: "h-12 bg-[#f1f3f5] border-none rounded-xl",
                  input:
                    "text-sm text-gray-700 placeholder:text-gray-400 font-medium",
                }}
                id="parent-password"
                placeholder="รหัสผ่าน"
                type="password"
                value={password}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                onValueChange={(v) => {
                  setPassword(v);
                  setError("");
                }}
              />
            </div>

            <button
              className="ml-auto block text-xs font-semibold text-[#5d7c6f] transition-colors hover:text-[#405d51]"
              type="button"
              onClick={() => router.push("/parent/forgot-password")}
            >
              ลืมรหัสผ่าน?
            </button>
          </div>

          {error && <p className="text-xs text-red-500 text-center">{error}</p>}

          <div className="pt-1 space-y-5">
            <Button
              className="w-full h-12 rounded-xl bg-[#6b857a] text-white font-bold text-base shadow-sm hover:bg-[#5a7168] transition-colors"
              isLoading={loading}
              onPress={handleLogin}
            >
              เข้าสู่ระบบ
            </Button>

            <button
              className="w-full flex items-center justify-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors"
              onClick={() => router.push("/")}
            >
              <ArrowLeft size={14} />
              กลับหน้าหลัก
            </button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
