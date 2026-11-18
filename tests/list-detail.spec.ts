import { expect, test, type Page } from '@playwright/test';
import { initialState } from '../src/fixtures';
import { STORAGE_KEY } from '../src/model';
import type { AppState } from '../src/types';

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-11T12:00:00Z') });
  await page.goto('/'); await expect(page.getByRole('heading', { name: 'Выберите запись' })).toBeVisible();
});

const nav = (page: Page, name: string) => page.getByRole('navigation', { name: 'Основная навигация' }).getByRole('button', { name, exact: true });
const space = (page: Page, name: string) => page.getByRole('navigation', { name: 'Пространства', exact: true }).getByRole('button', { name, exact: true });
const tab = (page: Page, name: string) => page.getByRole('tablist', { name: 'Материалы записи' }).getByRole('tab', { name: new RegExp(`^${name}:`) });
const row = (page: Page, id: string) => page.getByTestId(`record-row-${id}`);
const question = (page: Page) => page.getByRole('textbox', { name: 'Вопрос Ассистенту' });
const saved = (page: Page): Promise<AppState> => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
async function openRecord(page: Page, id = 'project-committee') { await row(page, id).locator('.record-row-open').click(); await expect(page.getByTestId('record-page')).toBeVisible(); }
async function filter(page: Page, value: string) { await page.getByRole('button', { name: 'Фильтры', exact: true }).click(); const dialog = page.getByRole('dialog', { name: 'Фильтры' }); await dialog.getByRole('button', { name: value, exact: true }).click(); await dialog.getByRole('button', { name: 'Применить', exact: true }).click(); }

test('compact list rows show source, space and status without a separate table', async ({ page }) => {
  const first = row(page, 'project-committee').locator('.record-row-open'); const box = await first.boundingBox();
  expect(box).not.toBeNull(); expect(box!.height).toBeLessThanOrEqual(68);
  await expect(first).toContainText('Файл'); await expect(first).toContainText('Проектный комитет'); await expect(first).toContainText('18 мин');
  const processing = row(page, 'contractor-meeting').locator('.row-kind'); await expect(processing).toHaveAttribute('title', 'Распознаём речь · 64%');
  await expect(row(page, 'contractor-meeting').locator('.record-row-open')).toHaveAccessibleName(/Распознаём речь, 64%/);
});

test('list divider supports mouse and keyboard without losing the open conversation', async ({ page }) => {
  await openRecord(page); await tab(page, 'Ассистент').click(); await question(page).fill('Черновик при изменении ширины');
  const divider = page.getByRole('separator', { name: 'Ширина списка записей' }); const list = page.locator('.records-pane');
  await expect(divider).toHaveAttribute('aria-orientation', 'vertical'); await expect(divider).toHaveAttribute('aria-controls', 'records-pane'); const initial = (await list.boundingBox())!.width;
  await divider.focus(); await page.keyboard.press('ArrowRight'); await expect.poll(async () => (await list.boundingBox())!.width).toBeCloseTo(initial + 16, 0);
  await expect(divider).toHaveAttribute('aria-valuenow', String(initial + 16));
  const handle = await divider.boundingBox(); await page.mouse.move(handle!.x + handle!.width / 2, handle!.y + 80); await page.mouse.down(); await page.mouse.move(handle!.x + handle!.width / 2 + 40, handle!.y + 80); await page.mouse.up();
  const resized = (await list.boundingBox())!.width; expect(resized).toBeGreaterThan(initial + 16); await expect(question(page)).toHaveValue('Черновик при изменении ширины');
  await nav(page, 'Ассистент').click(); await nav(page, 'Все записи').click(); await expect.poll(async () => (await list.boundingBox())!.width).toBeCloseTo(resized, 0);
  await expect(question(page)).toHaveValue('Черновик при изменении ширины'); await divider.dblclick(); await expect.poll(async () => (await list.boundingBox())!.width).toBeCloseTo(initial, 0);
  await divider.focus(); await page.keyboard.press('Home'); await expect.poll(async () => (await list.boundingBox())!.width).toBe(Number(await divider.getAttribute('aria-valuemin')));
  await page.keyboard.press('ArrowLeft'); await expect(divider).toHaveAttribute('aria-valuenow', await divider.getAttribute('aria-valuemin') as string);
  await page.keyboard.press('End'); await expect.poll(async () => (await list.boundingBox())!.width).toBe(Number(await divider.getAttribute('aria-valuemax')));
});

