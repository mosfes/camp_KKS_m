import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInThisContext } from "node:vm";

import { NextResponse } from "next/server";
import ts from "typescript";

import { clearActiveCampCookies } from "../lib/server-active-camp";

const require = createRequire(import.meta.url);

test("signing out clears every camp context cookie at its original path", () => {
  const response = clearActiveCampCookies(NextResponse.json({ success: true }));
  const cookies = response.headers.get("set-cookie") ?? "";

  for (const name of [
    "headteacher_active_camp_id",
    "headteacher_active_base_id",
    "headteacher_active_tracking_student_id",
  ]) {
    assert.match(
      cookies,
      new RegExp(`${name}=; Path=/headteacher/dashboard/camp; Max-Age=0`),
    );
  }
});

test("camp detail rejects a camp outside the signed-in teacher's dashboard", async () => {
  const source = readFileSync(
    new URL("../app/api/camps/[id]/route.ts", import.meta.url),
    "utf8",
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const loaded = { exports: {} as { GET: Function } };
  const calls: unknown[] = [];
  const loadRoute = runInThisContext(
    `(function(require, module, exports) { ${compiled}\n})`,
  );

  loadRoute(
    (specifier: string) => {
      if (specifier === "@/lib/auth") {
        return {
          requireTeacher: async () => ({
            teacher: { teachers_id: 7, role: "TEACHER" },
            error: null,
          }),
        };
      }
      if (specifier === "@/lib/db") {
        return {
          prisma: {
            camp: {
              findFirst: async (query: unknown) => {
                calls.push(query);
                return null;
              },
            },
          },
        };
      }
      if (specifier === "@/lib/teacher-camp-access") {
        return require("../lib/teacher-camp-access");
      }
      if (specifier.startsWith("@/lib/")) return {};
      return require(specifier);
    },
    loaded,
    loaded.exports,
  );

  const response = await loaded.exports.GET(
    new Request("https://camp.test/api/camps/42?view=overview"),
    { params: Promise.resolve({ id: "42" }) },
  );

  assert.equal(response.status, 404);
  assert.equal(calls.length, 1);
  const query = calls[0] as { where: { camp_id: number; deletedAt: null; OR: unknown[] } };
  assert.equal(query.where.camp_id, 42);
  assert.equal(query.where.deletedAt, null);
  assert.equal(query.where.OR.length, 5);
});
