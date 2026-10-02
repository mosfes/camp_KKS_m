import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

export default function SsoCallbackPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f0e7] px-4">
      <AuthenticateWithRedirectCallback />
      <div
        aria-live="polite"
        className="rounded-2xl border border-gray-100 bg-white px-8 py-7 text-center shadow-sm"
      >
        <div
          aria-hidden="true"
          className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-4 border-[#dfe7e3] border-t-[#6b857a]"
        />
        <p className="font-medium text-slate-600">กำลังเข้าสู่ระบบ...</p>
      </div>
    </main>
  );
}
