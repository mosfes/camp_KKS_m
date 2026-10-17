#!/usr/bin/env node

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import readline from "node:readline/promises";

import { launch, Launcher } from "chrome-launcher";
import lighthouse, { desktopConfig, generateReport } from "lighthouse";
import puppeteer from "puppeteer-core";

const SCORE_KEYS = ["performance", "accessibility", "best-practices", "seo"];

const SCORE_LABELS = {
  performance: "Performance",
  accessibility: "Accessibility",
  "best-practices": "Best Practices",
  seo: "SEO",
};

const METRIC_IDS = [
  "first-contentful-paint",
  "largest-contentful-paint",
  "total-blocking-time",
  "cumulative-layout-shift",
  "speed-index",
];
const AUTH_COOKIE_FILE = "auth-cookies.json";

const ROLE_CONFIGS = {
  student: {
    label: "นักเรียน",
    dashboardPath: "/student/dashboard",
    allowedPathPrefixes: ["/student/"],
    cookieName: "student_session",
    sessionEnv: "KKS_LIGHTHOUSE_STUDENT_SESSION",
    authCheckPath: "/api/auth/student/me",
  },
  parent: {
    label: "ผู้ปกครอง",
    dashboardPath: "/parent/dashboard",
    allowedPathPrefixes: ["/parent/"],
    cookieName: "parent_session",
    sessionEnv: "KKS_LIGHTHOUSE_PARENT_SESSION",
    authCheckPath: "/api/auth/parent/me",
  },
  teacher: {
    label: "ครู",
    dashboardPath: "/headteacher/dashboard",
    allowedPathPrefixes: ["/headteacher/"],
    cookieName: "teacher_session",
    sessionEnv: "KKS_LIGHTHOUSE_TEACHER_SESSION",
    authCheckPath: "/api/auth/me",
    expectedRole: "TEACHER",
  },
  headteacher: {
    label: "หัวหน้าค่าย",
    dashboardPath: "/headteacher/dashboard",
    allowedPathPrefixes: ["/headteacher/"],
    cookieName: "teacher_session",
    sessionEnv: "KKS_LIGHTHOUSE_HEADTEACHER_SESSION",
    authCheckPath: "/api/auth/me",
    expectedDerivedRole: "HEADTEACHER",
  },
  "camp-leader": {
    label: "ผู้ดูแลค่าย",
    dashboardPath: "/headteacher/dashboard",
    allowedPathPrefixes: ["/headteacher/"],
    cookieName: "teacher_session",
    sessionEnv: "KKS_LIGHTHOUSE_CAMP_LEADER_SESSION",
    authCheckPath: "/api/auth/me",
    expectedRole: "CAMP_LEADER",
  },
  admin: {
    label: "แอดมิน",
    dashboardPath: "/admin_add_user",
    allowedPathPrefixes: [
      "/admin_add_user",
      "/admin_promote_students",
      "/admin_graduated_students",
    ],
    cookieName: "teacher_session",
    sessionEnv: "KKS_LIGHTHOUSE_ADMIN_SESSION",
    authCheckPath: "/api/auth/me",
    expectedRole: "ADMIN",
  },
};

const ROLE_ALIASES = {
  camp_leader: "camp-leader",
  campLeader: "camp-leader",
};

