import { expect, test } from '@playwright/test';

test('workspace counts match the catalogue and leave their menu usable', async ({ page }) => {
  await page.goto('/?preview=1#/spaces');
  await page.mouse.move(600, 120);
  const nav = page.getByRole('navigation', { name: 'Пространства', exact: true });
  for (const [name, expected] of [['Личное', '5'], ['Проектный комитет', '6'], ['Пилот с заказчиком', '4']]) {
    const button = nav.getByRole('button', { name: `Пространство: ${name}`, exact: true });
    const item = button.locator('xpath=ancestor::li[1]');
    const row = page.getByRole('row').filter({ has: page.getByRole('button', { name: `Открыть пространство: ${name}`, exact: true }) });
    await expect(item.locator('[data-slot="sidebar-menu-badge"]')).toHaveText(expected);
    await expect(item.locator('[data-slot="sidebar-menu-badge"]')).toBeVisible();
    await expect(row.locator('.workspace-number-column').first()).toHaveText(expected);
    await expect(button).toHaveAccessibleDescription(/запис/);
  }

  const project = nav.getByRole('button', { name: 'Пространство: Проектный комитет', exact: true });
  const item = project.locator('xpath=ancestor::li[1]');
  await project.hover();
  await expect(item.locator('[data-slot="sidebar-menu-badge"]')).toBeHidden();
  const actions = item.getByRole('button', { name: 'Действия пространства: Проектный комитет' });
  await expect(actions).toBeVisible();
  await actions.click();
  await expect(page.getByRole('menuitem', { name: 'Управление папками' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(actions).toBeFocused();

  await page.getByRole('button', { name: 'Создать пространство', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Новое пространство' });
  const longName = 'Тестовое пространство с очень длинным названием для проверки боковой панели';
  await dialog.getByRole('textbox', { name: 'Название пространства' }).fill(longName);
  await dialog.getByRole('button', { name: 'Создать пространство', exact: true }).click();
  const created = nav.getByRole('button', { name: `Пространство: ${longName}`, exact: true });
  const createdBadge = created.locator('xpath=ancestor::li[1]').locator('[data-slot="sidebar-menu-badge"]');
  await expect(createdBadge).toHaveText('0');
  await expect(created).toHaveAccessibleDescription('0 записей');
  const [labelBox, badgeBox] = await Promise.all([created.locator('span').last().boundingBox(), createdBadge.boundingBox()]);
  expect(labelBox && badgeBox).toBeTruthy();
  expect(labelBox!.x + labelBox!.width).toBeLessThanOrEqual(badgeBox!.x);
});

test('counts are available in compact navigation', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 850 });
  await page.goto('/?preview=1#/spaces');
  await page.getByRole('button', { name: 'Переключить навигацию' }).click();
  const dialog = page.getByRole('dialog', { name: 'Навигация' });
  const nav = dialog.getByRole('navigation', { name: 'Пространства', exact: true });
  const project = nav.getByRole('button', { name: 'Пространство: Проектный комитет', exact: true });
  await expect(project.locator('xpath=ancestor::li[1]').locator('[data-slot="sidebar-menu-badge"]')).toHaveText('6');
  await expect(project).toHaveAccessibleDescription(/6 записей/);
  await project.click();
  await expect(page).toHaveURL(/#\/spaces\/project$/);
  await expect(dialog).toHaveCount(0);
});

for (const dismissal of ['outside', 'trigger'] as const) {
  test(`closing an inactive workspace menu by ${dismissal} restores its count after the pointer leaves`, async ({ page }) => {
    await page.goto('/?preview=1#/spaces/project');
    const nav = page.getByRole('navigation', { name: 'Пространства', exact: true });
    const personal = nav.getByRole('button', { name: 'Пространство: Личное', exact: true });
    const item = personal.locator('xpath=ancestor::li[1]');
    const actions = item.getByRole('button', { name: 'Действия пространства: Личное', exact: true });
    const badge = item.locator('[data-slot="sidebar-menu-badge"]');
    const heading = page.getByRole('heading', { name: 'Проектный комитет', exact: true });
    await personal.hover();
    await actions.click();
    await expect(page.getByRole('menuitem', { name: 'Управление папками', exact: true })).toBeVisible();

    if (dismissal === 'trigger') {
      await actions.click();
    } else {
      const box = await heading.boundingBox();
      expect(box).toBeTruthy();
      await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
    }
    await expect(page.getByRole('menu')).toHaveCount(0);
    await heading.hover();
    await expect(actions).toHaveCSS('opacity', '0');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText('5');
    await expect(page).toHaveURL(/#\/spaces\/project$/);
    await expect(nav.getByRole('button', { name: 'Пространство: Проектный комитет', exact: true })).toHaveAttribute('aria-current', 'page');
  });
}

test('keyboard dismissal preserves focus return and forward navigation', async ({ page }) => {
  await page.goto('/?preview=1#/spaces/project');
  await page.mouse.move(600, 120);
  const nav = page.getByRole('navigation', { name: 'Пространства', exact: true });
  const personal = nav.getByRole('button', { name: 'Пространство: Личное', exact: true });
  const item = personal.locator('xpath=ancestor::li[1]');
  const actions = item.getByRole('button', { name: 'Действия пространства: Личное', exact: true });
  const badge = item.locator('[data-slot="sidebar-menu-badge"]');
  await personal.focus();
  await page.keyboard.press('Tab');
  await expect(actions).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menuitem', { name: 'Управление папками', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(actions).toBeFocused();
  await expect(actions).toHaveCSS('opacity', '1');
  await expect(badge).toBeHidden();
  await page.keyboard.press('Tab');
  await expect(actions).not.toBeFocused();
  await expect(actions).toHaveCSS('opacity', '0');
  await expect(badge).toBeVisible();

  await personal.focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menuitem', { name: 'Управление папками', exact: true })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Управление папками', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(nav.getByRole('button', { name: 'Пространство: Проектный комитет', exact: true })).toBeFocused();
  await expect(actions).toHaveCSS('opacity', '0');
  await expect(badge).toBeVisible();
  await expect(page).toHaveURL(/#\/spaces\/project$/);
});

test.describe('a pointer without hover', () => {
  test.use({ hasTouch: true });
  test('the count and actions remain separately available', async ({ page }) => {
    await page.goto('/?preview=1#/spaces');
    const nav = page.getByRole('navigation', { name: 'Пространства', exact: true });
    const button = nav.getByRole('button', { name: 'Пространство: Проектный комитет', exact: true });
    const item = button.locator('xpath=ancestor::li[1]');
    const badge = item.locator('[data-slot="sidebar-menu-badge"]');
    const actions = item.getByRole('button', { name: 'Действия пространства: Проектный комитет' });
    await expect(badge).toBeVisible();
    await expect(actions).toBeVisible();
    const [badgeBox, actionBox] = await Promise.all([badge.boundingBox(), actions.boundingBox()]);
    expect(badgeBox && actionBox).toBeTruthy();
    expect(badgeBox!.x + badgeBox!.width).toBeLessThanOrEqual(actionBox!.x);
    await actions.click();
    await expect(page.getByRole('menuitem', { name: 'Управление папками' })).toBeVisible();
  });
});
