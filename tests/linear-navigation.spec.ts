import {test,expect} from '@playwright/test';
test('wide list, contextual record, retained query/selection and Assistant draft',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await expect(page.locator('.mode-list .records-pane')).toBeVisible();await expect(page.locator('.detail-pane')).toBeHidden();
 await page.getByRole('navigation',{name:'Пространства',exact:true}).getByRole('button',{name:'Проектный комитет',exact:true}).click();
 await page.getByRole('searchbox').fill('комитет');
 await page.getByTestId('record-row-project-committee').locator('.record-row-open').click();
 await expect(page.locator('.linear-view.mode-full')).toBeVisible();await expect(page.locator('.records-pane')).toBeHidden();
 await page.getByRole('tab',{name:/^Ассистент:/}).click();const input=page.getByRole('textbox',{name:'Вопрос Ассистенту'});await input.fill('Проверь решения комитета');
 await page.getByRole('button',{name:'Вернуться к списку',exact:true}).click();await expect(page.getByRole('searchbox')).toHaveValue('комитет');await expect(page.getByTestId('record-row-project-committee')).toHaveClass(/is-selected/);
 await page.getByTestId('record-row-project-committee').locator('.record-row-open').click();await expect(page.getByRole('textbox',{name:'Вопрос Ассистенту'})).toHaveValue('Проверь решения комитета');
 await page.getByRole('button',{name:'Рядом со списком',exact:true}).click();await expect(page.locator('.records-pane')).toBeVisible();await expect(page.locator('.detail-pane')).toBeVisible();
 await page.getByRole('tab',{name:/^Резюме:/}).click();await page.screenshot({path:'qa/linear-split.png'});
 await page.getByRole('button',{name:'Вернуться к списку',exact:true}).click();await page.getByRole('searchbox').fill('');await page.screenshot({path:'qa/linear-wide.png'});expect(errors).toEqual([]);
});
test('list scroll and keyboard focus return to selected row',async({page})=>{
 await page.goto('/');const viewport=page.getByTestId('library-page');await viewport.evaluate(e=>e.scrollTop=300);await page.waitForTimeout(100);const before=await viewport.evaluate(e=>e.scrollTop);
 const row=page.locator('.record-row-open').filter({hasText:'Интервью с заказчиком'}).first();await row.click();await page.getByRole('button',{name:'Вернуться к списку',exact:true}).click();expect(await viewport.evaluate(e=>e.scrollTop)).toBe(before);await expect(row).toBeFocused();
});
