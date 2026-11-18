import { test, expect } from '@playwright/test';

test('compact workspace rows expose the facts hidden from table columns', async ({ page }) => {
  await page.setViewportSize({ width: 700, height: 850 });
  await page.goto('/?preview=1#/spaces');
  const row = page.getByRole('row').filter({ has: page.getByRole('button', { name: 'Открыть пространство: Личное' }) });
  const open = row.getByRole('button', { name: 'Открыть пространство: Личное' });
  await expect(open).toHaveAccessibleDescription(/Только вам.*запис.*Папки:\s*\d+.*Владелец:/);
  await expect(row.locator('.workspace-owner-column')).toBeHidden();
  await expect(row.locator('.workspace-number-column').first()).toBeHidden();

  await page.setViewportSize({ width: 1280, height: 850 });
  await expect(row.locator('.workspace-owner-column')).toBeVisible();
  await expect(row.locator('.workspace-number-column').first()).toBeVisible();
  await expect(open).toHaveAccessibleDescription('Только вам');

  await page.setViewportSize({ width: 700, height: 850 });
  await open.click();
  await expect(page).toHaveURL(/#\/spaces\/personal$/);
});
