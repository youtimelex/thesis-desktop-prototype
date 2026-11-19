import { expect, test, type Page } from '@playwright/test';
import { initialState } from '../src/fixtures';
import { STORAGE_KEY } from '../src/model';
import type { AppState } from '../src/types';
import { expectListFilter, selectOption as select } from './list-helpers';

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-11T12:00:00Z') });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Все записи', exact: true })).toBeVisible();
});

const sidebar = (page: Page) => page.locator('.sidebar');
const nav = (page: Page, name: string) => page.getByRole('navigation', { name: 'Основная навигация' }).getByRole('button', { name, exact: true });
const space = (page: Page, name: string) => page.getByRole('navigation', { name: 'Пространства', exact: true }).getByRole('button', { name, exact: true });
const scopedAssistant = (page: Page) => page.getByRole('main').getByRole('button', { name: 'Ассистент', exact: true });
const record = (page: Page) => page.getByRole('main').getByRole('button', { name: 'Записать', exact: true });
const saved = (page: Page): Promise<AppState> => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
async function openRecord(page: Page, id = 'project-committee') { await page.getByTestId(`record-row-${id}`).getByRole('button').first().click(); await expect(page.getByTestId('record-page')).toBeVisible(); }
async function openFolder(page: Page) {
  await space(page, 'Проектный комитет').click(); await select(page, 'Папка: Все папки', 'Планирование');
  await page.getByRole('button', { name: 'Открыть папку', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Планирование', exact: true })).toBeVisible();
}
async function saveDraftAndLeave(page: Page) {
  await nav(page, 'Все записи').click(); const modal = page.getByRole('dialog', { name: 'Что сделать с записью?' });
  await modal.getByRole('button', { name: /Сохранить черновик и выйти/ }).click(); await expect(page.getByTestId('library-page')).toBeVisible();
}

test('compact server is static, settings remains available and record is in the section header', async ({ page }) => {
  const panel = sidebar(page); const server = panel.getByRole('group', { name: 'Vinteo Тезис, thesis.sever.ru' });
  await expect(server).toContainText('Vinteo Тезис'); await expect(server).toContainText('thesis.sever.ru'); await expect(server).not.toContainText('Подключено');
  await expect(panel.getByRole('button', { name: 'Настройки', exact: true })).toHaveText('Настройки'); await expect(record(page)).toBeVisible();
  await expect(record(page)).toHaveCount(1); await expect(page.locator('.topbar').getByRole('button', { name: 'Записать', exact: true })).toHaveCount(0);
  const before = page.url(); await server.click(); expect(page.url()).toBe(before); await expect(server.locator('button, a')).toHaveCount(0);
  await panel.getByRole('button', { name: 'Настройки', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Подключение к Тезису' })).toBeVisible();
  const settings = page.getByRole('navigation', { name: 'Разделы настроек' });
  await expect(settings.getByRole('button').nth(0)).toHaveText('Подключение'); await expect(settings.getByRole('button').nth(1)).toHaveText('Аккаунт');
  await expect(record(page)).toHaveCount(0);
});

test('default filters show all values and choosing all restores the complete list', async ({ page }) => {
  await expectListFilter(page, 'Пространство: Все пространства');
  await expectListFilter(page, 'Источник: Все источники');
  await expectListFilter(page, 'Состояние: Все состояния');
  await expect(page.locator('.record-row')).toHaveCount(17);

  await select(page, 'Источник: Все источники', 'Файлы'); await expect(page.locator('.record-row')).toHaveCount(5);
  await select(page, 'Источник: Файлы', 'Все источники'); await expect(page.locator('.record-row')).toHaveCount(17);
  await select(page, 'Состояние: Все состояния', 'Обработаны'); expect(await page.locator('.record-row').count()).toBeLessThan(17);
  await select(page, 'Состояние: Обработаны', 'Все состояния'); await expect(page.locator('.record-row')).toHaveCount(17);
  await select(page, 'Пространство: Все пространства', 'Проектный комитет'); await expect(page.locator('.record-row')).toHaveCount(6);
  await expectListFilter(page, 'Папка: Все папки');
  await select(page, 'Папка: Все папки', 'Планирование'); await expect(page.locator('.record-row')).toHaveCount(1);
  await select(page, 'Папка: Планирование', 'Все папки'); await expect(page.locator('.record-row')).toHaveCount(6);
  await select(page, 'Пространство: Проектный комитет', 'Все пространства'); await expect(page.locator('.record-row')).toHaveCount(17);

  await space(page, 'Личное').click(); await expectListFilter(page, 'Источник: Все источники');
  await expectListFilter(page, 'Состояние: Все состояния'); await expectListFilter(page, 'Папка: Все папки');
  await expect(page.locator('.record-row')).toHaveCount(6); await select(page, 'Папка: Все папки', 'Для разбора');
  await expect(page.locator('.record-row')).toHaveCount(1); await expect(page.getByTestId('record-row-learning')).toBeVisible();
  await select(page, 'Папка: Для разбора', 'Все папки'); await expect(page.locator('.record-row')).toHaveCount(6);
  await page.getByRole('button', { name: 'Фильтры', exact: true }).click(); const filters = page.getByRole('dialog', { name: 'Фильтры' });
  for (const name of ['Все источники', 'Все состояния', 'Все папки']) await expect(filters.getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('recording is available only on record-list pages, not other sections', async ({ page }) => {
  const check = async (destination: string) => { await expect(record(page)).toHaveCount(1); await expect(record(page)).toBeVisible(); await expect(record(page)).toHaveAccessibleDescription(`После отправки: ${destination}`); await expect(page.locator('.topbar').getByRole('button', { name: 'Записать', exact: true })).toHaveCount(0); };
  const absent = async () => { await expect(record(page)).toHaveCount(0); await expect(page.locator('.topbar').getByRole('button', { name: 'Записать', exact: true })).toHaveCount(0); };
  await check('Личное · Без папки'); await page.getByRole('button', { name: 'Все пространства', exact: true }).click(); await absent();
  await space(page, 'Личное').click(); await check('Личное · Без папки');
  await space(page, 'Проектный комитет').click(); await check('Проектный комитет · В корне пространства');
  await page.getByRole('button', { name: 'Ещё', exact: true }).click(); await page.getByRole('menuitem', { name: 'Участники' }).click(); await absent();
  await space(page, 'Проектный комитет').click(); await page.getByRole('button', { name: 'Ещё', exact: true }).click(); await page.getByRole('menuitem', { name: 'Управление папками' }).click(); await absent();
  await sidebar(page).getByRole('button', { name: 'Настройки', exact: true }).click(); await absent();
  await nav(page, 'Ассистент').click(); await absent();
  await page.locator('.history-item-open').filter({ hasText: 'Что решили на проектном комитете?' }).click(); await absent();
  await page.goto('/#/search/area/project'); await expect(page.getByRole('heading', { name: 'Поиск', exact: true })).toBeVisible(); await absent();
  await openFolder(page); await check('Проектный комитет · Планирование'); await openRecord(page);
  await check('Проектный комитет · Планирование'); await expect(page.locator('.detail-pane').getByRole('button', { name: 'Записать', exact: true })).toHaveCount(0);
});

test('space counters use one rule and include recordings inside folders', async ({ page }) => {
  await expect(space(page, 'Личное').locator('.nav-count')).toHaveText('5');
  await expect(space(page, 'Проектный комитет').locator('.nav-count')).toHaveText('6');
  await expect(space(page, 'Пилот с заказчиком').locator('.nav-count')).toHaveText('4');
  await space(page, 'Проектный комитет').click(); await expect(page.locator('.title-with-count .title-count')).toHaveText('6');
  await expect(page.getByTestId('record-row-project-committee')).toBeVisible(); await expect(page.getByTestId('record-row-architecture-review')).toBeVisible();
  await page.getByRole('button', { name: 'Все пространства', exact: true }).click();
  const cards = page.locator('.workspace-grid'); await expect(cards.getByRole('button', { name: /^Личное/ })).toContainText('5 записей');
  await expect(cards.getByRole('button', { name: /^Проектный комитет/ })).toContainText('6 записей');
  await expect(cards.getByRole('button', { name: /^Пилот с заказчиком/ })).toContainText('4 записи');
});

test('recording from all records defaults visibly to personal and remains independent of other drafts', async ({ page }) => {
  await record(page).click();
  await expect(page.getByTestId('recorder-page')).toBeVisible();
  await expect(page.getByTestId('recorder-page').getByRole('button', { name: 'К записям' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Пространство для записи: Личное' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Папка для записи: Без папки' })).toBeVisible();
  await expect(page.getByText('После отправки: Личное · Без папки')).toBeVisible();
  await expect(record(page)).toHaveCount(0); await expect(page.getByTestId('finish-recording')).toBeVisible(); await page.getByRole('textbox', { name: 'Название записи' }).fill('Запись из всех записей');
  await saveDraftAndLeave(page);
  await expect(record(page)).toBeVisible();
  const data = await saved(page); const draft = data.drafts.find(d => d.title === 'Запись из всех записей')!;
  expect(draft.areaId).toBe('personal'); expect(draft.folderId).toBeNull(); expect(draft.paused).toBe(true); expect(data.drafts.some(d => d.id === 'draft-first')).toBe(true);
});

test('leaving a folder for global Assistant does not carry the folder into a new recording', async ({ page }) => {
  await openFolder(page); await nav(page, 'Ассистент').click(); await expect(record(page)).toHaveCount(0);
  await nav(page, 'Все записи').click(); await record(page).click();
  await expect(page.getByRole('button', { name: 'Пространство для записи: Личное' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Папка для записи: Без папки' })).toBeVisible();
  await expect(page.getByTestId('recorder-page').getByRole('button', { name: 'К записям' })).toBeVisible();
});

test('recording from a space and folder shows and preserves each exact destination', async ({ page }) => {
  await space(page, 'Проектный комитет').click(); await record(page).click();
  await expect(page.getByTestId('recorder-page').getByRole('button', { name: 'К пространству «Проектный комитет»' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Пространство для записи: Проектный комитет' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Папка для записи: В корне пространства' })).toBeVisible();
  await expect(page.getByText('После отправки: Проектный комитет · В корне пространства')).toBeVisible();
  await page.getByRole('textbox', { name: 'Название записи' }).fill('Запись из пространства'); await page.getByTestId('finish-recording').click();
  let data = await saved(page); expect(data.records[0].areaId).toBe('project'); expect(data.records[0].folderId).toBeNull();
  await expect(space(page, 'Проектный комитет').locator('.nav-count')).toHaveText('7');
  await expect(page.locator('.records-pane').getByRole('heading', { name: 'Проектный комитет', exact: true })).toBeVisible();
  await select(page, 'Папка: Все папки', 'Планирование'); await page.getByRole('button', { name: 'Открыть папку' }).click();
  await record(page).click(); await expect(page.getByRole('button', { name: 'Пространство для записи: Проектный комитет' })).toBeVisible();
  await expect(page.getByTestId('recorder-page').getByRole('button', { name: 'К папке «Планирование»' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Папка для записи: Планирование' })).toBeVisible();
  await expect(page.getByText('После отправки: Проектный комитет · Планирование')).toBeVisible();
  await page.getByRole('textbox', { name: 'Название записи' }).fill('Запись из папки'); await page.getByTestId('finish-recording').click();
  data = await saved(page); const created = data.records.find(r => r.title === 'Запись из папки')!;
  expect(created.areaId).toBe('project'); expect(created.folderId).toBe('project-planning');
  await expect(space(page, 'Проектный комитет').locator('.nav-count')).toHaveText('8');
  await page.clock.runFor(8000); await expect(page.locator('.records-pane').getByRole('heading', { name: 'Планирование', exact: true })).toBeVisible();
  await expect(page.getByTestId(`record-row-${created.id}`)).toBeVisible();
});

test('Add menu and persistent record action use the same folder destination', async ({ page }) => {
  await openFolder(page); await page.getByRole('button', { name: 'Добавить', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Записать на диктофон', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Пространство для записи: Проектный комитет' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Папка для записи: Планирование' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Название записи' }).fill('Черновик из меню'); await saveDraftAndLeave(page);
  const draft = (await saved(page)).drafts.find(d => d.title === 'Черновик из меню')!;
  expect(draft.areaId).toBe('project'); expect(draft.folderId).toBe('project-planning');
  await space(page, 'Проектный комитет').click(); await select(page, 'Папка: Планирование', 'Все папки'); await expect(page.locator('.title-with-count .title-count')).toHaveText('6');
  await expect(page.locator('.table-footer')).toContainText('6 записей · 1 черновик');
});

test('recording from an explicitly selected folder filter uses that folder', async ({ page }) => {
  await space(page, 'Проектный комитет').click(); await select(page, 'Папка: Все папки', 'Планирование');
  await expect(page.getByRole('heading', { name: 'Проектный комитет', exact: true })).toBeVisible(); await record(page).click();
  await expect(page.getByRole('button', { name: 'Папка для записи: Планирование' })).toBeVisible();
  await page.getByTestId('finish-recording').click(); const created = (await saved(page)).records[0];
  expect(created.areaId).toBe('project'); expect(created.folderId).toBe('project-planning');
});

test('changing the destination clears the previous folder rather than sending into another area', async ({ page }) => {
  await openFolder(page); await record(page).click(); await expect(page.getByRole('button', { name: 'Папка для записи: Планирование' })).toBeVisible();
  await select(page, 'Пространство для записи: Проектный комитет', 'Личное');
  await expect(page.getByRole('button', { name: 'Папка для записи: Без папки' })).toBeVisible();
  await expect(page.getByText('После отправки: Личное · Без папки')).toBeVisible();
  await page.getByTestId('finish-recording').click(); const data = await saved(page);
  expect(data.records[0].areaId).toBe('personal'); expect(data.records[0].folderId).toBeNull();
});

test('personal folders can be created and deleted without losing records or drafts', async ({ page }) => {
  await space(page, 'Личное').click(); await page.getByRole('button', { name: 'Ещё', exact: true }).click(); await page.getByRole('menuitem', { name: 'Управление папками' }).click();
  await page.getByRole('button', { name: 'Создать папку', exact: true }).click(); await page.getByRole('textbox', { name: 'Название папки' }).fill('Личные заметки');
  await page.getByRole('dialog', { name: 'Создать папку' }).getByRole('button', { name: 'Создать папку', exact: true }).click();
  const folder = (await saved(page)).folders.find(f => f.name === 'Личные заметки')!; expect(folder.areaId).toBe('personal');
  await page.getByRole('button', { name: 'Личные заметки 0 записей' }).click(); await record(page).click();
  await expect(page.getByRole('button', { name: 'Папка для записи: Личные заметки' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Название записи' }).fill('Личный черновик в папке'); await saveDraftAndLeave(page);
  await page.reload(); expect((await saved(page)).drafts.find(d => d.title === 'Личный черновик в папке')!.folderId).toBe(folder.id);
  await space(page, 'Личное').click(); await openRecord(page, 'learning');
  const oldSummary = (await saved(page)).records.find(r => r.id === 'learning')!.summary;
  await page.getByRole('button', { name: 'Действия', exact: true }).click(); await page.getByRole('menuitem', { name: 'Переместить в папку' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Личные заметки', exact: true }).click();
  expect((await saved(page)).records.find(r => r.id === 'learning')!.folderId).toBe(folder.id);
  await space(page, 'Личное').click(); await page.getByRole('button', { name: 'Ещё', exact: true }).click(); await page.getByRole('menuitem', { name: 'Управление папками' }).click();
  await page.getByRole('button', { name: 'Действия с папкой: Личные заметки' }).click(); await page.getByRole('menuitem', { name: 'Удалить папку' }).click();
  await expect(page.getByRole('dialog', { name: 'Удалить папку?' })).toContainText('Записи и черновики сохранятся');
  await page.getByRole('dialog').getByRole('button', { name: 'Удалить папку', exact: true }).click();
  const data = await saved(page); const kept = data.records.find(r => r.id === 'learning')!; const draft = data.drafts.find(d => d.title === 'Личный черновик в папке')!;
  expect(kept.folderId).toBeNull(); expect(kept.summary).toBe(oldSummary); expect(draft.folderId).toBeNull(); expect(data.records).toHaveLength(16);
});

test('workspace creation is only in the catalogue and the new workspace persists', async ({ page }) => {
  await space(page, 'Личное').click();
  await expect(page.getByRole('main').getByRole('button', { name: 'Создать пространство', exact: true })).toHaveCount(0);
  await expect(sidebar(page).getByRole('button', { name: 'Новое пространство', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Все пространства', exact: true }).click(); await page.getByRole('main').getByRole('button', { name: 'Создать пространство', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Новое пространство' }); await modal.getByRole('textbox', { name: 'Название пространства' }).fill('Команда «Маяк»');
  await modal.getByRole('button', { name: 'Создать пространство', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Команда «Маяк»', exact: true })).toBeVisible(); await expect(space(page, 'Команда «Маяк»').locator('.nav-count')).toHaveText('0');
  const data = await saved(page); const created = data.createdWorkspaces!.find(w => w.name === 'Команда «Маяк»')!;
  expect(created.server).toBe(data.server?.address); expect(created.members).toEqual([]); expect(data.records).toHaveLength(16);
  await page.reload(); await expect(page.getByRole('heading', { name: 'Команда «Маяк»', exact: true })).toBeVisible();
  await expect(space(page, 'Команда «Маяк»')).toBeVisible();
  await record(page).click(); await expect(page.getByRole('button', { name: 'Пространство для записи: Команда «Маяк»' })).toBeVisible();
  await expect(page.getByText('После отправки: Команда «Маяк» · В корне пространства')).toBeVisible();
  await page.getByTestId('finish-recording').click(); expect((await saved(page)).records[0].areaId).toBe(created.id);
  await expect(space(page, 'Команда «Маяк»').locator('.nav-count')).toHaveText('1');
});

test('workspace names are validated without duplicating existing spaces', async ({ page }) => {
  await page.getByRole('button', { name: 'Все пространства', exact: true }).click(); await page.getByRole('main').getByRole('button', { name: 'Создать пространство' }).click();
  const modal = page.getByRole('dialog', { name: 'Новое пространство' }); await modal.getByRole('textbox', { name: 'Название пространства' }).fill('проектный комитет');
  await modal.getByRole('button', { name: 'Создать пространство', exact: true }).click(); await expect(modal.getByRole('alert')).toContainText('уже есть');
  expect((await saved(page)).createdWorkspaces ?? []).toHaveLength(0);
});

test('a workspace from another server is not presented as an available space', async ({ page }) => {
  const state = initialState(); state.createdWorkspaces = [{ id: 'other-space', name: 'Чужое пространство', description: '', color: '#72b6e9', members: [], server: 'other.company.ru', owner: 'alexey.petrov@sever.ru' }];
  await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), { key: STORAGE_KEY, data: state });
  await page.goto('/#/spaces/other-space'); await page.reload();
  await expect(page.getByRole('heading', { name: 'Пространство недоступно', exact: true })).toBeVisible();
  await expect(page.getByRole('main').getByRole('button', { name: 'Добавить', exact: true })).toHaveCount(0);
  await expect(page.getByRole('main').getByRole('button', { name: /Ассистент/ })).toHaveCount(0);
  expect((await saved(page)).createdWorkspaces?.[0].name).toBe('Чужое пространство');
});

test('unavailable spaces offer no recording action; legacy record lists still use personal', async ({ page }) => {
  const state = initialState(); state.createdWorkspaces = [{ id: 'other-space', name: 'Чужое пространство', description: '', color: '#72b6e9', members: [], server: 'other.company.ru', owner: 'alexey.petrov@sever.ru' }];
  await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), { key: STORAGE_KEY, data: state });
  await page.goto('/#/spaces/other-space/folders'); await page.reload();
  const before = (await saved(page)).drafts.length; await expect(record(page)).toHaveCount(0);
  await page.goto('/#/spaces/other-space'); await expect(page.getByRole('heading', { name: 'Пространство недоступно' })).toBeVisible();
  await expect(record(page)).toHaveCount(0); expect((await saved(page)).drafts).toHaveLength(before);
  await page.goto('/#/spaces/legacy/folders/legacy-projects'); await expect(record(page)).toHaveAccessibleDescription('После отправки: Личное · Без папки');
  await record(page).click(); await expect(page.getByRole('button', { name: 'Пространство для записи: Личное' })).toBeVisible();
});

test('many created spaces scroll inside the sidebar without hiding recording or settings', async ({ page }) => {
  const state = initialState(); state.createdWorkspaces = Array.from({ length: 24 }, (_, i) => ({ id: `space-${i}`, name: `Команда ${i}`, description: '', color: '#72b6e9', members: [], server: state.server!.address, owner: 'alexey.petrov@sever.ru' }));
  await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), { key: STORAGE_KEY, data: state }); await page.reload();
  const list = page.getByRole('navigation', { name: 'Пространства', exact: true });
  expect(await list.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true); await expect(record(page)).toBeVisible();
  await expect(sidebar(page).getByRole('button', { name: 'Настройки', exact: true })).toBeVisible();
  await space(page, 'Команда 23').click(); await expect(page.getByRole('heading', { name: 'Команда 23', exact: true })).toBeVisible();
  await expect(space(page, 'Команда 23').locator('.nav-count')).toHaveText('0'); await expect(scopedAssistant(page)).toHaveCount(0);
});

test('record placement changes the list and keeps the same material and find state', async ({ page }) => {
  await openRecord(page);
  await page.getByRole('tab', { name: /^Транскрипция:/ }).click(); await page.getByRole('button', { name: /Поиск в транскрипции/ }).click();
  await page.getByRole('textbox', { name: 'Поиск в транскрипции' }).fill('запи'); await page.getByRole('button', { name: 'Следующее совпадение' }).click();
  await page.getByTestId('record-page').getByRole('button', { name: 'Открыть пространство «Проектный комитет»' }).click();
  await expect(page.locator('.records-pane').getByRole('heading', { name: 'Проектный комитет', exact: true })).toBeVisible(); await expect(page.getByRole('button', { name: 'К предыдущему списку', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'К предыдущему списку', exact: true }).click(); await expect(page.getByRole('tab', { name: /^Транскрипция:/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('textbox', { name: 'Поиск в транскрипции' })).toHaveValue('запи'); await expect(page.getByRole('status', { name: /Совпадение 2 из/ })).toBeVisible();
  await space(page, 'Проектный комитет').click(); await select(page, 'Папка: Все папки', 'Планирование');
  await page.getByRole('button', { name: 'Открыть папку' }).click(); await expect(page.getByRole('button', { name: 'К пространству «Проектный комитет»' })).toBeVisible();
});

test('placement of a local record opens its area and returns to that record', async ({ page }) => {
  await openRecord(page, 'workgroup');
  const placement = page.getByTestId('record-page').getByRole('button', { name: 'Открыть пространство «Личное»' });
  await expect(placement).toHaveAccessibleDescription('После отправки · Без папки'); await placement.click();
  await expect(page.locator('.records-pane').getByRole('heading', { name: 'Личное', exact: true })).toBeVisible(); await page.getByRole('button', { name: 'К предыдущему списку', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Рабочая группа', exact: true })).toBeVisible();
});

test('record lists have no space Assistant button; global and folder entries keep their context', async ({ page }) => {
  await expect(scopedAssistant(page)).toHaveCount(0); await space(page, 'Личное').click(); await expect(scopedAssistant(page)).toHaveCount(0);
  await nav(page, 'Ассистент').click(); await expect(page.getByRole('heading', { name: 'История диалогов' })).toBeVisible();
  await space(page, 'Личное').click(); await select(page, 'Папка: Все папки', 'Для разбора'); await page.getByRole('button', { name: 'Открыть папку' }).click();
  await expect(scopedAssistant(page)).toHaveAccessibleDescription('Новый диалог по папке «Для разбора»'); await scopedAssistant(page).click();
  await expect(page.getByRole('button', { name: 'Источники ответа: Личное · Для разбора' })).toBeVisible();
  expect((await saved(page)).dialogs[0].scope.areaId).toBe('personal'); expect((await saved(page)).dialogs[0].scope.folderId).toBe('personal-review');
  await page.getByRole('button', { name: 'К папке «Для разбора»' }).click();
  await space(page, 'Пилот с заказчиком').click(); await expect(scopedAssistant(page)).toHaveCount(0);
  await space(page, 'Проектный комитет').click(); await expect(scopedAssistant(page)).toHaveCount(0);
  await select(page, 'Папка: Все папки', 'Планирование'); await expect(scopedAssistant(page)).toHaveCount(0); await page.getByRole('button', { name: 'Открыть папку' }).click();
  const folderChat = scopedAssistant(page); await expect(folderChat).toHaveText('Ассистент'); await expect(folderChat).toHaveAccessibleDescription('Новый диалог по папке «Планирование»'); await folderChat.click();
  await expect(page.locator('.composer-source-row')).toContainText('Контекст:'); await expect(page.getByRole('button', { name: 'Источники ответа: Проектный комитет · Планирование' })).toBeVisible();
  expect((await saved(page)).dialogs[0].scope.folderId).toBe('project-planning'); await page.getByRole('button', { name: 'К папке «Планирование»' }).click();
  await expect(page.getByRole('heading', { name: 'Планирование', exact: true })).toBeVisible();
});

test('folder → global Assistant → existing dialogue → source returns to chat and history, not the old folder', async ({ page }) => {
  await openFolder(page); await nav(page, 'Ассистент').click(); await expect(page.getByRole('heading', { name: 'История диалогов' })).toBeVisible();
  await page.locator('.history-item-open').filter({ hasText: 'Что решили на проектном комитете?' }).click();
  await expect(page.getByRole('button', { name: 'К истории диалогов', exact: true })).toBeVisible();
  const answer = page.locator('[data-turn-id="turn-decisions"]'); await expect(answer).toContainText('Что решили на проектном комитете?');
  const source = answer.getByRole('button', { name: 'Открыть резюме записи «Проектный комитет»' }); await source.click();
  await expect(nav(page, 'Ассистент')).toHaveAttribute('aria-current', 'page'); await expect(space(page, 'Проектный комитет')).not.toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('button', { name: 'К диалогу', exact: true })).toBeVisible(); await page.getByRole('button', { name: 'К диалогу', exact: true }).click();
  await expect(answer).toContainText('Что решили на проектном комитете?'); await expect(source).toBeFocused();
  await page.getByRole('button', { name: 'К истории диалогов', exact: true }).click(); await expect(page.getByRole('heading', { name: 'История диалогов' })).toBeVisible();
  await expect(page).toHaveURL(/#\/assistant$/); await expect(nav(page, 'Ассистент')).toHaveAttribute('aria-current', 'page');
});

test('global Assistant source search does not inherit a folder opened before history', async ({ page }) => {
  await openFolder(page); await nav(page, 'Ассистент').click(); await page.locator('.history-item-open').filter({ hasText: 'Что решили на проектном комитете?' }).click();
  await page.locator('.answer-sources button').first().click(); await page.keyboard.press('Meta+k');
  await expect(page.getByRole('searchbox', { name: 'Поиск: Все записи' })).toBeFocused(); await expect(page.locator('.search-scope-line')).toContainText('Все записи');
});

test('choosing an existing history item from a contextual chat returns to history', async ({ page }) => {
  await openFolder(page); await scopedAssistant(page).click();
  await expect(page.getByRole('button', { name: 'К папке «Планирование»' })).toBeVisible();
  await page.locator('.history-item-open').filter({ hasText: 'Как подготовиться к пилоту?' }).click();
  await expect(page.getByRole('button', { name: 'Источники ответа: Пилот с заказчиком' })).toBeVisible();
  await page.getByRole('button', { name: 'К истории диалогов' }).click(); await expect(page.getByRole('heading', { name: 'История диалогов' })).toBeVisible();
});

test('directly opened global conversation offers a return to chat history', async ({ page }) => {
  await page.goto('/#/assistant/dialog-decisions');
  await expect(page.getByRole('button', { name: 'К истории диалогов' })).toBeVisible();
  await page.getByRole('button', { name: 'К истории диалогов' }).click(); await expect(page).toHaveURL(/#\/assistant$/);
  await expect(page.getByRole('heading', { name: 'История диалогов' })).toBeVisible();
});

test('Assistant is a record tab, with the current recording as its context', async ({ page }) => {
  await openRecord(page); const tabs = page.getByRole('tablist', { name: 'Материалы записи' }); await expect(tabs.getByRole('tab')).toHaveCount(4);
  await expect(tabs.getByRole('tab').nth(2)).toHaveAccessibleName('Ассистент: Диалог по записи');
  await tabs.getByRole('tab', { name: /^Ассистент:/ }).click(); await expect(page.getByTestId('record-assistant')).toContainText('Проектный комитет');
  await expect(page.getByRole('textbox', { name: 'Вопрос Ассистенту' })).toBeVisible(); await expect(page.getByRole('tab', { name: /^Ассистент:/ })).toHaveAttribute('aria-selected', 'true');
});

test('sign-out keeps confirmed server and SSO is offered only after server entry', async ({ page }) => {
  await sidebar(page).getByRole('button', { name: 'Настройки', exact: true }).click(); await page.getByRole('button', { name: 'Аккаунт', exact: true }).click();
  await page.getByRole('button', { name: 'Выйти из профиля' }).click(); await expect(page.getByRole('button', { name: 'Войти через SSO' })).toBeVisible();
  await expect(page.getByText('thesis.sever.ru', { exact: true })).toBeVisible(); await page.getByRole('button', { name: 'Изменить сервер' }).click();
  await page.getByRole('alertdialog', { name: 'Сменить сервер?' }).getByRole('button', { name: 'Сменить сервер', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Адрес сервера' })).toBeVisible(); await expect(page.getByRole('button', { name: 'Войти через SSO' })).toHaveCount(0);
});

for (const width of [1024, 1440, 1920]) test(`personal actions and sidebar remain reachable at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 }); await space(page, 'Личное').click();
  await expect(scopedAssistant(page)).toHaveCount(0);
  for (const name of ['Записать', 'Добавить', 'Ещё']) {
    const action = page.getByRole('main').getByRole('button', { name, exact: true }); await expect(action).toBeVisible();
    const box = await action.boundingBox(); expect(box).not.toBeNull(); expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
  }
  await expect(record(page)).toBeVisible(); expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
});

test('a long workspace name stays inside the desktop content at 1024px', async ({ page }) => {
  const state = initialState(); const name = 'ДлинноеНазваниеПространства'.repeat(3);
  state.createdWorkspaces = [{ id: 'long-space', name, description: '', color: '#72b6e9', members: [], server: state.server!.address, owner: 'alexey.petrov@sever.ru' }];
  await page.setViewportSize({ width: 1024, height: 900 }); await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), { key: STORAGE_KEY, data: state }); await page.reload();
  await space(page, name).click(); await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  const heading = await page.getByRole('heading', { name, exact: true }).boundingBox(); const main = await page.getByRole('main').boundingBox();
  expect(heading!.x + heading!.width).toBeLessThanOrEqual(main!.x + main!.width + 1);
  const add = await page.getByRole('main').getByRole('button', { name: 'Добавить', exact: true }).boundingBox(); expect(add!.x + add!.width).toBeLessThanOrEqual(1025);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
});
