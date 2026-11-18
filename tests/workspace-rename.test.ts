import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState, OWNER, SERVER} from '../src/fixtures.ts';
import {canRenameWorkspace,reducer,validateWorkspace,workspaceList} from '../src/model.ts';

test('workspace rename changes only an owned created workspace name',()=>{
 let s=reducer(initialState(),{type:'create-workspace',id:'custom-rename',name:'Команда Альфа',server:SERVER});
 const before=s;assert.equal(canRenameWorkspace(s,'custom-rename'),true);assert.equal(validateWorkspace(s,'Команда Альфа','custom-rename'),null);
 s=reducer(s,{type:'rename-workspace',id:'custom-rename',name:'  Команда   Бета  ',server:SERVER});
 assert.equal(workspaceList(s).find(w=>w.id==='custom-rename')?.name,'Команда Бета');
 assert.equal(s.records,before.records);assert.equal(s.folders,before.folders);assert.equal(s.drafts,before.drafts);assert.equal(s.dialogs,before.dialogs);assert.equal(s.createdWorkspaces![0].owner,OWNER);
 assert.equal(reducer(s,{type:'rename-workspace',id:'custom-rename',name:'Команда Бета',server:SERVER}),s);
});
test('rename rejects fixtures, Personal, other owners/servers, offline and invalid names',()=>{
 let s=reducer(initialState(),{type:'create-workspace',id:'custom-rename',name:'Команда Альфа',server:SERVER});
 for(const id of ['personal','project','pilot','missing']){assert.equal(canRenameWorkspace(s,id),false);assert.equal(reducer(s,{type:'rename-workspace',id,name:'Новая команда',server:SERVER}),s);}
 for(const name of ['', 'x'.repeat(81),'Личное','Проектный комитет'])assert.equal(reducer(s,{type:'rename-workspace',id:'custom-rename',name,server:SERVER}),s);
 const offline={...s,settings:{...s.settings,network:'offline' as const}};assert.equal(reducer(offline,{type:'rename-workspace',id:'custom-rename',name:'Новая',server:SERVER}),offline);
 const foreign={...s,createdWorkspaces:s.createdWorkspaces!.map(w=>({...w,owner:'someone@example.test'}))};assert.equal(reducer(foreign,{type:'rename-workspace',id:'custom-rename',name:'Новая',server:SERVER}),foreign);
 const switched={...s,server:{address:'other.example.test',organization:'Other'}};assert.equal(reducer(switched,{type:'rename-workspace',id:'custom-rename',name:'Новая',server:SERVER}),switched);
 const signedOut={...s,authenticated:false};assert.equal(canRenameWorkspace(signedOut,'custom-rename'),false);
});
