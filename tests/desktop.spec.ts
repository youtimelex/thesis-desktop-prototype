import { expect, test, type Page } from '@playwright/test';
import { initialState } from '../src/fixtures';
import { STORAGE_KEY } from '../src/model';
import type { AppState } from '../src/types';
import { expectListFilter, selectOption as select } from './list-helpers';

test.beforeEach(async ({ page }) => { await page.clock.install({ time: new Date('2026-11-10T12:00:00Z') }); await page.goto('/'); await expect(page.getByRole('heading', { name: 'Все записи', exact: true })).toBeVisible(); });
const nav = (page: Page, name: string) => page.getByRole('navigation', { name: 'Основная навигация' }).getByRole('button', { name, exact: true });
const space = (page: Page, name: string) => page.getByRole('navigation', { name: 'Пространства', exact: true }).getByRole('button', { name, exact: true });
const saved = (page: Page): Promise<AppState> => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
async function seed(page: Page, state: AppState, hash = '/records') { await page.evaluate(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key: STORAGE_KEY, state }); await page.goto(`/#${hash}`); await page.reload(); }
async function openRecord(page: Page, id = 'project-committee') { await page.getByTestId(`record-row-${id}`).getByRole('button').first().click(); await expect(page.getByTestId('record-page')).toBeVisible(); }
async function newDialog(page: Page) { await nav(page, 'Ассистент').click(); await page.getByRole('button', { name: 'Новый диалог', exact: true }).first().click(); await expect(page.getByRole('textbox', { name: 'Вопрос Ассистенту' })).toBeVisible(); }
function wav() { const buffer = Buffer.alloc(16044); buffer.write('RIFF', 0); buffer.writeUInt32LE(16036, 4); buffer.write('WAVEfmt ', 8); buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22); buffer.writeUInt32LE(8000, 24); buffer.writeUInt32LE(16000, 28); buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34); buffer.write('data', 36); buffer.writeUInt32LE(16000, 40); return buffer; }

