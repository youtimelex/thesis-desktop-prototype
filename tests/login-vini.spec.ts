import { expect, test } from '@playwright/test';

test('settings uses the same VINi confirmation and cancel restores focus', async ({ page }) => {
  await page.goto('/?preview=1#/settings/connection');
  const change = page.getByRole('button', { name: 'Изменить сервер', exact: true });
  const confirmation = page.getByRole('alertdialog', { name: 'Сменить сервер?' });
  await change.click();
  await expect(confirmation.getByRole('button', { name: 'Отмена' })).toBeFocused();
  await expect(confirmation).toContainText('Черновиков:');
  await page.keyboard.press('Escape');
  await expect(confirmation).toBeHidden();
  await expect(change).toBeFocused();
  await change.click();
  await confirmation.getByRole('button', { name: 'Сменить сервер' }).click();
  await expect(page.getByRole('form', { name: 'Укажите адрес сервера' })).toBeVisible();
});

for (const theme of ['dark', 'light']) {
  test(`VINi server and SSO flow in ${theme} theme`, async ({ page }) => {
    await page.setViewportSize(theme === 'dark' ? { width: 1280, height: 850 } : { width: 900, height: 600 });
    await page.addInitScript(theme => {
      localStorage.setItem('thesis-vini-home-appearance-v1', JSON.stringify({ theme, colorway: 'blue', language: 'ru' }));
    }, theme);
    await page.goto('/?preview=1#/settings/account');
    await page.getByRole('button', { name: 'Выйти из профиля' }).click();
    const login = page.getByRole('region', { name: 'Войдите в рабочее пространство' });
    await expect(login.locator('[data-slot="card"]')).toBeVisible();
    await expect(login.getByText('thesis.sever.ru', { exact: true })).toBeVisible();
    await expect(login.getByText('Сервер подтверждён', { exact: true })).toHaveCount(0);
    const change = login.getByRole('button', { name: 'Изменить сервер' });
    const confirmation = page.getByRole('alertdialog', { name: 'Сменить сервер?' });
    await change.click();
    await expect(confirmation.getByRole('button', { name: 'Отмена' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(confirmation).toBeHidden();
    await expect(change).toBeFocused();
    await change.click();
    await confirmation.getByRole('button', { name: 'Сменить сервер' }).click();
    await expect(confirmation).toBeHidden();
    const form = page.getByRole('form', { name: 'Укажите адрес сервера' });
    const input = form.getByRole('textbox', { name: /Адрес сервера/ });
    await expect(input).toBeFocused();
    await expect(input).toHaveAttribute('required', '');
    const submit = form.getByRole('button', { name: 'Продолжить' });
    await expect(input).toHaveValue('thesis.sever.ru');
    await expect(submit).toBeEnabled();
    await input.clear();
    await expect(submit).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Войти через SSO' })).toHaveCount(0);
    const help = form.getByRole('button', { name: 'Как узнать адрес?' });
    await help.click();
    const dialog = page.getByRole('dialog', { name: 'Где взять адрес сервера?' });
    await expect(dialog.locator('[data-slot="card"]')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Понятно' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(help).toBeFocused();
    await input.fill('http://company.example');
    await submit.click();
    await expect(form.getByRole('alert')).toContainText('HTTP');
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await expect(input).toBeFocused();
    await input.fill('server.example');
    await expect(form.getByRole('alert')).toHaveCount(0);
    await input.press('Enter');
    const sso = login.getByRole('button', { name: 'Войти через SSO' });
    await expect(sso).toBeFocused();
    await expect(login.getByText('server.example', { exact: true })).toBeVisible();
    await sso.press('Enter');
    await expect(page.getByRole('heading', { name: 'Все записи', exact: true })).toBeVisible();
  });
}
