import { test, expect } from '@playwright/test';

// Separate browser contexts and preview mode keep the user's stored data untouched.
test('record assistant suggestions adapt to the available content width', async ({ page }) => {
  await page.goto('/?preview=1#/spaces/pilot');
  await page.getByTestId('record-row-customer-interview').locator('.record-row-open').click();
  await page.getByRole('tab', { name: /^Ассистент:/ }).click();
  const list = page.locator('.assistant-layout--record .suggested-questions');
  const properties = page.getByRole('button', { name: 'Свойства записи', exact: true });
  const records = page.getByRole('button', { name: 'Записи', exact: true });

  // The same window can be wide or narrow for its content depending on panels.
  if (await properties.getAttribute('aria-pressed') === 'true') await properties.click();
  await expect.poll(() => list.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
  const cards = list.getByRole('button');
  await expect(cards).toHaveCount(3);
  const widePositions = await cards.evaluateAll(elements => elements.map(el => el.getBoundingClientRect().top));
  expect(Math.max(...widePositions) - Math.min(...widePositions)).toBeLessThan(2);
  await properties.click();
  await records.click();
  await expect(page.getByRole('complementary', { name: 'Записи текущего списка' })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Свойства записи' })).toBeVisible();
  await expect.poll(() => cards.evaluateAll(elements => {
    const positions = elements.map(el => el.getBoundingClientRect());
    return positions.length === 3 && positions[0].bottom <= positions[1].top && positions[1].bottom <= positions[2].top
      && Math.max(...positions.map(rect => rect.left)) - Math.min(...positions.map(rect => rect.left)) < 2;
  })).toBe(true);
  await expect.poll(() => list.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
  await list.getByRole('button', { name: 'Следующие шаги' }).click();
  await expect(page.getByRole('textbox', { name: 'Вопрос Ассистенту' })).toHaveValue('Какие следующие шаги обсудили?');
});

for (const theme of ['dark', 'light'] as const) {
  test(`compact navigation stays inside the window and restores focus: ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 1093, height: 878 });
    // This test's fresh Playwright context is separate from the user's browser.
    await page.addInitScript(value => localStorage.setItem('thesis-vini-home-appearance-v1', JSON.stringify({ theme: value, colorway: 'blue' })), theme);
    await page.goto('/?preview=1#/spaces/pilot');
    const trigger = page.getByRole('button', { name: 'Переключить навигацию' });
    const dialog = page.getByRole('dialog', { name: 'Навигация' });
    const shell = page.locator('.desktop-app');
    await trigger.click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('navigation', { name: 'Основная навигация' })).toBeVisible();
    // VINi opens the Sheet from outside the viewport. Wait for its opening
    // movement before checking the resting geometry.
    await expect.poll(async () => {
      const [windowBox, panelBox] = await Promise.all([shell.boundingBox(), dialog.boundingBox()]);
      return windowBox && panelBox ? panelBox.x - windowBox.x : -Infinity;
    }).toBeGreaterThanOrEqual(-1);
    const [windowBox, panelBox] = await Promise.all([shell.boundingBox(), dialog.boundingBox()]);
    expect(windowBox && panelBox).toBeTruthy();
    expect(panelBox!.x).toBeGreaterThanOrEqual(windowBox!.x - 1);
    expect(panelBox!.y).toBeGreaterThanOrEqual(windowBox!.y - 1);
    expect(panelBox!.x + panelBox!.width).toBeLessThanOrEqual(windowBox!.x + windowBox!.width + 1);
    expect(panelBox!.y + panelBox!.height).toBeLessThanOrEqual(windowBox!.y + windowBox!.height + 1);
    expect(panelBox!.width).toBeLessThanOrEqual(281);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();

    await trigger.click();
    await expect(dialog).toBeVisible();
    await page.mouse.click(windowBox!.x + windowBox!.width - 24, windowBox!.y + windowBox!.height / 2);
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();

    await trigger.click();
    await dialog.getByRole('button', { name: 'Настройки', exact: true }).click();
    await expect(page).toHaveURL(/#\/settings\/connection$/);
    await expect(dialog).toHaveCount(0);
    await trigger.click();
    await expect(dialog.getByRole('navigation', { name: 'Разделы настроек' })).toBeVisible();
  });
}
