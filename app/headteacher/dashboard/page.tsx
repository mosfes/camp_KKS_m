import { GET as getCamps } from "@/app/api/camps/route";
import { GET as getTeacher } from "@/app/api/auth/me/route";
import { GET as getAcademicYears } from "@/app/api/academic_years/route";
import { GET as getHomeroom } from "@/app/api/teacher/homeroom/route";
import { GET as getTeacherBus } from "@/app/api/teacher/bus/route";

import StudentDashboard from "./DashboardClient";

export default async function Page() {
  const [camps, teacher, academicYears, homeroom, teacherBus] =
    await Promise.all([
      getCamps(new Request("https://www.kkscamp.com/api/camps")),
      getTeacher(),
      getAcademicYears(),
      getHomeroom(),
      getTeacherBus(new Request("https://www.kkscamp.com/api/teacher/bus")),
    ]);

  const responses = [
    ["/api/camps", camps],
    ["/api/auth/me", teacher],
    ["/api/academic_years", academicYears],
    ["/api/teacher/homeroom", homeroom],
    ["/api/teacher/bus", teacherBus],
  ] as const;
  const initialData: Record<string, unknown> = {};

  await Promise.all(
    responses.map(async ([key, response]) => {
      if (response.ok) initialData[key] = await response.json();
    }),
  );

  return <StudentDashboard initialData={initialData} />;
}
