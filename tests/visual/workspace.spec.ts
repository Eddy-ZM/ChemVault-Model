import { expect, test } from '@playwright/test';

for (const route of [
  { name: 'home', path: '/' },
  { name: 'workspace', path: '/molecule' },
  { name: 'login', path: '/login' },
  { name: 'molecules', path: '/molecules' },
]) {
  test(`${route.name} layout`, async ({ page }) => {
    await page.route('**/api/product-events', (request) => request.fulfill({ status: 204, body: '' }));
    await page.route('https://user.chemvault.science/**', (request) => request.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ user: null, allowed: false })
    }));
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

test('loaded molecule and structure details', async ({ page }) => {
  await page.route('**/api/product-events', (request) => request.fulfill({ status: 204, body: '' }));
  await page.route('https://user.chemvault.science/**', (request) => request.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: null }) }));
  await page.goto('/molecule', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Upload', exact: true }).first().click();
  await page.locator('input[type="file"]').setInputFiles({
    name: 'water.xyz',
    mimeType: 'chemical/x-xyz',
    buffer: Buffer.from('3\nVisual regression fixture: water\nO 0.000000 0.000000 0.000000\nH 0.000000 0.757000 0.586000\nH 0.000000 -0.757000 0.586000\n')
  });
  await page.getByRole('button', { name: 'Load File' }).click();
  await page.getByText('Structure loaded', { exact: true }).first().waitFor();
  await page.getByRole('button', { name: 'Structure Details' }).click();
  await page.getByRole('dialog').waitFor();
  await page.addStyleTag({ content: '*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }' });
  await expect(page).toHaveScreenshot('workspace-loaded-details.png', {
    animations: 'disabled',
    fullPage: true,
    maxDiffPixelRatio: 0.01
  });
});
