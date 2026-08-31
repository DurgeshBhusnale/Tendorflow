/**
 * Headless mobile UI smoke test.
 *
 * The companion to smoke.mjs, which only ever exercises a 1440px desktop. This
 * one drives a real device profile (iPhone 12, 390x844, touch) through the same
 * pages, plus the two things that only exist below `lg`: the off-canvas nav rail
 * and a full-bleed drawer.
 *
 * Beyond console and network errors it asserts the layout itself: no element may
 * extend past the right edge of the viewport, and the document must not scroll
 * horizontally. A single overflowing element breaks a mobile layout in a way
 * that is easy to miss by eye, and trivial to catch here.
 *
 * Run with both dev servers up:
 *
 *   node scripts/smoke-mobile.mjs [email] [password]
 *
 * Screenshots land in scripts/screenshots/mobile/.
 */
import { mkdirSync } from "node:fs";
import { chromium, devices } from "playwright";

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:5173";
const EMAIL = process.argv[2] ?? "priya.admin@tenderflow-demo.com";
const PASSWORD = process.argv[3] ?? "AdminPass123";
const OUT = new URL("./screenshots/mobile/", import.meta.url).pathname.replace(/^\//, "");

mkdirSync(OUT, { recursive: true });

const consoleErrors = [];
const failedRequests = [];
const layoutProblems = [];

const browser = await chromium.launch();
const context = await browser.newContext(devices["iPhone 12"]);
const page = await context.newPage();

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

/**
 * Only the right edge is checked. The nav rail sits at a negative x when closed,
 * which is deliberate, so a left-edge check would flag it on every page.
 */
async function checkLayout(label) {
  const result = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const overflowing = [];
    for (const el of document.querySelectorAll("body *")) {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.right > vw + 1) {
        const cls = typeof el.className === "string" ? el.className.slice(0, 60) : "";
        overflowing.push(
          `<${el.tagName.toLowerCase()} class="${cls}"> right=${Math.round(rect.right)} vw=${vw}`,
        );
      }
    }
    return {
      overflowing: overflowing.slice(0, 5),
      scrollsHorizontally:
        document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });

  if (result.scrollsHorizontally) {
    layoutProblems.push(`${label} :: document scrolls horizontally`);
  }
  for (const el of result.overflowing) {
    layoutProblems.push(`${label} :: overflows viewport ${el}`);
  }
  if (!result.scrollsHorizontally && result.overflowing.length === 0) {
    console.log("  layout: fits viewport");
  }
}

/**
 * Resolve once the nav rail has finished sliding into `state` ("open" or
 * "closed"), allowing for its 200ms transition. Returns false if it never does.
 */
async function railSettles(state) {
  return page
    .waitForFunction(
      (want) => {
        const el = document.querySelector("aside");
        if (!el) return false;
        const { left, right } = el.getBoundingClientRect();
        return want === "open" ? left >= -1 : right <= 1;
      },
      state,
      { timeout: 5000, polling: 100 },
    )
    .then(() => true)
    .catch(() => false);
}

/** Wait until every "Loading…" placeholder has cleared. */
async function waitForLoaded() {
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
await checkLayout("/");

console.log("2. Signing in as", EMAIL);
await page.getByLabel("Email").fill(EMAIL);
await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
await page.getByRole("button", { name: "Sign In" }).click();
await page.waitForURL("**/dashboard", { timeout: 20000 });
await waitForLoaded();
await shot("02-dashboard");
await checkLayout("/dashboard");

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
  await checkLayout(path);
}

// The off-canvas rail is mobile-only, so smoke.mjs never reaches it.
console.log("4. Off-canvas navigation");
await visit("/tenders", "Tenders");
await page.getByRole("button", { name: "Open navigation" }).click();
if (!(await railSettles("open"))) {
  layoutProblems.push("nav rail did not open");
}
await page.screenshot({ path: `${OUT}10-nav-open.png` });
console.log("  screenshot: 10-nav-open.png");
await checkLayout("nav open");

// Tapping a link must close the rail as well as navigate. The rail is only
// translated off-canvas, never unmounted, so Playwright still reports its links
// as "visible" when it is closed — the position of the panel is the real test.
await page.getByRole("link", { name: "Clients" }).click();
await page.waitForURL("**/clients", { timeout: 20000 });
await waitForLoaded();
if (await railSettles("closed")) {
  console.log("  rail closed on navigate");
} else {
  layoutProblems.push("nav rail stayed open after navigating");
}

console.log("5. Drawer at phone width");
await visit("/tenders", "Tenders");
await page.getByRole("button", { name: "Log Tender" }).first().click();
await page.getByRole("dialog").waitFor({ timeout: 10000 });
await page.screenshot({ path: `${OUT}11-drawer.png` });
console.log("  screenshot: 11-drawer.png");
await checkLayout("drawer");
await page.keyboard.press("Escape");

console.log("6. Credentials click-to-reveal");
await visit("/credentials", "Credentials");
const revealButton = page.getByRole("button", { name: "Reveal" }).first();
if (await revealButton.count()) {
  await revealButton.click();
  await page.getByRole("button", { name: "Hide" }).first().waitFor({ timeout: 20000 });
  await shot("12-credentials-revealed");
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
if (layoutProblems.length) {
  console.log(`layout problems (${layoutProblems.length}):`);
  layoutProblems.forEach((e) => console.log("  -", e));
} else {
  console.log("layout problems: none");
}
process.exit(consoleErrors.length || failedRequests.length || layoutProblems.length ? 1 : 0);
