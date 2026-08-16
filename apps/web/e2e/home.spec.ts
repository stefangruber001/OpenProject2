import { test, expect } from "@playwright/test";

// `/` stopped being a page in 226d108: it is a signpost into the workspace,
// which is static HTML under public/workspace. This test still asserted the
// day-one scaffold's "A solid foundation, ready to build on" headline and had
// been failing ever since — the front door is what an operator hits first, so
// what it is asserted to do should be what it does.
test("the front door leads into the workspace", async ({ page }) => {
  await page.goto("/");
  // Two hops: the redirect out of Next, then index.html's own forward into the
  // ERP shell. Landing anywhere else means the signpost is broken.
  await page.waitForURL(/\/workspace\/erp\.html/, { timeout: 15000 });
  await expect(page).toHaveTitle(/Canei Subirats/i);
  // And it is the server-backed copy. sync-workspace.mjs stamps this marker on
  // every page it publishes, and ErpStore reads it to decide between the server
  // and the browser's own storage — so its absence would mean the front door
  // leads to a workspace quietly keeping the company's data on one device.
  // Deliberately not asserting rendered content: this job runs without a
  // database, and the shell is supposed to say so rather than invent figures.
  await expect(page.locator('meta[name="erp-api"]')).toHaveCount(1);
});

test("health endpoint reports ok", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.status).toBe("ok");
});
