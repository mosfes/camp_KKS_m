import VerifyEmailResult from "./VerifyEmailResult";

export default async function ParentVerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;

  return <VerifyEmailResult token={token} />;
}
