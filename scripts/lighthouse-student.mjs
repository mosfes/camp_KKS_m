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

function parseArgs(argv) {
  const options = {
    baseUrl: "https://www.kkscamp.com",
    threshold: 90,
    setupAuth: false,
    headed: false,
    ci: false,
    mode: "both",
    campId: null,
    stationId: null,
    profileDir: path.join(
      os.homedir(),
      ".cache",
      "kkscamp-lighthouse",
      "student-profile",
    ),
    outputDir: path.resolve(".lighthouse-reports", "student"),
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
    else if (argument === "--base-url") {
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

  return options;
}

function printHelp() {
  console.log(`
ตรวจ Lighthouse เฉพาะ route ฝั่งนักเรียน

ครั้งแรก (เปิด Chrome ให้ login แล้วกด Enter ใน terminal):
  npm run lighthouse:student:login

ตรวจทั้ง mobile และ desktop:
  npm run lighthouse:student

Options:
  --base-url <url>       ค่าเริ่มต้น https://www.kkscamp.com
  --threshold <0-100>    คะแนนขั้นต่ำ ค่าเริ่มต้น 90
  --mode <mode>          both | mobile | desktop
  --camp-id <id>         ระบุค่ายที่จะใช้แทนการเลือกอัตโนมัติ
  --station-id <id>      ระบุฐานภารกิจที่จะใช้แทนการเลือกอัตโนมัติ
  --output-dir <path>    ที่เก็บ JSON, HTML และ summary.md
  --profile-dir <path>   Chrome profile สำหรับ session นักเรียน
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
  const dashboardUrl = `${options.baseUrl}/student/dashboard`;
  const { chrome, browser } = await launchBrowser(options, true, dashboardUrl);

  try {
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    const pages = await browser.pages();
    const page = pages[0] ?? (await browser.newPage());
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
      "ล็อกอินด้วยบัญชีนักเรียนใน Chrome ที่เปิดขึ้นมา แล้วกลับมากด Enter ที่นี่... ",
    );
    terminal.close();

    await page.goto(dashboardUrl, {
      waitUntil: "networkidle2",
      timeout: 60_000,
    });

    const currentUrl = new URL(page.url());
    if (
      currentUrl.origin !== new URL(options.baseUrl).origin ||
      !currentUrl.pathname.startsWith("/student/")
    ) {
      throw new Error(
        `ยังไม่พบ session นักเรียน (หน้าเว็บอยู่ที่ ${currentUrl.pathname})`,
      );
    }

    console.log(`บันทึก session นักเรียนแล้วที่ ${options.profileDir}`);
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

async function discoverRoutes(page, options) {
  await page.goto(`${options.baseUrl}/student/dashboard`, {
    waitUntil: "networkidle2",
    timeout: 60_000,
  });

  const currentUrl = new URL(page.url());
  if (
    currentUrl.origin !== new URL(options.baseUrl).origin ||
    !currentUrl.pathname.startsWith("/student/")
  ) {
    throw new Error(
      "ไม่พบ session นักเรียน กรุณารัน `npm run lighthouse:student:login` ก่อน",
    );
  }

  const routes = [
    { name: "dashboard", path: "/student/dashboard" },
    { name: "profile", path: "/student/profile" },
  ];

  const campsResponse = await fetchJsonInPage(page, "/api/student/camps");
  if (!campsResponse.ok || !Array.isArray(campsResponse.body)) {
    throw new Error(`โหลดรายการค่ายไม่สำเร็จ (HTTP ${campsResponse.status})`);
  }

  const camps = campsResponse.body;
  const selectedCamp = options.campId
    ? camps.find((camp) => Number(camp.id) === options.campId)
    : (camps.find((camp) => camp.isRegistered && !camp.isEnded) ??
      camps.find((camp) => camp.isRegistered) ??
      camps[0]);

  if (!selectedCamp)
    return { routes, selectedCamp: null, selectedStation: null };

  const campId = Number(selectedCamp.id);
  routes.push(
    { name: "camp-detail", path: `/student/dashboard/camp/${campId}` },
    { name: "camp-bus", path: `/student/dashboard/camp/${campId}/bus` },
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
        path: `/student/dashboard/camp/${campId}/missions`,
      });

      const stations = Array.isArray(missionsResponse.body?.station)
        ? missionsResponse.body.station
        : [];
      selectedStation = options.stationId
        ? stations.find(
            (station) => Number(station.station_id) === options.stationId,
          )
        : stations[0];

      if (selectedStation) {
        routes.push({
          name: "mission-station",
          path: `/student/dashboard/camp/${campId}/missions/${selectedStation.station_id}`,
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
        path: `/student/dashboard/camp/${campId}/survey`,
      });
    }
  }

  return { routes, selectedCamp, selectedStation };
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
    "# Student Lighthouse summary",
    "",
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
    const finalPath = new URL(result.finalUrl).pathname;
    return (
      finalPath === result.requestedPath && result.belowThreshold.length > 0
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
    const finalPath = new URL(result.finalUrl).pathname;
    return finalPath !== result.requestedPath;
  });
  if (redirects.length > 0) {
    lines.push("", "## Redirected routes", "");
    for (const result of redirects) {
      lines.push(
        `- ${result.mode} ${result.requestedPath} → ${new URL(result.finalUrl).pathname}`,
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

    // CI/local preview can provide the app's signed student cookie without an
    // interactive login. The value is intentionally accepted only via env so
    // it never appears in command history or generated reports.
    if (process.env.KKS_LIGHTHOUSE_STUDENT_SESSION) {
      await discoveryPage.setCookie({
        name: "student_session",
        value: process.env.KKS_LIGHTHOUSE_STUDENT_SESSION,
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
        results.push(result);
        console.log(
          `  P ${scoreText(result.scores.performance)} / A ${scoreText(result.scores.accessibility)} / BP ${scoreText(result.scores["best-practices"])} / SEO ${scoreText(result.scores.seo)}`,
        );
      }
    }

    const summary = {
      baseUrl: options.baseUrl,
      threshold: options.threshold,
      generatedAt: new Date().toISOString(),
      discovery: {
        campId: discovery.selectedCamp?.id ?? null,
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
      const finalPath = new URL(result.finalUrl).pathname;
      return (
        finalPath === result.requestedPath && result.belowThreshold.length > 0
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
  console.error(`\nLighthouse student audit ล้มเหลว: ${error.message}`);
  process.exitCode = 1;
});
