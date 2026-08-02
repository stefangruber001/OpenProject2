import { test, expect } from "@playwright/test";

test("live control tower renders computed figures from the real services", async ({ page }) => {
  await page.goto("/diorka/control-tower");
  await expect(page.getByRole("heading", { name: "Control Tower" })).toBeVisible();
  await expect(page.getByText(/composed capabilities/)).toBeVisible();

  // KPI + project row are computed live (margin = revenue − actual cost).
  await expect(page.getByText("Portfolio margin")).toBeVisible();
  await expect(page.getByText(/Full bathroom/)).toBeVisible();
  await expect(page.getByText(/812,00/).first()).toBeVisible(); // margin €812.00 (KPI + row)

  // API surface returns the same live overview.
  const res = await page.request.get("/api/diorka/control-tower");
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  // Tracks the capability list in tenants/diorka/tenant.yaml — composing one
  // more is a deliberate act, so this number is meant to be edited alongside
  // it rather than loosened into a >= that would notice nothing.
  expect(body.capabilities).toBe(17);
  expect(body.projects[0].marginCents).toBe(81200);
});
