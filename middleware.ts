import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import {
  ACTIVE_BASE_COOKIE,
  ACTIVE_CAMP_COOKIE,
  ACTIVE_TRACKING_STUDENT_COOKIE,
  CLEAN_CAMP_PATH,
} from "@/lib/client-active-camp";

const HEADTEACHER_CAMP_PREFIX = CLEAN_CAMP_PATH;

function setActiveCampCookie(
  response: NextResponse,
  campId: string,
  isSecure: boolean,
) {
  response.cookies.set({
    name: ACTIVE_CAMP_COOKIE,
    value: campId,
    httpOnly: false,
    sameSite: "lax",
    secure: isSecure,
    path: HEADTEACHER_CAMP_PREFIX,
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}

function setNumericContextCookie(
  response: NextResponse,
  name: string,
  value: string,
  isSecure: boolean,
) {
  response.cookies.set({
    name,
    value,
    httpOnly: false,
    sameSite: "lax",
    secure: isSecure,
    path: HEADTEACHER_CAMP_PREFIX,
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}

const isAdminRoute = createRouteMatcher([
  "/admin_add_user(.*)",
  "/admin_promote_students(.*)",
  "/admin_graduated_students(.*)",
]);
const isTeacherRoute = createRouteMatcher(["/headteacher(.*)"]);
const isStudentRoute = createRouteMatcher(["/student(.*)"]);
const isParentRoute = createRouteMatcher(["/parent(.*)"]);

const isProtectedApiRoute = createRouteMatcher([
  "/api/teachers(.*)",
  "/api/students(.*)",
  "/api/surveys(.*)",
  "/api/upload(.*)",
  "/api/classrooms(.*)",
  "/api/vulgar-words(.*)",
  "/api/document-personnel(.*)",
  "/api/project-document-templates(.*)",
  "/api/document-reference-options(.*)",
  "/api/camps(.*)",
  "/api/parent(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  const authObject = await auth();

  if (
    !authObject.userId &&
    (isAdminRoute(req) || isTeacherRoute(req) || isStudentRoute(req))
  ) {
    await auth.protect();
  }

  let role: string | undefined = undefined;
  let parentMustChangePassword = false;

  const teacherCookie = req.cookies.get("teacher_session")?.value;
  const studentCookie = req.cookies.get("student_session")?.value;
  const parentCookie = req.cookies.get("parent_session")?.value;

  if (teacherCookie) {
    try {
      const { jwtVerify } = await import("jose");
      const secret = new TextEncoder().encode(process.env.JWT_SECRET);
      const { payload } = await jwtVerify(teacherCookie, secret);

      role = (payload.role as string)?.toLowerCase() || "teacher";
    } catch (e) {
      console.error("Failed to verify teacher_session cookie", e);
    }
  } else if (studentCookie) {
    try {
      const { jwtVerify } = await import("jose");
      const secret = new TextEncoder().encode(process.env.JWT_SECRET);

      await jwtVerify(studentCookie, secret);
      role = "student";
    } catch (e) {
      console.error("Failed to verify student_session cookie", e);
    }
  } else if (parentCookie) {
    try {
      const { jwtVerify } = await import("jose");
      const secret = new TextEncoder().encode(process.env.JWT_SECRET);

      const { payload } = await jwtVerify(parentCookie, secret);
      role = "parent";
      parentMustChangePassword = payload.mustChangePassword === true;
    } catch (e) {
      console.error("Failed to verify parent_session cookie", e);
    }
  }

  if (!role && authObject.userId) {
    role = (
      (authObject.sessionClaims?.metadata as any)?.role as string | undefined
    )?.toLowerCase();
  }

  // Helper: ตรวจสอบว่า role นี้เป็น "ครู" หรือไม่ (รองรับทุก role ของครู)
  const isTeacherRole = (r: string | undefined) =>
    r === "admin" ||
    r === "teacher" ||
    r === "camp_leader" ||
    r === "head_teacher" ||
    r === "headteacher";

  if (isParentRoute(req) && role !== "parent") {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (
    isParentRoute(req) &&
    role === "parent" &&
    parentMustChangePassword &&
    !/^\/parent\/change-password\/?$/.test(req.nextUrl.pathname)
  ) {
    return NextResponse.redirect(new URL("/parent/change-password", req.url));
  }

  // API Route Protection
  if (isProtectedApiRoute(req)) {
    const isCampLocationRoute = req.nextUrl.pathname.match(
      /^\/api\/camps\/\d+\/location$/,
    );

    // Endpoint นี้ตรวจสิทธิ์สัมพันธ์กับค่ายซ้ำใน route handler และเปิดให้นักเรียน/
    // ผู้ปกครองอ่านได้ ส่วนการแก้ไขและส่ง GPS จำกัดเฉพาะครูใน route handler
    if (isCampLocationRoute) {
      if (!isTeacherRole(role) && role !== "student" && role !== "parent") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (role === "parent" && parentMustChangePassword) {
        return NextResponse.json(
          { error: "กรุณาเปลี่ยนรหัสผ่านก่อนใช้งานระบบ" },
          { status: 428 },
        );
      }
    } else if (req.nextUrl.pathname.startsWith("/api/parent")) {
      if (role !== "parent") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (parentMustChangePassword) {
        return NextResponse.json(
          { error: "กรุณาเปลี่ยนรหัสผ่านก่อนใช้งานระบบ" },
          { status: 428 },
        );
      }
    }
    // Special case for upload and certificate: allow both teachers and students
    else if (
      req.nextUrl.pathname.startsWith("/api/upload") ||
      req.nextUrl.pathname.match(/^\/api\/camps\/\d+\/certificate/)
    ) {
      if (!isTeacherRole(role) && role !== "student") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    } else {
      // Other protected routes: only allow teachers
      if (!isTeacherRole(role)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }
  }

  if (authObject.userId) {
    if (isAdminRoute(req) && role !== "admin") {
      if (isTeacherRole(role)) {
        return NextResponse.redirect(
          new URL("/headteacher/dashboard", req.url),
        );
      } else if (role === "student") {
        return NextResponse.redirect(new URL("/student/dashboard", req.url));
      } else {
        return NextResponse.redirect(new URL("/", req.url));
      }
    }

    // อนุญาตทุก role ของครูให้เข้า /headteacher ได้
    if (isTeacherRoute(req) && !isTeacherRole(role)) {
      if (role === "student") {
        return NextResponse.redirect(new URL("/student/dashboard", req.url));
      } else {
        return NextResponse.redirect(new URL("/", req.url));
      }
    }

    // ไม่อนุญาตให้ครูเข้า /student
    if (isStudentRoute(req) && isTeacherRole(role)) {
      return NextResponse.redirect(new URL("/headteacher/dashboard", req.url));
    }
  }

  const pathname = req.nextUrl.pathname;
  const isSecure = req.nextUrl.protocol === "https:";
  const legacyBaseRoute = pathname.match(
    /^\/headteacher\/dashboard\/camp\/(\d+)\/base\/(\d+)$/,
  );

  if (legacyBaseRoute) {
    const [, campId, baseId] = legacyBaseRoute;
    const cleanUrl = req.nextUrl.clone();

    cleanUrl.pathname = `${HEADTEACHER_CAMP_PREFIX}/base`;
    const response = NextResponse.redirect(cleanUrl);

    setActiveCampCookie(response, campId, isSecure);

    return setNumericContextCookie(
      response,
      ACTIVE_BASE_COOKIE,
      baseId,
      isSecure,
    );
  }

  const legacyTrackingStudentRoute = pathname.match(
    /^\/headteacher\/dashboard\/camp\/(\d+)\/tracking\/(\d+)$/,
  );

  if (legacyTrackingStudentRoute) {
    const [, campId, studentId] = legacyTrackingStudentRoute;
    const cleanUrl = req.nextUrl.clone();

    cleanUrl.pathname = `${HEADTEACHER_CAMP_PREFIX}/tracking/student`;
    const response = NextResponse.redirect(cleanUrl);

    setActiveCampCookie(response, campId, isSecure);

    return setNumericContextCookie(
      response,
      ACTIVE_TRACKING_STUDENT_COOKIE,
      studentId,
      isSecure,
    );
  }

  const legacyCampRoute = pathname.match(
    /^\/headteacher\/dashboard\/camp\/(\d+)(\/.*)?$/,
  );

  if (legacyCampRoute) {
    const [, campId, suffix] = legacyCampRoute;
    const cleanUrl = req.nextUrl.clone();

    cleanUrl.pathname = `${HEADTEACHER_CAMP_PREFIX}${suffix || "/overview"}`;

    return setActiveCampCookie(
      NextResponse.redirect(cleanUrl),
      campId,
      isSecure,
    );
  }

  if (pathname === HEADTEACHER_CAMP_PREFIX) {
    const dashboardUrl = req.nextUrl.clone();

    dashboardUrl.pathname = "/headteacher/dashboard";
    dashboardUrl.search = "?tab=camp";

    return NextResponse.redirect(dashboardUrl);
  }

  if (pathname.startsWith(`${HEADTEACHER_CAMP_PREFIX}/`)) {
    const campId = req.cookies.get(ACTIVE_CAMP_COOKIE)?.value;

    if (!campId || !/^\d+$/.test(campId)) {
      const dashboardUrl = req.nextUrl.clone();

      dashboardUrl.pathname = "/headteacher/dashboard";
      dashboardUrl.search = "?tab=camp";

      return NextResponse.redirect(dashboardUrl);
    }

    const oldCleanBaseRoute = pathname.match(
      /^\/headteacher\/dashboard\/camp\/base\/(\d+)$/,
    );

    if (oldCleanBaseRoute) {
      const cleanUrl = req.nextUrl.clone();

      cleanUrl.pathname = `${HEADTEACHER_CAMP_PREFIX}/base`;

      return setNumericContextCookie(
        NextResponse.redirect(cleanUrl),
        ACTIVE_BASE_COOKIE,
        oldCleanBaseRoute[1],
        isSecure,
      );
    }

    const oldCleanTrackingStudentRoute = pathname.match(
      /^\/headteacher\/dashboard\/camp\/tracking\/(\d+)$/,
    );

    if (oldCleanTrackingStudentRoute) {
      const cleanUrl = req.nextUrl.clone();

      cleanUrl.pathname = `${HEADTEACHER_CAMP_PREFIX}/tracking/student`;

      return setNumericContextCookie(
        NextResponse.redirect(cleanUrl),
        ACTIVE_TRACKING_STUDENT_COOKIE,
        oldCleanTrackingStudentRoute[1],
        isSecure,
      );
    }

    if (pathname === `${HEADTEACHER_CAMP_PREFIX}/base`) {
      const baseId = req.cookies.get(ACTIVE_BASE_COOKIE)?.value;

      if (!baseId || !/^\d+$/.test(baseId)) {
        const basesUrl = req.nextUrl.clone();

        basesUrl.pathname = `${HEADTEACHER_CAMP_PREFIX}/bases`;

        return NextResponse.redirect(basesUrl);
      }

      const internalUrl = req.nextUrl.clone();

      internalUrl.pathname = `${HEADTEACHER_CAMP_PREFIX}/${campId}/base/${baseId}`;

      return NextResponse.rewrite(internalUrl);
    }

    if (pathname === `${HEADTEACHER_CAMP_PREFIX}/tracking/student`) {
      const studentId = req.cookies.get(ACTIVE_TRACKING_STUDENT_COOKIE)?.value;

      if (!studentId || !/^\d+$/.test(studentId)) {
        const trackingUrl = req.nextUrl.clone();

        trackingUrl.pathname = `${HEADTEACHER_CAMP_PREFIX}/tracking`;

        return NextResponse.redirect(trackingUrl);
      }

      const internalUrl = req.nextUrl.clone();

      internalUrl.pathname = `${HEADTEACHER_CAMP_PREFIX}/${campId}/tracking/${studentId}`;

      return NextResponse.rewrite(internalUrl);
    }

    const suffix = pathname.slice(HEADTEACHER_CAMP_PREFIX.length);
    const internalUrl = req.nextUrl.clone();

    internalUrl.pathname =
      suffix === "/overview"
        ? `${HEADTEACHER_CAMP_PREFIX}/${campId}`
        : `${HEADTEACHER_CAMP_PREFIX}/${campId}${suffix}`;

    return NextResponse.rewrite(internalUrl);
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
