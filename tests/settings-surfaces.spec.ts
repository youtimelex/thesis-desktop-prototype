import {test,expect} from '@playwright/test';
for(const theme of ['light','dark'])for(const colorway of ['blue','neutral','orange'])for(const width of [720,1280])test(`settings surfaces ${theme} ${colorway} ${width}`,async({page})=>{
await page.setViewportSize({width,height:1000});await page.addInitScript(({theme,colorway})=>localStorage.setItem('thesis-vini-home-appearance-v1',JSON.stringify({theme,colorway})),{theme,colorway});
await page.goto('/#/settings/appearance');
const tokens=await page.locator('.settings-shell').evaluate(e=>{const el=document.createElement('span');e.appendChild(el);const out:Record<string,string>={};for(const token of ['base','space','surface']){el.style.background=`var(--vini-theme-main-${token})`;out[token]=getComputedStyle(el).backgroundColor;}el.remove();return out;});
for(const selector of ['.settings-shell','.settings-sidebar','.settings-group-card'])expect(await page.locator(selector).first().evaluate(e=>getComputedStyle(e).backgroundColor)).toBe(tokens.base);
expect(await page.locator('.content-shell').evaluate(e=>getComputedStyle(e).backgroundColor)).toBe(tokens.space);
expect(tokens.base).not.toBe(tokens.space);expect(tokens.surface).not.toBe(tokens.base);
await page.screenshot({path:`qa/settings-surfaces-${theme}-${colorway}-${width}.png`});
await page.getByRole('button',{name:'Подключение',exact:true}).click();expect(await page.locator('.connection-card').evaluate(e=>getComputedStyle(e).backgroundColor)).toBe(tokens.surface);
await page.addScriptTag({path:'node_modules/axe-core/axe.min.js'});expect(await page.evaluate(async()=> (await(window as any).axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map((v:any)=>v.id))).toEqual([]);
expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
await page.getByRole('button',{name:'Назад в приложение'}).click();expect(await page.locator('.content-shell').evaluate(e=>getComputedStyle(e).backgroundColor)).toBe(tokens.base);expect(await page.locator('.desktop-app').evaluate(e=>getComputedStyle(e).backgroundColor)).toBe(tokens.space);
});
