import {test,expect} from '@playwright/test';
for(const theme of ['light','dark'])for(const width of [390,720,1280,2047])test(`settings reference ${theme} ${width}`,async({page})=>{
 await page.setViewportSize({width,height:1000});await page.addInitScript(theme=>localStorage.setItem('thesis-vini-home-appearance-v1',JSON.stringify({theme,colorway:'blue'})),theme);
 await page.goto('/#/home');await page.getByRole('button',{name:'Настройки',exact:true}).click();
 const nav=page.getByRole('navigation',{name:'Разделы настроек'});
 await expect(nav).toBeVisible();await expect(page.getByRole('navigation',{name:'Основная навигация'})).toHaveCount(0);
 for(const section of ['Оформление','Запись и отправка','Аккаунт','Уведомления','Хранилище','Подключение']){
  await nav.getByRole('button',{name:section,exact:true}).click();await expect(page.getByRole('heading',{name:section,exact:true,level:1})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  expect((await page.locator('.settings-content').boundingBox())!.width).toBeLessThanOrEqual(764);
  await page.screenshot({path:`qa/settings-${section}-${theme}-${width}.png`});
 }
 await nav.getByRole('button',{name:'Хранилище',exact:true}).click();const rows=page.locator('.storage-stat');await expect(rows).toHaveCount(3);expect(await rows.first().evaluate(e=>getComputedStyle(e).borderTopWidth)).toBe('0px');expect(await rows.last().evaluate(e=>getComputedStyle(e).borderBottomWidth)).toBe('0px');
 await nav.getByRole('button',{name:'Запись и отправка',exact:true}).click();const wifi=page.getByRole('switch',{name:'Отправлять только по Wi-Fi'});const previous=await wifi.isChecked();await wifi.click();await page.reload();await expect(wifi).toBeChecked({checked:!previous});
 await expect(page.getByRole('textbox',{name:'Поиск разделов настроек'})).toHaveCount(0);expect((await page.getByRole('button',{name:'Назад в приложение'}).boundingBox())!.height).toBe(28);
 await page.addScriptTag({path:'node_modules/axe-core/axe.min.js'});expect(await page.evaluate(async()=> (await(window as any).axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map((v:any)=>v.id))).toEqual([]);
 await page.getByRole('button',{name:'Назад в приложение'}).click();await expect(page.getByRole('navigation',{name:'Основная навигация'})).toBeVisible();
});
test('settings returns to source and selects theme',async({page})=>{
 await page.goto('/#/assistant');await page.getByRole('button',{name:'Настройки',exact:true}).click();await page.getByRole('button',{name:'Оформление',exact:true}).focus();await page.keyboard.press('Enter');
 await page.getByRole('combobox',{name:'Тема оформления'}).click();await page.getByRole('option',{name:'Светлая',exact:true}).click();
 await page.getByRole('button',{name:'Аккаунт',exact:true}).click();await page.getByRole('button',{name:'Назад в приложение'}).click();await expect(page.getByRole('heading',{name:'Ассистент',exact:true})).toBeVisible();
});

test('language demo selection persists without claiming translation',async({page})=>{await page.goto('/#/settings/appearance');await expect(page.getByText('Демонстрационный выбор. Интерфейс пока доступен только на русском.')).toBeVisible();await page.getByRole('combobox',{name:'Язык интерфейса (демонстрация)'}).focus();await page.keyboard.press('Enter');await page.getByRole('option',{name:'English',exact:true}).click();await page.reload();await expect(page.getByRole('combobox',{name:'Язык интерфейса (демонстрация)'})).toContainText('English');await expect(page.getByRole('heading',{name:'Оформление',exact:true,level:1})).toBeVisible();});

test('demo settings do not claim live permissions or server checks',async({page})=>{
await page.goto('/#/settings/connection');await expect(page.getByText('Адрес сохранён',{exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'Демонстрация сети'})).toBeVisible();await page.getByRole('button',{name:'Нет подключения',exact:true}).click();await expect(page.getByText('Адрес сохранён',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Wi-Fi',exact:true}).click();
await page.getByRole('button',{name:'Запись и отправка',exact:true}).click();await expect(page.getByRole('switch',{name:'Вход по биометрии'})).toHaveCount(0);await expect(page.getByText('Микрофон',{exact:true})).toBeVisible();await expect(page.getByText('Не подключено',{exact:true})).toBeVisible();
await page.getByRole('button',{name:'Уведомления',exact:true}).click();await expect(page.getByText('Системные уведомления',{exact:true})).toBeVisible();await expect(page.getByText('Демо: выбор сохраняется, но пока не управляет показом уведомлений.')).toBeVisible();});
