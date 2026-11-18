import { test, expect } from '@playwright/test';

// The preview query keeps model edits in memory; each Playwright context is
// separate from the user's browser and never loads data into localStorage.
test('creation controls expose their visible field labels', async ({ page }) => {
  await page.goto('/?preview=1#/home');
  await page.getByRole('button', { name: 'Настроить', exact: true }).first().click();
  const meeting = page.getByRole('dialog', { name: 'Записать встречу' });
  await expect(meeting.getByRole('combobox', { name: 'Имя во встрече', exact: true })).toBeVisible();
  await expect(meeting.getByRole('textbox', { name: 'Название записи', exact: true })).toBeVisible();
  await meeting.getByRole('combobox', { name: 'Имя во встрече', exact: true }).click();
  await page.getByRole('option', { name: 'Своё имя', exact: true }).click();
  await expect(meeting.getByRole('textbox', { name: 'Своё имя', exact: true })).toBeVisible();
  await meeting.getByRole('button', { name: 'Отмена', exact: true }).click();

  await page.getByRole('button', { name: 'Добавить', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Загрузить файл', exact: true }).click();
  const upload = page.getByRole('dialog', { name: 'Загрузить запись' });
  await upload.getByLabel('Аудио- или видеофайл').setInputFiles({ name: 'example.mp3', mimeType: 'audio/mpeg', buffer: Buffer.from('test') });
  await expect(upload.getByRole('textbox', { name: 'Название записи', exact: true })).toBeVisible();
  await upload.getByRole('button', { name: 'Отмена', exact: true }).click();

  await page.getByRole('button', { name: /^Продолжить запись:/ }).click();
  await expect(page.getByRole('combobox', { name: 'Папка после отправки', exact: true })).toBeVisible();
});

for (const width of [1280, 900]) {
  test(`record actions are in the window toolbar at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    // Exercise the fallback independently of browser/OS sharing capabilities.
    await page.addInitScript(() => Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }));
    await page.goto('/?preview=1#/records');
    await page.getByTestId('record-row-project-committee').locator('.record-row-open').click();

    const toolbar = page.locator('.unified-window-toolbar');
    const back = toolbar.getByRole('button', { name: 'Назад', exact: true });
    const records = toolbar.getByRole('button', { name: 'Записи', exact: true });
    const actions = toolbar.getByRole('button', { name: 'Действия', exact: true });
    const share = toolbar.getByRole('button', { name: 'Поделиться', exact: true });
    for (const control of [back, records, actions, share]) await expect(control).toBeVisible();
    await expect(toolbar.getByRole('navigation')).toHaveCount(0);
    await expect(page.locator('.record-context-header')).toHaveCount(0);
    const bounds = await toolbar.boundingBox();
    const backBox = await back.boundingBox();
    const recordsBox = await records.boundingBox();
    const actionsBox = await actions.boundingBox();
    const shareBox = await share.boundingBox();
    expect(bounds && backBox && recordsBox && actionsBox && shareBox).toBeTruthy();
    expect(backBox!.x + backBox!.width).toBeLessThan(recordsBox!.x);
    expect(recordsBox!.x).toBeLessThan(bounds!.x + bounds!.width / 2);
    for (const box of [actionsBox!, shareBox!]) {
      expect(box.x).toBeGreaterThan(bounds!.x + bounds!.width / 2);
      expect(box.x + box.width).toBeLessThanOrEqual(bounds!.x + bounds!.width + 1);
    }

    await actions.click();
    await expect(page.getByRole('menuitem', { name: 'Переименовать' })).toBeVisible();
    await page.keyboard.press('Escape');
    await share.click();
    await expect(page.getByRole('dialog', { name: 'Поделиться резюме' })).toBeVisible();
    await page.keyboard.press('Escape');
    await records.click();
    await expect(page.locator('#focus-record-list')).toBeVisible();
    await page.keyboard.press('Escape');
    await back.click();
    await expect(page).toHaveURL(/#\/records$/);
  });
}

test('sharing uses the system sheet with the selected recording summary', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data: ShareData) => { (window as Window & { sharedData?: ShareData }).sharedData = data; },
    });
  });
  await page.goto('/?preview=1#/records');
  await page.getByTestId('record-row-project-committee').locator('.record-row-open').click();
  await page.getByRole('button', { name: 'Поделиться', exact: true }).click();
  const data = await page.evaluate(() => (window as Window & { sharedData?: ShareData }).sharedData);
  expect(data?.title).toBe('Проектный комитет');
  expect(data?.text).toContain('Обсудили первый мобильный релиз');
  expect(data?.url).toBeUndefined();
  await expect(page.getByRole('dialog', { name: 'Поделиться резюме' })).toHaveCount(0);
});

test('cancelling system sharing does not open the fallback', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async () => { throw new DOMException('Cancelled', 'AbortError'); },
    });
  });
  await page.goto('/?preview=1#/records');
  await page.getByTestId('record-row-project-committee').locator('.record-row-open').click();
  await page.getByRole('button', { name: 'Поделиться', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Поделиться резюме' })).toHaveCount(0);
});

test('a failed system share offers the copy fallback', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async () => { throw new DOMException('Unavailable', 'NotAllowedError'); },
    });
  });
  await page.goto('/?preview=1#/records');
  await page.getByTestId('record-row-project-committee').locator('.record-row-open').click();
  await page.getByRole('button', { name: 'Поделиться', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Поделиться резюме' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('textbox', { name: 'Резюме для передачи' })).toHaveValue(/Проектный комитет/);
  await expect(dialog.getByRole('button', { name: 'Копировать итоги' })).toBeEnabled();
});

test('return from a record restores the filtered list and selected row', async ({ page }) => {
  await page.goto('/?preview=1#/records');
  const query = page.getByRole('searchbox');
  await query.fill('комитет');
  const row = page.getByTestId('record-row-project-committee').locator('.record-row-open');
  await row.click();
  await expect(page.getByRole('navigation', { name: 'Основная навигация' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Назад', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Назад', exact: true }).click();
  await expect(page).toHaveURL(/#\/records$/);
  await expect(query).toHaveValue('комитет');
  await expect(row).toBeFocused();
});

test('renaming a record does not remove it from the panel inherited from a filtered list', async ({ page }) => {
  await page.goto('/?preview=1#/records');
  const query = page.getByRole('searchbox');
  await query.fill('Проектный комитет');
  await page.getByTestId('record-row-project-committee').locator('.record-row-open').click();
  await page.getByRole('button', { name: 'Записи', exact: true }).click();
  const list = page.locator('#focus-record-list');
  // The list is the catalogue, not the query results from the page of origin.
  await expect(list.getByRole('button', { name: /^Оперативное совещание,/ })).toBeVisible();
  await page.getByRole('button', { name: 'Действия', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Переименовать' }).click();
  await page.getByRole('textbox', { name: 'Новое название записи' }).fill('Итоги встречи');
  await page.getByRole('dialog', { name: 'Переименовать запись' }).getByRole('button', { name: 'Сохранить' }).click();
  await expect(list.getByRole('button', { name: /^Итоги встречи,/ })).toBeVisible();
  await expect(page.locator('.detail-list-notice')).toHaveCount(0);
  await page.getByRole('button', { name: 'Назад', exact: true }).click();
  await expect(query).toHaveValue('Проектный комитет');
  await expect(page.getByTestId('record-row-project-committee')).toHaveCount(0);
});

test('switching from search results preserves the original search for Back', async ({ page }) => {
  await page.goto('/?preview=1#/search/all');
  const query = page.getByRole('searchbox');
  await query.fill('Проектный комитет');
  await page.getByTestId('record-row-project-committee').locator('.record-row-open').click();
  await page.getByRole('button', { name: 'Записи', exact: true }).click();
  await page.locator('#focus-record-list').getByRole('button', { name: /^Оперативное совещание,/ }).click();
  await expect(page.getByRole('heading', { name: 'Оперативное совещание', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Назад', exact: true }).click();
  await expect(page).toHaveURL(/#\/search\/all$/);
  await expect(query).toHaveValue('Проектный комитет');
  await expect(page.getByTestId('record-row-project-committee')).toBeVisible();
});

test('Meta+K from a record returns to its existing search and focuses its query', async ({ page }) => {
  await page.goto('/?preview=1#/search/all');
  const query = page.getByRole('searchbox', { name: 'Поиск: Все записи' });
  await query.fill('Проектный комитет');
  await page.getByTestId('record-row-project-committee').locator('.record-row-open').click();
  await expect(page).toHaveURL(/#\/records\/project-committee\/summary\?search=1$/);
  await page.keyboard.press('Meta+k');
  await expect(page).toHaveURL(/#\/search\/all$/);
  await expect(query).toBeVisible();
  await expect(query).toHaveValue('Проектный комитет');
  await expect(query).toBeFocused();
});

test('Control+K from a folder record opens search within that folder', async ({ page }) => {
  await page.goto('/?preview=1#/spaces/project/folders/project-releases');
  await page.getByTestId('record-row-architecture-review').locator('.record-row-open').click();
  await page.keyboard.press('Control+k');
  await expect(page).toHaveURL(/#\/search\/folder\/project\/project-releases$/);
  const query = page.getByRole('searchbox', { name: /Релизы.*Проектный комитет/ });
  await expect(query).toBeVisible();
  await expect(query).toBeFocused();
  await expect(page.getByTestId('record-row-architecture-review')).toBeVisible();
  await expect(page.getByTestId('record-row-project-committee')).toHaveCount(0);
});

test('Meta+K from a direct scoped record opens search in the encoded space', async ({ page }) => {
  await page.goto('/?preview=1#/records/customer-interview/summary?area=pilot');
  await page.keyboard.press('Meta+k');
  await expect(page).toHaveURL(/#\/search\/area\/pilot$/);
  const query = page.getByRole('searchbox', { name: 'Поиск: Пилот с заказчиком' });
  await expect(query).toBeVisible();
  await expect(query).toBeFocused();
});

test('Meta+K does not navigate away from an open rename dialog', async ({ page }) => {
  await page.goto('/?preview=1#/records');
  await page.getByTestId('record-row-project-committee').locator('.record-row-open').click();
  await page.getByRole('button', { name: 'Действия', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Переименовать' }).click();
  const dialog = page.getByRole('dialog', { name: 'Переименовать запись' });
  const input = dialog.getByRole('textbox', { name: 'Новое название записи' });
  await input.fill('Черновик названия');
  const recordUrl = page.url();
  await page.keyboard.press('Meta+k');
  await expect(page).toHaveURL(recordUrl);
  await expect(dialog).toBeVisible();
  await expect(input).toHaveValue('Черновик названия');
  await expect(input).toBeFocused();
});

test('a folder catalogue ignores the originating search and stays selected during switching', async ({ page }) => {
  await page.goto('/?preview=1#/spaces/project/folders/project-releases');
  const query = page.getByRole('searchbox');
  await query.fill('Архитектурный комитет');
  await page.getByTestId('record-row-architecture-review').locator('.record-row-open').click();
  await page.getByRole('button', { name: 'Записи', exact: true }).click();
  const list = page.locator('#focus-record-list');
  await expect(page.locator('.focus-record-list-context')).toContainText('Релизы');
  await expect(list.getByRole('button', { name: /^Подготовка к релизу,/ })).toBeVisible();
  await expect(list.getByRole('button', { name: /^Проектный комитет,/ })).toHaveCount(0);
  await list.getByRole('button', { name: /^Подготовка к релизу,/ }).click();
  await expect(page.getByRole('heading', { name: 'Подготовка к релизу', exact: true })).toBeVisible();
  await expect(page.locator('.focus-record-list-context')).toContainText('Релизы');
  await expect(list.getByRole('button', { name: /^Архитектурный комитет,/ })).toBeVisible();
  await page.getByRole('button', { name: 'Назад', exact: true }).click();
  await expect(page).toHaveURL(/#\/spaces\/project\/folders\/project-releases$/);
  await expect(query).toHaveValue('Архитектурный комитет');
});

test('a direct record URL returns to the scope encoded in its address', async ({ page }) => {
  await page.goto('/?preview=1#/records/project-committee/summary?area=project');
  await expect(page.getByRole('button', { name: 'Записи', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Назад', exact: true }).click();
  await expect(page).toHaveURL(/#\/spaces\/project$/);
});

test('switching records keeps the original list as the return destination', async ({ page }) => {
  await page.goto('/?preview=1#/records');
  const original = page.getByTestId('record-row-project-committee').locator('.record-row-open');
  await original.click();
  await page.getByRole('tab', { name: /^Транскрипция/ }).click();
  await expect(page.getByRole('button', { name: 'Записи', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Записи', exact: true }).click();
  const other = page.locator('#focus-record-list [role=listitem] button:not([aria-current=true])').first();
  await expect(other).toBeVisible();
  await other.click();
  await expect(page).not.toHaveURL(/#\/records\/project-committee\//);
  await page.getByRole('button', { name: 'Назад', exact: true }).click();
  await expect(page).toHaveURL(/#\/records$/);
  await expect(original).toBeFocused();
});

test('closing the wide record list restores focus to its trigger', async ({ page }) => {
  await page.goto('/?preview=1#/records');
  await page.getByTestId('record-row-project-committee').locator('.record-row-open').click();
  const trigger = page.getByRole('button', { name: 'Записи', exact: true });
  await trigger.click();
  const close = page.getByRole('button', { name: 'Закрыть список записей' });
  await close.focus();
  await page.keyboard.press('Enter');
  await expect(close).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
});

test('closing the narrow record panel returns focus to its trigger', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 850 });
  await page.goto('/?preview=1#/records');
  await page.getByTestId('record-row-project-committee').locator('.record-row-open').click();
  const trigger = page.getByRole('button', { name: 'Записи', exact: true });
  await trigger.click();
  await expect(page.getByRole('complementary', { name: 'Записи текущего списка' })).toBeVisible();
  await page.getByRole('button', { name: 'Закрыть список записей' }).focus();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('complementary', { name: 'Записи текущего списка' })).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

for (const width of [1280, 900]) {
  test(`record list and properties can remain open together at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    await page.goto('/?preview=1#/records');
    await page.getByTestId('record-row-project-committee').locator('.record-row-open').click();
    const records = page.getByRole('button', { name: 'Записи', exact: true });
    const properties = page.getByRole('button', { name: 'Свойства записи', exact: true });
    await expect(records).toHaveAttribute('aria-pressed', 'false');
    if (await properties.getAttribute('aria-pressed') === 'false') await properties.click();
    const info = page.getByRole('complementary', { name: 'Свойства записи' });
    await expect(info).toBeVisible();
    await records.click();
    const list = page.getByRole('complementary', { name: 'Записи текущего списка' });
    await expect(records).toHaveAttribute('aria-pressed', 'true');
    await expect(list).toBeVisible();
    await expect(info).toBeVisible();
    const listBox = await list.boundingBox();
    const infoBox = await info.boundingBox();
    expect(listBox && infoBox).toBeTruthy();
    expect(listBox!.x + listBox!.width).toBeLessThanOrEqual(infoBox!.x + 1);
    await list.getByRole('button', { name: /^Оперативное совещание, ВКС,/ }).click();
    await expect(page.getByRole('heading', { name: 'Оперативное совещание', exact: true })).toBeVisible();
    await expect(list).toBeVisible();
    await expect(info).toBeVisible();
    await expect(records).toHaveAttribute('aria-pressed', 'true');
    await properties.click();
    await expect(info).toHaveCount(0);
    await expect(list).toBeVisible();
    await expect(records).toHaveAttribute('aria-pressed', 'true');
    await properties.click();
    await expect(info).toBeVisible();
    if (width === 900) {
      // Reopening properties dismisses the list when there is insufficient space.
      await expect(list).toHaveCount(0);
      await expect(records).toHaveAttribute('aria-pressed', 'false');
      // The user can still explicitly open the list over the record.
      await records.click();
      await expect(list).toBeVisible();
      await expect(info).toBeVisible();
      await expect(records).toHaveAttribute('aria-pressed', 'true');
    } else {
      await expect(list).toBeVisible();
      await expect(records).toHaveAttribute('aria-pressed', 'true');
    }
    await records.click();
    await expect(list).toHaveCount(0);
    await expect(records).toHaveAttribute('aria-pressed', 'false');
    await expect(info).toBeVisible();
  });
}

test('the record list shows the source icon and accessible type for each entry', async ({ page }) => {
  await page.goto('/?preview=1#/records');
  await page.getByTestId('record-row-project-committee').locator('.record-row-open').click();
  await page.getByRole('button', { name: 'Записи', exact: true }).click();
  const list = page.getByRole('list', { name: 'Записи текущего списка' });
  for (const [name, type, glyph] of [
    ['Проектный комитет', 'Файл', 'upload_file'],
    ['Оперативное совещание', 'ВКС', 'videocam'],
    ['Обсуждение бюджета', 'Диктофон', 'graphic_eq'],
  ]) {
    const row = list.getByRole('button', { name: new RegExp(`^${name}, ${type},`) });
    await expect(row).toBeVisible();
    await expect(row.locator('.row-source')).toHaveText(glyph);
    await row.locator('.row-source').hover();
    await expect(page.getByRole('tooltip').filter({ hasText: type })).toBeVisible();
  }
});

test('a source opened from a conversation returns to that conversation', async ({ page }) => {
  await page.goto('/?preview=1#/assistant/dialog-decisions');
  const source = page.locator('.answer-sources button').first();
  await expect(source).toBeVisible();
  await source.click();
  await expect(page).toHaveURL(/#\/records\//);
  await expect(page.getByRole('button', { name: 'Записи', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Назад', exact: true }).click();
  await expect(page).toHaveURL(/#\/assistant\/dialog-decisions$/);
  await expect(page.locator('.answer-sources button').first()).toBeFocused();
});

test('the content conversation switcher preserves drafts and list navigation history', async ({ page }) => {
  await page.goto('/?preview=1#/assistant');
  await page.getByRole('button', { name: 'Открыть диалог: Что решили на проектном комитете?' }).click();
  const toolbar = page.locator('.unified-window-toolbar');
  const header = page.locator('.assistant-conversation-header');
  const switcher = header.getByRole('button', { name: /^История диалогов:/ });
  await expect(switcher).toBeVisible();
  await expect(page.getByRole('button', { name: /^История диалогов:/ })).toHaveCount(1);
  await expect(header).toHaveCount(1);
  await expect(page.locator('#page-toolbar-slot .assistant-window-toolbar')).toHaveCount(0);
  const breadcrumb = toolbar.getByRole('navigation', { name: 'Навигация страницы' });
  await expect(breadcrumb).toHaveText('Ассистент');
  await expect(breadcrumb.locator('[data-slot="breadcrumb-item"]')).toHaveCount(1);
  await expect(toolbar.getByRole('button', { name: 'Переключить навигацию' })).toBeVisible();
  await expect(header.getByRole('button', { name: /^Действия с диалогом:/ })).toBeVisible();

  const question = page.getByRole('textbox', { name: 'Вопрос Ассистенту' });
  await question.fill('Продолжить обсуждение комитета');
  await switcher.click();
  await expect(page.getByRole('menuitem', { name: 'Все диалоги', exact: true })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Новый диалог', exact: true })).toBeVisible();
  await page.getByRole('menuitem', { name: /^Как подготовиться к пилоту\?/ }).click();
  await expect(page).toHaveURL(/#\/assistant\/dialog-pilot$/);
  await expect(question).toHaveValue('');

  await switcher.click();
  await page.getByRole('menuitem', { name: /^Что решили на проектном комитете\?/ }).click();
  await expect(page).toHaveURL(/#\/assistant\/dialog-decisions$/);
  await expect(question).toHaveValue('Продолжить обсуждение комитета');

  await toolbar.getByRole('button', { name: 'Назад по истории', exact: true }).click();
  await expect(page).toHaveURL(/#\/assistant$/);
  await expect(page.getByRole('heading', { name: 'Ассистент', exact: true })).toBeVisible();
  await toolbar.getByRole('button', { name: 'Вперёд по истории', exact: true }).click();
  await expect(page).toHaveURL(/#\/assistant\/dialog-decisions$/);
  await expect(question).toHaveValue('Продолжить обсуждение комитета');
  await expect(switcher).toHaveAccessibleName('История диалогов: Что решили на проектном комитете?');
});

test('a new conversation returns to all dialogs and reopens its draft from the content header', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 850 });
  await page.goto('/?preview=1#/assistant/dialog-decisions');
  const switcher = page.locator('.assistant-conversation-header').getByRole('button', { name: /^История диалогов:/ });
  await switcher.click();
  await page.getByRole('menuitem', { name: 'Новый диалог', exact: true }).click();
  await expect(page).not.toHaveURL(/dialog-decisions/);
  const createdUrl = page.url();
  const question = page.getByRole('textbox', { name: 'Вопрос Ассистенту' });
  await expect(question).toHaveValue('');
  await expect(page.getByTestId('question-bubble')).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Навигация страницы' })).toHaveText('Ассистент');
  await question.fill('Черновик нового разговора');
  await expect(switcher).toHaveAccessibleName('История диалогов: Черновик нового разговора');

  await switcher.click();
  await page.getByRole('menuitem', { name: 'Все диалоги', exact: true }).click();
  await expect(page).toHaveURL(/#\/assistant$/);
  await expect(page.getByRole('heading', { name: 'Ассистент', exact: true })).toBeVisible();
  await expect(page.locator('.assistant-window-toolbar')).toHaveCount(0);
  await expect(page.locator('.assistant-conversation-header')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Открыть диалог: Что решили на проектном комитете?' })).toBeVisible();
  await page.getByRole('button', { name: 'Открыть диалог: Черновик нового разговора' }).click();
  await expect(page).toHaveURL(createdUrl);
  await expect(question).toHaveValue('Черновик нового разговора');
  await expect(switcher).toBeVisible();
});

test('scoped assistant lists, conversations and new dialogs keep one Assistant breadcrumb', async ({ page }) => {
  const breadcrumb = page.getByRole('navigation', { name: 'Навигация страницы' });
  for (const path of [
    '/spaces/project/assistant?area=project',
    '/spaces/project/assistant/dialog-decisions?area=project',
    '/spaces/project/assistant?area=project&folder=project-planning',
    '/spaces/project/assistant/dialog-decisions?area=project&folder=project-planning',
  ]) {
    await page.goto(`/?preview=1#${path}`);
    await expect(breadcrumb).toHaveText('Ассистент');
    await expect(breadcrumb.locator('[data-slot="breadcrumb-item"]')).toHaveCount(1);
  }
  await page.locator('.assistant-conversation-header').getByRole('button', { name: /^История диалогов:/ }).click();
  await page.getByRole('menuitem', { name: 'Новый диалог', exact: true }).click();
  await expect(page).toHaveURL(/#\/spaces\/project\/assistant\/[^?]+\?area=project&folder=project-planning$/);
  await expect(breadcrumb).toHaveText('Ассистент');
  await expect(breadcrumb.locator('[data-slot="breadcrumb-item"]')).toHaveCount(1);
  await expect(page.getByRole('button', { name: /^Источники ответа: Проектный комитет · Планирование/ })).toBeVisible();
  await breadcrumb.getByRole('button', { name: 'Ассистент', exact: true }).click();
  await expect(page).toHaveURL(/#\/spaces\/project\/assistant\?area=project&folder=project-planning$/);
  await expect(page.getByRole('heading', { name: 'Ассистент', exact: true })).toBeVisible();
  await expect(breadcrumb.getByRole('button', { name: 'Ассистент', exact: true })).toHaveCount(0);
});

test('a direct record link does not invent a source collection', async ({ page }) => {
  await page.goto('/?preview=1#/records/project-committee/summary');
  await expect(page.getByRole('button', { name: 'Назад', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Записи', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Назад', exact: true }).click();
  await expect(page).toHaveURL(/#\/records$/);
});

for (const [name, path] of [['filtered library', '/records'], ['search results', '/search/all']] as const) {
  test(`reloading a record from ${name} does not offer a reconstructed list`, async ({ page }) => {
    await page.goto(`/?preview=1#${path}`);
    await page.getByRole('searchbox').fill('комитет');
    await page.getByTestId('record-row-project-committee').locator('.record-row-open').click();
    await expect(page.getByRole('button', { name: 'Записи', exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Назад', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Записи', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Назад', exact: true }).click();
    await expect(page).toHaveURL(name === 'search results' ? /#\/search\/all$/ : /#\/records$/);
  });
}

test('opening properties in a narrow window closes the record list', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 850 });
  await page.goto('/?preview=1#/records');
  await page.getByTestId('record-row-project-committee').locator('.record-row-open').click();
  const list = page.getByRole('button', { name: 'Записи', exact: true });
  const properties = page.getByRole('button', { name: 'Свойства записи', exact: true });
  if (await properties.getAttribute('aria-pressed') === 'true') await properties.click();
  await list.click();
  await expect(list).toHaveAttribute('aria-expanded', 'true');
  await properties.click();
  await expect(list).toHaveAttribute('aria-expanded', 'false');
  await expect(properties).toHaveAttribute('aria-expanded', 'true');
  await expect(properties).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(properties).toHaveAttribute('aria-expanded', 'false');
  await expect(properties).toBeFocused();
});

test('shrinking the window closes the open record list and restores focus', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 850 });
  await page.goto('/?preview=1#/records');
  await page.getByTestId('record-row-project-committee').locator('.record-row-open').click();
  const list = page.getByRole('button', { name: 'Записи', exact: true });
  const properties = page.getByRole('button', { name: 'Свойства записи', exact: true });
  if (await properties.getAttribute('aria-pressed') === 'false') await properties.click();
  await list.click();
  await page.getByRole('button', { name: 'Закрыть список записей' }).focus();
  await page.setViewportSize({ width: 900, height: 850 });
  await expect(list).toHaveAttribute('aria-expanded', 'false');
  await expect(properties).toHaveAttribute('aria-expanded', 'true');
  await expect(list).toBeFocused();
});

test('home recent records offer all records and return to home', async ({ page }) => {
  await page.goto('/?preview=1#/home');
  await page.getByTestId('meeting-card-project-committee').click();
  await page.getByRole('button', { name: 'Записи', exact: true }).click();
  const list = page.locator('#focus-record-list');
  await expect(list.getByRole('button', { name: /^Обсуждение бюджета,/ })).toBeVisible();
  await list.getByRole('button', { name: /Оперативное совещание/ }).click();
  await expect(page.getByRole('heading', { name: 'Оперативное совещание' })).toBeVisible();
  await page.locator('.unified-window-toolbar').getByRole('button', { name: 'Назад', exact: true }).click();
  await expect(page).toHaveURL(/#\/home$/);
});

test('home continuation offers all records and returns to home', async ({ page }) => {
  await page.goto('/?preview=1#/home');
  await page.getByRole('button', { name: /Открыть запись: Планирование пилота/ }).click();
  await page.getByRole('button', { name: 'Записи', exact: true }).click();
  const list = page.locator('#focus-record-list');
  await expect(list.getByRole('button', { name: /^Проектный комитет,/ })).toBeVisible();
  await list.getByRole('button', { name: /Обсуждение пилота/ }).click();
  await page.locator('.unified-window-toolbar').getByRole('button', { name: 'Назад', exact: true }).click();
  await expect(page).toHaveURL(/#\/home$/);
});