test('library visual baseline and no runtime errors', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await expect(page.locator('.record-row')).toHaveCount(17);
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(21, 24, 28)');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: 'qa/desktop-library-1440.png' }); expect(errors).toEqual([]);
});
test('search, source filter and scroll survive record navigation; areas are independent', async ({ page }) => {
  await page.getByRole('searchbox', { name: 'Поиск: Все записи' }).fill('комитет');
  await select(page, 'Источник: Все источники', 'Файлы'); await expect(page.locator('.record-row')).toHaveCount(1);
  await openRecord(page); await expect(page.getByRole('searchbox')).toHaveValue('комитет'); await expectListFilter(page, 'Источник: Файлы');
  await space(page, 'Личное').click(); await expect(page.getByRole('searchbox')).toHaveValue(''); await expectListFilter(page, 'Источник: Все источники');
  await nav(page, 'Все записи').click(); await expect(page.getByRole('searchbox')).toHaveValue('комитет');
});
test('full filters are staged until Apply; dismiss discards changes', async ({ page }) => {
  await page.getByRole('button', { name: 'Фильтры', exact: true }).click(); let modal = page.getByRole('dialog', { name: 'Фильтры', exact: true });
  await modal.getByRole('button', { name: 'Файлы', exact: true }).click(); await modal.getByRole('button', { name: 'Закрыть', exact: true }).click();
  await expectListFilter(page, 'Источник: Все источники'); await expect(page.locator('.record-row')).toHaveCount(17);
  await page.getByRole('button', { name: 'Фильтры', exact: true }).click(); modal = page.getByRole('dialog', { name: 'Фильтры', exact: true }); await modal.getByRole('button', { name: 'Файлы', exact: true }).click(); await modal.getByRole('button', { name: 'Применить', exact: true }).click();
  await expectListFilter(page, 'Источник: Файлы'); await expect(page.locator('.record-row')).toHaveCount(5);
});
test('space root and folder filters retain explicit context', async ({ page }) => {
  await space(page, 'Проектный комитет').click(); await select(page, 'Папка: Все папки', 'В корне пространства');
  const data = await saved(page); const expected = data.records.filter(r => r.areaId === 'project' && !r.folderId && ['ready', 'processing', 'processing-error'].includes(r.status));
  await expect(page.locator('.record-row')).toHaveCount(expected.length); await expect(page.getByRole('heading', { name: 'Проектный комитет', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Ещё', exact: true }).click(); await page.getByRole('menuitem', { name: 'Управление папками' }).click();
  await expect(page.getByRole('heading', { name: 'Папки', exact: true })).toBeVisible();
});
test('record summary, transcript and player share one session', async ({ page }) => {
  await openRecord(page); await expect(page.getByRole('heading', { name: 'Резюме', exact: true })).toBeVisible();
  await expect(page.locator('.summary-card .markdown')).toContainText('Обсудили первый мобильный релиз'); await page.screenshot({ path: 'qa/desktop-record-1440.png' });
  await page.getByRole('button', { name: 'Воспроизвести запись', exact: true }).click(); await page.clock.runFor(3000); await page.getByRole('button', { name: 'Поставить на паузу', exact: true }).click();
  const position = await page.getByRole('slider', { name: 'Позиция воспроизведения' }).inputValue();
  await page.getByRole('tab', { name: 'Транскрипция: 8 реплик' }).click(); await expect(page.getByRole('slider', { name: 'Позиция воспроизведения' })).toHaveValue(position);
  await select(page, 'Скорость воспроизведения 1×', '1,5×'); await page.getByRole('tab', { name: 'Сведения: Источник и хранение' }).click();
  await expect(page.getByRole('button', { name: 'Скорость воспроизведения 1.5×' })).toBeVisible(); await expect(page.getByRole('slider', { name: 'Позиция воспроизведения' })).toHaveValue(position);
  await page.screenshot({ path: 'qa/desktop-record-details-1440.png' });
});
test('literal transcript search leaves all utterances and never seeks playback', async ({ page }) => {
  await openRecord(page); await page.getByRole('tab', { name: 'Транскрипция: 8 реплик' }).click(); await page.getByRole('button', { name: /Поиск в транскрипции/ }).click();
  await page.getByRole('textbox', { name: 'Поиск в транскрипции' }).fill('запи'); await expect(page.locator('.transcript-segment')).toHaveCount(8);
  expect(await page.locator('mark').count()).toBeGreaterThan(3); await expect(page.getByRole('slider', { name: 'Позиция воспроизведения' })).toHaveValue('0');
  await page.getByRole('button', { name: 'Следующее совпадение' }).click(); await expect(page.getByRole('slider', { name: 'Позиция воспроизведения' })).toHaveValue('0');
  await page.screenshot({ path: 'qa/desktop-transcript-1440.png' });
});
test('transcript editing marks summary stale and processing preserves old materials', async ({ page }) => {
  await openRecord(page); await page.getByRole('tab', { name: 'Транскрипция: 8 реплик' }).click(); await page.locator('.transcript-segment').first().hover();
  await page.getByRole('button', { name: 'Редактировать реплику 00:00' }).click(); await page.getByRole('textbox', { name: 'Текст реплики' }).fill('Решили проверить абрикос и сохранить ручную правку.'); await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await page.getByRole('tab', { name: 'Резюме: Основные итоги встречи' }).click(); await expect(page.getByText('Транскрипция изменена. Пересоздайте резюме в «Действиях».')).toBeVisible();
  await page.getByRole('button', { name: 'Действия', exact: true }).click(); await page.getByRole('menuitem', { name: 'Пересоздать резюме', exact: true }).click();
  const confirm = page.getByRole('dialog', { name: 'Пересоздать резюме?', exact: true }); await confirm.getByRole('button', { name: 'Пересоздать резюме', exact: true }).click(); await expect(page.locator('.summary-card').getByText('Предыдущая версия · обновляется', { exact: true })).toBeVisible(); await expect(page.getByRole('tab', { name: 'Резюме: Предыдущая версия · обновляется' })).toBeVisible();
  await page.clock.runFor(6000); await expect(page.locator('.summary-card')).toContainText('абрикос'); await expect(page.getByText('Транскрипция изменена. Пересоздайте резюме в «Действиях».')).toHaveCount(0);
});
test('record rename and audience-changing move preserve recording ID and clear folder', async ({ page }) => {
  await openRecord(page); await page.getByRole('button', { name: 'Действия', exact: true }).click(); await page.getByRole('menuitem', { name: 'Переименовать', exact: true }).click();
  await page.getByRole('textbox', { name: 'Новое название записи' }).fill('Решения проектной команды'); await page.getByRole('button', { name: 'Сохранить', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Решения проектной команды' })).toBeVisible();
  await page.getByRole('button', { name: 'Действия', exact: true }).click(); await page.getByRole('menuitem', { name: 'Изменить пространство', exact: true }).click(); const modal = page.getByRole('dialog'); await modal.getByRole('button', { name: 'Личное', exact: true }).click();
  await expect(modal).toContainText('Участники прежнего пространства потеряют'); await modal.getByRole('button', { name: 'Переместить запись', exact: true }).click();
  const data = await saved(page); const r = data.records.find(r => r.id === 'project-committee')!; expect(r.areaId).toBe('personal'); expect(r.folderId).toBeNull(); expect(data.records.length).toBe(16);
});
test('folder creation, rename and deletion preserve recordings', async ({ page }) => {
  await space(page, 'Проектный комитет').click(); await page.getByRole('button', { name: 'Ещё', exact: true }).click(); await page.getByRole('menuitem', { name: 'Управление папками' }).click();
  await page.getByRole('button', { name: 'Создать папку', exact: true }).click(); await page.getByRole('textbox', { name: 'Название папки' }).fill('Новая папка'); await page.getByRole('dialog').getByRole('button', { name: 'Создать папку', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Новая папка 0 записей' })).toBeVisible(); await page.getByRole('button', { name: 'Действия с папкой: Планирование' }).click(); await page.getByRole('menuitem', { name: 'Удалить папку' }).click(); await page.getByRole('dialog').getByRole('button', { name: 'Удалить папку', exact: true }).click();
  expect((await saved(page)).records.length).toBe(16); expect((await saved(page)).records.find(r => r.id === 'project-committee')!.folderId).toBeNull();
});
test('new recording is available with saved drafts; exit keeps capturing until explicit save', async ({ page }) => {
  await page.getByRole('button', { name: 'Записать', exact: true }).click(); await page.getByRole('textbox', { name: 'Название записи', exact: true }).fill('Новая встреча'); await page.clock.runFor(2000);
  await nav(page, 'Все записи').click(); const modal = page.getByRole('dialog', { name: 'Что сделать с записью?' }); await expect(modal).toContainText('Запись продолжается');
  const before = (await saved(page)).drafts.find(d => d.title === 'Новая встреча')!.seconds; await page.clock.runFor(3000); expect((await saved(page)).drafts.find(d => d.title === 'Новая встреча')!.seconds).toBeGreaterThan(before);
  await modal.getByRole('button', { name: /Сохранить черновик и выйти/ }).click(); await expect(page.getByTestId('library-page')).toBeVisible(); expect((await saved(page)).drafts.length).toBe(2); expect((await saved(page)).drafts.every(d => d.paused)).toBe(true);
  await page.getByRole('button', { name: 'Записать', exact: true }).click(); await page.getByTestId('finish-recording').click(); await expect(page.getByTestId('record-page')).toBeVisible(); expect((await saved(page)).drafts.length).toBe(2);
});
test('recording restart is confirmed and preserves title', async ({ page }) => {
  await page.getByRole('button', { name: 'Записать', exact: true }).click(); await page.getByRole('textbox', { name: 'Название записи', exact: true }).fill('Сохранить название'); await page.clock.runFor(3000); await page.getByRole('button', { name: 'Заново', exact: true }).click(); await page.getByRole('dialog').getByRole('button', { name: 'Начать заново', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Название записи', exact: true })).toHaveValue('Сохранить название'); expect((await saved(page)).drafts[0].seconds).toBeLessThanOrEqual(1);
  await page.screenshot({ path: 'qa/desktop-recorder-1440.png' });
});
test('actual file selection creates an independent queued record and preserves filters', async ({ page }) => {
  await select(page, 'Источник: Все источники', 'Файлы'); await page.getByRole('button', { name: 'Добавить', exact: true }).click(); await page.getByRole('menuitem', { name: 'Загрузить файл', exact: true }).click();
  await page.getByLabel('Аудио- или видеофайл').setInputFiles({ name: 'Локальная встреча.wav', mimeType: 'audio/wav', buffer: wav() }); await page.getByRole('dialog').getByRole('button', { name: 'Загрузить запись', exact: true }).click();
  await expectListFilter(page, 'Источник: Файлы'); await expect(page.locator('.record-row').first()).toContainText('Локальная встреча'); expect((await saved(page)).records[0].areaId).toBe('personal');
});
test('agent lifecycle, pause and completion use one route and stable result', async ({ page }) => {
  await page.getByRole('button', { name: 'Добавить', exact: true }).click(); await page.getByRole('menuitem', { name: 'Записать встречу', exact: true }).click();
  await page.getByRole('textbox', { name: 'Ссылка на встречу', exact: true }).fill('https://meet.company.ru/room'); await page.getByRole('textbox', { name: 'Название встречи' }).fill('Командная встреча'); await page.getByRole('button', { name: 'Подключить агента', exact: true }).click();
  const id = (await saved(page)).meetings[0].id; await page.getByTestId(`meeting-row-${id}`).getByRole('button').click(); await expect(page.getByTestId('player-dock')).toHaveCount(0); await expect(page.getByRole('main').getByRole('button', { name: 'Записать', exact: true })).toHaveCount(0); await expect(page.getByRole('button', { name: 'Пауза', exact: true })).toBeDisabled();
  await page.clock.runFor(11000); await page.getByRole('button', { name: 'Пауза', exact: true }).click(); const seconds = await page.locator('.recorder-time').innerText(); await page.clock.runFor(3000); await expect(page.locator('.recorder-time')).toHaveText(seconds);
  await page.getByRole('button', { name: 'Завершить', exact: true }).click(); await page.getByRole('dialog').getByRole('button', { name: 'Завершить запись', exact: true }).click(); await expect(page.getByTestId('record-page')).toBeVisible(); expect(page.url()).toContain(`/meetings/${id}`); expect((await saved(page)).records.filter(r => r.bridgeId === id).length).toBe(1);
});
test('failed agent can correct its HTTPS URL without changing title or destination', async ({ page }) => {
  const s = initialState(); s.meetings = [{ id: 'failed-agent', title: 'Неудачная встреча', server: s.server!.address, areaId: 'project', agentName: 'Тезис Агент', url: 'https://meet.company.ru/old', stage: 'error', startedAt: Date.now(), pausedMs: 0 }]; await seed(page, s, '/meetings/failed-agent');
  await page.getByRole('button', { name: 'Изменить ссылку', exact: true }).click(); await page.getByRole('textbox', { name: 'Новая ссылка на встречу' }).fill('https://meet.company.ru/new'); await page.getByRole('button', { name: 'Сохранить и подключить' }).click();
  const m = (await saved(page)).meetings[0]; expect(m.id).toBe('failed-agent'); expect(m.title).toBe('Неудачная встреча'); expect(m.areaId).toBe('project'); expect(m.url).toBe('https://meet.company.ru/new');
});
test('Assistant starts globally, suggestions draft only, and sources never auto-send', async ({ page }) => {
  await newDialog(page); await expect(page.getByRole('button', { name: 'Источники ответа: Все доступные записи' })).toBeVisible(); await page.getByRole('button', { name: 'Принятые решения' }).click();
  await expect(page.getByRole('textbox', { name: 'Вопрос Ассистенту' })).toHaveValue('Какие решения приняты?'); await expect(page.locator('.assistant-turn')).toHaveCount(0);
  await page.getByRole('button', { name: 'Источники ответа: Все доступные записи' }).click(); const modal = page.getByRole('dialog', { name: 'Источники ответа' }); await modal.getByRole('button', { name: 'Снять выбор' }).click(); await modal.getByRole('button', { name: 'Применить', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Вопрос Ассистенту' })).toHaveValue('Какие решения приняты?'); await expect(page.getByRole('button', { name: 'Отправить вопрос', exact: true })).toBeDisabled(); await expect(page.getByRole('button', { name: 'Источники ответа: Источники не выбраны' })).toBeVisible();
});
test('Assistant answers cite real recordings; record return keeps the conversation and draft', async ({ page }) => {
  await openRecord(page); await page.getByRole('tab', { name: /^Ассистент:/ }).click(); await page.getByRole('textbox', { name: 'Вопрос Ассистенту' }).fill('Какие решения приняты?'); await page.getByRole('button', { name: 'Отправить вопрос', exact: true }).click(); await page.clock.runFor(3000);
  await expect(page.locator('.answer-sources button')).toHaveCount(1); await page.getByRole('textbox', { name: 'Вопрос Ассистенту' }).fill('Уточняющий вопрос'); await page.locator('.answer-sources button').first().click(); await expect(page.getByRole('tab', { name: /^Резюме:/ })).toHaveAttribute('aria-selected', 'true'); await page.getByRole('tab', { name: /^Ассистент:/ }).click(); await expect(page.getByRole('textbox', { name: 'Вопрос Ассистенту' })).toHaveValue('Уточняющий вопрос'); await expect(page.locator('.assistant-turn')).toHaveCount(1);
  await page.screenshot({ path: 'qa/desktop-assistant-1440.png' });
});
test('changing sources after a question creates a new dialog and atomically transfers its draft', async ({ page }) => {
  await nav(page, 'Ассистент').click(); await page.locator('.history-item-open').filter({ hasText: 'Что решили на проектном комитете?' }).click(); await page.getByRole('textbox', { name: 'Вопрос Ассистенту' }).fill('Неотправленный вопрос'); await page.getByRole('button', { name: 'Источники ответа: Проектный комитет' }).click();
  await select(page, /^Область поиска:/, 'Личное'); await page.getByRole('dialog').getByRole('button', { name: 'Применить', exact: true }).click(); await expect(page.getByRole('dialog')).toContainText('Источники изменились'); await page.getByRole('dialog').getByRole('button', { name: 'Новый диалог', exact: true }).click();
  const data = await saved(page); expect(data.dialogs.find(d => d.id === 'dialog-decisions')!.draft).toBe(''); expect(data.dialogs.filter(d => d.draft === 'Неотправленный вопрос').length).toBe(1); expect(data.dialogs.find(d => d.draft === 'Неотправленный вопрос')!.scope.areaId).toBe('personal');
});
test('Assistant conversation rename and deletion do not remove source recordings', async ({ page }) => {
  await nav(page, 'Ассистент').click(); await page.locator('.history-item').first().hover(); await page.getByRole('button', { name: 'Действия с диалогом: Что решили на проектном комитете?', exact: true }).click(); await page.getByRole('menuitem', { name: 'Переименовать диалог', exact: true }).click(); await page.getByRole('textbox', { name: 'Название диалога' }).fill('Решения команды'); await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await page.locator('.history-item').first().hover(); await page.getByRole('button', { name: 'Действия с диалогом: Решения команды', exact: true }).click(); await page.getByRole('menuitem', { name: 'Удалить диалог', exact: true }).click(); await page.getByRole('dialog').getByRole('button', { name: 'Удалить диалог', exact: true }).click();
  expect((await saved(page)).dialogs.length).toBe(2); expect((await saved(page)).records.length).toBe(16);
});
test('offline Assistant preserves input and disables sending', async ({ page }) => {
  const s = initialState(); s.settings.network = 'offline'; await seed(page, s); await newDialog(page); await page.getByRole('textbox', { name: 'Вопрос Ассистенту' }).fill('Сохранённый вопрос'); await expect(page.getByRole('button', { name: 'Отправить вопрос', exact: true })).toBeDisabled(); await page.reload(); await expect(page.getByRole('textbox', { name: 'Вопрос Ассистенту' })).toHaveValue('Сохранённый вопрос');
});
test('settings persist; sign-out retains connection and local drafts', async ({ page }) => {
  await page.getByRole('button', { name: 'Настройки', exact: true }).click(); await page.getByRole('button', { name: 'Запись и отправка', exact: true }).click(); await page.getByRole('switch', { name: 'Отправлять только по Wi-Fi' }).click(); await page.reload(); await expect(page.getByRole('switch', { name: 'Отправлять только по Wi-Fi' })).toHaveAttribute('aria-checked', 'false');
  await page.getByRole('button', { name: 'Аккаунт', exact: true }).click(); await page.getByRole('button', { name: 'Выйти из профиля' }).click(); await expect(page.getByRole('button', { name: 'Войти через SSO' })).toBeVisible(); await expect(page.getByText('thesis.sever.ru', { exact: true })).toBeVisible(); expect((await saved(page)).drafts.length).toBe(1);
});
test('server discovery precedes SSO and changing server isolates old recordings', async ({ page }) => {
  await page.getByRole('button', { name: 'Настройки', exact: true }).click(); await page.getByRole('button', { name: 'Изменить сервер', exact: true }).click(); await page.getByRole('alertdialog', { name: 'Сменить сервер?' }).getByRole('button', { name: 'Сменить сервер', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Войти через SSO' })).toHaveCount(0); await page.getByRole('textbox', { name: 'Адрес сервера' }).fill('http://new.company.ru'); await page.getByRole('button', { name: 'Продолжить', exact: true }).click(); await expect(page.getByRole('alert')).toContainText('HTTP');
  await page.getByRole('textbox', { name: 'Адрес сервера' }).fill('new.company.ru'); await page.getByRole('button', { name: 'Продолжить', exact: true }).click(); await page.clock.runFor(1000); await page.getByRole('button', { name: 'Войти через SSO' }).click(); await page.clock.runFor(1000);
  await expect(page.getByTestId('record-row-project-committee')).toHaveCount(0); expect((await saved(page)).records.length).toBe(16); expect((await saved(page)).drafts.length).toBe(1); await page.getByTestId('draft-row-draft-first').getByRole('button').first().click(); await expect(page.getByText('Место отправки недоступно', { exact: true })).toBeVisible();
});
test('desktop geometry and navigation accessibility at 1024 and 1920', async ({ page }) => {
  for (const width of [1024, 1920]) { await page.setViewportSize({ width, height: 900 }); expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1); await expect(nav(page, 'Все записи')).toBeVisible(); await expect(page.getByRole('button', { name: 'Настройки', exact: true })).toBeVisible(); }
  await page.screenshot({ path: 'qa/desktop-library-1920.png' });
});

test('finishing a contextual recording returns to its original filtered space, not a dead draft', async ({ page }) => {
  await space(page, 'Проектный комитет').click(); await select(page, 'Источник: Все источники', 'Файлы');
  await page.getByRole('button', { name: 'Добавить', exact: true }).click(); await page.getByRole('menuitem', { name: 'Записать на диктофон', exact: true }).click();
  await page.getByRole('textbox', { name: 'Название записи', exact: true }).fill('Контекстная запись'); await page.getByTestId('finish-recording').click(); await expect(page.getByTestId('record-page')).toBeVisible();
  await expect(page.locator('.records-pane').getByRole('heading', { name: 'Проектный комитет', exact: true })).toBeVisible(); await expectListFilter(page, 'Источник: Файлы');
});
test('contextual Assistant returns directly to its folder after opening a source', async ({ page }) => {
  await space(page, 'Проектный комитет').click(); await select(page, 'Папка: Все папки', 'Планирование'); await page.getByRole('button', { name: 'Открыть папку' }).click();
  await page.getByRole('main').getByRole('button', { name: 'Ассистент', exact: true }).click();
  await expect(page.getByRole('button', { name: 'К папке «Планирование»' })).toBeVisible(); await page.getByRole('textbox', { name: 'Вопрос Ассистенту' }).fill('Какие решения приняты?'); await page.getByRole('button', { name: 'Отправить вопрос' }).click(); await page.clock.runFor(3000);
  await page.locator('.answer-sources button').first().click(); await page.getByRole('button', { name: 'К диалогу', exact: true }).click(); await page.getByRole('button', { name: 'К папке «Планирование»' }).click();
  await expect(page.getByRole('heading', { name: 'Планирование', exact: true })).toBeVisible();
});
test('browser Back also asks what to do with a live recording without pausing it', async ({ page }) => {
  await page.getByRole('button', { name: 'Записать', exact: true }).click(); await page.clock.runFor(2000); await page.evaluate(() => history.back());
  const modal = page.getByRole('dialog', { name: 'Что сделать с записью?' }); await expect(modal).toBeVisible(); await expect(modal).toContainText('Запись продолжается'); expect((await saved(page)).drafts[0].paused).toBe(false);
  await modal.getByRole('button', { name: 'Продолжить запись', exact: true }).click(); await expect(page.getByTestId('recorder-page')).toBeVisible();
});
test('clipboard denial gives a manual copy fallback with stale-version notice', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new DOMException('Denied', 'NotAllowedError'); } } }); });
  const s = initialState(); s.records[0].transcriptRevision = 2; await seed(page, s); await openRecord(page); await page.getByRole('button', { name: 'Копировать итоги', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Скопируйте итоги' })).toBeVisible(); await expect(page.getByRole('textbox', { name: 'Итоги для копирования' })).toHaveValue(/Резюме не обновлено после изменения транскрипции/);
});
test('requested offline upload resumes in the open app when connectivity permits it', async ({ page }) => {
  const s = initialState(); s.settings.network = 'offline'; s.records.find(r => r.id === 'workgroup')!.uploadRequested = true; await seed(page, s);
  await page.getByRole('button', { name: 'Настройки', exact: true }).click(); await page.getByRole('button', { name: 'Wi-Fi', exact: true }).click(); await page.clock.runFor(2000);
  expect((await saved(page)).records.find(r => r.id === 'workgroup')!.status).toBe('uploading');
  await nav(page, 'Все записи').click(); await openRecord(page, 'pilot-planning'); await page.getByRole('button', { name: 'Повторить создание резюме', exact: true }).click(); await page.clock.runFor(6000); await expect(page.locator('.record-status')).toContainText('Обработано');
});
test('used-source deletion hides the cached answer without deleting the dialog', async ({ page }) => {
  await nav(page, 'Ассистент').click(); await page.locator('.history-item-open').filter({ hasText: 'Что решили на проектном комитете?' }).click(); await page.locator('.answer-sources button').first().click();
  await page.getByRole('button', { name: 'Действия', exact: true }).click(); await page.getByRole('menuitem', { name: 'Удалить запись', exact: true }).click(); await page.getByRole('dialog').getByRole('button', { name: 'Удалить запись', exact: true }).click();
  await expect(page.getByText('Источник недоступен. Ответ скрыт, пока доступ не восстановлен.')).toBeVisible(); expect((await saved(page)).dialogs.some(d => d.id === 'dialog-decisions')).toBe(true);
});
test('partial transcript remains readable but cannot be edited; no-speech outcome remains neutral', async ({ page }) => {
  await openRecord(page, 'contractor-meeting'); await page.getByRole('tab', { name: /Транскрипция: 2 реплики/ }).click();
  await expect(page.locator('.transcript-segment')).toHaveCount(2); await expect(page.getByRole('button', { name: 'Улучшить текст', exact: true })).toBeDisabled(); await expect(page.locator('.transcript-local-status')).toContainText('распознанной части');
  await nav(page, 'Все записи').click(); await openRecord(page, 'no-speech'); await expect(page.locator('.pending-material')).toContainText('Речь не обнаружена'); await expect(page.getByRole('button', { name: 'Воспроизвести запись' })).toBeEnabled();
});
test('unreadable desktop storage is retained, not replaced by fixtures', async ({ page }) => {
  await page.evaluate(key => localStorage.setItem(key, '{broken-user-data'), STORAGE_KEY); await page.reload(); await expect(page.getByRole('alert')).toContainText('Не удалось сохранить изменения');
  await page.clock.runFor(3000); expect(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).toBe('{broken-user-data');
});

test('legacy folders retain their recordings without pretending to be a workspace', async ({ page }) => {
  const s = initialState(); s.records.find(r => r.id === 'server-operations')!.folderId = 'legacy-projects'; await seed(page, s, '/spaces/legacy/folders/legacy-projects');
  await expect(page.getByTestId('record-row-server-operations')).toBeVisible(); await page.getByRole('button', { name: 'Ещё', exact: true }).click(); await expect(page.getByRole('menuitem', { name: 'Участники', exact: true })).toHaveCount(0); await page.getByRole('menuitem', { name: 'Управление папками' }).click();
  await expect(page.getByRole('heading', { name: 'Папки без пространства', exact: true })).toBeVisible(); expect((await saved(page)).records.length).toBe(16);
});
