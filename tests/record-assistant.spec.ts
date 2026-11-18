import { expect, test, type Page } from '@playwright/test';
import { initialState } from '../src/fixtures';
import { STORAGE_KEY } from '../src/model';
import type { AppState, AssistantDialog, Turn } from '../src/types';
import { selectOption as select } from './list-helpers';

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-11T12:00:00Z') });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Все записи', exact: true })).toBeVisible();
});

const nav = (page: Page, name: string) => page.getByRole('navigation', { name: 'Основная навигация' }).getByRole('button', { name, exact: true });
const space = (page: Page, name: string) => page.getByRole('navigation', { name: 'Пространства', exact: true }).getByRole('button', { name, exact: true });
const tab = (page: Page, name: string) => page.getByRole('tablist', { name: 'Материалы записи' }).getByRole('tab', { name: new RegExp(`^${name}:`) });
const draft = (page: Page) => page.getByRole('textbox', { name: 'Вопрос Ассистенту' });
const saved = (page: Page): Promise<AppState> => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
const recordButton = (page: Page) => page.getByRole('main').getByRole('button', { name: 'Записать', exact: true });
async function openRecord(page: Page, id = 'project-committee') { await page.getByTestId(`record-row-${id}`).getByRole('button').first().click(); await expect(page.getByTestId('record-page')).toBeVisible(); }
async function openAssistant(page: Page) { await tab(page, 'Ассистент').click(); await expect(page.getByTestId('record-assistant')).toBeVisible(); }

test('one record conversation keeps its turns and draft across tabs, reload and global history', async ({ page }) => {
  await openRecord(page);
  const tabs = page.getByRole('tablist', { name: 'Материалы записи' });
  await expect(tabs.getByRole('tab').locator('strong')).toHaveText(['Резюме', 'Транскрипция', 'Ассистент', 'Сведения']);
  await openAssistant(page); await expect(page.locator('.record-chat-heading')).toContainText('Диалог по записи'); await expect(page.locator('.record-chat-heading')).toContainText('Проектный комитет');
  await expect(page.getByTestId('record-assistant').locator('.composer-source-row')).toHaveCount(0);
  await draft(page).fill('Какие решения приняты?');
  await expect.poll(async () => (await saved(page)).dialogs.filter(d => d.recordContextId === 'project-committee').length).toBe(1);
  const id = (await saved(page)).dialogs.find(d => d.recordContextId === 'project-committee')!.id;
  expect(id).not.toBe('dialog-decisions'); expect((await saved(page)).dialogs.find(d => d.id === 'dialog-decisions')!.turns).toHaveLength(1);
  await tab(page, 'Транскрипция').click(); await expect(page.getByTestId('record-assistant')).toHaveCount(0);
  await expect(page.locator('.transcript-card')).toBeVisible(); await openAssistant(page);
  await expect(page.locator('.transcript-card')).toHaveCount(0); await expect(draft(page)).toHaveValue('Какие решения приняты?');
  await page.getByRole('button', { name: 'Отправить вопрос' }).click(); await page.clock.runFor(4000);
  await expect(page.locator('.assistant-turn')).toContainText('Какие решения приняты?'); await expect(page.locator('.answer-sources button')).toHaveCount(1);
  await draft(page).fill('Неотправленное продолжение'); await tab(page, 'Сведения').click(); await expect(page.getByTestId('record-assistant')).toHaveCount(0);
  await openAssistant(page); await expect(draft(page)).toHaveValue('Неотправленное продолжение'); await expect(page.locator('.assistant-turn')).toHaveCount(1);
  await space(page, 'Личное').click(); await nav(page, 'Все записи').click(); await openRecord(page); await openAssistant(page);
  await expect(draft(page)).toHaveValue('Неотправленное продолжение'); await page.reload();
  await expect(page.getByTestId('record-assistant')).toBeVisible(); await expect(draft(page)).toHaveValue('Неотправленное продолжение');
  expect((await saved(page)).dialogs.filter(d => d.recordContextId === 'project-committee')).toHaveLength(1);
  await nav(page, 'Ассистент').click(); const historyItem = page.locator('.history-item').filter({ hasText: 'Какие решения приняты?' });
  await expect(historyItem).toContainText('Запись · Проектный комитет'); await historyItem.locator('.history-item-open').click();
  await expect(page).toHaveURL(new RegExp(`/assistant/${id}$`)); await expect(draft(page)).toHaveValue('Неотправленное продолжение');
  await expect(page.locator('.composer-source-row')).toContainText('Контекст:'); await expect(page.getByRole('button', { name: 'Источники ответа: Проектный комитет' })).toBeVisible();
  await draft(page).fill('Изменено в общей истории'); await page.locator('.answer-sources button').first().click();
  await expect(page.getByRole('button', { name: 'К диалогу', exact: true })).toBeVisible(); await openAssistant(page);
  await expect(draft(page)).toHaveValue('Изменено в общей истории'); await expect(page.locator('.assistant-turn')).toHaveCount(1);
  const data = await saved(page); expect(data.dialogs.filter(d => d.recordContextId === 'project-committee')).toHaveLength(1); expect(data.dialogs.find(d => d.recordContextId === 'project-committee')!.id).toBe(id);
});

