import { expect, type Page } from '@playwright/test';

const listFilter = /^(Пространство|Источник|Состояние|Папка): (.+)$/;

async function field(page: Page, label: string) {
  const match = listFilter.exec(label);
  if (!match) throw new Error(`Неизвестный фильтр: ${label}`);
  await page.getByRole('button', { name: 'Фильтры', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Фильтры', exact: true });
  const group = dialog.locator('fieldset').filter({ has: page.getByText(match[1], { exact: true }) });
  await expect(group.getByRole('button', { name: match[2], exact: true })).toHaveAttribute('aria-pressed', 'true');
  return { dialog, group };
}

export async function expectListFilter(page: Page, label: string) {
  const { dialog } = await field(page, label);
  await dialog.getByRole('button', { name: 'Отмена', exact: true }).click();
}

export async function selectOption(page: Page, label: string | RegExp, value: string) {
  if (typeof label === 'string' && listFilter.test(label) && await page.locator('.records-pane').isVisible()) {
    const { dialog, group } = await field(page, label);
    await group.getByRole('button', { name: value, exact: true }).click();
    await dialog.getByRole('button', { name: 'Применить', exact: true }).click();
    return;
  }
  await page.getByRole('button', { name: label, exact: typeof label === 'string' }).click();
  const role = typeof label === 'string' && /^(Скорость воспроизведения|Сортировка):?/.test(label) ? 'menuitemradio' : 'menuitem';
  await page.getByRole(role, { name: value, exact: true }).click();
}
