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

  // The home page only needs Clerk once the visitor presses the Google
  // sign-in button, so it mounts its own provider on demand.
  if (pathname === "/") {
    return children;
  }

  return <ConfiguredClerkProvider>{children}</ConfiguredClerkProvider>;
}
