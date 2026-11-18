import { expect, test, type Page } from '@playwright/test';
import { initialState } from '../src/fixtures';
import { STORAGE_KEY } from '../src/model';
import type { AppState } from '../src/types';

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-10T12:00:00Z') });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Все записи', exact: true })).toBeVisible();
});

async function seed(page: Page, state: AppState, id: string, section = 'summary') {
  await page.evaluate(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key: STORAGE_KEY, state });
  await page.goto(`/#/records/${id}/${section}`);
  await page.reload();
  await expect(page.getByTestId('record-page')).toBeVisible();
}
const saved = (page: Page): Promise<AppState> => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
const tabs = (page: Page) => page.getByRole('tablist', { name: 'Материалы записи' });

test('summary error is consistent across pages and retries only summary directly', async ({ page }) => {
  const state = initialState(); const original = state.records.find(r => r.id === 'pilot-planning')!;
  await seed(page, state, original.id);
  const card = page.locator('.summary-card');
  await expect(page.locator('.record-status')).toContainText('Не удалось создать резюме');
  await expect(card).toContainText('Не удалось создать резюме');
  await expect(card).toContainText('Транскрипция сохранена и доступна.');
  await expect(card.getByRole('button', { name: 'Повторить создание резюме', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'К статусу записи' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Повторить создание резюме', exact: true })).toHaveCount(1);
  await expect(tabs(page).getByRole('tab', { name: 'Транскрипция: 3 реплики' })).toBeVisible();

  await tabs(page).getByRole('tab', { name: 'Транскрипция: 3 реплики' }).click();
  await expect(tabs(page).getByRole('tab', { name: 'Резюме: Не удалось создать резюме' })).toBeVisible();
  await expect(page.locator('.transcript-card .section-heading')).toContainText('3 реплики');
  await expect(page.locator('.transcript-segment')).toHaveCount(3);
  await expect(page.locator('.transcript-local-status')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Улучшить текст', exact: true })).toBeEnabled();
  await expect(page.locator('.transcript-subtools')).not.toContainText('после обработки');
  await tabs(page).getByRole('tab', { name: 'Резюме: Не удалось создать резюме' }).click();
  await page.screenshot({ path: 'qa/desktop-summary-error.png' });
  await card.getByRole('button', { name: 'Повторить создание резюме', exact: true }).click();
  const retried = (await saved(page)).records.find(r => r.id === original.id)!;
  expect(retried.status).toBe('processing'); expect(retried.processing?.phase).toBe('summary');
  expect(retried.transcript).toEqual(original.transcript); expect(retried.id).toBe(original.id);
  await expect(card).toContainText('Создаём резюме');
  await expect(card.getByRole('button', { name: 'Повторить создание резюме' })).toHaveCount(0);
  await page.clock.runFor(6000);
  await expect(page.locator('.record-status')).toContainText('Обработано');
  expect((await saved(page)).records.find(r => r.id === original.id)!.transcript).toEqual(original.transcript);
});

test('failed upload blocks both materials and can be retried directly from the transcript', async ({ page }) => {
  const state = initialState(); await seed(page, state, 'pilot-discussion');
  await expect(page.locator('.record-status')).toContainText('Не удалось отправить запись');
  await expect(page.locator('.summary-card')).toContainText('Не удалось отправить запись');
  await expect(page.locator('.summary-card')).toContainText('Запись сохранена на устройстве');
  await expect(page.locator('.summary-card')).not.toContainText('готовится');
  await expect(page.locator('.summary-card .text-skeleton')).toHaveCount(0);
  await expect(tabs(page).getByRole('tab', { name: 'Транскрипция: Не удалось отправить запись' })).toBeVisible();
  await tabs(page).getByRole('tab', { name: 'Транскрипция: Не удалось отправить запись' }).click();
  await expect(tabs(page).getByRole('tab', { name: 'Резюме: Не удалось отправить запись' })).toBeVisible();
  await expect(page.locator('.transcript-card')).toContainText('Не удалось отправить запись');
  await page.screenshot({ path: 'qa/desktop-upload-error.png' });
  await page.locator('.transcript-card').getByRole('button', { name: 'Повторить отправку', exact: true }).click();
  expect((await saved(page)).records.find(r => r.id === 'pilot-discussion')!.status).toBe('uploading');
  await expect(tabs(page).getByRole('tab', { name: 'Резюме: Отправляем запись' })).toBeVisible();
  await expect(page.locator('.transcript-card').getByRole('button', { name: 'Повторить отправку' })).toHaveCount(0);
});

test('a failed partial transcript stays readable, searchable and offers phase-specific retry', async ({ page }) => {
  const state = initialState(); const record = state.records.find(r => r.id === 'contractor-meeting')!;
  record.status = 'processing-error'; record.frozen = false;
  await seed(page, state, record.id);
  await expect(page.locator('.summary-card')).toContainText('Распознавание остановлено');
  await expect(page.getByRole('button', { name: 'Повторить распознавание', exact: true })).toBeVisible();
  await tabs(page).getByRole('tab', { name: 'Транскрипция: 2 реплики · ошибка распознавания' }).click();
  await expect(page.locator('.transcript-local-status')).toContainText('Доступна распознанная часть');
  await expect(page.locator('.transcript-subtools')).toContainText('Распознавание остановлено');
  await expect(page.locator('.transcript-local-status .spin')).toHaveCount(0);
  await expect(tabs(page).getByRole('tab', { name: 'Резюме: Ожидает повтора распознавания' })).toBeVisible();
  await page.getByRole('button', { name: /Поиск в транскрипции/ }).click();
  await page.getByRole('textbox', { name: 'Поиск в транскрипции' }).fill('сервер');
  await expect(page.getByRole('status', { name: /по распознанной части/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Улучшить текст' })).toBeDisabled();
  await page.getByRole('button', { name: 'Повторить распознавание', exact: true }).click();
  const result = (await saved(page)).records.find(r => r.id === record.id)!;
  expect(result.status).toBe('processing'); expect(result.processing?.phase).toBe('transcription'); expect(result.transcript).toEqual(record.transcript);
  await expect(page.locator('.transcript-local-status')).toContainText('Текст дополняется');
});

test('offline, Wi-Fi restrictions and permissions disable retry with a clear reason', async ({ page }) => {
  const state = initialState(); state.settings.network = 'offline';
  await seed(page, state, 'pilot-planning');
  await expect(page.getByRole('button', { name: 'Повторить создание резюме', exact: true })).toBeDisabled();
  await expect(page.getByText('Подключитесь к сети, чтобы повторить обработку.')).toBeVisible();
  await page.clock.runFor(6000);
  expect((await saved(page)).records.find(r => r.id === 'pilot-planning')!.status).toBe('processing-error');

  const mobile = initialState(); mobile.settings.network = 'mobile'; mobile.settings.wifiOnly = true;
  await seed(page, mobile, 'pilot-discussion');
  await expect(page.getByRole('button', { name: 'Повторить отправку', exact: true })).toBeDisabled();
  await expect(page.getByText('Подключитесь к Wi-Fi, чтобы отправить запись.')).toBeVisible();
  expect((await saved(page)).records.find(r => r.id === 'pilot-discussion')!.status).toBe('upload-error');

  const readonly = initialState(); readonly.records.find(r => r.id === 'pilot-planning')!.canManage = false;
  await seed(page, readonly, 'pilot-planning');
  await expect(page.getByRole('button', { name: 'Повторить создание резюме', exact: true })).toBeDisabled();
  await expect(page.getByText('Нет права изменять запись.')).toBeVisible();
});

test('a failed update preserves the previous summary and exposes its retry in place', async ({ page }) => {
  const state = initialState(); const record = state.records.find(r => r.id === 'project-committee')!;
  record.status = 'processing-error'; record.operation = 'summary'; record.processing = { phase: 'summary', ticks: 0 };
  await seed(page, state, record.id);
  await expect(page.locator('.summary-card')).toContainText('Предыдущая версия · обновление не завершено');
  await expect(page.locator('.summary-card .markdown')).toContainText('Обсудили первый мобильный релиз');
  await expect(page.getByRole('button', { name: 'Повторить создание резюме', exact: true })).toHaveCount(1);
  await tabs(page).getByRole('tab', { name: 'Транскрипция: 8 реплик' }).click();
  await expect(tabs(page).getByRole('tab', { name: 'Резюме: Предыдущая версия · обновление не завершено' })).toBeVisible();
  await expect(page.locator('.transcript-local-status')).toHaveCount(0);
  await tabs(page).getByRole('tab', { name: 'Резюме: Предыдущая версия · обновление не завершено' }).click();
  await page.getByRole('button', { name: 'Повторить создание резюме', exact: true }).click();
  await expect(page.locator('.summary-card')).toContainText('Предыдущая версия · обновляется');
  await expect(page.locator('.summary-card .markdown')).toContainText('Обсудили первый мобильный релиз');
  const retried = (await saved(page)).records.find(r => r.id === record.id)!;
  expect(retried.processing?.phase).toBe('summary'); expect(retried.summary).toBe(record.summary); expect(retried.transcript).toEqual(record.transcript);
});

test('a local unsent record does not imply an automatic upload', async ({ page }) => {
  const state = initialState(); state.settings.network = 'offline'; await seed(page, state, 'workgroup');
  await expect(page.locator('.record-status')).toContainText('На устройстве');
  await expect(page.locator('.summary-card')).toContainText('Отправьте запись');
  await expect(page.getByRole('button', { name: 'Отправить запись', exact: true })).toBeDisabled();
  await expect(tabs(page).getByRole('tab', { name: 'Транскрипция: Запись не отправлена' })).toBeVisible();
  await page.clock.runFor(6000); expect((await saved(page)).records.find(r => r.id === 'workgroup')!.uploadRequested).toBeUndefined();
});

for (const width of [1024, 1440, 1920]) test(`find controls remain visible and do not cover the match at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  const state = initialState(); const record = state.records.find(r => r.id === 'project-committee')!;
  record.duration = 4000;
  record.transcript = Array.from({ length: 60 }, (_, i) => ({ id: `long-${i}`, speaker: i % 2 ? 'Мария Соколова' : 'Алексей Петров', color: '#72b6e9', start: i * 50, end: i * 50 + 45, text: i === 1 || i === 55 ? `Важная договорённость: кварцевый ориентир номер ${i}. Контекст для проверки.` : `Обсуждение вопроса ${i}. Достаточно длинная реплика, чтобы проверить прокрутку и чтение записи.` }));
  await seed(page, state, record.id, 'transcript');
  const viewport = page.getByTestId('record-page');
  const initialScroll = await viewport.evaluate(el => el.scrollTop);
  await page.getByRole('button', { name: /Поиск в транскрипции/ }).click();
  const input = page.getByRole('textbox', { name: 'Поиск в транскрипции' }); await input.fill('кварцевый');
  await expect(page.getByRole('status', { name: 'Совпадение 1 из 2' })).toBeVisible();
  const position = await page.getByRole('slider', { name: 'Позиция воспроизведения' }).inputValue();
  await page.getByRole('button', { name: 'Следующее совпадение' }).click();
  await expect(page.getByRole('status', { name: 'Совпадение 2 из 2' })).toBeVisible();
  await expect(page.locator('[data-current-match="true"]')).toHaveText('кварцевый');
  await expect(input).toBeFocused();
  await expect(page.getByRole('slider', { name: 'Позиция воспроизведения' })).toHaveValue(position);
  const geometry = await page.evaluate(() => {
    const bounds = (selector: string) => { const r = document.querySelector(selector)!.getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; };
    return { viewport: bounds('[data-testid="record-page"]'), panel: bounds('.transcript-find-panel'), input: bounds('.transcript-search input'), arrows: bounds('.find-navigation'), match: bounds('[data-current-match="true"]'), tabs: bounds('.record-local-toolbar'), player: bounds('[data-testid="player-dock"]'), position: getComputedStyle(document.querySelector('.transcript-find-panel')!).position };
  });
  expect(geometry.position).toBe('sticky');
  expect(geometry.panel.top).toBeGreaterThanOrEqual(geometry.viewport.top - 1);
  expect(geometry.input.top).toBeGreaterThanOrEqual(geometry.viewport.top);
  expect(geometry.arrows.bottom).toBeLessThanOrEqual(geometry.viewport.bottom);
  expect(geometry.match.top).toBeGreaterThanOrEqual(geometry.panel.bottom - 1);
  expect(geometry.match.bottom).toBeLessThanOrEqual(geometry.viewport.bottom);
  expect(geometry.tabs.bottom).toBeLessThanOrEqual(geometry.panel.top + 1);
  expect(geometry.player.top).toBeGreaterThanOrEqual(geometry.viewport.bottom - 1);
  if (width === 1440) await page.screenshot({ path: 'qa/desktop-transcript-sticky.png' });

  await page.getByRole('button', { name: 'Предыдущее совпадение' }).click();
  await expect(page.getByRole('status', { name: 'Совпадение 1 из 2' })).toBeVisible();
  await viewport.evaluate(el => { el.scrollTop = el.scrollHeight; });
  const pinned = await page.locator('.transcript-find-panel').boundingBox(); const screen = await viewport.boundingBox();
  expect(pinned!.y).toBeGreaterThanOrEqual(screen!.y - 1); expect(pinned!.y + pinned!.height).toBeLessThanOrEqual(screen!.y + screen!.height);
  await expect(input).toBeVisible(); await expect(page.getByRole('button', { name: 'Следующее совпадение' })).toBeVisible();
  await input.press('Escape');
  await expect(page.getByRole('button', { name: /Поиск в транскрипции/ })).toBeVisible();
  await expect.poll(() => viewport.evaluate(el => el.scrollTop)).toBe(initialScroll);
});
