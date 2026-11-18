import {test,expect} from '@playwright/test';
import {initialState,OWNER,SERVER} from '../src/fixtures.ts';
for(const theme of ['light','dark'])test(`workspace rename dialog ${theme}`,async({page})=>{
 const state=initialState();state.createdWorkspaces=[{id:'rename-test-space',name:'Команда для переименования',description:'Тест',color:'#8b919b',members:[],owner:OWNER,server:SERVER}];
 await page.addInitScript(({state,theme})=>{if(!localStorage.getItem('vinteo-thesis-desktop-vini-home-v1'))localStorage.setItem('vinteo-thesis-desktop-vini-home-v1',JSON.stringify(state));localStorage.setItem('thesis-vini-home-appearance-v1',JSON.stringify({theme,colorway:'blue'}));},{state,theme});
 await page.setViewportSize({width:1280,height:900});await page.goto('/#/home');
 const nav=page.getByRole('navigation',{name:'Пространства',exact:true});await expect(nav.locator('[data-slot="sidebar-menu-item"]').first()).toContainText('Все пространства');
 await nav.getByRole('button',{name:'Пространство: Проектный комитет',exact:true}).hover();await nav.getByRole('button',{name:'Действия пространства: Проектный комитет',exact:true}).click();await expect(page.getByRole('menuitem',{name:'Переименовать пространство'})).toHaveCount(0);await page.keyboard.press('Escape');
 await nav.getByRole('button',{name:'Пространство: Команда для переименования',exact:true}).hover();await nav.getByRole('button',{name:'Действия пространства: Команда для переименования',exact:true}).click();await page.getByRole('menuitem',{name:'Переименовать пространство',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Переименовать пространство',exact:true});await expect(dialog).toBeVisible();await expect(page.getByRole('menu')).toHaveCount(0);
 const input=dialog.getByRole('textbox',{name:'Название пространства',exact:true});await expect(input).toHaveValue('Команда для переименования');await page.screenshot({path:`qa/workspace-rename-${theme}.png`,animations:'disabled'});await input.fill('Проектный комитет');await input.press('Enter');await expect(dialog.getByRole('alert')).toContainText('уже есть');
 await input.fill('Команда после переименования');await input.press('Enter');await expect(dialog).toBeHidden();await expect(nav.getByRole('button',{name:'Пространство: Команда после переименования',exact:true})).toBeVisible();
 await page.reload();await expect(nav.getByRole('button',{name:'Пространство: Команда после переименования',exact:true})).toBeVisible();
 await nav.getByRole('button',{name:'Действия пространства: Команда после переименования',exact:true}).focus();await page.keyboard.press('Enter');await page.getByRole('menuitem',{name:'Переименовать пространство',exact:true}).click();await expect(dialog).toBeVisible();await page.keyboard.press('Escape');await expect(dialog).toBeHidden();
});
