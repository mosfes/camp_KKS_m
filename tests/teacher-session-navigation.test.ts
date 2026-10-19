import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { after, before, beforeEach, test } from "node:test";
import { runInThisContext } from "node:vm";

import { createRouteMatcher } from "@clerk/nextjs/server";
import { SignJWT } from "jose";
import { NextRequest, NextResponse } from "next/server";
import type { NextFetchEvent, NextMiddleware } from "next/server";
import ts from "typescript";

const originalSecret = process.env.JWT_SECRET;
const secret = "teacher-navigation-regression-test-secret";
const require = createRequire(import.meta.url);
let clerkCalls = 0;

before(() => {
  process.env.JWT_SECRET = secret;
});

after(() => {
  if (originalSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalSecret;
});

beforeEach(() => {
  clerkCalls = 0;
});

// Exercise the actual middleware with real JWT verification, route matching,
// redirects and rewrites. Simulate Clerk redirecting before its handler runs,
// as can happen when its short-lived session token needs a handshake.
const source = readFileSync(
  new URL("../middleware.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const loaded = { exports: {} as { default: NextMiddleware } };
const loadMiddleware = runInThisContext(
  `(function(require, module, exports) { ${compiled}\n})`,
);

loadMiddleware(
  (specifier: string) => {
    if (specifier === "@clerk/nextjs/server") {
      return {
        createRouteMatcher,
        clerkMiddleware: () => () => {
          clerkCalls += 1;
          return NextResponse.redirect("https://camp.test/login");
        },
      };
    }
    if (specifier === "@/lib/client-active-camp") {
      return require("../lib/client-active-camp");
    }
    return require(specifier);
  },
  loaded,
  loaded.exports,
);

async function token(payload: Record<string, unknown>, expiration = "7d") {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(expiration)
    .sign(new TextEncoder().encode(secret));
}

async function navigate(path: string, session?: string, context = "") {
  const cookie = [session && `teacher_session=${session}`, context]
    .filter(Boolean)
    .join("; ");
  const request = new NextRequest(`https://camp.test${path}`, {
    headers: { cookie, RSC: "1" },
  });
  const response = await loaded.exports.default(request, {} as NextFetchEvent);

  return response ?? NextResponse.next();
}

for (const role of ["TEACHER", "HEADTEACHER", "CAMP_LEADER", "ADMIN"]) {
  test(`${role} can switch menus even when Clerk would redirect to login`, async () => {
    const session = await token({ teachers_id: 7, role });
    for (const path of [
      "/headteacher/dashboard?tab=camp",
      "/headteacher/dashboard?tab=homeroom",
      "/headteacher/profile",
      "/api/auth/me",
      "/api/camps?view=dashboard",
      "/api/teacher/homeroom",
    ]) {
      const response = await navigate(path, session);
      assert.equal(response.headers.get("location"), null, path);
      assert.equal(response.status, 200, path);
    }
    assert.equal(clerkCalls, 0);
  });
}

test("camp menus still rewrite to the active camp without a Clerk handshake", async () => {
  const session = await token({ teachers_id: 7, role: "HEADTEACHER" });
  for (const page of [
    "overview",
    "students",
    "attendance",
    "bases",
    "tracking",
  ]) {
    const response = await navigate(
      `/headteacher/dashboard/camp/${page}`,
      session,
      "headteacher_active_camp_id=42",
    );
    assert.equal(response.headers.get("location"), null);
    assert.equal(
      response.headers.get("x-middleware-rewrite"),
      `https://camp.test/headteacher/dashboard/camp/42${page === "overview" ? "" : `/${page}`}`,
    );
  }
  assert.equal(clerkCalls, 0);
});

test("teacher sessions still enforce administrator access", async () => {
  const teacherSession = await token({ teachers_id: 7, role: "TEACHER" });
  const denied = await navigate("/admin_add_user", teacherSession);
  assert.equal(
    denied.headers.get("location"),
    "https://camp.test/headteacher/dashboard",
  );

  const adminSession = await token({ teachers_id: 8, role: "ADMIN" });
  const allowed = await navigate("/admin_add_user", adminSession);
  assert.equal(allowed.headers.get("location"), null);
  assert.equal(clerkCalls, 0);
});

test("an unrecognized teacher role cannot access teacher pages or APIs", async () => {
  const session = await token({ teachers_id: 7, role: "PARENT" });
  const page = await navigate("/headteacher/dashboard", session);
  assert.equal(page.headers.get("location"), "https://camp.test/");
  const api = await navigate("/api/camps", session);
  assert.equal(api.status, 401);
});

test("missing, expired, forged and non-teacher sessions still require Clerk authentication", async () => {
  const sessions = [
    undefined,
    "invalid-jwt",
    await token({ teachers_id: 7, role: "TEACHER" }, "-1s"),
    await token({ students_id: 7, role: "TEACHER" }),
    await token({ teachers_id: 0, role: "TEACHER" }),
  ];
  for (const session of sessions) {
    const response = await navigate("/headteacher/dashboard", session);
    assert.equal(response.headers.get("location"), "https://camp.test/login");
  }
  assert.equal(clerkCalls, sessions.length);
});

test("a teacher cookie does not bypass Clerk on login, logout or other role routes", async () => {
  const session = await token({ teachers_id: 7, role: "TEACHER" });
  const paths = [
    "/",
    "/sso-callback",
    "/api/auth/logout",
    "/student/dashboard",
    "/parent/family",
    "/api/parent/me",
  ];
  for (const path of paths) {
    await navigate(path, session);
  }
  assert.equal(clerkCalls, paths.length);
});
