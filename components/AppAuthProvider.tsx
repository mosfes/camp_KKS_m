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

  // Student, parent, and teacher pages use server-verified application sessions.
  // These areas do not need the Clerk UI/runtime bundle during navigation.
  if (
    pathname.startsWith("/student/") ||
    pathname.startsWith("/parent/") ||
    pathname.startsWith("/headteacher/") ||
    pathname === "/admin_add_user" ||
    pathname.startsWith("/admin_add_user/") ||
    pathname === "/admin_promote_students" ||
    pathname === "/admin_graduated_students"
  ) {
    return children;
  }

  // The home page only needs Clerk once the visitor presses the Google
  // sign-in button, so it mounts its own provider on demand.
  if (pathname === "/") {
    return children;
  }

  return <ConfiguredClerkProvider>{children}</ConfiguredClerkProvider>;
}