function parseArgs(argv) {
  const options = {
    baseUrl: "https://www.kkscamp.com",
    role: "student",
    threshold: 90,
    setupAuth: false,
    headed: false,
    ci: false,
    mode: "both",
    campId: null,
    stationId: null,
    profileDir: null,
    outputDir: null,
  };

  const takeValue = (index, flag) => {
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`${flag} ต้องมีค่าตามหลัง`);
    }
    return value;
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--setup-auth") options.setupAuth = true;
    else if (argument === "--headed") options.headed = true;
    else if (argument === "--ci") options.ci = true;
    else if (argument === "--help" || argument === "-h") options.help = true;
    else if (argument === "--role") {
      const requestedRole = takeValue(index, argument);
      options.role = ROLE_ALIASES[requestedRole] ?? requestedRole;
      index += 1;
    } else if (argument === "--base-url") {
      options.baseUrl = takeValue(index, argument).replace(/\/$/, "");
      index += 1;
    } else if (argument === "--threshold") {
      options.threshold = Number(takeValue(index, argument));
      index += 1;
    } else if (argument === "--mode") {
      options.mode = takeValue(index, argument);
      index += 1;
    } else if (argument === "--camp-id") {
      options.campId = Number(takeValue(index, argument));
      index += 1;
    } else if (argument === "--station-id") {
      options.stationId = Number(takeValue(index, argument));
      index += 1;
    } else if (argument === "--profile-dir") {
      options.profileDir = path.resolve(takeValue(index, argument));
      index += 1;
    } else if (argument === "--output-dir") {
      options.outputDir = path.resolve(takeValue(index, argument));
      index += 1;
    } else {
      throw new Error(`ไม่รู้จัก option: ${argument}`);
    }
  }

  if (
    !Number.isFinite(options.threshold) ||
    options.threshold < 0 ||
    options.threshold > 100
  ) {
    throw new Error("--threshold ต้องเป็นตัวเลข 0-100");
  }
  if (!["both", "mobile", "desktop"].includes(options.mode)) {
    throw new Error("--mode ต้องเป็น both, mobile หรือ desktop");
  }
  if (!ROLE_CONFIGS[options.role]) {
    throw new Error(`--role ต้องเป็น ${Object.keys(ROLE_CONFIGS).join(", ")}`);
  }
  for (const [flag, value] of [
    ["--camp-id", options.campId],
    ["--station-id", options.stationId],
  ]) {
    if (value !== null && (!Number.isInteger(value) || value <= 0)) {
      throw new Error(`${flag} ต้องเป็นจำนวนเต็มบวก`);
    }
  }

  options.profileDir ??= path.join(
    os.homedir(),
    ".cache",
    "kkscamp-lighthouse",
    `${options.role}-profile`,
  );
  options.outputDir ??= path.resolve(".lighthouse-reports", options.role);

  return options;
}