test('list divider keeps enough room for content at 1024px', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 }); await openRecord(page);
  const divider = page.getByRole('separator', { name: 'Ширина списка записей' }); await divider.focus(); await page.keyboard.press('End');
  const detail = await page.getByRole('region', { name: 'Содержимое записи' }).boundingBox(); expect(detail!.width).toBeGreaterThanOrEqual(500);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await tab(page, 'Ассистент').click(); await question(page).fill('Вопрос в узкой карточке');
  for (const name of ['Резюме', 'Транскрипция', 'Ассистент', 'Сведения']) await expect(tab(page, name)).toBeVisible();
  const input = (await question(page).boundingBox())!; const player = (await page.getByTestId('player-dock').boundingBox())!;
  expect(input.x).toBeGreaterThanOrEqual(detail!.x); expect(input.x + input.width).toBeLessThanOrEqual(detail!.x + detail!.width); expect(input.y + input.height).toBeLessThanOrEqual(player.y);
});

test('list width survives reload in a tab, adapts to the viewport, and keeps preview isolated', async ({ page }) => {
  const divider = page.getByRole('separator', { name: 'Ширина списка записей' }); const list = page.locator('.records-pane');
  const defaultWidth = (await list.boundingBox())!.width;
  await page.evaluate(key => sessionStorage.setItem(key, JSON.stringify({ unrelated: 'preserved' })), STORAGE_KEY);
  await divider.focus(); await page.keyboard.press('End'); const wide = (await list.boundingBox())!.width;
  expect(wide).toBe(560); expect(await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!), STORAGE_KEY)).toEqual({ unrelated: 'preserved', listWidth: wide });
  await page.reload(); await expect.poll(async () => (await list.boundingBox())!.width).toBe(wide);
  await page.setViewportSize({ width: 1024, height: 768 }); await expect.poll(async () => Number(await divider.getAttribute('aria-valuenow'))).toBeLessThan(wide);
  expect((await page.getByRole('region', { name: 'Содержимое записи' }).boundingBox())!.width).toBeGreaterThanOrEqual(500);
  await page.setViewportSize({ width: 1440, height: 900 }); await expect.poll(async () => (await list.boundingBox())!.width).toBe(wide);
  await page.goto('/?preview=1'); await expect.poll(async () => (await list.boundingBox())!.width).toBe(defaultWidth);
  await divider.focus(); await page.keyboard.press('ArrowRight'); await expect.poll(async () => (await list.boundingBox())!.width).toBe(defaultWidth + 16);
  expect(await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!), STORAGE_KEY)).toEqual({ unrelated: 'preserved', listWidth: wide });
  await page.reload(); await expect.poll(async () => (await list.boundingBox())!.width).toBe(defaultWidth);
  await page.goto('/'); await expect.poll(async () => (await list.boundingBox())!.width).toBe(wide);
});

test('selecting a record keeps the same list, its scroll and independent detail scrolling', async ({ page }) => {
  const list = page.getByTestId('library-page'); await list.evaluate(el => { el.dataset.identity = 'same-list'; el.scrollTop = 250; });
  await row(page, 'budget-discussion').scrollIntoViewIfNeeded(); const before = await list.evaluate(el => el.scrollTop);
  await openRecord(page, 'budget-discussion'); await expect(list).toHaveAttribute('data-identity', 'same-list');
  await expect.poll(() => list.evaluate(el => el.scrollTop)).toBeCloseTo(before, 0);
  await expect(row(page, 'budget-discussion').locator('.record-row-open')).toHaveAttribute('aria-current', 'true');
  await expect(page.getByRole('region', { name: 'Панель записей' })).toBeVisible(); await expect(page.getByRole('region', { name: 'Содержимое записи' })).toBeVisible();
  const record = page.getByTestId('record-page'); await record.evaluate(el => { el.scrollTop = 150; });
  await expect.poll(() => list.evaluate(el => el.scrollTop)).toBeCloseTo(before, 0);
});

