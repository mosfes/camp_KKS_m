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

  // Only these routes use Clerk's client-side sign-in or sign-out methods.
  // The home page mounts its own provider when Google sign-in is requested.
  const needsClerk =
    pathname === "/login" ||
    pathname.startsWith("/sso-callback") ||
    pathname.startsWith("/logout/");

  return needsClerk ? (
    <ConfiguredClerkProvider>{children}</ConfiguredClerkProvider>
  ) : (
    children
  );
}
