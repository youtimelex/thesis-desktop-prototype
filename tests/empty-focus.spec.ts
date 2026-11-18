import { test, expect } from '@playwright/test';

test('resetting filters from an empty result keeps the search and returns focus', async ({ page }) => {
  await page.goto('/?preview=1#/records');
  const search = page.getByRole('searchbox', { name: 'Поиск: Все записи' });
  await search.fill('несуществующая запись для проверки');
  await page.getByRole('combobox', { name: 'Источник' }).click();
  await page.getByRole('option', { name: 'Файлы', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ничего не найдено' })).toBeVisible();

  await page.getByRole('button', { name: 'Сбросить фильтры' }).click();
  await expect(page.getByRole('button', { name: 'Фильтры', exact: true })).toBeFocused();
  await expect(page.getByRole('combobox', { name: 'Источник' })).toContainText('Все источники');
  await expect(search).toHaveValue('несуществующая запись для проверки');
  await expect(page.getByRole('heading', { name: 'Ничего не найдено' })).toBeVisible();

  await page.getByRole('button', { name: 'Очистить поиск', exact: true }).last().click();
  await expect(search).toBeFocused();
  await expect(search).toHaveValue('');
  await expect(page.getByRole('region', { name: 'Список записей' })).toBeVisible();
});

test('clearing dialog search returns focus to the search field', async ({ page }) => {
  await page.goto('/?preview=1#/assistant');
  const search = page.getByRole('textbox', { name: 'Поиск диалогов', exact: true });
  await search.fill('несуществующий диалог для проверки');
  await expect(page.getByRole('heading', { name: 'Диалоги не найдены' })).toBeVisible();

  await page.getByRole('button', { name: 'Очистить поиск диалогов' }).click();
  await expect(search).toBeFocused();
  await expect(search).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Открыть диалог: Что решили на проектном комитете?' })).toBeVisible();
});