test('different recordings keep separate record conversations and leave old history untouched', async ({ page }) => {
  await openRecord(page); await openAssistant(page); await draft(page).fill('Черновик первой записи');
  await openRecord(page, 'budget-discussion'); await openAssistant(page);
  await expect(draft(page)).toHaveValue(''); await draft(page).fill('Черновик второй записи');
  await openRecord(page); await openAssistant(page);
  await expect(draft(page)).toHaveValue('Черновик первой записи');
  const data = await saved(page); const linked = data.dialogs.filter(d => d.recordContextId);
  expect(linked).toHaveLength(2); expect(new Set(linked.map(d => d.id)).size).toBe(2);
  expect(data.dialogs.find(d => d.id === 'dialog-decisions')!.turns[0].question).toBe('Что решили на проектном комитете?');
});

test('changing sources of a record-linked chat creates a separate global dialogue', async ({ page }) => {
  await openRecord(page); await openAssistant(page); await draft(page).fill('Вопрос до смены источников');
  const recordId = (await saved(page)).dialogs.find(d => d.recordContextId === 'project-committee')!.id;
  await nav(page, 'Ассистент').click(); await page.locator('.history-item-open').filter({ hasText: 'Вопрос до смены источников' }).click();
  await page.getByRole('button', { name: 'Источники ответа: Проектный комитет' }).click(); await select(page, 'Область поиска: Все доступные записи', 'Личное');
  await page.getByRole('dialog', { name: 'Источники ответа' }).getByRole('button', { name: 'Применить', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Начать новый диалог?' })).toContainText('Диалог останется связан с записью');
  await page.getByRole('dialog', { name: 'Начать новый диалог?' }).getByRole('button', { name: 'Новый диалог' }).click();
  await expect(draft(page)).toHaveValue('Вопрос до смены источников');
  const data = await saved(page); const linked = data.dialogs.find(d => d.id === recordId)!; const changed = data.dialogs.find(d => d.draft === 'Вопрос до смены источников')!;
  expect(linked.recordContextId).toBe('project-committee'); expect(linked.scope.recordIds).toEqual(['project-committee']); expect(linked.draft).toBe('');
  expect(changed.id).not.toBe(recordId); expect(changed.recordContextId).toBeUndefined(); expect(changed.scope.areaId).toBe('personal');
  await nav(page, 'Все записи').click(); await openRecord(page); await openAssistant(page); await expect(draft(page)).toHaveValue('');
  expect((await saved(page)).dialogs.find(d => d.recordContextId === 'project-committee')!.id).toBe(recordId);
});

test('an answer continues while the user switches tabs and can be stopped and retried', async ({ page }) => {
  await openRecord(page); await openAssistant(page); await draft(page).fill('Какие решения приняты?'); await page.getByRole('button', { name: 'Отправить вопрос' }).click();
  await expect(page.getByRole('button', { name: 'Остановить ответ' })).toBeVisible(); await page.getByRole('button', { name: 'Остановить ответ' }).click();
  await expect(page.getByText('Ответ остановлен. Вопрос и источники сохранены.')).toBeVisible(); await page.getByRole('button', { name: 'Повторить запрос' }).click();
  await tab(page, 'Резюме').click(); await page.clock.runFor(4000); await openAssistant(page);
  await expect(page.locator('.assistant-turn')).toContainText('Какие решения приняты?'); await expect(page.locator('.answer-sources button')).toHaveCount(1);
  const linked = (await saved(page)).dialogs.find(d => d.recordContextId === 'project-committee')!; expect(linked.turns).toHaveLength(1); expect(linked.turns[0].status).toBe('ready');
});

test('record composer is compact and supports multiline questions without changing its source', async ({ page }) => {
  await openRecord(page); await openAssistant(page); const chat = page.getByTestId('record-assistant');
  await expect(chat.locator('.composer-source-row')).toHaveCount(0); await expect(chat.locator('.record-chat-heading')).toContainText('Проектный комитет');
  const form = await chat.locator('.assistant-composer').boundingBox(); expect(form).not.toBeNull(); expect(form!.height).toBeLessThanOrEqual(65);
  await draft(page).fill('Первая строка'); await draft(page).press('Shift+Enter'); await page.keyboard.type('Вторая строка');
  await expect(draft(page)).toHaveValue('Первая строка\nВторая строка'); await draft(page).press('Enter'); await page.clock.runFor(4000);
  await expect(page.locator('.question-bubble')).toHaveText('Первая строка\nВторая строка'); await expect(page.locator('.answer-sources button')).toHaveCount(1);
  const turn = (await saved(page)).dialogs.find(d => d.recordContextId === 'project-committee')!.turns[0];
  expect(turn.snapshots.map(source => source.recordId)).toEqual(['project-committee']);
});

test('returning to the record Assistant with arrow keys keeps focus on its tab', async ({ page }) => {
  await openRecord(page); await openAssistant(page); await draft(page).fill('Какие решения приняты?');
  await page.getByRole('button', { name: 'Отправить вопрос' }).click(); await page.clock.runFor(4000); await page.locator('.answer-sources button').first().click();
  await tab(page, 'Резюме').focus(); await page.keyboard.press('ArrowRight'); await page.clock.runFor(20); await expect(tab(page, 'Транскрипция')).toBeFocused();
  await page.keyboard.press('ArrowRight'); await page.clock.runFor(20); await expect(tab(page, 'Ассистент')).toBeFocused(); await expect(page.locator('.assistant-turn')).toHaveCount(1);
});

test('returning from a source keeps the same record answer and chat position', async ({ page }) => {
  const state = initialState(); const template = state.dialogs[0].turns[0];
  const conversation: AssistantDialog = { id: 'record-long-chat', title: 'Диалог о записи', draft: 'Черновик', server: state.server!.address, owner: 'alexey.petrov@sever.ru', recordContextId: 'project-committee', scope: { mode: 'explicit', areaId: 'all', recordIds: ['project-committee'] }, createdAt: Date.now(), updatedAt: Date.now(), turns: Array.from({ length: 12 }, (_, i): Turn => ({ ...template, id: `record-long-${i}`, question: `Вопрос ${i}`, answer: `Ответ ${i}.\n\n${'Подробности обсуждения и сохранённые договорённости. '.repeat(8)}`, snapshots: template.snapshots.map(s => ({ ...s })), usedRecordIds: [...template.usedRecordIds] })) };
  state.dialogs.unshift(conversation); await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: STORAGE_KEY, value: state });
  await page.goto('/#/records/project-committee/assistant'); await page.reload();
  const viewport = page.locator('[data-testid="record-assistant"] .conversation-scroll'); const turn = page.locator('[data-turn-id="record-long-4"]');
  await expect(page.locator('[data-turn-id="record-long-0"] .markdown')).toContainText('Ответ 0.'); await expect(turn.locator('.markdown')).toContainText('Ответ 4.');
  const source = turn.getByRole('button', { name: 'Открыть резюме записи «Проектный комитет»' }); await source.scrollIntoViewIfNeeded();
  const before = await viewport.evaluate(el => el.scrollTop); const offset = (await turn.boundingBox())!.y - (await viewport.boundingBox())!.y;
  await source.click(); await expect(tab(page, 'Резюме')).toHaveAttribute('aria-selected', 'true'); await openAssistant(page);
  await expect(turn).toContainText('Ответ 4.'); await expect(draft(page)).toHaveValue('Черновик');
  const after = await viewport.evaluate(el => el.scrollTop); const returnedOffset = (await turn.boundingBox())!.y - (await viewport.boundingBox())!.y;
  expect(Math.abs(after - before)).toBeLessThanOrEqual(2); expect(Math.abs(returnedOffset - offset)).toBeLessThanOrEqual(2);
});

