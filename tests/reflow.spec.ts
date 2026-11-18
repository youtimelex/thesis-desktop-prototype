import{test,expect}from'@playwright/test';
for(const width of [720,820,1024,1440])test(`reflow ${width}`,async({page})=>{
 await page.setViewportSize({width,height:900});
 for(const route of ['/','/#/settings/appearance','/#/library/all','/#/assistant']){await page.goto(route);await page.waitForTimeout(100);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),route).toBe(true);}
 await page.goto('/');await page.getByTestId('meeting-card-project-committee').click();await expect(page.getByRole('tab',{name:/^Резюме:/})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`qa/reflow-${width}.png`});
});
test('assistant stop/retry states and AX semantics',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await page.getByTestId('meeting-card-project-committee').click();await page.getByRole('textbox',{name:'Вопрос Ассистенту'}).fill('Какие решения?');await page.getByRole('button',{name:'Отправить вопрос',exact:true}).click();await expect(page.getByText('Готовим ответ…',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Остановить ответ',exact:true}).click();await expect(page.getByText('Ответ остановлен. Вопрос и источники сохранены.',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Повторить запрос',exact:true}).click();await expect(page.getByText('Готовим ответ…',{exact:true})).toBeVisible();
 const session=await page.context().newCDPSession(page);const tree=await session.send('Accessibility.getFullAXTree');const names=tree.nodes.filter((x:any)=>!x.ignored).map((x:any)=>x.name?.value);expect(names).toContain('Вопрос Ассистенту');expect(names).toContain('Остановить ответ');expect(names).toContain('Позиция воспроизведения');expect(errors).toEqual([]);
 await page.screenshot({path:'qa/assistant-loading.png'});
});
