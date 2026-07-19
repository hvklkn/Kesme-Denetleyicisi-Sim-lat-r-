import { expect, type Page, test } from "@playwright/test";

async function stepSimulation(page: Page, count = 1): Promise<void> {
  const stepButton = page.getByRole("button", { name: "Simülasyonu bir adım ilerlet" });
  for (let index = 0; index < count; index += 1) {
    await stepButton.click();
  }
}

async function startIrqIsr(page: Page, irqLine: number): Promise<void> {
  await page.getByRole("button", { name: `IRQ${irqLine} kesme oluştur` }).click();
  await stepSimulation(page, 3);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("ana simülasyon yüzeyi açılır", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "IRQ Kontrol Paneli" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "IRR" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "IMR" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "ISR", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Simülasyonu bir adım ilerlet" })).toBeVisible();
});

test("IRQ oluşturma ve ISR progress gözlemlenir", async ({ page }) => {
  await startIrqIsr(page, 1);

  await expect(page.getByTestId("active-isr-cycle")).toContainText("0/4 cycle");
  await stepSimulation(page);

  await expect(page.getByTestId("active-isr-cycle")).toContainText("1/4 cycle");
  await expect(page.getByTestId("interrupt-timeline")).toContainText("IRQ1 - Klavye ISR 1/4");
});

test("IRQ maskeleme bekleyen kesmeyi CPU'dan engeller", async ({ page }) => {
  await page.getByRole("button", { name: "IRQ1 mask değiştir" }).click();
  await page.getByRole("button", { name: "IRQ1 kesme oluştur" }).click();
  await stepSimulation(page);

  await expect(page.getByText("Maskeli").first()).toBeVisible();
  await expect(page.getByTestId("signal-active-stage")).toContainText("RUNNING");
  await expect(page.getByText("IRQ1 maskeli olduğu için CPU'ya iletilmedi").first()).toBeVisible();
});

test("nested interrupt senaryosu ISR stack oluşturur", async ({ page }) => {
  await startIrqIsr(page, 4);
  await stepSimulation(page, 2);
  await page.getByRole("button", { name: "IRQ1 kesme oluştur" }).click();
  await stepSimulation(page, 2);

  await expect(page.getByTestId("active-isr-stack")).toContainText("IRQ4 - Seri port 1");
  await expect(page.getByText("IRQ1 - Klavye, aktif IRQ4 - Seri port 1")).toBeVisible();
});

test("EOI sonrası önceki ISR kaldığı cycle'dan devam eder", async ({ page }) => {
  await startIrqIsr(page, 4);
  await stepSimulation(page, 2);
  await page.getByRole("button", { name: "IRQ1 kesme oluştur" }).click();
  await stepSimulation(page, 3);
  await stepSimulation(page, 4);
  await page.getByRole("button", { name: "End of Interrupt gönder" }).click();
  await stepSimulation(page);

  await expect(page.getByTestId("active-isr-cycle")).toContainText("2/6 cycle");
  await expect(page.getByText("IRQ4 - Seri port 1 ISR kaldığı yerden devam ediyor")).toBeVisible();
});

test("reset sonrası temiz başlangıç gösterilir", async ({ page }) => {
  await startIrqIsr(page, 1);
  await stepSimulation(page);
  await page.getByRole("button", { name: "Simülasyonu sıfırla" }).click();

  await expect(page.getByRole("heading", { name: "RUNNING" })).toBeVisible();
  await expect(page.getByTestId("timeline-empty")).toBeVisible();
  await expect(page.getByTestId("context-stack-empty")).toBeVisible();
  await expect(page.getByText("Simülasyon sıfırlandı; IRR, IMR, ISR, context stack ve timeline temizlendi.")).toBeVisible();
});
