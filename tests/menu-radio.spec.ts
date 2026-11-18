import { expect, test } from '@playwright/test';

test('sorting keeps one selected radio item and changes the record order', async ({ page }) => {
  await page.goto('/?preview=1#/records');
  const rows = page.locator('[data-testid^="record-row-"]');
  const initiallyFirst = await rows.first().getAttribute('data-testid');
  const sort = page.getByRole('button', { name: 'Сортировка: Сначала новые' });
  await sort.click();
  await expect(page.getByRole('menuitemradio', { name: 'Сначала новые' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('menuitemradio', { name: 'Сначала старые' })).toHaveAttribute('aria-checked', 'false');
  await page.getByRole('menuitemradio', { name: 'Сначала старые' }).click();
  await expect(page.getByRole('menuitemradio', { name: 'Сначала старые' })).toHaveCount(0);
  await expect(rows.first()).not.toHaveAttribute('data-testid', initiallyFirst!);
  const changedSort = page.getByRole('button', { name: 'Сортировка: Сначала старые' });
  await changedSort.click();
  await expect(page.getByRole('menuitemradio', { name: 'Сначала старые' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('menuitemradio', { name: 'Сначала новые' })).toHaveAttribute('aria-checked', 'false');
  await page.keyboard.press('Escape');
  await expect(changedSort).toBeFocused();
});

test('playback speed preserves the selected value and closes the menu', async ({ page }) => {
  await page.goto('/?preview=1#/records');
  await page.getByTestId('record-row-project-committee').locator('.record-row-open').click();
  await page.getByRole('button', { name: 'Скорость воспроизведения 1×', exact: true }).click();
  await expect(page.getByRole('menuitemradio', { name: '1×', exact: true })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('menuitemradio', { name: '1,5×', exact: true }).click();
  await expect(page.getByRole('menuitemradio', { name: '1,5×', exact: true })).toHaveCount(0);
  const speed = page.getByRole('button', { name: 'Скорость воспроизведения 1.5×', exact: true });
  await expect(speed).toBeVisible();
  await speed.click();
  await expect(page.getByRole('menuitemradio', { name: '1,5×', exact: true })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('menuitemradio', { name: '1×', exact: true })).toHaveAttribute('aria-checked', 'false');
  await page.keyboard.press('Escape');
  await expect(speed).toBeFocused();
});
