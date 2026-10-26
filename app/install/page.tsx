import type { Metadata } from "next";

import AndroidInstallClient from "./AndroidInstallClient";

export const metadata: Metadata = {
  title: "ติดตั้ง KKS Camp บน Android",
  description: "เพิ่ม KKS Camp ไปยังหน้าจอโฮมของโทรศัพท์ Android",
};

export default function InstallPage() {
  return <AndroidInstallClient />;
}
