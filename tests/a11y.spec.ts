import {test,expect} from '@playwright/test';
for(const theme of ['light','dark'])for(const colorway of ['blue','neutral','orange'])test(`a11y ${theme}/${colorway}`,async({page})=>{
 await page.addInitScript(({theme,colorway})=>localStorage.setItem('thesis-vini-appearance-v1',JSON.stringify({theme,colorway})),{theme,colorway});
 for(const route of ['/','/#/settings/appearance','/#/library/all','/#/assistant']) {
  await page.goto(route);await page.waitForTimeout(250);await page.addScriptTag({path:'node_modules/axe-core/axe.min.js'});
  const v=await page.evaluate(async()=> (await (window as any).axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map((x:any)=>({id:x.id,nodes:x.nodes.map((n:any)=>({target:n.target,summary:n.failureSummary}))})));expect(v,route).toEqual([]);
 }
 await page.goto('/');await page.getByTestId('meeting-card-project-committee').click();await expect(page.getByRole('tab',{name:/^Резюме:/})).toBeVisible();await page.waitForTimeout(250);await page.addScriptTag({path:'node_modules/axe-core/axe.min.js'});
 const v=await page.evaluate(async()=> (await (window as any).axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map((x:any)=>({id:x.id,nodes:x.nodes.map((n:any)=>({target:n.target,summary:n.failureSummary}))})));expect(v,'record').toEqual([]);
});
test('library row keyboard, menu focus and dialog containment',async({page})=>{
 await page.goto('/#/library/all');const rows=page.locator('.record-row-open');await expect(rows.first()).toBeVisible();await rows.first().focus();await page.keyboard.press('ArrowDown');await expect(rows.nth(1)).toBeFocused();await page.keyboard.press('k');await expect(rows.first()).toBeFocused();
 const row=page.getByTestId('record-row-project-committee');await expect(row).toHaveAttribute('data-slot','item');await row.locator('.record-row-open').focus();await page.keyboard.press('Tab');await expect(row.getByRole('button').last()).toBeFocused();await page.keyboard.press('Enter');await expect(page.getByRole('menu')).toBeVisible();await page.keyboard.press('Escape');await expect(row.getByRole('button').last()).toBeFocused();
 await page.goto('/#/settings/connection');const trigger=page.getByRole('button',{name:'Изменить сервер',exact:true});await trigger.click();const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();for(let i=0;i<8;i++){await page.keyboard.press('Tab');await expect.poll(()=>dialog.evaluate(e=>e.contains(document.activeElement))).toBe(true);}await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(trigger).toBeFocused();
});
