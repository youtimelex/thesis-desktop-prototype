import {test,expect} from '@playwright/test';
test('DS navigation, item semantics, slider keyboard, toast and empty', async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');
 await expect(page.locator('[data-slot="sidebar"]')).toBeVisible();await expect(page.locator('[data-slot="sidebar-menu-button"]').first()).toBeVisible();
 const row=page.getByTestId('meeting-card-project-committee');await expect(row).toHaveAttribute('data-slot','item');await row.focus();await page.keyboard.press('Enter');
 const slider=page.getByRole('slider',{name:'Позиция воспроизведения'});await expect(slider).toBeVisible();await expect(slider).toBeEnabled();await slider.focus();await page.keyboard.press('ArrowRight');expect(Number(await slider.getAttribute('aria-valuenow'))).toBeGreaterThan(0);await page.keyboard.press('End');await expect(slider).toHaveAttribute('aria-valuenow','1080');await page.keyboard.press('Home');await expect(slider).toHaveAttribute('aria-valuenow','0');
 await page.screenshot({path:'qa/phase3-record.png'});
 await page.getByRole('button',{name:'Настройки',exact:true}).click();await page.getByRole('button',{name:'Уведомления',exact:true}).click();await page.getByRole('switch').first().click();await expect(page.getByText('Настройки сохранены',{exact:true})).toBeVisible();await expect(page.locator('[data-slot="toast"]')).toBeVisible();await page.screenshot({path:'qa/phase3-toast.png'});
 await page.getByRole('button',{name:'Аккаунт',exact:true}).click();await expect(page.locator('[data-slot="avatar"]')).toBeVisible();
 await page.getByRole('button',{name:'Все записи',exact:true}).click();const search=page.getByRole('searchbox').first();await search.fill('неттакойзаписиXYZ');await expect(page.locator('[data-slot="empty"]')).toBeVisible();await page.screenshot({path:'qa/phase3-empty.png'});expect(errors).toEqual([]);
});
for(const width of [820,1024,1440]) test(`sidebar sizing and routes ${width}`,async({page})=>{
 await page.setViewportSize({width,height:900});await page.goto('/');
 const sidebar=page.locator('[data-slot="sidebar"]');expect((await sidebar.boundingBox())!.width).toBe(width<=1150?76:216);
 for(const name of ['Ассистент','Личное','Настройки','Главная']) {await page.getByRole('button',{name,exact:true}).first().click();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
 await page.screenshot({path:`qa/phase3-nav-${width}.png`});
});
