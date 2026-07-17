import { test, expect } from "@playwright/test";

test("R1: build presupuesto → accept with option → factura at reduced rate", async ({ page }) => {
  await page.goto("/diorka");
  await page.fill('input[name="title"]', "e2e — Reforma baño");
  await page.click('button:has-text("Create quote")');
  await page.waitForURL(/presupuestos\//);

  // one base partida (mediciones 1×5×2.5 = 12.5 m²) + one optional
  await page.fill('input[name="description"]', "Demolición y retirada");
  await page.fill('input[name="unidades"]', "1");
  await page.fill('input[name="largo"]', "5");
  await page.fill('input[name="ancho"]', "2.5");
  await page.fill('input[name="precio"]', "18.40");
  await page.click('button:has-text("Add")');
  await page.waitForSelector('tr:has-text("Demolición y retirada")');

  await page.fill('input[name="description"]', "Mampara premium");
  await page.fill('input[name="unidades"]', "1");
  await page.fill('input[name="precio"]', "480");
  await page.check('input[name="optional"]');
  await page.click('button:has-text("Add")');
  await page.waitForSelector('tr:has-text("Mampara premium")');
  await expect(page.getByText("Base:")).toContainText("230,00");

  await page.check('input[name="options"]');
  await page.click('button:has-text("Mark as accepted")');
  await page.waitForSelector("text=accepted");

  await page.fill('input[name="buyerName"]', "María García");
  await page.fill('input[name="ageYears"]', "15");
  await page.click('button:has-text("Issue invoice")');
  await page.waitForURL(/facturas\//);
  await expect(page.locator("h1")).toContainText("Factura");
  await expect(page.getByText("IVA 10 %")).toBeVisible(); // reduced rate decided by rule
});
