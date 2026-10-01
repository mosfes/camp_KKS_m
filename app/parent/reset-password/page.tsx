import ResetPasswordForm from "./ResetPasswordForm";

export default async function ParentResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;

  return <ResetPasswordForm token={token} />;
}
