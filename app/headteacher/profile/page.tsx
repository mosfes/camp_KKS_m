import { GET as getProfile } from "@/app/api/teacher/profile/route";

import { TeacherProfileView } from "@/components/profile/TeacherProfileView";

export default async function HeadteacherProfilePage() {
  const response = await getProfile();
  const initialProfile = response.ok ? await response.json() : null;

  return (
    <TeacherProfileView
      backLabel="กลับสู่แดชบอร์ด"
      backUrl="/headteacher/dashboard"
      initialProfile={initialProfile}
    />
  );
}
