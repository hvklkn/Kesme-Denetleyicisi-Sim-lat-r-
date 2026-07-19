import { expect, test } from "@playwright/test";

test("ana simülasyon yüzeyi açılır", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "IRQ Kontrol Paneli" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "IRR" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "IMR" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "ISR" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Step" })).toBeVisible();
});
