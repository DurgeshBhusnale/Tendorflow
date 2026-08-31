/**
 * Headless UI smoke test.
 *
 * Logs in, walks every page, screenshots each one, and reports any console
 * errors or failed network requests. Run with both dev servers up:
 *
 *   node scripts/smoke.mjs [email] [password]
 *
 * Screenshots land in scripts/screenshots/.
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:5173";
const EMAIL = process.argv[2] ?? "priya.admin@tenderflow-demo.com";
const PASSWORD = process.argv[3] ?? "AdminPass123";
const OUT = new URL("./screenshots/", import.meta.url).pathname.replace(/^\//, "");

mkdirSync(OUT, { recursive: true });

const consoleErrors = [];
const failedRequests = [];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(`${page.url()} :: ${msg.text()}`);
});
page.on("requestfailed", (req) => {
  failedRequests.push(`${req.method()} ${req.url()} :: ${req.failure()?.errorText}`);
});
page.on("response", (res) => {
  if (res.status() >= 400) failedRequests.push(`HTTP ${res.status()} ${res.url()}`);
});

async function shot(name) {
  await page.screenshot({ path: `${OUT}${name}.png`, fullPage: true });
  console.log(`  screenshot: ${name}.png`);
}

/** Wait until every "Loading…" placeholder has cleared. */
async function waitForLoaded() {
  // Wait for a positive signal that data arrived rather than for the loading
  // text to vanish — checking for its absence races with React's first render.
  await page.waitForFunction(
    () => {
      const text = document.body.innerText;
      return text.length > 0 && !text.includes("Loading…");
    },
    null,
    { timeout: 30000, polling: 200 },
  );
  await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
}

async function visit(path, waitForText) {
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
  if (waitForText) {
    await page.getByText(waitForText, { exact: false }).first().waitFor({ timeout: 20000 });
  }
  await waitForLoaded();
}

console.log("1. Login page");
await visit("/", "Sign in");
await shot("01-login");

console.log("2. Signing in as", EMAIL);
await page.getByLabel("Email").fill(EMAIL);
await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
await page.getByRole("button", { name: "Sign In" }).click();
await page.waitForURL("**/dashboard", { timeout: 20000 });
await waitForLoaded();
await shot("02-dashboard");

const pages = [
  ["/clients", "Clients", "03-clients"],
  ["/credentials", "Credentials", "04-credentials"],
  ["/tenders", "Tenders", "05-tenders"],
  ["/dsc", "DSC Keys", "06-dsc"],
  ["/admin/users", "Users", "07-admin-users"],
  ["/admin/portals", "Portals", "08-admin-portals"],
  ["/admin/tender-names", "Tender Names", "09-admin-tender-names"],
];

for (const [path, heading, name] of pages) {
  console.log(`3. ${path}`);
  await visit(path, heading);
  await shot(name);
}

// Prove the credentials click-to-reveal actually calls the per-row endpoint.
console.log("4. Credentials click-to-reveal");
await visit("/credentials", "Credentials");
const revealButton = page.getByRole("button", { name: "Reveal" }).first();
if (await revealButton.count()) {
  await revealButton.click();
  await page.getByRole("button", { name: "Hide" }).first().waitFor({ timeout: 20000 });
  await shot("10-credentials-revealed");
} else {
  console.log("  !! no Reveal button found — credentials table may be empty");
  process.exitCode = 1;
}

await browser.close();

console.log("\n=== RESULT ===");
if (consoleErrors.length) {
  console.log(`console errors (${consoleErrors.length}):`);
  consoleErrors.forEach((e) => console.log("  -", e));
} else {
  console.log("console errors: none");
}
if (failedRequests.length) {
  console.log(`failed/4xx-5xx requests (${failedRequests.length}):`);
  failedRequests.forEach((e) => console.log("  -", e));
} else {
  console.log("failed requests: none");
}
process.exit(consoleErrors.length || failedRequests.length ? 1 : 0);