function printHelp() {
  console.log(`
ตรวจ Lighthouse แยกตาม role ของผู้ใช้งาน

ครั้งแรก (เปิด Chrome ให้ login ด้วย role ที่เลือก แล้วกด Enter ใน terminal):
  npm run lighthouse:student:login
  npm run lighthouse:parent:login
  npm run lighthouse:teacher:login
  npm run lighthouse:headteacher:login
  npm run lighthouse:camp-leader:login
  npm run lighthouse:admin:login

ตรวจทั้ง mobile และ desktop (เลือกคำสั่งตาม role):
  npm run lighthouse:student
  npm run lighthouse:parent
  npm run lighthouse:teacher
  npm run lighthouse:headteacher
  npm run lighthouse:camp-leader
  npm run lighthouse:admin

ตรวจทุก role ต่อกัน (ต้อง setup login ของแต่ละ role ไว้ก่อน):
  npm run lighthouse:all

Options:
  --role <role>          student | parent | teacher | headteacher | camp-leader | admin
  --base-url <url>       ค่าเริ่มต้น https://www.kkscamp.com
  --threshold <0-100>    คะแนนขั้นต่ำ ค่าเริ่มต้น 90
  --mode <mode>          both | mobile | desktop
  --camp-id <id>         ระบุค่ายที่จะใช้แทนการเลือกอัตโนมัติ
  --station-id <id>      ระบุฐานภารกิจที่จะใช้แทนการเลือกอัตโนมัติ
  --output-dir <path>    ที่เก็บ JSON, HTML และ summary.md
  --profile-dir <path>   Chrome profile สำหรับ session ของ role นี้
  --headed               แสดง Chrome ระหว่างตรวจ
  --ci                   exit code 1 เมื่อมีคะแนนต่ำกว่า threshold
`);
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function scoreOf(category) {
  return category?.score == null ? null : Math.round(category.score * 100);
}

function scoreText(score) {
  return score == null ? "-" : String(score);
}

function routeSlug(name) {
  return name
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function pathAndSearch(urlOrPath) {
  const url = new URL(urlOrPath, "https://lighthouse.invalid");
  return `${url.pathname}${url.search}`;
}

function authCookiePath(options) {
  return path.join(options.profileDir, AUTH_COOKIE_FILE);
}

async function saveAuthCookies(page, options) {
  const cookies = await page.cookies(options.baseUrl);
  const cookieFile = authCookiePath(options);

  await fs.writeFile(cookieFile, JSON.stringify(cookies, null, 2), {
    mode: 0o600,
  });
  await fs.chmod(cookieFile, 0o600);
}

async function restoreAuthCookies(page, options) {
  try {
    const serialized = await fs.readFile(authCookiePath(options), "utf8");
    const now = Date.now() / 1_000;
    const cookies = JSON.parse(serialized).filter(
      (cookie) =>
        cookie?.name && (cookie.expires === -1 || cookie.expires > now),
    );

    if (cookies.length > 0) {
      await page.setCookie(...cookies);
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

function getLowAudits(lhr, categoryKey, limit = 5) {
  const category = lhr.categories[categoryKey];
  if (!category) return [];

  return category.auditRefs
    .filter((ref) => ref.weight > 0)
    .map((ref) => lhr.audits[ref.id])
    .filter(
      (audit) =>
        audit &&
        typeof audit.score === "number" &&
        audit.score < 0.9 &&
        !["manual", "notApplicable", "informative"].includes(
          audit.scoreDisplayMode,
        ),
    )
    .sort((left, right) => left.score - right.score)
    .slice(0, limit)
    .map((audit) => ({
      id: audit.id,
      title: audit.title,
      score: Math.round(audit.score * 100),
      displayValue: audit.displayValue ?? null,
    }));
}

async function launchBrowser(options, headed, startingUrl = "about:blank") {
  await fs.mkdir(options.profileDir, { recursive: true });
  // chrome-launcher may otherwise read a stale port left by an interrupted run.
  await fs.rm(path.join(options.profileDir, "DevToolsActivePort"), {
    force: true,
  });
  await fs.writeFile(path.join(options.profileDir, "chrome-err.log"), "");
  await fs.writeFile(path.join(options.profileDir, "chrome-out.log"), "");

  const chromeFlags = [
    ...Launcher.defaultFlags().filter(
      (flag) =>
        flag !== "--use-mock-keychain" && flag !== "--password-store=basic",
    ),
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-dev-shm-usage",
    "--profile-directory=Default",
  ];
  if (!headed) chromeFlags.push("--headless=new");

  const chrome = await launch({
    userDataDir: options.profileDir,
    startingUrl,
    chromeFlags,
    ignoreDefaultFlags: true,
    logLevel: "error",
  });
  const browser = await puppeteer.connect({
    browserURL: `http://127.0.0.1:${chrome.port}`,
  });

  return { chrome, browser };
}

async function setupAuth(options) {
  const roleConfig = ROLE_CONFIGS[options.role];
  const dashboardUrl = `${options.baseUrl}${roleConfig.dashboardPath}`;
  const { chrome, browser } = await launchBrowser(options, true, dashboardUrl);

  try {
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    const pages = await browser.pages();
    let page = pages[0] ?? (await browser.newPage());
    if (page.url() !== dashboardUrl) {
      await page.goto(dashboardUrl, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
    }

    const terminal = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    await terminal.question(
      `ล็อกอินด้วยบัญชี${roleConfig.label}ใน Chrome ที่เปิดขึ้นมา แล้วกลับมากด Enter ที่นี่... `,
    );
    terminal.close();

    // Clerk/Google OAuth can finish in a new tab and close the original tab.
    // Re-select the authenticated app tab before navigating or reading cookies.
    const openPages = (await browser.pages()).filter(
      (candidate) => !candidate.isClosed(),
    );
    page =
      openPages.toReversed().find((candidate) => {
        try {
          const candidateUrl = new URL(candidate.url());
          return (
            candidateUrl.origin === new URL(options.baseUrl).origin &&
            matchesAllowedPath(candidateUrl.pathname, roleConfig)
          );
        } catch {
          return false;
        }
      }) ??
      openPages.at(-1) ??
      (await browser.newPage());

    const selectedUrl = new URL(page.url());
    const isAlreadyOnRolePage =
      selectedUrl.origin === new URL(options.baseUrl).origin &&
      matchesAllowedPath(selectedUrl.pathname, roleConfig);
    if (!isAlreadyOnRolePage) {
      await page.goto(dashboardUrl, {
        waitUntil: "networkidle2",
        timeout: 60_000,
      });
    }

    await assertRoleSession(page, options);

    await saveAuthCookies(page, options);
    console.log(
      `บันทึก session ${roleConfig.label}แล้วที่ ${options.profileDir}`,
    );
  } finally {
    await browser.disconnect();
    await chrome.kill();
  }
}

async function fetchJsonInPage(page, url) {
  return page.evaluate(async (requestUrl) => {
    const response = await fetch(requestUrl, {
      cache: "no-store",
      credentials: "include",
    });
    const body = await response.json().catch(() => null);
    return { ok: response.ok, status: response.status, body };
  }, url);
}

function matchesAllowedPath(pathname, roleConfig) {
  return roleConfig.allowedPathPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix),
  );
}

async function assertRoleSession(page, options) {
  const roleConfig = ROLE_CONFIGS[options.role];
  const currentUrl = new URL(page.url());
  if (
    currentUrl.origin !== new URL(options.baseUrl).origin ||
    !matchesAllowedPath(currentUrl.pathname, roleConfig)
  ) {
    throw new Error(
      `ยังไม่พบ session ${roleConfig.label} (หน้าเว็บอยู่ที่ ${currentUrl.pathname}) กรุณารัน \`npm run lighthouse:${options.role}:login\` ก่อน`,
    );
  }

  const meResponse = await fetchJsonInPage(page, roleConfig.authCheckPath);
  if (!meResponse.ok) {
    throw new Error(
      `ตรวจสอบ session ${roleConfig.label}ไม่สำเร็จ (HTTP ${meResponse.status}) กรุณา login ใหม่`,
    );
  }

  if (roleConfig.expectedRole || roleConfig.expectedDerivedRole) {
    const actualRole = String(meResponse.body?.role ?? "").toUpperCase();
    const derivedRoles = Array.isArray(meResponse.body?.roles)
      ? meResponse.body.roles.map((role) => String(role).toUpperCase())
      : [];
    if (roleConfig.expectedRole && actualRole !== roleConfig.expectedRole) {
      throw new Error(
        `session นี้เป็น role ${actualRole || "UNKNOWN"} แต่คำสั่งต้องการ ${roleConfig.expectedRole}`,
      );
    }
    if (
      roleConfig.expectedDerivedRole &&
      !derivedRoles.includes(roleConfig.expectedDerivedRole)
    ) {
      throw new Error(
        `บัญชีนี้ไม่มีสิทธิ์ ${roleConfig.expectedDerivedRole} (พบ ${derivedRoles.join(", ") || "none"})`,
      );
    }
  }
}

function chooseCamp(camps, options, getId) {
  if (options.campId) {
    const selectedCamp = camps.find(
      (camp) => Number(getId(camp)) === options.campId,
    );
    if (!selectedCamp) {
      throw new Error(`ไม่พบค่าย ID ${options.campId} ที่ role นี้เข้าถึงได้`);
    }
    return selectedCamp;
  }

  return (
    camps.find((camp) => camp.isOwner && !camp.isEnded) ??
    camps.find((camp) => camp.isRegistered && !camp.isEnded) ??
    camps.find((camp) => camp.isOwner) ??
    camps.find((camp) => camp.isRegistered) ??
    camps[0] ??
    null
  );
}

async function discoverStudentRoutes(page, options) {
  const routes = [
    { name: "dashboard", path: "/student/dashboard" },
    { name: "profile", path: "/student/profile" },
  ];

  const campsResponse = await fetchJsonInPage(page, "/api/student/camps");
  if (!campsResponse.ok || !Array.isArray(campsResponse.body)) {
    throw new Error(`โหลดรายการค่ายไม่สำเร็จ (HTTP ${campsResponse.status})`);
  }

  const camps = campsResponse.body;
  const selectedCamp = chooseCamp(camps, options, (camp) => camp.id);

  if (!selectedCamp)
    return { routes, selectedCamp: null, selectedStation: null };

  const campId = Number(selectedCamp.id);
  const campPublicId = selectedCamp.publicId;
  routes.push(
    { name: "camp-detail", path: `/student/dashboard/camp/${campPublicId}` },
    { name: "camp-bus", path: `/student/dashboard/camp/${campPublicId}/bus` },
  );

  let selectedStation = null;
  if (selectedCamp.isRegistered) {
    const missionsResponse = await fetchJsonInPage(
      page,
      `/api/student/camps/${campId}/missions`,
    );

    if (missionsResponse.ok) {
      routes.push({
        name: "camp-missions",
        path: `/student/dashboard/camp/${campPublicId}/missions`,
      });

      const stations = Array.isArray(missionsResponse.body?.station)
        ? missionsResponse.body.station
        : [];
      selectedStation = options.stationId
        ? stations.find(
            (station) => Number(station.station_id) === options.stationId,
          )
        : stations[0];

      if (options.stationId && !selectedStation) {
        throw new Error(
          `ไม่พบฐานภารกิจ ID ${options.stationId} ในค่าย ${campId}`,
        );
      }

      if (selectedStation) {
        routes.push({
          name: "mission-station",
          path: `/student/dashboard/camp/${campPublicId}/missions/${selectedStation.publicId}`,
        });
      }
    }
  }

  if (selectedCamp.hasSurvey && selectedCamp.isRegistered) {
    const surveyResponse = await fetchJsonInPage(
      page,
      `/api/student/surveys?campId=${campId}`,
    );
    if (
      surveyResponse.ok &&
      surveyResponse.body?.survey &&
      !surveyResponse.body.isCompleted
    ) {
      routes.push({
        name: "camp-survey",
        path: `/student/dashboard/camp/${campPublicId}/survey`,
      });
    }
  }

  return { routes, selectedCamp, selectedStation };
}

async function discoverParentRoutes(page, options) {
  const routes = [
    { name: "dashboard", path: "/parent/dashboard" },
    { name: "profile", path: "/parent/profile" },
    { name: "student", path: "/parent/student" },
  ];
  const campsResponse = await fetchJsonInPage(page, "/api/parent/camps");
  if (!campsResponse.ok || !Array.isArray(campsResponse.body)) {
    throw new Error(`โหลดรายการค่ายไม่สำเร็จ (HTTP ${campsResponse.status})`);
  }

  const selectedCamp = chooseCamp(
    campsResponse.body,
    options,
    (camp) => camp.id,
  );
  if (selectedCamp) {
    routes.push({
      name: "camp-detail",
      path: `/parent/dashboard/camp/${selectedCamp.id}`,
    });
  }

  return { routes, selectedCamp, selectedStation: null };
}

async function discoverTeacherRoutes(page, options) {
  const routes = [
    { name: "dashboard", path: "/headteacher/dashboard" },
    { name: "dashboard-homeroom", path: "/headteacher/dashboard?tab=homeroom" },
    { name: "dashboard-camp", path: "/headteacher/dashboard?tab=camp" },
    { name: "profile", path: "/headteacher/profile" },
  ];
  const campsResponse = await fetchJsonInPage(page, "/api/camps");
  if (!campsResponse.ok || !Array.isArray(campsResponse.body)) {
    throw new Error(`โหลดรายการค่ายไม่สำเร็จ (HTTP ${campsResponse.status})`);
  }

  const selectedCamp = chooseCamp(
    campsResponse.body,
    options,
    (camp) => camp.camp_id,
  );
  if (!selectedCamp) {
    return { routes, selectedCamp: null, selectedStation: null };
  }

  const campId = Number(selectedCamp.camp_id);
  const campPrefix = "/headteacher/dashboard/camp";
  // The public camp pages use clean URLs and an active-camp cookie. Visiting
  // the legacy ID URL once creates the same context as selecting a camp in UI.
  await page.goto(`${options.baseUrl}${campPrefix}/${campId}`, {
    waitUntil: "networkidle2",
    timeout: 60_000,
  });
  const accessResponse = await fetchJsonInPage(
    page,
    `/api/camps/${campId}/access`,
  );
  if (!accessResponse.ok) {
    throw new Error(`โหลดสิทธิ์ค่ายไม่สำเร็จ (HTTP ${accessResponse.status})`);
  }
  const access = accessResponse.body ?? {};

  routes.push(
    { name: "camp-detail", path: `${campPrefix}/overview` },
    { name: "camp-students", path: `${campPrefix}/students` },
    { name: "camp-tracking", path: `${campPrefix}/tracking` },
    { name: "camp-location", path: `${campPrefix}/location` },
    { name: "camp-attendance", path: `${campPrefix}/attendance` },
  );

  if (access.isOwner || access.isHomeroomTeacher) {
    routes.push({ name: "camp-shirts", path: `${campPrefix}/shirts` });
  }
  if (
    access.hasTransport &&
    (access.isOwner || access.isHomeroomTeacher || access.isBusTeacher)
  ) {
    routes.push({ name: "camp-bus", path: `${campPrefix}/bus-checkin` });
  }
  if (access.isOwner) {
    routes.push(
      { name: "camp-bases", path: `${campPrefix}/bases` },
      { name: "camp-score-comparison", path: `${campPrefix}/score-comparison` },
      { name: "camp-project-document", path: `${campPrefix}/project-document` },
      {
        name: "camp-project-summary-document",
        path: `${campPrefix}/project-summary-document`,
      },
      { name: "camp-survey", path: `${campPrefix}/survey` },
      { name: "camp-survey-results", path: `${campPrefix}/survey/results` },
      { name: "camp-certificate", path: `${campPrefix}/certificate` },
    );

    const basesResponse = await fetchJsonInPage(
      page,
      `/api/camps/${campId}?view=bases`,
    );
    const stations = Array.isArray(basesResponse.body?.station)
      ? basesResponse.body.station
      : [];
    const selectedStation = options.stationId
      ? stations.find(
          (station) => Number(station.station_id) === options.stationId,
        )
      : stations[0];
    if (options.stationId && !selectedStation) {
      throw new Error(
        `ไม่พบฐานภารกิจ ID ${options.stationId} ในค่าย ${campId}`,
      );
    }
    if (selectedStation) {
      await page.goto(
        `${options.baseUrl}${campPrefix}/${campId}/base/${selectedStation.station_id}`,
        { waitUntil: "networkidle2", timeout: 60_000 },
      );
      routes.push({ name: "camp-base-detail", path: `${campPrefix}/base` });
    }

    const trackingResponse = await fetchJsonInPage(
      page,
      `/api/camps/${campId}/tracking`,
    );
    const selectedStudent = Array.isArray(trackingResponse.body?.students)
      ? trackingResponse.body.students[0]
      : null;
    if (selectedStudent) {
      await page.goto(
        `${options.baseUrl}${campPrefix}/${campId}/tracking/${selectedStudent.studentId}`,
        { waitUntil: "networkidle2", timeout: 60_000 },
      );
      routes.push({
        name: "camp-tracking-student",
        path: `${campPrefix}/tracking/student`,
      });
    }

    return { routes, selectedCamp, selectedStation };
  }

  return { routes, selectedCamp, selectedStation: null };
}

async function discoverAdminRoutes(page, options) {
  const discovery = await discoverTeacherRoutes(page, options);
  const adminRoutes = [
    { name: "admin-overview", path: "/admin_add_user" },
    { name: "admin-teachers", path: "/admin_add_user?tab=teacher" },
    { name: "admin-document-data", path: "/admin_add_user?tab=documentdata" },
    { name: "admin-classrooms", path: "/admin_add_user?tab=classroom" },
    { name: "admin-students", path: "/admin_add_user?tab=student" },
    { name: "admin-camps", path: "/admin_add_user?tab=camp" },
    { name: "admin-bus-layouts", path: "/admin_add_user?tab=buslayout" },
    { name: "admin-vulgar-words", path: "/admin_add_user?tab=vulgarwords" },
    { name: "admin-promote-students", path: "/admin_promote_students" },
    { name: "admin-graduated-students", path: "/admin_graduated_students" },
    { name: "admin-profile", path: "/admin_add_user/profile" },
  ];

  return { ...discovery, routes: [...adminRoutes, ...discovery.routes] };
}

async function discoverRoutes(page, options) {
  const roleConfig = ROLE_CONFIGS[options.role];
  await page.goto(`${options.baseUrl}${roleConfig.dashboardPath}`, {
    waitUntil: "networkidle2",
    timeout: 60_000,
  });
  await assertRoleSession(page, options);

  if (options.role === "student") return discoverStudentRoutes(page, options);
  if (options.role === "parent") return discoverParentRoutes(page, options);
  if (options.role === "admin") return discoverAdminRoutes(page, options);
  return discoverTeacherRoutes(page, options);
}

function summarizeLhr(lhr, route, mode, threshold) {
  const scores = Object.fromEntries(
    SCORE_KEYS.map((key) => [key, scoreOf(lhr.categories[key])]),
  );
  const belowThreshold = Object.entries(scores)
    .filter(([, score]) => score != null && score < threshold)
    .map(([key, score]) => ({ key, score }));
  const metrics = Object.fromEntries(
    METRIC_IDS.map((id) => [id, lhr.audits[id]?.displayValue ?? null]),
  );
  const lowAudits = Object.fromEntries(
    belowThreshold.map(({ key }) => [key, getLowAudits(lhr, key)]),
  );

  return {
    route: route.name,
    requestedPath: route.path,
    finalUrl: lhr.finalDisplayedUrl,
    mode,
    scores,
    belowThreshold,
    metrics,
    lowAudits,
    fetchTime: lhr.fetchTime,
  };
}

function markdownSummary(summary) {
  const lines = [
    `# ${ROLE_CONFIGS[summary.role].label} Lighthouse summary`,
    "",
    `- Role: ${summary.role}`,
    `- Base URL: ${summary.baseUrl}`,
    `- Threshold: ${summary.threshold}`,
    `- Generated: ${summary.generatedAt}`,
    `- Representative camp: ${summary.discovery.campId ?? "none"}`,
    `- Representative station: ${summary.discovery.stationId ?? "none"}`,
    "",
    "| Mode | Page | Performance | Accessibility | Best Practices | SEO |",
    "| --- | --- | ---: | ---: | ---: | ---: |",
  ];

  for (const result of summary.results) {
    lines.push(
      `| ${result.mode} | ${result.requestedPath} | ${scoreText(result.scores.performance)} | ${scoreText(result.scores.accessibility)} | ${scoreText(result.scores["best-practices"])} | ${scoreText(result.scores.seo)} |`,
    );
  }

  lines.push("", `## Pages below ${summary.threshold}`, "");
  const lowResults = summary.results.filter((result) => {
    const finalPath = pathAndSearch(result.finalUrl);
    return (
      finalPath === pathAndSearch(result.requestedPath) &&
      result.belowThreshold.length > 0
    );
  });
  if (lowResults.length === 0) {
    lines.push("None.");
  } else {
    for (const result of lowResults) {
      const scores = result.belowThreshold
        .map(({ key, score }) => `${SCORE_LABELS[key]} ${score}`)
        .join(", ");
      lines.push(`- **${result.mode} ${result.requestedPath}**: ${scores}`);

      for (const { key } of result.belowThreshold) {
        const audits = result.lowAudits[key] ?? [];
        for (const audit of audits.slice(0, 3)) {
          const detail = audit.displayValue ? ` — ${audit.displayValue}` : "";
          lines.push(
            `  - ${SCORE_LABELS[key]}: ${audit.title} (${audit.score})${detail}`,
          );
        }
      }
    }
  }

  const redirects = summary.results.filter((result) => {
    const finalPath = pathAndSearch(result.finalUrl);
    return finalPath !== pathAndSearch(result.requestedPath);
  });
  if (redirects.length > 0) {
    lines.push("", "## Redirected routes", "");
    for (const result of redirects) {
      lines.push(
        `- ${result.mode} ${result.requestedPath} → ${pathAndSearch(result.finalUrl)}`,
      );
    }
  }

  return `${lines.join("\n")}\n`;
}

async function runAudits(options) {
  const runDir = path.join(options.outputDir, timestamp());
  await fs.mkdir(runDir, { recursive: true });

  const { chrome, browser } = await launchBrowser(options, options.headed);
  const results = [];

  try {
    const discoveryPage = await browser.newPage();

    await restoreAuthCookies(discoveryPage, options);

    // CI/local preview can provide the app's signed role cookie without an
    // interactive login. The value is intentionally accepted only via env so
    // it never appears in command history or generated reports.
    const roleConfig = ROLE_CONFIGS[options.role];
    const sessionValue = process.env[roleConfig.sessionEnv];
    if (sessionValue) {
      await discoveryPage.setCookie({
        name: roleConfig.cookieName,
        value: sessionValue,
        url: options.baseUrl,
        httpOnly: true,
        secure: options.baseUrl.startsWith("https://"),
        sameSite: "Lax",
      });
    }

    const discovery = await discoverRoutes(discoveryPage, options);
    await discoveryPage.close();

    const modes =
      options.mode === "both" ? ["mobile", "desktop"] : [options.mode];
    console.log(
      `พบ ${discovery.routes.length} หน้า: ${discovery.routes.map((route) => route.path).join(", ")}`,
    );

    for (const mode of modes) {
      for (const route of discovery.routes) {
        const url = new URL(route.path, options.baseUrl).href;
        console.log(`[${mode}] ${route.path}`);

        const runnerResult = await lighthouse(
          url,
          {
            port: chrome.port,
            logLevel: "error",
            output: "json",
            onlyCategories: SCORE_KEYS,
            disableStorageReset: true,
          },
          mode === "desktop" ? desktopConfig : undefined,
        );

        if (!runnerResult?.lhr) {
          throw new Error("Lighthouse ไม่คืนผลการตรวจ");
        }

        const filePrefix = `${mode}-${routeSlug(route.name)}`;
        await Promise.all([
          fs.writeFile(
            path.join(runDir, `${filePrefix}.json`),
            JSON.stringify(runnerResult.lhr, null, 2),
          ),
          fs.writeFile(
            path.join(runDir, `${filePrefix}.html`),
            generateReport(runnerResult.lhr, "html"),
          ),
        ]);

        const result = summarizeLhr(
          runnerResult.lhr,
          route,
          mode,
          options.threshold,
        );
        if (
          pathAndSearch(result.finalUrl) !== pathAndSearch(result.requestedPath)
        ) {
          throw new Error(
            `${route.path} ไปจบที่ ${pathAndSearch(result.finalUrl)} แทนหน้าที่ต้องตรวจ`,
          );
        }
        results.push(result);
        console.log(
          `  P ${scoreText(result.scores.performance)} / A ${scoreText(result.scores.accessibility)} / BP ${scoreText(result.scores["best-practices"])} / SEO ${scoreText(result.scores.seo)}`,
        );
      }
    }

    const summary = {
      role: options.role,
      baseUrl: options.baseUrl,
      threshold: options.threshold,
      generatedAt: new Date().toISOString(),
      discovery: {
        campId:
          discovery.selectedCamp?.id ?? discovery.selectedCamp?.camp_id ?? null,
        stationId: discovery.selectedStation?.station_id ?? null,
      },
      results,
    };

    await Promise.all([
      fs.writeFile(
        path.join(runDir, "summary.json"),
        JSON.stringify(summary, null, 2),
      ),
      fs.writeFile(path.join(runDir, "summary.md"), markdownSummary(summary)),
    ]);

    const lowResults = results.filter((result) => {
      const finalPath = pathAndSearch(result.finalUrl);
      return (
        finalPath === pathAndSearch(result.requestedPath) &&
        result.belowThreshold.length > 0
      );
    });
    console.log(
      `\nสรุป: ${lowResults.length}/${results.length} รายการต่ำกว่า ${options.threshold}`,
    );
    console.log(`รายงาน: ${path.join(runDir, "summary.md")}`);

    if (options.ci && lowResults.length > 0) process.exitCode = 1;
  } finally {
    await browser.disconnect();
    await chrome.kill();
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  if (options.setupAuth) await setupAuth(options);
  else await runAudits(options);
}

main().catch((error) => {
  console.error(`\nLighthouse audit ล้มเหลว: ${error.message}`);
  process.exitCode = 1;
});
