export default function ParentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Access control lives in middleware so password-recovery pages can remain
  // public while every other /parent route still requires a parent session.
  return <>{children}</>;
}
