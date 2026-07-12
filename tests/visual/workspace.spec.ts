import { expect, test } from '@playwright/test';

for (const route of [
  { name: 'home', path: '/' },
  { name: 'workspace', path: '/molecule' },
]) {
  test(`${route.name} layout`, async ({ page }) => {
    await page.route('**/api/product-events', (request) => request.fulfill({ status: 204, body: '' }));
    await page.goto(route.path, { waitUntil: 'networkidle' });
    await page.addStyleTag({ content: '*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }' });
    await expect(page.locator('body')).toBeVisible();
    await expect(page).toHaveScreenshot(`${route.name}.png`, {
      animations: 'disabled',
      fullPage: true,
      maxDiffPixelRatio: 0.01,
    });
  });
}
