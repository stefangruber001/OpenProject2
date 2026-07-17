import { test, expect } from "@playwright/test";

test("tenant workspace composes, issues and serves a factura", async ({ page }) => {
  await page.goto("/reformas-demo");
  await expect(page.getByRole("heading", { name: /Reformas Iberia/ })).toBeVisible();
  await expect(page.getByText("jurisdiction/es-ES + vertical/construction-reformas")).toBeVisible();

  await page.getByRole("button", { name: /demo automático/i }).click();
  const invoiceLink = page.getByRole("link", { name: /FAC-\d{4}-\d{4}/ }).first();
  await expect(invoiceLink).toBeVisible();

  await invoiceLink.click();
  await expect(page.locator("h1")).toContainText("Factura");
  await expect(page.getByText("Base imponible")).toBeVisible();
});