test('a local unsent recording keeps a draft but never fabricates available sources', async ({ page }) => {
  await openRecord(page, 'workgroup'); await openAssistant(page); await expect(page.getByTestId('record-assistant').locator('.composer-source-row')).toHaveCount(0);
  await expect(page.getByText('Вопрос можно отправить после загрузки записи и появления текста.')).toBeVisible();
  await draft(page).fill('Вопрос до обработки'); await expect(page.getByRole('button', { name: 'Отправить вопрос' })).toBeDisabled();
  await tab(page, 'Резюме').click(); await openAssistant(page); await expect(draft(page)).toHaveValue('Вопрос до обработки');
  const linked = (await saved(page)).dialogs.find(d => d.recordContextId === 'workgroup')!; expect(linked.turns).toHaveLength(0); expect(linked.scope.recordIds).toEqual(['workgroup']);
});

test('partial transcript can be used as a record conversation with its existing notice', async ({ page }) => {
  await openRecord(page, 'contractor-meeting'); await openAssistant(page); await expect(page.getByTestId('record-assistant').locator('.composer-source-row')).toHaveCount(0);
  await draft(page).fill('Кратко по выбранным записям'); await page.getByRole('button', { name: 'Отправить вопрос' }).click(); await page.clock.runFor(4000);
  await expect(page.getByText('По распознанной части', { exact: true })).toBeVisible(); await expect(page.locator('.answer-sources button').first()).toContainText('Транскрипция целиком');
  const linked = (await saved(page)).dialogs.find(d => d.recordContextId === 'contractor-meeting')!; expect(linked.turns[0].snapshots[0].material).toBe('transcript');
});

