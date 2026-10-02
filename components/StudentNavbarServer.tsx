import type { StudentNavbarStudent } from "@/components/StudentNavbar";

import { AppNavbar } from "@/components/StudentNavbar";
import { getStudentMe } from "@/lib/server-student-api";

export async function StudentNavbarServer() {
  const student = await getStudentMe<StudentNavbarStudent>();

  return <AppNavbar initialStudent={student} />;
}

export function StudentNavbarFallback() {
  return (
    <nav className="h-16 border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="h-10 w-32 rounded-xl bg-gray-100" />
        <div className="h-9 w-20 rounded-xl bg-gray-100" />
      </div>
    </nav>
  );
}
