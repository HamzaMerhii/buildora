const { chromium, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const base = process.env.BASE_URL || "http://localhost:3000";
let browser;
let page;
let phase = "Launching browser";
const started = Date.now();
const passedRoutes = [];
console.log("START runtime verification", base);
const heartbeat = setInterval(
  () =>
    console.log(
      "RUNNING",
      phase,
      Math.round((Date.now() - started) / 1000) + "s",
    ),
  15000,
);
function collect(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? collect(path.join(dir, e.name))
      : e.name === "page.tsx"
        ? [
            path
              .dirname(path.join(dir, e.name))
              .replaceAll("\\", "/")
              .replace("src/app", "")
              .replace(/\/\([^/]+\)/g, "")
              .replace("[buildingId]", "building-a")
              .replace(/\/projects\/\[id\]/, "/projects/cedar-residence")
              .replace(/\/apartments\/\[id\]/, "/apartments/apt-201")
              .replace(/\/stages\/\[id\]/, "/stages/stage-3")
              .replace(/\/tasks\/\[id\]/, "/tasks/task-1")
              .replace(/\/parties\/\[id\]/, "/parties/abc")
              .replace(/\/payments\/\[id\]/, "/payments/pay-014")
              .replace(/\/leads\/\[id\]/, "/leads/lead-1")
              .replace(/\/companies\/\[id\]/, "/companies/cedar")
              .replace(/\/floors\/\[id\]/, "/floors/floor-2") || "/",
          ]
        : [],
  );
}
(async () => {
  browser = await chromium.launch({
    channel: process.env.BROWSER_CHANNEL || "chrome",
    headless: true,
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(45000);
  async function navigate(url) {
    phase = "Loading " + url.replace(base, "");
    return page.goto(url, { waitUntil: "networkidle" });
  }
  const errors = [],
    remote = [],
    failedAssets = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("request", (r) => {
    if (/stitch|googleusercontent|fonts.googleapis/.test(r.url()))
      remote.push(r.url());
  });
  page.on("response", (r) => {
    if (r.status() >= 400 && /\.(webp|woff2|png)/.test(r.url()))
      failedAssets.push(r.url());
  });
  const routes = collect("src/app");
  for (const route of routes) {
    const response = await navigate(base + route);
    await page.locator("h1").first().waitFor();
    if (response.status() >= 400)
      throw Error(route + " returned " + response.status());
    const broken = await page
      .locator("img")
      .evaluateAll((images) =>
        images.filter((i) => i.complete && !i.naturalWidth).map((i) => i.src),
      );
    if (broken.length) throw Error(route + " broken images " + broken);
    console.log("ROUTE PASS", route);
    passedRoutes.push(route);
  }
  await navigate(base + "/app/projects/new");
  await page
    .getByRole("button", { name: "Create Project", exact: true })
    .click();
  await expect(page.getByLabel("Project Name *")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await page.getByLabel("Project Name *").fill("QA Cedar Annex");
  await page.getByLabel("Location / Site Address *").fill("Beirut, Lebanon");
  await page.getByLabel("Total Approved Budget *").fill("-1");
  await page
    .getByRole("button", { name: "Create Project", exact: true })
    .click();
  await expect(page.getByLabel("Total Approved Budget *")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await page.getByLabel("Total Approved Budget *").fill("900000");
  await page.getByLabel("Expected End Date *").fill("2025-01-01");
  await page
    .getByRole("button", { name: "Create Project", exact: true })
    .click();
  await expect(
    page.getByText("End date must be on or after start date"),
  ).toBeVisible();
  fs.mkdirSync("verification", { recursive: true });
  await page.evaluate(() => {
    document.activeElement?.blur();
    window.scrollTo({ top: 0, behavior: "instant" });
  });
  await page.screenshot({ path: "verification/project-validation.png", fullPage: true });
  await page.getByLabel("Expected End Date *").fill("2028-01-01");
  await page
    .getByRole("button", { name: "Create Project", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "QA Cedar Annex" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Edit Project", exact: true }).click();
  await expect(page.getByLabel("Project Name *")).toHaveValue("QA Cedar Annex");
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByLabel("Project Name *")).toHaveValue("QA Cedar Annex");
  await page.getByLabel("Project Name *").fill("QA Cedar Annex Updated");
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "QA Cedar Annex Updated" }),
  ).toBeVisible();
  console.log("FLOW PASS project validation/create/edit");
  await navigate(base + "/apartments/apt-201/enquire");
  await page.getByRole("button", { name: "Submit Enquiry" }).click();
  await expect(
    page.getByText("Please provide a phone number or email address"),
  ).toBeVisible();
  await page.getByLabel("Full Name *").fill("Phone Only Buyer");
  await page
    .getByLabel("Phone Number", { exact: true })
    .fill("+961 70 999 111");
  await page.getByRole("button", { name: "Submit Enquiry" }).click();
  await expect(page.getByText("Enquiry Sent Successfully!")).toBeVisible();
  await navigate(base + "/app/leads");
  await page
    .getByPlaceholder("Search leads by name, phone or email…")
    .fill("Phone Only Buyer");
  await expect(
    page.getByText("Phone Only Buyer", { exact: true }),
  ).toBeVisible();
  console.log("FLOW PASS phone-only enquiry creates lead");
  await navigate(base + "/apartments/apt-201/enquire");
  await page.getByLabel("Full Name *").fill("Email Only Buyer");
  await page
    .getByLabel("Email Address", { exact: true })
    .fill("buyer@example.com");
  await page.getByRole("button", { name: "Submit Enquiry" }).click();
  await expect(page.getByText("Enquiry Sent Successfully!")).toBeVisible();
  console.log("FLOW PASS email-only enquiry");
  await navigate(base + "/app/tasks/task-1");
  await page
    .getByRole("button", { name: "Add Task Update", exact: true })
    .click();
  await page.getByLabel("New Progress Percentage *").fill("101");
  await page.getByRole("button", { name: "Save Update", exact: true }).click();
  await expect(page.getByText("Progress cannot exceed 100")).toBeVisible();
  await page.getByLabel("New Progress Percentage *").fill("75");
  await page
    .getByLabel("Notes / Site Observation")
    .fill("QA reinforcement inspection completed.");
  await page.getByRole("button", { name: "Save Update", exact: true }).click();
  await expect(
    page.getByText("QA reinforcement inspection completed."),
  ).toBeVisible();
  console.log("FLOW PASS task progress validation/update");
  await navigate(base + "/app/leads/lead-1");
  await page
    .getByRole("button", { name: "Update Status", exact: true })
    .first()
    .click();
  await page.getByLabel("Select New Status *").selectOption("CONTACTED");
  await page.getByRole("button", { name: "Save Status", exact: true }).click();
  await expect(page.locator(".page-header .badge")).toHaveText("Contacted");
  console.log("FLOW PASS lead status");
  await navigate(base + "/app/projects");
  await page.getByLabel("Search projects", { exact: true }).fill("zzzzzz");
  await expect(page.getByText("No developments found")).toBeVisible();
  await page.getByLabel("Search projects", { exact: true }).fill("");
  await page.getByLabel("Project status").selectOption("COMPLETED");
  await expect(page.locator(".project-card")).toHaveCount(1);
  console.log("FLOW PASS search/filter");
  for (const width of [390, 820, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of [
      "/",
      "/app/dashboard",
      "/app/projects/new",
      "/app/apartments",
      "/app/payments",
      "/sign-in",
      "/platform/users",
    ]) {
      await navigate(base + route);
      await page.locator("h1").first().waitFor();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      );
      if (overflow) throw Error("Overflow " + width + " " + route);
    }
    console.log("RESPONSIVE PASS", width);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await navigate(base + "/app/dashboard");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Payments", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Payments", exact: true }),
  ).toBeVisible();
  console.log("FLOW PASS mobile navigation");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await navigate(base + "/");
  await page.getByRole("link", { name: "Workspace Login" }).click();
  await expect(page.locator(".auth-layout")).toBeVisible();
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByLabel("Email Address *", { exact: true })).toHaveAttribute("aria-invalid", "true");
  await page.getByLabel("Email Address *", { exact: true }).fill("invalid-email");
  await page.getByLabel("Password *", { exact: true }).fill("short");
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByText("Password must be at least 8 characters")).toBeVisible();
  await expect(page).toHaveURL(base + "/sign-in");
  await page.getByRole("link", { name: "Create account", exact: true }).click();
  await page.getByLabel("Full Name *", { exact: true }).fill("QA Reviewer");
  await page.getByLabel("Work Email *").fill("qa@example.com");
  await page.getByLabel("Password *", { exact: true }).fill("password123");
  await page.getByLabel("Confirm Password *").fill("different123");
  await page.getByLabel("I accept the workspace terms").check();
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page.getByText("Passwords do not match")).toBeVisible();
  await expect(page).toHaveURL(base + "/register");
  await page.getByLabel("Confirm Password *").fill("password123");
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page).toHaveURL(base + "/company-setup");
  await page.getByRole("button", { name: "Create Workspace" }).click();
  await expect(page).toHaveURL(base + "/workspace-ready");
  console.log("FLOW PASS auth validation and onboarding");
  await navigate(base + "/sign-in");
  await page.getByLabel("Email Address *", { exact: true }).fill("qa@example.com");
  await page.getByLabel("Password *", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL(base + "/app/dashboard");
  await expect(page.locator(".sidebar nav [aria-current=page]")).toHaveText("Dashboard");
  await page.locator(".workspace-switch").click();
  await page.getByRole("link", { name: "Platform administration", exact: true }).click();
  await expect(page).toHaveURL(base + "/platform");
  await expect(page.locator(".brand small")).toHaveText("PLATFORM ADMINISTRATION");
  await page.locator(".workspace-switch").click();
  await page.getByRole("link", { name: "Public website", exact: true }).click();
  await expect(page.locator(".public-header")).toBeVisible();
  await expect(page.locator(".public-footer")).toBeVisible();
  for (const [route, label] of [["/app/tasks/task-1", "Construction"], ["/app/buildings/building-a/floors/new", "Projects"], ["/app/settings/profile", "Settings"]]) {
    await navigate(base + route);
    await expect(page.locator(".sidebar [aria-current=page]")).toHaveText(label);
    await expect(page.locator(".topbar")).toBeVisible();
  }
  console.log("FLOW PASS public/auth/private/platform navigation and active sidebar");
  await page.setViewportSize({ width: 390, height: 844 });
  await navigate(base + "/app/payments");
  fs.mkdirSync("verification", { recursive: true });
  await page.screenshot({
    path: "verification/payments-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const [route, file] of [
    ["/", "public-home"],
    ["/app/projects/new", "project-form"],
    ["/app/dashboard", "dashboard-desktop"],
    ["/sign-in", "sign-in"],
    ["/platform", "platform-dashboard"],
  ]) {
    await navigate(base + route);
    await page.screenshot({
      path: "verification/" + file + ".png",
      fullPage: true,
    });
  }
  expect(errors).toEqual([]);
  expect(remote).toEqual([]);
  expect(failedAssets).toEqual([]);
  fs.writeFileSync(
    "verification/runtime-results.json",
    JSON.stringify(
      {
        baseURL: base,
        completedAt: new Date().toISOString(),
        elapsedSeconds: Math.round((Date.now() - started) / 1000),
        routes: routes.length,
        routeList: routes,
        consoleErrors: errors,
        remoteStitchRequests: remote,
        failedAssets,
        responsiveWidths: [390, 820, 1440],
        flows: 9,
      },
      null,
      2,
    ),
  );
  console.log(
    "ALL PASSED",
    routes.length,
    "routes; zero console errors, missing assets, or remote Stitch requests.",
  );
  for (const file of ["runtime-failure.json", "runtime-failure.png"])
    fs.rmSync(path.join("verification", file), { force: true });
  await browser.close();
  clearInterval(heartbeat);
})().catch(async (e) => {
  clearInterval(heartbeat);
  fs.mkdirSync("verification", { recursive: true });
  fs.writeFileSync(
    "verification/runtime-failure.json",
    JSON.stringify({ phase, passedRoutes, error: e.message }, null, 2),
  );
  if (page)
    await page
      .screenshot({ path: "verification/runtime-failure.png", fullPage: true })
      .catch(() => {});
  if (browser) await browser.close().catch(() => {});
  console.error(e);
  process.exitCode = 1;
});