test('record A → B → A restores Assistant tab and draft without auto-playing', async ({ page }) => {
  await openRecord(page); await tab(page, 'Ассистент').click(); await question(page).fill('Черновик по первой записи');
  await openRecord(page, 'budget-discussion'); await expect(page.getByRole('heading', { name: 'Обсуждение бюджета', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Воспроизвести запись' })).toBeVisible(); await openRecord(page);
  await expect(tab(page, 'Ассистент')).toHaveAttribute('aria-selected', 'true'); await expect(question(page)).toHaveValue('Черновик по первой записи');
  expect((await saved(page)).dialogs.filter(d => d.recordContextId === 'project-committee')).toHaveLength(1);
  await page.reload(); await expect(question(page)).toHaveValue('Черновик по первой записи');
});

test('detail toolbar navigates between visible records and can close without losing a draft', async ({ page }) => {
  await openRecord(page); await expect(page.getByRole('button', { name: 'Предыдущая запись' })).toBeDisabled();
  await page.getByRole('button', { name: 'Следующая запись' }).click(); await page.clock.runFor(20); await expect(row(page, 'server-operations').locator('.record-row-open')).toHaveAttribute('aria-current', 'true'); await expect(page.getByRole('button', { name: 'Следующая запись' })).toBeFocused();
  await page.getByRole('button', { name: 'Предыдущая запись' }).click(); await tab(page, 'Ассистент').click(); await question(page).fill('Черновик после закрытия');
  await page.getByRole('button', { name: 'Закрыть карточку' }).click(); await page.clock.runFor(20); await expect(page.getByRole('heading', { name: 'Выберите запись' })).toBeVisible(); await expect(row(page, 'project-committee').locator('.record-row-open')).toBeFocused();
  await openRecord(page); await expect(tab(page, 'Ассистент')).toHaveAttribute('aria-selected', 'true'); await expect(question(page)).toHaveValue('Черновик после закрытия');
  await filter(page, 'Диктофон'); await expect(page.getByRole('button', { name: 'Предыдущая запись' })).toBeDisabled(); await expect(page.getByRole('button', { name: 'Следующая запись' })).toBeDisabled();
});

test('detail navigation follows the filtered list rather than unrelated records', async ({ page }) => {
  await openRecord(page); await filter(page, 'Файлы'); await page.getByRole('button', { name: 'Следующая запись' }).click();
  await expect(row(page, 'contractor-meeting').locator('.record-row-open')).toHaveAttribute('aria-current', 'true');
  await expect(page.getByTestId('record-page').getByRole('heading', { name: 'Встреча с подрядчиком', exact: true })).toBeVisible();
});

test('switching a playing record never starts playback of the next record', async ({ page }) => {
  await openRecord(page); await page.getByRole('button', { name: 'Воспроизвести запись', exact: true }).click(); await page.clock.runFor(2000);
  await expect(page.getByRole('button', { name: 'Поставить на паузу', exact: true })).toBeVisible(); await openRecord(page, 'budget-discussion');
  await expect(page.getByRole('button', { name: 'Воспроизвести запись', exact: true })).toBeVisible(); await expect(page.getByRole('slider', { name: 'Позиция воспроизведения' })).toHaveValue('0');
});

test('record A → B → A restores transcript search and reading position', async ({ page }) => {
  const state = initialState(); const record = state.records.find(r => r.id === 'project-committee')!; record.duration = 4000;
  record.transcript = Array.from({ length: 60 }, (_, i) => ({ id: `long-${i}`, speaker: i % 2 ? 'Мария Соколова' : 'Алексей Петров', color: '#72b6e9', start: i * 50, end: i * 50 + 45, text: i === 1 || i === 55 ? `Важная договорённость: кварцевый ориентир номер ${i}.` : `Обсуждение вопроса ${i}. Длинная реплика для проверки позиции.` }));
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: STORAGE_KEY, value: state }); await page.reload();
  await openRecord(page); await tab(page, 'Транскрипция').click(); await page.getByRole('button', { name: /Поиск в транскрипции/ }).click();
  await page.getByRole('textbox', { name: 'Поиск в транскрипции' }).fill('кварцевый'); await page.getByRole('button', { name: 'Следующее совпадение' }).click();
  const viewport = page.getByTestId('record-page'); const before = await viewport.evaluate(el => el.scrollTop); expect(before).toBeGreaterThan(500);
  await openRecord(page, 'budget-discussion'); await openRecord(page);
  await expect(tab(page, 'Транскрипция')).toHaveAttribute('aria-selected', 'true'); await expect(page.getByRole('textbox', { name: 'Поиск в транскрипции' })).toHaveValue('кварцевый');
  await expect(page.getByRole('status', { name: 'Совпадение 2 из 2' })).toBeVisible(); await expect.poll(() => viewport.evaluate(el => el.scrollTop)).toBeCloseTo(before, 0);
});

test('unfinished transcript edit survives record switching and warns on page unload', async ({ page }) => {
  await openRecord(page); await tab(page, 'Транскрипция').click(); await page.locator('.transcript-segment').first().hover();
  await page.getByRole('button', { name: 'Редактировать реплику 00:00' }).click(); await page.getByRole('textbox', { name: 'Текст реплики' }).fill('Несохранённая правка первой записи');
  await openRecord(page, 'budget-discussion');
  expect(await page.evaluate(() => { const e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; })).toBe(true);
  await openRecord(page); await expect(tab(page, 'Транскрипция')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('textbox', { name: 'Текст реплики' })).toHaveValue('Несохранённая правка первой записи');
  await expect(page.getByRole('button', { name: 'Редактировать реплику 00:32' })).toBeDisabled();
  await page.getByRole('button', { name: 'Закрыть карточку' }).click(); await openRecord(page);
  await expect(page.getByRole('textbox', { name: 'Текст реплики' })).toHaveValue('Несохранённая правка первой записи');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  expect((await saved(page)).records.find(r => r.id === 'project-committee')!.transcript[0].text).toBe('Несохранённая правка первой записи');
  expect(await page.evaluate(() => { const e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; })).toBe(false);
});

test('filtering out a selected record keeps it open and offers a clear reset', async ({ page }) => {
  await openRecord(page, 'budget-discussion'); await filter(page, 'Файлы');
  await expect(row(page, 'budget-discussion')).toHaveCount(0); await expect(page.getByRole('heading', { name: 'Обсуждение бюджета', exact: true })).toBeVisible();
  const notice = page.locator('.detail-list-notice'); await expect(notice).toContainText('не видна в списке из-за фильтров');
  await notice.getByRole('button', { name: 'Сбросить фильтры' }).click(); await expect(notice).toHaveCount(0);
  await expect(row(page, 'budget-discussion').locator('.record-row-open')).toHaveAttribute('aria-current', 'true');
});

test('search keeps the open recording until the user chooses another result', async ({ page }) => {
  await openRecord(page); const search = page.getByRole('searchbox', { name: 'Поиск: Все записи' }); await search.fill('бюджет');
  await expect(page.locator('.detail-list-notice')).toContainText('не видна в списке из-за фильтров');
  await expect(page.getByTestId('record-page').getByRole('heading', { name: 'Проектный комитет', exact: true })).toBeVisible();
  await openRecord(page, 'budget-discussion'); await expect(page.locator('.detail-list-notice')).toHaveCount(0);
  await expect(row(page, 'budget-discussion').locator('.record-row-open')).toHaveAttribute('aria-current', 'true'); await expect(search).toHaveValue('бюджет');
});

test('a moved record remains open with a truthful out-of-scope notice', async ({ page }) => {
  await space(page, 'Проектный комитет').click(); await openRecord(page);
  await page.getByRole('button', { name: 'Действия', exact: true }).click(); await page.getByRole('menuitem', { name: 'Изменить пространство' }).click();
  const dialog = page.getByRole('dialog'); await dialog.getByRole('button', { name: 'Личное', exact: true }).click(); await dialog.getByRole('button', { name: 'Переместить запись', exact: true }).click();
  await expect(page.locator('.detail-list-notice')).toContainText('не входит в этот список'); await expect(row(page, 'project-committee')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Содержимое записи' }).getByRole('heading', { name: 'Проектный комитет', exact: true })).toBeVisible();
  expect((await saved(page)).records.find(r => r.id === 'project-committee')!.areaId).toBe('personal');
});

test('scoped selection survives Back, Forward and reload', async ({ page }) => {
  await space(page, 'Проектный комитет').click(); await openRecord(page); await openRecord(page, 'architecture-review');
  await expect(page).toHaveURL(/records\/architecture-review\/summary\?area=project$/); await page.goBack();
  await expect(row(page, 'project-committee').locator('.record-row-open')).toHaveAttribute('aria-current', 'true'); await page.goForward();
  await expect(row(page, 'architecture-review').locator('.record-row-open')).toHaveAttribute('aria-current', 'true'); await page.reload();
  await expect(page.locator('.records-pane').getByRole('heading', { name: 'Проектный комитет', exact: true })).toBeVisible();
  await expect(row(page, 'architecture-review').locator('.record-row-open')).toHaveAttribute('aria-current', 'true');
  await expect(page.getByRole('region', { name: 'Содержимое записи' }).getByRole('heading', { name: 'Архитектурный комитет' })).toBeVisible();
});

test('a direct record link restores the opened folder and selected record after reload', async ({ page }) => {
  await space(page, 'Проектный комитет').click(); await filter(page, 'Планирование'); await page.getByRole('button', { name: 'Открыть папку', exact: true }).click();
  await openRecord(page); await expect(page).toHaveURL(/records\/project-committee\/summary\?area=project&folder=project-planning$/); await page.reload();
  await expect(page.locator('.records-pane').getByRole('heading', { name: 'Планирование', exact: true })).toBeVisible();
  await expect(row(page, 'project-committee').locator('.record-row-open')).toHaveAttribute('aria-current', 'true');
  await expect(page.getByRole('button', { name: 'К пространству «Проектный комитет»' })).toBeVisible();
});

test('the last selected record is remembered per list in the session', async ({ page }) => {
  await openRecord(page, 'budget-discussion'); await space(page, 'Проектный комитет').click(); await expect(page.getByRole('heading', { name: 'Выберите запись' })).toBeVisible();
  await openRecord(page); await nav(page, 'Все записи').click(); await expect(row(page, 'budget-discussion').locator('.record-row-open')).toHaveAttribute('aria-current', 'true');
  await space(page, 'Проектный комитет').click(); await expect(row(page, 'project-committee').locator('.record-row-open')).toHaveAttribute('aria-current', 'true');
});

test('returning from Assistant to the list selects the list section and retains the last record', async ({ page }) => {
  await openRecord(page); await tab(page, 'Ассистент').click(); await question(page).fill('Черновик при переходе в раздел');
  await nav(page, 'Ассистент').click(); await expect(nav(page, 'Ассистент')).toHaveAttribute('aria-current', 'page');
  await nav(page, 'Все записи').click(); await expect(nav(page, 'Все записи')).toHaveAttribute('aria-current', 'page');
  await expect(nav(page, 'Ассистент')).not.toHaveAttribute('aria-current', 'page'); await expect(row(page, 'project-committee').locator('.record-row-open')).toHaveAttribute('aria-current', 'true');
  await expect(question(page)).toHaveValue('Черновик при переходе в раздел'); await expect(page.getByRole('button', { name: /К (?:истории диалогов|диалогу)/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Закрыть карточку' }).click(); await expect(page.getByRole('heading', { name: 'Выберите запись' })).toBeVisible(); await expect(nav(page, 'Все записи')).toHaveAttribute('aria-current', 'page');
});

test('returning from Assistant to a workspace restores its record and active workspace', async ({ page }) => {
  await space(page, 'Проектный комитет').click(); await openRecord(page); await nav(page, 'Ассистент').click(); await space(page, 'Проектный комитет').click();
  await expect(space(page, 'Проектный комитет')).toHaveAttribute('aria-current', 'page'); await expect(nav(page, 'Ассистент')).not.toHaveAttribute('aria-current', 'page');
  await expect(row(page, 'project-committee').locator('.record-row-open')).toHaveAttribute('aria-current', 'true'); await expect(page.getByRole('button', { name: /К (?:истории диалогов|диалогу)/ })).toHaveCount(0);
});

test('choosing all records from an Assistant source changes section even for the same URL', async ({ page }) => {
  await nav(page, 'Ассистент').click(); await page.locator('.history-item-open').filter({ hasText: 'Что решили на проектном комитете?' }).click();
  await question(page).fill('Черновик разговора'); await page.locator('.answer-sources button').first().click();
  await expect(nav(page, 'Ассистент')).toHaveAttribute('aria-current', 'page'); await expect(page.getByRole('button', { name: 'К диалогу', exact: true })).toBeVisible();
  const sourceUrl = page.url(); await nav(page, 'Все записи').click(); await expect(nav(page, 'Все записи')).toHaveAttribute('aria-current', 'page');
  expect(page.url()).toBe(sourceUrl); await expect(nav(page, 'Ассистент')).not.toHaveAttribute('aria-current', 'page'); await expect(page.getByRole('button', { name: 'К диалогу', exact: true })).toHaveCount(0);
  await page.goBack(); await expect(nav(page, 'Ассистент')).toHaveAttribute('aria-current', 'page'); await expect(page.getByRole('button', { name: 'К диалогу', exact: true })).toBeVisible();
  await page.goForward(); await expect(nav(page, 'Все записи')).toHaveAttribute('aria-current', 'page'); await page.reload(); await expect(nav(page, 'Все записи')).toHaveAttribute('aria-current', 'page');
  await page.getByRole('button', { name: 'Закрыть карточку' }).click(); await expect(page.getByRole('heading', { name: 'Выберите запись' })).toBeVisible();
  await nav(page, 'Ассистент').click(); await page.locator('.history-item-open').filter({ hasText: 'Что решили на проектном комитете?' }).click(); await expect(question(page)).toHaveValue('Черновик разговора');
});

test('source opened from Assistant keeps its return context across tabs and reload', async ({ page }) => {
  await nav(page, 'Ассистент').click(); await page.locator('.history-item-open').filter({ hasText: 'Что решили на проектном комитете?' }).click();
  await page.locator('.answer-sources button').first().click(); await tab(page, 'Транскрипция').click();
  await expect(nav(page, 'Ассистент')).toHaveAttribute('aria-current', 'page'); await expect(page.getByRole('button', { name: 'К диалогу', exact: true })).toBeVisible();
  await page.reload(); await expect(nav(page, 'Ассистент')).toHaveAttribute('aria-current', 'page'); await page.getByRole('button', { name: 'К диалогу', exact: true }).click();
  await expect(page.locator('[data-turn-id="turn-decisions"]')).toContainText('Что решили на проектном комитете?');
});

test('record list uses the same secondary pane width and surface as dialog history', async ({ page }) => {
  for (const [width, height] of [[1024, 768], [1440, 900], [1920, 1080]]) {
    await page.setViewportSize({ width, height }); await nav(page, 'Все записи').click();
    const records = page.getByRole('region', { name: 'Панель записей' }); const recordWidth = (await records.boundingBox())!.width;
    const recordSurface = await records.evaluate(el => getComputedStyle(el).backgroundColor);
    await nav(page, 'Ассистент').click(); const history = page.getByRole('complementary', { name: 'История диалогов' });
    await expect(history).toBeVisible(); expect((await history.boundingBox())!.width).toBeCloseTo(recordWidth, 0); expect(await history.evaluate(el => getComputedStyle(el).backgroundColor)).toBe(recordSurface);
  }
});

test('selected records, dialogs and settings share the same secondary navigation treatment', async ({ page }) => {
  await openRecord(page); const selectedRecord = row(page, 'project-committee'); const color = await selectedRecord.evaluate(el => getComputedStyle(el).backgroundColor);
  await nav(page, 'Ассистент').click(); await page.locator('.history-item-open').first().click();
  const selectedDialog = page.locator('.history-item.is-active'); await expect(selectedDialog).toBeVisible(); expect(await selectedDialog.evaluate(el => getComputedStyle(el).backgroundColor)).toBe(color);
  await page.getByRole('button', { name: 'Настройки', exact: true }).click(); const selectedSetting = page.locator('.settings-navigation > button.is-active'); await expect(selectedSetting).toBeVisible();
  expect(await selectedSetting.evaluate(el => getComputedStyle(el).backgroundColor)).toBe(color);
});

test('compact secondary panel keeps its list actions and search usable at 1024px', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  const record = await page.getByRole('button', { name: 'Записать', exact: true }).boundingBox(); const add = await page.getByRole('button', { name: 'Добавить', exact: true }).boundingBox();
  expect(record!.y).toBe(add!.y); await expect(page.locator('.records-pane .search-input kbd')).toBeHidden();
  const search = page.getByRole('searchbox', { name: 'Поиск: Все записи' }); await search.fill('бюджет'); await expect(row(page, 'budget-discussion')).toBeVisible();
  await page.getByRole('button', { name: 'Фильтры', exact: true }).click(); await expect(page.getByRole('dialog', { name: 'Фильтры' })).toBeVisible();
});

test('placement changes the list scope but keeps the same recording and offers a return', async ({ page }) => {
  await openRecord(page); await tab(page, 'Ассистент').click(); await question(page).fill('Контекст сохранится');
  await page.getByRole('button', { name: 'Открыть пространство «Проектный комитет»' }).click();
  await expect(page).toHaveURL(/records\/project-committee\/assistant\?area=project$/); await expect(question(page)).toHaveValue('Контекст сохранится');
  await expect(row(page, 'project-committee').locator('.record-row-open')).toHaveAttribute('aria-current', 'true');
  await page.getByRole('button', { name: 'К предыдущему списку' }).click(); await expect(page.locator('.records-pane').getByRole('heading', { name: 'Все записи' })).toBeVisible();
  await expect(question(page)).toHaveValue('Контекст сохранится');
});

test('placement already shown in the list does not silently do nothing', async ({ page }) => {
  await space(page, 'Проектный комитет').click(); await openRecord(page);
  const before = page.url(); await page.getByRole('button', { name: 'Открыть пространство «Проектный комитет»' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Этот список уже открыт' })).toBeVisible(); expect(page.url()).toBe(before);
  await expect(row(page, 'project-committee').locator('.record-row-open')).toHaveAttribute('aria-current', 'true');
});

test('record conversation is the same dialogue in global Assistant and source return', async ({ page }) => {
  await openRecord(page); await tab(page, 'Ассистент').click(); await question(page).fill('Какие решения приняты?');
  await page.getByRole('button', { name: 'Отправить вопрос' }).click(); await page.clock.runFor(4000); await question(page).fill('Продолжение');
  const id = (await saved(page)).dialogs.find(d => d.recordContextId === 'project-committee')!.id;
  await nav(page, 'Ассистент').click(); await page.locator('.history-item-open').filter({ hasText: 'Какие решения приняты?' }).click();
  await expect(page).toHaveURL(new RegExp(`/assistant/${id}$`)); await expect(question(page)).toHaveValue('Продолжение');
  await page.locator('.answer-sources button').first().click(); await expect(page.getByRole('button', { name: 'К диалогу', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'К диалогу', exact: true }).click(); await expect(question(page)).toHaveValue('Продолжение');
});

test('closing a source opened from global Assistant returns to that conversation', async ({ page }) => {
  await nav(page, 'Ассистент').click(); await page.locator('.history-item-open').filter({ hasText: 'Что решили на проектном комитете?' }).click();
  await question(page).fill('Продолжение глобального диалога'); await page.locator('.answer-sources button').first().click();
  await page.getByRole('button', { name: 'Закрыть карточку' }).click(); await expect(question(page)).toHaveValue('Продолжение глобального диалога');
  await expect(page.locator('[data-turn-id="turn-decisions"]')).toContainText('Что решили на проектном комитете?');
});

test('recording from the selected folder preserves its destination', async ({ page }) => {
  await space(page, 'Проектный комитет').click(); await filter(page, 'Планирование'); await page.getByRole('button', { name: 'Открыть папку', exact: true }).click();
  await openRecord(page); await page.getByRole('button', { name: 'Записать', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Пространство для записи: Проектный комитет' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Папка для записи: Планирование' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Название записи' }).fill('Новая запись в папке'); await page.getByTestId('finish-recording').click();
  const created = (await saved(page)).records.find(r => r.title === 'Новая запись в папке')!; expect(created.areaId).toBe('project'); expect(created.folderId).toBe('project-planning');
  await expect(page.getByTestId('record-page')).toBeVisible(); await expect(page.locator('.records-pane').getByRole('heading', { name: 'Планирование' })).toBeVisible();
});

test('folder actions remain usable inside the compact list at 1024px', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 }); await space(page, 'Проектный комитет').click(); await filter(page, 'Планирование');
  await page.getByRole('button', { name: 'Открыть папку', exact: true }).click(); const bounds = await page.locator('.records-pane').boundingBox();
  for (const name of ['Записать', 'Ассистент', 'Добавить', 'Ещё']) {
    const action = page.locator('.records-pane').getByRole('button', { name, exact: true }); await expect(action).toBeVisible();
    const box = await action.boundingBox(); expect(box).not.toBeNull(); expect(box!.x).toBeGreaterThanOrEqual(bounds!.x); expect(box!.x + box!.width).toBeLessThanOrEqual(bounds!.x + bounds!.width + 1);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
});

test('deleting selected record clears the detail instead of opening another', async ({ page }) => {
  await openRecord(page); await page.getByRole('button', { name: 'Действия', exact: true }).click(); await page.getByRole('menuitem', { name: 'Удалить запись' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Удалить запись', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Выберите запись' })).toBeVisible(); await expect(row(page, 'project-committee')).toHaveCount(0);
  await expect(page.locator('.record-row.is-selected')).toHaveCount(0); expect((await saved(page)).records).toHaveLength(15);
});

test('arrow keys move focus in the list without starting a draft', async ({ page }) => {
  const first = row(page, 'project-committee').locator('.record-row-open'); await first.focus(); await page.keyboard.press('j');
  await expect(page.getByTestId('draft-row-draft-first').locator('.record-row-open')).toBeFocused(); await expect(page.getByTestId('recorder-page')).toHaveCount(0);
  await page.keyboard.press('k'); await expect(first).toBeFocused(); await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown');
  await expect(row(page, 'server-operations').locator('.record-row-open')).toBeFocused(); await page.keyboard.press('Enter');
  await expect(row(page, 'server-operations').locator('.record-row-open')).toHaveAttribute('aria-current', 'true');
});

test('experiment does not read or overwrite the working v2 key', async ({ page }) => {
  const marker = JSON.stringify({ record: 'Данные рабочей версии' }); expect(STORAGE_KEY).toBe('vinteo-thesis-desktop-list-detail-v1');
  await page.evaluate(value => localStorage.setItem('vinteo-thesis-desktop-v2', value), marker); await page.reload();
  await expect(page.getByTestId('record-row-project-committee')).toBeVisible(); expect(await page.evaluate(() => localStorage.getItem('vinteo-thesis-desktop-v2'))).toBe(marker);
});

for (const [width, height] of [[1024, 768], [1440, 900], [1920, 1080]]) test(`three panels and composer remain usable at ${width} × ${height}`, async ({ page }) => {
  await page.setViewportSize({ width, height }); await openRecord(page); await tab(page, 'Ассистент').click();
  const list = page.getByRole('region', { name: 'Панель записей' }); const detail = page.getByRole('region', { name: 'Содержимое записи' });
  const suggestions = page.locator('.assistant-layout--record .suggested-questions > button'); const conversation = await page.locator('.assistant-layout--record .conversation-scroll').boundingBox();
  expect(conversation).not.toBeNull(); for (const item of await suggestions.all()) { const box = await item.boundingBox(); expect(box).not.toBeNull(); expect(box!.y + box!.height).toBeLessThanOrEqual(conversation!.y + conversation!.height + 1); }
  const listBox = await list.boundingBox(); const detailBox = await detail.boundingBox(); const input = await question(page).boundingBox(); const player = await page.getByTestId('player-dock').boundingBox();
  expect(listBox).not.toBeNull(); expect(detailBox).not.toBeNull(); expect(input).not.toBeNull(); expect(player).not.toBeNull();
  expect(Math.abs(listBox!.x + listBox!.width - detailBox!.x)).toBeLessThanOrEqual(1); expect(player!.x).toBeGreaterThanOrEqual(detailBox!.x - 1);
  expect(input!.y + input!.height).toBeLessThanOrEqual(player!.y + 1); expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
});
