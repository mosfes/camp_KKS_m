"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

const ConfiguredClerkProvider = dynamic(
  () => import("@/components/ConfiguredClerkProvider"),
);

export default function AppAuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // Student pages authenticate on the server through the Clerk session and
  // the student_session cookie. They do not use Clerk's client-side hooks, so
  // avoid downloading the Clerk UI/runtime bundle on every student screen.
  if (pathname.startsWith("/student/")) {
    return children;
  }

  return <ConfiguredClerkProvider>{children}</ConfiguredClerkProvider>;
}
