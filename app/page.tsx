import Image from "next/image";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth, currentUser } from "@clerk/nextjs/server";

import { prisma } from "@/lib/db";
import AutoLogout from "@/components/AutoLogout";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import InAppBrowserGuard from "@/components/InAppBrowserGuard";

export default async function Home() {
  const { userId } = await auth();

  if (userId) {
    const user = await currentUser();
    const email = user?.emailAddresses[0]?.emailAddress;

    if (!email) {
      return <div>ไม่พบข้อมูลอีเมลในระบบ</div>;
    }

    const teacher = await prisma.teachers.findFirst({
      where: { email: email, deletedAt: null },
    });

    if (teacher) {
      if (teacher.role === "ADMIN") {
        redirect("/api/auth/sync-session?to=/headteacher/dashboard");
      } else {
        redirect("/api/auth/sync-session?to=/headteacher/dashboard");
      }
    }

    const student = await prisma.students.findFirst({
      where: { email: email, deletedAt: null },
    });

    if (student) {
      redirect("/api/auth/sync-session?to=/student/dashboard");
    }

    return <AutoLogout email={email} />;
  }

  const userAgent = (await headers()).get("user-agent") ?? "";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f0e7] px-4 py-8">
      <InAppBrowserGuard initialUserAgent={userAgent}>
        <section className="w-full max-w-[400px] rounded-2xl border border-gray-100 bg-white px-8 py-9 text-center shadow-[0_12px_32px_rgba(51,65,85,0.16)]">
          <Image
            priority
            unoptimized
            alt="ตราโรงเรียนกัลยาณวัตร"
            className="mx-auto mb-4 h-[84px] w-[84px] object-contain"
            height={84}
            src="/images/logoKKS-login.webp"
            width={84}
          />
          <h1 className="text-xl font-bold text-slate-800">
            ยินดีต้อนรับสู่ KKS Camp
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            ล็อกอินเพื่อเข้าใช้งานระบบ
          </p>

          <GoogleSignInButton />
        </section>
      </InAppBrowserGuard>
    </main>
  );
}
