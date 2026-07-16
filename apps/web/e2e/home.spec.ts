import { test, expect } from "@playwright/test";

test("home page renders the product headline", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /solid foundation/i })).toBeVisible();
});

test("health endpoint reports ok", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.status).toBe("ok");
});
