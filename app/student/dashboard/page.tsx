import StudentDashboardClient from "./StudentDashboardClient";

import {
  getStudentBusAssignments,
  getStudentCamps,
  getStudentMe,
} from "@/lib/server-student-api";

export default async function StudentDashboardPage() {
  const [camps, student, bus] = await Promise.all([
    getStudentCamps<any[]>(),
    getStudentMe<any>(),
    getStudentBusAssignments<{ assignments?: any[] }>(),
  ]);
  const initialDataLoaded = Array.isArray(camps) && student !== null;

  return (
    <StudentDashboardClient
      initialBusAssignments={
        Array.isArray(bus?.assignments) ? bus.assignments : []
      }
      initialCamps={Array.isArray(camps) ? camps : []}
      initialDataLoaded={initialDataLoaded}
      initialStudent={student}
    />
  );
}
