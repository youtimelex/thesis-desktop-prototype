import {test,expect} from '@playwright/test';
for(const width of [390,1225])test(`unified navigation ${width}`,async({page})=>{
 await page.setViewportSize({width,height:900});await page.goto('/#/spaces/personal');
 await expect(page.getByRole('heading',{name:'Личное',exact:true})).toBeVisible();
 await expect(page.getByRole('navigation',{name:'Навигация страницы'})).toContainText('Личное');
 await page.getByRole('button',{name:'Спросить ассистента',exact:true}).click();
 await expect(page.getByRole('button',{name:'Источники ответа: Личное'})).toBeVisible();
 await page.goto('/#/spaces');await expect(page.getByRole('table',{name:'Пространства',exact:true})).toBeVisible();
 await page.getByRole('table',{name:'Пространства',exact:true}).getByRole('button').first().click();
 await page.goto('/#/records');const input=page.locator('#library-search');await input.fill('Проектный комитет');
 await page.getByTestId('record-row-project-committee').locator('.record-row-open').click();
 await expect(page.locator('[data-slot="sidebar-inset-header"] .record-breadcrumbs')).toBeVisible();
 await expect(page.locator('.meeting-document .detail-toolbar')).toHaveCount(0);
 await page.getByRole('navigation',{name:'Путь к записи'}).getByRole('button',{name:'Все записи',exact:true}).click();
 await expect(input).toHaveValue('Проектный комитет');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
});
