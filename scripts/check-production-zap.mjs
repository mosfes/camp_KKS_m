#!/usr/bin/env node

// Read-only checks for the public response headers cited in the student ZAP report.
// Authenticated pages must be checked separately in the signed-in browser.

const origin = "https://www.kkscamp.com";
const checks = [];

async function response(path) {
  const url = new URL(path, origin);
  url.searchParams.set("security_check", Date.now().toString());
  return fetch(url, { cache: "no-store", redirect: "manual" });
}

function check(scope, label, passed) {
  checks.push({ scope, check: label, result: passed ? "PASS" : "FAIL" });
}

const page = await response("/about");
const html = await page.text();
const pageHeaders = page.headers;
check("HTML", "HTTP 200", page.status === 200);
check("HTML", "CSP", Boolean(pageHeaders.get("content-security-policy")));
check("HTML", "anti-clickjacking", pageHeaders.get("x-frame-options") === "SAMEORIGIN");
check("HTML", "nosniff", pageHeaders.get("x-content-type-options") === "nosniff");
check("HTML", "HSTS", Boolean(pageHeaders.get("strict-transport-security")));
check("HTML", "CORS origin", pageHeaders.get("access-control-allow-origin") === origin);
check("HTML", "no X-Powered-By", !pageHeaders.has("x-powered-by"));
check("HTML", "HTML MIME", pageHeaders.get("content-type")?.includes("text/html"));

const scriptPath = html.match(/<script[^>]+src="([^"]+\.js[^"]*)"/)?.[1];
if (scriptPath) {
  const script = await response(scriptPath);
  check("JavaScript", "HTTP 200", script.status === 200);
  check("JavaScript", "CORS origin", script.headers.get("access-control-allow-origin") === origin);
  check("JavaScript", "nosniff", script.headers.get("x-content-type-options") === "nosniff");
  check("JavaScript", "HSTS", Boolean(script.headers.get("strict-transport-security")));
  check("JavaScript", "JavaScript MIME", script.headers.get("content-type")?.includes("javascript"));
} else {
  check("JavaScript", "asset found", false);
}

const manifest = await response("/manifest.webmanifest");
check("Manifest", "HTTP 200", manifest.status === 200);
check("Manifest", "manifest MIME", manifest.headers.get("content-type")?.includes("application/manifest+json"));
check("Manifest", "nosniff", manifest.headers.get("x-content-type-options") === "nosniff");
check("Manifest", "HSTS", Boolean(manifest.headers.get("strict-transport-security")));

console.table(checks);
const failures = checks.filter((item) => item.result === "FAIL");
console.log(`${checks.length - failures.length}/${checks.length} checks passed`);
if (failures.length) process.exitCode = 1;