test('one placement button changes the list and keeps the same record tab', async ({ page }) => {
  await openRecord(page); await openAssistant(page); await draft(page).fill('Оставить в карточке');
  const detail = page.getByTestId('record-page');
  const placement = detail.locator('.record-location-action'); await expect(placement).toHaveCount(1);
  await expect(placement).toHaveRole('button'); await expect(placement).toHaveAccessibleName('Открыть пространство «Проектный комитет»');
  await expect(placement).toHaveAccessibleDescription('Планирование'); await expect(placement.locator('strong')).toHaveText('Проектный комитет');
  await expect(placement.locator('small')).toHaveText('Планирование'); await expect(detail.getByRole('button', { name: /Открыть папку/ })).toHaveCount(0);
  await placement.click(); await expect(page).toHaveURL(/#\/records\/project-committee\/assistant\?area=project$/); await expect(page.getByRole('button', { name: 'К предыдущему списку', exact: true })).toBeVisible();
  await select(page, 'Папка: Все папки', 'Планирование'); await page.getByRole('button', { name: 'Открыть папку', exact: true }).click();
  await expect(page).toHaveURL(/#\/spaces\/project\/folders\/project-planning$/); await page.goBack();
  await page.getByRole('button', { name: 'К предыдущему списку', exact: true }).click();
  await expect(tab(page, 'Ассистент')).toHaveAttribute('aria-selected', 'true'); await expect(draft(page)).toHaveValue('Оставить в карточке');
  await expect(page.locator('.records-pane').getByRole('heading', { name: 'Все записи' })).toBeVisible();
});

test('personal or unplaced recordings do not show a fictitious folder or workspace link', async ({ page }) => {
  await openRecord(page, 'budget-discussion'); let aside = page.getByTestId('record-page').locator('.record-location');
  await expect(aside.getByRole('button', { name: 'Открыть пространство «Личное»' })).toBeVisible(); await expect(aside.getByRole('button', { name: /Открыть папку/ })).toHaveCount(0);
  await openRecord(page, 'server-operations'); aside = page.getByTestId('record-page').locator('.record-location');
  await expect(aside).toContainText('Без пространства'); await expect(aside.getByRole('button', { name: /Открыть пространство|Открыть папку/ })).toHaveCount(0);
});

test('an existing unscoped folder remains the sole available placement link', async ({ page }) => {
  const state = initialState(); state.records.find(r => r.id === 'server-operations')!.folderId = 'legacy-projects';
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: STORAGE_KEY, value: state }); await page.reload();
  await openRecord(page, 'server-operations'); const placement = page.locator('.record-location-action');
  await expect(placement).toHaveAccessibleName('Открыть папку «Проекты VINTEO»'); await expect(placement).toHaveAccessibleDescription('Проекты VINTEO');
  await expect(placement.locator('strong')).toHaveText('Без пространства'); await placement.click();
  await expect(page).toHaveURL(/#\/records\/server-operations\/summary\?area=legacy&folder=legacy-projects$/); await expect(page.getByTestId('record-row-server-operations')).toBeVisible();
  await page.getByRole('button', { name: 'К предыдущему списку', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Оперативное совещание', exact: true })).toBeVisible();
});

test('an unavailable folder is identified without inventing a destination', async ({ page }) => {
  const state = initialState(); state.records.find(r => r.id === 'project-committee')!.folderId = 'missing-folder';
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: STORAGE_KEY, value: state }); await page.reload();
  await openRecord(page); const placement = page.locator('.record-location-action');
  await expect(placement).toHaveAccessibleName('Открыть пространство «Проектный комитет»'); await expect(placement).toHaveAccessibleDescription('Папка недоступна');
  await placement.click(); await expect(page).toHaveURL(/#\/records\/project-committee\/summary\?area=project$/); await page.getByRole('button', { name: 'К предыдущему списку', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Проектный комитет', exact: true })).toBeVisible();
});

test('speaker names are complete and arranged in a vertical list', async ({ page }) => {
  const state = initialState(); const longName = 'Александра Длинная-Фамилия С Очень Большим Именем';
  state.records.find(r => r.id === 'project-committee')!.transcript[0].speaker = longName;
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: STORAGE_KEY, value: state }); await page.reload();
  await openRecord(page); await tab(page, 'Сведения').click(); const list = page.getByRole('list', { name: 'Спикеры записи' }); const names = list.locator('li > span:last-child');
  await expect(names).toHaveText([longName, 'Мария Соколова', 'Дмитрий Волков', 'Алексей Петров']);
  const first = await list.getByRole('listitem').nth(0).boundingBox(); const second = await list.getByRole('listitem').nth(1).boundingBox();
  expect(first).not.toBeNull(); expect(second).not.toBeNull(); expect(second!.y).toBeGreaterThanOrEqual(first!.y + first!.height);
  expect(await names.first().evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
});

test('record card has no record button on any tab; the folder header keeps its recording destination', async ({ page }) => {
  await space(page, 'Проектный комитет').click(); await select(page, 'Папка: Все папки', 'Планирование');
  await page.getByRole('button', { name: 'Открыть папку' }).click(); await openRecord(page);
  for (const name of ['Резюме', 'Транскрипция', 'Ассистент', 'Сведения']) {
    await tab(page, name).click(); await expect(page.locator('.detail-pane').getByRole('button', { name: 'Записать', exact: true })).toHaveCount(0); await expect(page.getByRole('button', { name: 'Действия', exact: true })).toBeVisible();
  }
  await expect(recordButton(page)).toHaveAccessibleDescription('После отправки: Проектный комитет · Планирование'); await recordButton(page).click();
  await expect(page.getByRole('button', { name: 'Пространство для записи: Проектный комитет' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Папка для записи: Планирование' })).toBeVisible();
});

test('record action stays on record lists and preserves its destination', async ({ page }) => {
  await expect(page.locator('.sidebar').getByRole('button', { name: 'Записать', exact: true })).toHaveCount(0);
  await expect(recordButton(page)).toHaveCount(1); await expect(page.locator('.topbar').getByRole('button', { name: 'Записать', exact: true })).toHaveCount(0);
  await expect(page.locator('.page-heading').getByRole('button', { name: 'Записать', exact: true })).toBeVisible(); await expect(recordButton(page)).toHaveAccessibleDescription('После отправки: Личное · Без папки');
  await nav(page, 'Ассистент').click(); await expect(recordButton(page)).toHaveCount(0);
  await space(page, 'Проектный комитет').click(); await expect(recordButton(page)).toHaveAccessibleDescription('После отправки: Проектный комитет · В корне пространства');
  await select(page, 'Папка: Все папки', 'Планирование'); await expect(recordButton(page)).toHaveAccessibleDescription('После отправки: Проектный комитет · Планирование');
  await page.getByRole('button', { name: 'Открыть папку' }).click(); await expect(recordButton(page)).toHaveAccessibleDescription('После отправки: Проектный комитет · Планирование');
  await recordButton(page).click(); await expect(page.getByRole('button', { name: 'Пространство для записи: Проектный комитет' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Папка для записи: Планирование' })).toBeVisible(); await expect(recordButton(page)).toHaveCount(0); await expect(page.getByTestId('finish-recording')).toBeVisible();
});

test('a completed meeting retains its route while switching to the record Assistant', async ({ page }) => {
  const state = initialState(); state.meetings = [{ id: 'completed-test', title: 'Проектный комитет', url: 'https://meet.company.ru/room', agentName: 'Тезис Агент', areaId: 'project', server: state.server!.address, stage: 'completed', startedAt: Date.now(), pausedMs: 0, resultId: 'project-committee' }];
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: STORAGE_KEY, value: state });
  await page.goto('/#/meetings/completed-test'); await page.reload(); await openAssistant(page); await expect(page).toHaveURL(/#\/meetings\/completed-test\/assistant$/);
  await expect(page.locator('.detail-pane').getByRole('button', { name: 'Записать', exact: true })).toHaveCount(0);
  await draft(page).fill('Вопрос по встрече'); await tab(page, 'Сведения').click(); await openAssistant(page); await expect(draft(page)).toHaveValue('Вопрос по встрече');
  expect((await saved(page)).dialogs.find(d => d.recordContextId === 'project-committee')?.draft).toBe('Вопрос по встрече');
});

for (const width of [1024, 1440, 1920]) test(`record Assistant and player remain usable at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 }); await openRecord(page); await openAssistant(page);
  const chat = page.getByTestId('record-assistant'); const input = draft(page); const player = page.getByTestId('player-dock');
  await expect(chat).toBeVisible(); await expect(input).toBeVisible(); await expect(player).toBeVisible();
  const inputBox = await input.boundingBox(); const playerBox = await player.boundingBox(); const tabBox = await tab(page, 'Ассистент').boundingBox();
  expect(inputBox).not.toBeNull(); expect(playerBox).not.toBeNull(); expect(tabBox).not.toBeNull();
  expect(inputBox!.y).toBeGreaterThan(tabBox!.y + tabBox!.height); expect(inputBox!.y + inputBox!.height).toBeLessThanOrEqual(playerBox!.y + 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
});
