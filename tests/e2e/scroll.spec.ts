import { expect, test } from "@playwright/test";

for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test(`troca de página durante a rolagem mantém o topo (${reducedMotion})`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion });
    await page.goto("/conquistas");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    if (reducedMotion === "no-preference") {
      await expect(page.locator("html")).toHaveClass(/lenis/);
    }

    await page.mouse.move(300, 400);
    await page.mouse.wheel(0, 650);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(20);
    // Activate an existing link without Playwright scrolling it into view first.
    await page.locator('a[href="/rankings"]').first().evaluate((link: HTMLAnchorElement) => link.click());
    await expect(page).toHaveURL("/rankings");
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    // Check multiple frames so residual Lenis momentum cannot pass unnoticed.
    const positions = await page.evaluate(async () => {
      const values: number[] = [];
      const start = performance.now();
      while (performance.now() - start < 800) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        values.push(window.scrollY);
      }
      return values;
    });
    expect(positions.every((value) => value === 0)).toBe(true);
  });
}
