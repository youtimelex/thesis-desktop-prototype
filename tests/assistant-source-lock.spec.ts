import { expect, test } from '@playwright/test';

// Preview keeps these changes in the isolated browser context's memory.
test('a new dialog can choose its sources until its first question', async ({ page }) => {
  await page.goto('/?preview=1#/assistant/dialog-draft');
  const sourcesButton = page.getByRole('button', { name: /^Источники ответа:/ });
  await sourcesButton.click();
  const picker = page.getByRole('dialog', { name: 'Источники ответа' });
  await picker.getByRole('button', { name: 'Снять выбор со всех' }).click();
  await picker.getByRole('checkbox', { name: /Проектный комитет/ }).check();
  await picker.getByRole('button', { name: 'Применить', exact: true }).click();
  await expect(sourcesButton).toHaveAccessibleName('Источники ответа: Проектный комитет');
  await page.getByRole('button', { name: 'Отправить вопрос' }).click();
  await expect(page.locator('.assistant-turn')).toHaveCount(1);
  await sourcesButton.click();
  await expect(picker).toContainText('Источники закреплены за диалогом');
  await expect(picker.getByRole('checkbox')).toHaveCount(0);
  await expect(picker.getByRole('button', { name: 'Применить' })).toHaveCount(0);
  await expect(picker.getByRole('list', { name: 'Выбранные источники' })).toContainText('Проектный комитет');
});

test('an existing conversation allows viewing sources and opening the cited record', async ({ page }) => {
  await page.goto('/?preview=1#/assistant/dialog-decisions');
  await page.getByRole('button', { name: 'Источники ответа: Проектный комитет' }).click();
  const picker = page.getByRole('dialog', { name: 'Источники ответа' });
  await expect(picker).toContainText('Чтобы выбрать другие, начните новый диалог.');
  await expect(picker.getByRole('checkbox')).toHaveCount(0);
  await picker.getByRole('button', { name: 'Готово' }).click();
  await page.getByRole('button', { name: /Открыть резюме записи «Проектный комитет»/ }).click();
  await expect(page).toHaveURL(/#\/records\/project-committee\/summary/);
});
