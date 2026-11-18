import { test, expect } from '@playwright/test';

test('invalid file choices cannot submit an earlier file and a valid choice recovers', async ({ page }) => {
  await page.goto('/?preview=1#/home');
  await page.getByRole('button', { name: 'Добавить', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Загрузить файл', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Загрузить запись' });
  const fileInput = dialog.getByLabel('Аудио- или видеофайл');
  const submit = dialog.getByRole('button', { name: 'Загрузить запись', exact: true });

  const selectFile = dialog.getByRole('button', { name: 'Выбрать файл', exact: true });
  await selectFile.focus();
  await page.keyboard.press('Tab');
  await expect(fileInput).not.toBeFocused();

  await fileInput.setInputFiles({ name: 'first.mp3', mimeType: 'audio/mpeg', buffer: Buffer.from('test') });
  await expect(dialog.getByText('first.mp3', { exact: true })).toBeVisible();
  await expect(submit).toBeEnabled({ timeout: 7000 });
  // A cancelled chooser does not discard the already selected file.
  await fileInput.setInputFiles([]);
  await expect(dialog.getByText('first.mp3', { exact: true })).toBeVisible();

  const changeFile = dialog.getByRole('button', { name: 'Выбрать другой файл', exact: true });
  await changeFile.focus();
  await fileInput.setInputFiles({ name: 'wrong.txt', mimeType: 'text/plain', buffer: Buffer.from('test') });
  const invalid = dialog.getByRole('alert');
  await expect(invalid).toContainText('Выберите аудио- или видеофайл');
  await expect(dialog.getByText('first.mp3', { exact: true })).toHaveCount(0);
  await expect(dialog.getByRole('textbox', { name: 'Название записи' })).toHaveCount(0);
  await expect(submit).toBeDisabled();
  await expect(selectFile).toBeFocused();
  await expect(selectFile).toHaveAccessibleDescription(/Выберите аудио- или видеофайл/);

  await fileInput.setInputFiles({ name: 'empty.mp3', mimeType: 'audio/mpeg', buffer: Buffer.alloc(0) });
  await expect(invalid).toContainText('Файл пуст');
  await expect(submit).toBeDisabled();
  await expect(selectFile).toHaveAccessibleDescription(/Файл пуст/);

  await fileInput.setInputFiles({ name: 'next.mp3', mimeType: 'audio/mpeg', buffer: Buffer.from('test') });
  await expect(dialog.getByRole('alert')).toHaveCount(0);
  await expect(dialog.getByText('next.mp3', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('textbox', { name: 'Название записи' })).toHaveValue('next');
  await expect(submit).toBeEnabled({ timeout: 7000 });
});
