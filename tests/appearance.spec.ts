import {test,expect} from '@playwright/test';
for(const theme of ['light','dark']) for(const [colorway,label] of [['blue','VINi · Синяя'],['neutral','VINi · Нейтральная'],['orange','VINTEO · Оранжевая']]) {
 test(`appearance ${theme} ${colorway}, persistence and controls`,async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('/#/settings/appearance');
 await page.getByRole('combobox',{name:'Тема оформления'}).click();await page.getByRole('option',{name:theme==='light'?'Светлая':'Тёмная',exact:true}).click();
 await page.getByRole('combobox',{name:'Брендовая палитра'}).click();await page.getByRole('option',{name:label,exact:true}).click();
 await expect(page.locator('html')).toHaveAttribute('data-theme',theme);await expect(page.locator('html')).toHaveAttribute('data-colorway',colorway);
 await page.reload();await expect(page.locator('html')).toHaveAttribute('data-theme',theme);await expect(page.getByRole('combobox',{name:'Брендовая палитра'})).toContainText(label);
 expect(await page.evaluate(()=>getComputedStyle(document.documentElement).colorScheme)).toBe(theme);
 await page.screenshot({path:`qa/settings-${theme}-${colorway}.png`});
 await page.goto('/');await expect(page.getByRole('heading',{name:'Записи',exact:true})).toBeVisible();await page.screenshot({path:`qa/home-${theme}-${colorway}.png`});
 await page.getByTestId('meeting-card-project-committee').click();await page.getByRole('textbox',{name:'Вопрос Ассистенту'}).fill('Проверь решения');
 await page.getByRole('tab',{name:/^Резюме:/}).focus();await page.keyboard.press('ArrowRight');await expect(page.getByRole('tab',{name:/^Транскрипция:/})).toBeFocused();await page.keyboard.press('Enter');await expect(page.getByRole('tab',{name:/^Транскрипция:/})).toHaveAttribute('aria-selected','true');
 await expect(page.getByRole('textbox',{name:'Вопрос Ассистенту'})).toHaveValue('Проверь решения');
 await page.getByRole('button',{name:'Поиск в транскрипции'}).click();await page.getByRole('textbox',{name:'Поиск в транскрипции'}).fill('запись');await expect(page.getByRole('textbox',{name:'Поиск в транскрипции'})).toHaveValue('запись');
 await page.screenshot({path:`qa/transcript-${theme}-${colorway}.png`});expect(errors).toEqual([]);
 });
}
test('field semantics, draft input and persistence',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Записать',exact:true}).click();
 const title=page.getByRole('textbox',{name:'Название записи',exact:true});await title.fill('Проверка VINi');await expect(title).toHaveValue('Проверка VINi');
 const id=await title.getAttribute('id');expect(id).toBeTruthy();await expect(page.locator('label').filter({hasText:'Название записи'})).toHaveAttribute('for',id!);
 await expect(page.getByRole('button',{name:'Пауза',exact:true})).toBeVisible();await page.screenshot({path:'qa/recorder-fields.png'});
});
