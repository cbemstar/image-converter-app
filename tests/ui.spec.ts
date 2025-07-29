import { test, expect } from '@playwright/test';

test('layout tool renders', async ({ page }) => {
  await page.goto('/tools/layout-tool/');
  await expect(page.locator('aside')).toBeVisible();
  await expect(page.getByText('Undo')).toBeVisible();
});
