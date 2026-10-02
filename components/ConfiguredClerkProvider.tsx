"use client";

import { thTH } from "@clerk/localizations";
import { ClerkProvider } from "@clerk/nextjs";

export default function ConfiguredClerkProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider
      appearance={{
        elements: {
          footerAction: "hidden",
          footer: "hidden",
        },
      }}
      localization={{
        ...thTH,
        formButtonPrimary: "เข้าสู่ระบบ",
        formFieldLabel__username: "เบอร์โทรศัพท์",
        socialButtonsBlockButton: "เข้าสู่ระบบด้วย {{provider|titleize}}",
        dividerText: "สำหรับ ผู้ปกครอง",
        signIn: {
          start: {
            title: "ยินดีต้อนรับสู่ KKS Camp",
            subtitle: "ล็อคอินเพื่อเข้าใช้งานระบบ",
          },
        },
        unstable__errors: {
          form_identifier_not_found: "ไม่พบเบอร์โทรศัพท์นี้ในระบบ",
          form_param_format_invalid: "รูปแบบเบอร์โทรศัพท์ไม่ถูกต้อง",
          form_param_nil: "กรุณากรอกข้อมูล",
          form_password_incorrect: "รหัสผ่านไม่ถูกต้อง",
        },
      }}
    >
      {children}
    </ClerkProvider>
  );
}
