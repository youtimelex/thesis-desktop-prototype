import { expect, test, type Page } from '@playwright/test';
import { initialState } from '../src/fixtures';
import { STORAGE_KEY } from '../src/model';
import type { AppState, Turn } from '../src/types';
import { expectListFilter, selectOption as select } from './list-helpers';

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-11T12:00:00Z') });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Все записи', exact: true })).toBeVisible();
});

const nav = (page: Page, name: string) => page.getByRole('navigation', { name: 'Основная навигация' }).getByRole('button', { name, exact: true });
const space = (page: Page, name: string) => page.getByRole('navigation', { name: 'Пространства', exact: true }).getByRole('button', { name, exact: true });
const scopedAssistant = (page: Page) => page.getByRole('main').getByRole('button', { name: 'Ассистент', exact: true });
const saved = (page: Page): Promise<AppState> => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
const tab = (page: Page, name: RegExp) => page.getByRole('tablist', { name: 'Материалы записи' }).getByRole('tab', { name });
async function seed(page: Page, state: AppState) { await page.evaluate(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key: STORAGE_KEY, state }); await page.goto('/#/records'); await page.reload(); await expect(page.getByTestId('library-page')).toBeVisible(); }
async function openFolder(page: Page) { await space(page, 'Проектный комитет').click(); await select(page, 'Папка: Все папки', 'Планирование'); await page.getByRole('button', { name: 'Открыть папку', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Планирование', exact: true })).toBeVisible(); }
async function openRecord(page: Page, id = 'project-committee') { await page.getByTestId(`record-row-${id}`).getByRole('button').first().click(); await expect(page.getByTestId('record-page')).toBeVisible(); }

test('version uses its own storage key and never reads or overwrites v1 data', async ({ page }) => {
  expect(STORAGE_KEY).toBe('vinteo-thesis-desktop-list-detail-v1');
  const marker = JSON.stringify({ record: 'Данные исходной версии' });
  await page.evaluate(value => localStorage.setItem('vinteo-thesis-desktop-v1', value), marker);
  await page.reload(); await expect(page.locator('.record-row')).toHaveCount(17);
  expect(await page.evaluate(() => localStorage.getItem('vinteo-thesis-desktop-v1'))).toBe(marker);
});

test('compact sidebar shows a static server block; connection and account live in settings', async ({ page }) => {
  const sidebar = page.locator('.sidebar');
  const server = sidebar.getByRole('group', { name: 'Vinteo Тезис, thesis.sever.ru' });
  await expect(server).toBeVisible(); await expect(server).toContainText('Vinteo Тезис'); await expect(server).toContainText('thesis.sever.ru'); await expect(server).not.toContainText('Подключено'); await expect(server).not.toHaveAttribute('aria-expanded');
  await expect(server.locator('button, a')).toHaveCount(0); const before = page.url(); await server.click(); expect(page.url()).toBe(before);
  await expect(sidebar.locator('.brand, .profile-trigger')).toHaveCount(0); await expect(page.locator('.breadcrumbs')).toHaveCount(0);
  await sidebar.getByRole('button', { name: 'Настройки', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Подключение к Тезису' })).toBeVisible();
  await page.getByRole('button', { name: 'Нет подключения', exact: true }).click();
  await expect(sidebar.getByRole('group', { name: 'Vinteo Тезис, thesis.sever.ru, нет подключения' })).toBeVisible();
  await page.getByRole('navigation', { name: 'Разделы настроек' }).getByRole('button', { name: 'Аккаунт', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Аккаунт', exact: true })).toBeVisible();
  await expect(page.getByText('alexey.petrov@sever.ru', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Выйти из профиля', exact: true })).toBeVisible();
});

test('all spaces catalogue includes personal distinctly from shared membership', async ({ page }) => {
  await page.getByRole('button', { name: 'Все пространства', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Пространства', exact: true })).toBeVisible();
  const cards = page.locator('.workspace-grid'); await expect(cards.locator('.workspace-card')).toHaveCount(3);
  const personal = cards.getByRole('button', { name: /^Личное/ }); await expect(personal).toContainText('Только вам'); await expect(personal).not.toContainText('участник');
  await expect(cards.getByRole('button', { name: /^Проектный комитет/ })).toContainText('3 участника');
  await personal.click(); await expect(page.getByRole('heading', { name: 'Личное', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Ещё', exact: true }).click(); await expect(page.getByRole('menuitem', { name: 'Участники' })).toHaveCount(0);
});

test('folder filter stays on the space; opening the folder is explicit and has its own controls', async ({ page }) => {
  await space(page, 'Проектный комитет').click(); await select(page, 'Источник: Все источники', 'Файлы'); await select(page, 'Папка: Все папки', 'Планирование');
  await expect(page.getByRole('heading', { name: 'Проектный комитет', exact: true })).toBeVisible();
  await expect(page.locator('.search-scope-line')).toContainText('папка «Планирование»');
  await expectListFilter(page, 'Папка: Планирование');
  await page.getByRole('button', { name: 'Открыть папку', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Планирование', exact: true })).toBeVisible();
  await expectListFilter(page, 'Источник: Все источники');
  await expect(page.getByRole('button', { name: 'К пространству «Проектный комитет»' })).toBeVisible();
  await page.getByRole('button', { name: 'К пространству «Проектный комитет»' }).click();
  await expectListFilter(page, 'Источник: Файлы');
  await expectListFilter(page, 'Папка: Планирование');
});

test('space → folder → record → transcript → folder is direct and keeps sidebar context', async ({ page }) => {
  await openFolder(page); await openRecord(page);
  await expect(space(page, 'Проектный комитет')).toHaveAttribute('aria-current', 'page');
  await expect(nav(page, 'Все записи')).not.toHaveAttribute('aria-current', 'page');
  const tabs = page.getByRole('tablist', { name: 'Материалы записи' }); await expect(tabs.getByRole('tab')).toHaveCount(4);
  await tab(page, /^Транскрипция:/).click(); await expect(tab(page, /^Транскрипция:/)).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.records-pane').getByRole('heading', { name: 'Планирование', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'К пространству «Проектный комитет»' })).toBeVisible();
  await expect(space(page, 'Проектный комитет')).toHaveAttribute('aria-current', 'page');
});

test('single record placement opens the space and keeps the folder as its caption', async ({ page }) => {
  await openRecord(page);
  const link = page.getByTestId('record-page').getByRole('button', { name: 'Открыть пространство «Проектный комитет»' });
  await expect(link).toContainText('Планирование'); await link.click();
  await expect(page).toHaveURL(/#\/records\/project-committee\/summary\?area=project$/); await expect(page.locator('.records-pane').getByRole('heading', { name: 'Проектный комитет', exact: true })).toBeVisible();
  await expect(page.getByTestId('record-row-project-committee')).toBeVisible(); await expect(page.getByTestId('record-row-architecture-review')).toBeVisible();
  await page.getByRole('button', { name: 'К предыдущему списку', exact: true }).click(); await expect(page.getByTestId('record-page')).toBeVisible();
  await nav(page, 'Все записи').click(); await openRecord(page, 'server-operations');
  const placement = page.getByTestId('record-page').locator('.record-location'); await expect(placement).toContainText('Без пространства');
  await expect(placement.getByRole('button', { name: /Открыть пространство|Открыть папку/ })).toHaveCount(0);
});

test('search → record → previous results retains query, filters and list position', async ({ page }) => {
  const state = initialState(); const base = state.records.find(r => r.id === 'project-committee')!;
  state.records.push(...Array.from({ length: 24 }, (_, i) => ({ ...base, id: `search-${i}`, title: `Контрольная встреча ${i}`, createdAt: new Date(Date.UTC(2026, 7, 27, 12, 0, i)).toISOString(), transcript: [...base.transcript] })));
  await seed(page, state); await space(page, 'Проектный комитет').click();
  await page.getByRole('searchbox', { name: 'Поиск: Проектный комитет' }).fill('Контрольная встреча'); await select(page, 'Источник: Все источники', 'Файлы');
  const viewport = page.getByTestId('library-page'); await viewport.evaluate(el => { el.scrollTop = 440; });
  const row = page.getByTestId('record-row-search-17').getByRole('button').first(); await row.scrollIntoViewIfNeeded();
  const before = await viewport.evaluate(el => el.scrollTop); expect(before).toBeGreaterThan(0);
  await row.click(); await expect(page.getByTestId('record-page')).toBeVisible();
  await expect(page.getByRole('searchbox', { name: 'Поиск: Проектный комитет' })).toHaveValue('Контрольная встреча');
  await expectListFilter(page, 'Источник: Файлы');
  await expect.poll(() => viewport.evaluate(el => el.scrollTop)).toBeCloseTo(before, 0);
});

test('⌘K uses and displays the current workspace or folder scope from a record', async ({ page }) => {
  await openFolder(page); await openRecord(page); await page.keyboard.press('Meta+k');
  const search = page.getByRole('searchbox', { name: 'Поиск: папка «Планирование» · Проектный комитет' });
  await expect(search).toBeFocused(); await expect(page.locator('.search-scope-line')).toContainText('папка «Планирование» · Проектный комитет');
  await search.fill('комитет'); await expect(page.getByTestId('record-row-project-committee')).toBeVisible();
  await openRecord(page); await expect(search).toHaveValue('комитет'); await expect(page.getByTestId('record-page')).toBeVisible();
  await expect(page.locator('.records-pane').getByRole('heading', { name: 'Планирование', exact: true })).toBeVisible();
});

test('⌘K in a library focuses that library without losing scope or entering global search', async ({ page }) => {
  await space(page, 'Пилот с заказчиком').click(); await page.keyboard.press('Meta+k');
  const search = page.getByRole('searchbox', { name: 'Поиск: Пилот с заказчиком' }); await expect(search).toBeFocused();
  await expect(page.locator('.search-scope-line')).toContainText('Поиск в: Пилот с заказчиком');
  await search.fill('Интервью'); await expect(page.getByTestId('record-row-customer-interview')).toBeVisible();
  await openRecord(page, 'customer-interview'); await page.keyboard.press('Control+k');
  await expect(page.getByTestId('record-page')).toBeVisible();
  await expect(page.getByRole('searchbox', { name: 'Поиск: Пилот с заказчиком' })).toHaveValue('Интервью');
});

test('⌘K focuses pinned scoped search without disturbing a scrolled list', async ({ page }) => {
  const state = initialState(); const base = state.records.find(r => r.id === 'project-committee')!;
  state.records.push(...Array.from({ length: 24 }, (_, i) => ({ ...base, id: `list-scroll-${i}`, title: `Рабочая встреча ${i}`, createdAt: new Date(Date.UTC(2026, 7, 27, 12, 0, i)).toISOString() })));
  await seed(page, state); await space(page, 'Проектный комитет').click(); await select(page, 'Источник: Все источники', 'Файлы');
  const viewport = page.getByTestId('library-page'); await viewport.evaluate(el => { el.scrollTop = 450; }); await expect.poll(() => viewport.evaluate(el => el.scrollTop)).toBeGreaterThan(400);
  const before = await viewport.evaluate(el => el.scrollTop); await page.keyboard.press('Meta+k');
  await expect(page.getByRole('searchbox', { name: 'Поиск: Проектный комитет' })).toBeFocused();
  await expectListFilter(page, 'Источник: Файлы');
  await expect(page.getByRole('heading', { name: 'Проектный комитет', exact: true })).toBeVisible();
  await expect.poll(() => viewport.evaluate(el => el.scrollTop)).toBeCloseTo(before, 0);
});

test('Assistant launched from a folder uses only its records and shows the actual material', async ({ page }) => {
  await openFolder(page); await expect(scopedAssistant(page)).toHaveAccessibleDescription('Новый диалог по папке «Планирование»'); await scopedAssistant(page).click();
  await expect(page.getByRole('button', { name: 'Источники ответа: Проектный комитет · Планирование' })).toBeVisible();
  await expect(page.locator('.composer-materials')).toHaveText('1 запись · резюме');
  await page.getByRole('button', { name: 'Источники ответа: Проектный комитет · Планирование' }).click();
  const picker = page.getByRole('dialog', { name: 'Источники ответа' });
  await expect(picker.getByRole('button', { name: 'Папка для ответа: Планирование' })).toBeVisible();
  await expect(picker.locator('.source-record')).toHaveCount(1); await expect(picker.locator('.source-record')).toContainText('Резюме');
  await picker.getByRole('button', { name: 'Применить', exact: true }).click();
  await page.getByRole('textbox', { name: 'Вопрос Ассистенту' }).fill('Кратко по выбранным записям'); await page.getByRole('button', { name: 'Отправить вопрос' }).click(); await page.clock.runFor(4000);
  const created = (await saved(page)).dialogs[0]; expect(created.scope.folderId).toBe('project-planning'); expect(created.scope.areaId).toBe('project');
  expect(created.turns[0].snapshots.map(source => source.recordId)).toEqual(['project-committee']); expect(created.turns[0].snapshots[0].material).toBe('summary');
  await expect(page.locator('.answer-sources button').first()).toContainText('Резюме целиком');
  await page.getByRole('button', { name: 'К папке «Планирование»' }).click(); await expect(page.getByRole('heading', { name: 'Планирование', exact: true })).toBeVisible();
});

test('opening a selected folder seeds Assistant independently from list source filters', async ({ page }) => {
  await space(page, 'Проектный комитет').click(); await select(page, 'Папка: Все папки', 'Планирование'); await select(page, 'Источник: Все источники', 'ВКС');
  await expect(page.getByRole('heading', { name: 'Ничего не найдено' })).toBeVisible(); await expect(scopedAssistant(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Открыть папку', exact: true }).click(); await select(page, 'Источник: Все источники', 'ВКС');
  await expect(page.getByRole('heading', { name: 'Ничего не найдено' })).toBeVisible();
  await expect(scopedAssistant(page)).toHaveAccessibleDescription('Новый диалог по папке «Планирование»'); await scopedAssistant(page).click();
  await expect(page.locator('.composer-materials')).toHaveText('1 запись · резюме');
  await page.getByRole('textbox', { name: 'Вопрос Ассистенту' }).fill('Какие решения приняты?'); await page.getByRole('button', { name: 'Отправить вопрос' }).click(); await page.clock.runFor(4000);
  const dialog = (await saved(page)).dialogs[0]; expect(dialog.scope.folderId).toBe('project-planning'); expect(dialog.turns[0].snapshots.map(s => s.recordId)).toEqual(['project-committee']);
});

test('global Assistant can select only root records without a space-level button', async ({ page }) => {
  await space(page, 'Проектный комитет').click(); await select(page, 'Папка: Все папки', 'В корне пространства');
  await expect(scopedAssistant(page)).toHaveCount(0); await page.getByRole('button', { name: 'Открыть корень' }).click(); await expect(scopedAssistant(page)).toHaveCount(0);
  await nav(page, 'Ассистент').click(); await page.getByRole('button', { name: 'Новый диалог', exact: true }).first().click();
  await page.getByRole('button', { name: 'Источники ответа: Все доступные записи' }).click();
  await select(page, 'Область поиска: Все доступные записи', 'Проектный комитет'); await select(page, 'Папка для ответа: Все папки и корень', 'В корне пространства');
  await page.getByRole('dialog', { name: 'Источники ответа' }).getByRole('button', { name: 'Применить', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Источники ответа: Проектный комитет · В корне пространства' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Вопрос Ассистенту' }).fill('Кратко по выбранным записям'); await page.getByRole('button', { name: 'Отправить вопрос' }).click(); await page.clock.runFor(4000);
  const data = await saved(page); const dialog = data.dialogs[0]; expect(dialog.scope.folderId).toBe('root');
  expect(dialog.turns[0].snapshots.length).toBeGreaterThan(0);
  for (const source of dialog.turns[0].snapshots) { const record = data.records.find(r => r.id === source.recordId)!; expect(record.areaId).toBe('project'); expect(record.folderId).toBeNull(); }
});

test('existing unscoped folders can be used as Assistant sources without becoming personal', async ({ page }) => {
  const state = initialState(); state.records.find(r => r.id === 'server-operations')!.folderId = 'legacy-projects'; await seed(page, state);
  await page.getByRole('button', { name: 'Настройки', exact: true }).click(); await page.getByRole('button', { name: 'Хранилище', exact: true }).click();
  await page.getByRole('button', { name: /Папки без пространства/ }).click(); await page.getByRole('button', { name: /^Проекты VINTEO/ }).click();
  await expect(page.getByRole('heading', { name: 'Проекты VINTEO', exact: true })).toBeVisible();
  await expect(scopedAssistant(page)).toHaveAccessibleDescription('Новый диалог по папке «Проекты VINTEO»'); await scopedAssistant(page).click();
  await expect(page.getByRole('button', { name: 'Источники ответа: Папки без пространства · Проекты VINTEO' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Вопрос Ассистенту' }).fill('Какие решения приняты?'); await page.getByRole('button', { name: 'Отправить вопрос' }).click(); await page.clock.runFor(4000);
  const dialog = (await saved(page)).dialogs[0]; expect(dialog.scope.areaId).toBe('legacy'); expect(dialog.turns[0].snapshots.map(source => source.recordId)).toEqual(['server-operations']);
});

test('record → Assistant tab → source → transcript → chat keeps material and original folder', async ({ page }) => {
  const state = initialState(); const record = state.records.find(r => r.id === 'project-committee')!; record.duration = 4000;
  record.transcript = Array.from({ length: 60 }, (_, i) => ({ id: `long-${i}`, speaker: i % 2 ? 'Мария Соколова' : 'Алексей Петров', color: '#72b6e9', start: i * 50, end: i * 50 + 45, text: i === 1 || i === 55 ? `Важная договорённость: кварцевый ориентир номер ${i}. Контекст для проверки.` : `Обсуждение вопроса ${i}. Длинная реплика для проверки позиции после возврата.` }));
  await seed(page, state); await openFolder(page); await openRecord(page); await tab(page, /^Транскрипция:/).click();
  await page.getByRole('button', { name: /Поиск в транскрипции/ }).click(); await page.getByRole('textbox', { name: 'Поиск в транскрипции' }).fill('кварцевый'); await page.getByRole('button', { name: 'Следующее совпадение' }).click();
  const viewport = page.getByTestId('record-page'); const before = await viewport.evaluate(el => el.scrollTop); expect(before).toBeGreaterThan(500);
  await tab(page, /^Ассистент:/).click();
  await expect(page.locator('.records-pane').getByRole('heading', { name: 'Планирование', exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Вопрос Ассистенту' }).fill('Кратко по выбранным записям'); await page.getByRole('button', { name: 'Отправить вопрос' }).click(); await page.clock.runFor(4000);
  await page.locator('.answer-sources button').first().click(); await expect(tab(page, /^Резюме:/)).toHaveAttribute('aria-selected', 'true');
  await tab(page, /^Ассистент:/).click(); await expect(page.locator('.assistant-turn')).toHaveCount(1);
  await tab(page, /^Транскрипция:/).click();
  await expect(tab(page, /^Транскрипция:/)).toHaveAttribute('aria-selected', 'true'); await expect(page.getByRole('textbox', { name: 'Поиск в транскрипции' })).toHaveValue('кварцевый');
  await expect(page.getByRole('status', { name: 'Совпадение 2 из 2' })).toBeVisible(); await expect.poll(() => viewport.evaluate(el => el.scrollTop)).toBeCloseTo(before, 0);
  await expect(page.locator('.records-pane').getByRole('heading', { name: 'Планирование', exact: true })).toBeVisible();
});

test('a source opens its named material and returns to the same answer, position and focus', async ({ page }) => {
  const state = initialState(); const dialog = state.dialogs[0]; const template = dialog.turns[0];
  dialog.turns = Array.from({ length: 14 }, (_, i): Turn => ({ ...template, id: `turn-long-${i}`, question: `Вопрос номер ${i}`, answer: `Ответ номер ${i}.\n\n${'Подробная информация по встрече и договорённостям. '.repeat(9)}`, snapshots: template.snapshots.map(s => ({ ...s })), usedRecordIds: [...template.usedRecordIds] }));
  await seed(page, state); await nav(page, 'Ассистент').click(); await page.locator('.history-item-open').filter({ hasText: 'Что решили на проектном комитете?' }).click();
  const conversation = page.locator('.conversation-scroll'); const turn = page.locator('[data-turn-id="turn-long-4"]');
  await expect(page.locator('[data-turn-id="turn-long-0"] .markdown')).toContainText('Ответ номер 0.');
  await expect(turn.locator('.markdown')).toContainText('Ответ номер 4.');
  const source = turn.getByRole('button', { name: 'Открыть резюме записи «Проектный комитет»' }); await source.scrollIntoViewIfNeeded();
  await expect(source).toContainText('Резюме целиком · версия ответа 1');
  const before = await conversation.evaluate(el => el.scrollTop); const beforeOffset = (await turn.boundingBox())!.y - (await conversation.boundingBox())!.y;
  await source.click(); await expect(tab(page, /^Резюме:/)).toHaveAttribute('aria-selected', 'true'); await page.getByRole('button', { name: 'К диалогу', exact: true }).click();
  await expect(turn).toContainText('Ответ номер 4.'); await expect(source).toBeFocused();
  const after = await conversation.evaluate(el => el.scrollTop); const afterOffset = (await turn.boundingBox())!.y - (await conversation.boundingBox())!.y;
  const geometry = `scroll ${before} → ${after}; answer offset ${beforeOffset} → ${afterOffset}`;
  expect(Math.abs(after - before), geometry).toBeLessThanOrEqual(2); expect(Math.abs(afterOffset - beforeOffset), geometry).toBeLessThanOrEqual(2);
});

test('transcript source opens the whole transcript, not an invented moment', async ({ page }) => {
  const state = initialState(); const dialog = state.dialogs[0]; const transcript = state.records.find(r => r.id === 'contractor-meeting')!;
  dialog.turns = [{ id: 'source-transcript', question: 'Что обсудили?', status: 'ready', snapshots: [{ recordId: transcript.id, title: transcript.title, material: 'transcript', text: transcript.transcript.map(s => s.text).join('\n'), revision: transcript.transcriptRevision }], usedRecordIds: [transcript.id], answer: 'Обсуждали проверку совместимости.', dueAt: 0 }];
  await seed(page, state); await nav(page, 'Ассистент').click(); await page.locator('.history-item-open').filter({ hasText: 'Что решили на проектном комитете?' }).click();
  const source = page.getByRole('button', { name: 'Открыть транскрипцию записи «Встреча с подрядчиком»' }); await expect(source).toContainText('Транскрипция целиком'); await expect(source).not.toContainText('00:');
  await source.click(); await expect(tab(page, /^Транскрипция:/)).toHaveAttribute('aria-selected', 'true'); await expect(page.getByRole('slider', { name: 'Позиция воспроизведения' })).toHaveValue('0'); await expect(page.getByRole('button', { name: 'Воспроизвести запись' })).toBeVisible();
  await page.getByRole('button', { name: 'К диалогу' }).click(); await expect(source).toBeVisible();
});

test('legacy or changed sources identify what opens without pretending to show an old version', async ({ page }) => {
  const state = initialState(); const dialog = state.dialogs[0]; const source = dialog.turns[0].snapshots[0];
  delete source.material; state.records.find(r => r.id === source.recordId)!.summaryRevision = 2;
  await seed(page, state); await nav(page, 'Ассистент').click(); await page.locator('.history-item-open').filter({ hasText: 'Что решили на проектном комитете?' }).click();
  const link = page.getByRole('button', { name: /Открыть запись «Проектный комитет», резюме по умолчанию/ }); await expect(link).toContainText('Запись · откроется резюме'); await link.click(); await expect(tab(page, /^Резюме:/)).toHaveAttribute('aria-selected', 'true');
  const changed = initialState(); changed.records.find(r => r.id === 'project-committee')!.summaryRevision = 2; await seed(page, changed); await nav(page, 'Ассистент').click(); await page.locator('.history-item-open').filter({ hasText: 'Что решили на проектном комитете?' }).click();
  await expect(page.getByRole('button', { name: /текущая версия отличается от источника ответа/ })).toContainText('материал изменён');
});

test('pending answer can be stopped and retried with identical question and sources', async ({ page }) => {
  await nav(page, 'Ассистент').click(); await page.getByRole('button', { name: 'Новый диалог', exact: true }).first().click();
  await page.getByRole('textbox', { name: 'Вопрос Ассистенту' }).fill('Какие решения приняты?'); await page.getByRole('button', { name: 'Отправить вопрос' }).click();
  await expect(page.getByRole('button', { name: 'Остановить ответ', exact: true })).toBeVisible();
  const original = (await saved(page)).dialogs[0].turns[0]; expect(original.status).toBe('pending');
  await page.getByRole('button', { name: 'Остановить ответ', exact: true }).click(); await expect(page.getByText('Ответ остановлен. Вопрос и источники сохранены.')).toBeVisible();
  await page.clock.runFor(6000); const stopped = (await saved(page)).dialogs[0].turns[0]; expect(stopped.status).toBe('stopped'); expect(stopped.answer).toBe('');
  await page.getByRole('button', { name: 'Повторить запрос', exact: true }).click(); await expect(page.getByRole('button', { name: 'Остановить ответ' })).toBeVisible(); await page.clock.runFor(3000);
  const dialog = (await saved(page)).dialogs[0]; expect(dialog.turns).toHaveLength(1); expect(dialog.turns[0].id).toBe(original.id); expect(dialog.turns[0].question).toBe(original.question); expect(dialog.turns[0].snapshots).toEqual(original.snapshots); expect(dialog.turns[0].status).toBe('ready');
});

test('stopped answer cannot retry offline and states why', async ({ page }) => {
  await nav(page, 'Ассистент').click(); await page.getByRole('button', { name: 'Новый диалог', exact: true }).first().click();
  await page.getByRole('textbox', { name: 'Вопрос Ассистенту' }).fill('Вопрос для повтора'); await page.getByRole('button', { name: 'Отправить вопрос' }).click(); await page.getByRole('button', { name: 'Остановить ответ' }).click();
  await page.getByRole('button', { name: 'Настройки', exact: true }).click(); await page.getByRole('button', { name: 'Нет подключения', exact: true }).click(); await nav(page, 'Ассистент').click(); await page.locator('.history-item-open').filter({ hasText: 'Вопрос для повтора' }).click();
  await expect(page.getByRole('button', { name: 'Повторить запрос' })).toBeDisabled(); await expect(page.getByText('Подключитесь к сети, чтобы повторить запрос.')).toBeVisible();
});

test('record tabs support Arrow keys, Home and End without changing the return target', async ({ page }) => {
  await openRecord(page); const summary = tab(page, /^Резюме:/); await summary.focus(); await page.keyboard.press('ArrowRight'); await page.clock.runFor(20);
  await expect(tab(page, /^Транскрипция:/)).toBeFocused(); await expect(tab(page, /^Транскрипция:/)).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowRight'); await page.clock.runFor(20); await expect(tab(page, /^Ассистент:/)).toBeFocused(); await expect(tab(page, /^Ассистент:/)).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowRight'); await page.clock.runFor(20); await expect(tab(page, /^Сведения:/)).toBeFocused(); await expect(page.getByRole('heading', { name: 'Сведения о записи' })).toBeVisible();
  await page.keyboard.press('Home'); await page.clock.runFor(20); await expect(tab(page, /^Резюме:/)).toBeFocused();
  await page.keyboard.press('End'); await page.clock.runFor(20); await expect(tab(page, /^Сведения:/)).toBeFocused();
  await expect(page.locator('.records-pane').getByRole('heading', { name: 'Все записи' })).toBeVisible(); await expect(page.getByTestId('record-row-project-committee').locator('.record-row-open')).toHaveAttribute('aria-current', 'true');
});

for (const width of [1024, 1440, 1920]) test(`desktop layout keeps its server and accessible record controls at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await expect(page.locator('.sidebar-server')).toContainText('thesis.sever.ru');
  await expect(page.locator('.sidebar-server')).toContainText('Vinteo Тезис'); await expect(page.locator('.sidebar-server')).not.toContainText('Подключено');
  await openRecord(page); await tab(page, /^Транскрипция:/).click();
  await expect(page.getByRole('tablist', { name: 'Материалы записи' })).toBeVisible();
  await expect(page.getByRole('tab', { name: /^Ассистент:/ })).toBeVisible(); await expect(page.getByTestId('record-page').locator('.record-location').getByRole('button', { name: /Ассистент/ })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  if (width === 1440) await page.screenshot({ path: 'qa/v2-record-1440.png' });
});
