import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, OWNER, SERVER } from '../src/fixtures.ts';
import { workspaceOwnerLabel } from '../src/workspaceOwner.ts';
test('only explicit ownership produces owner names; admin membership is not ownership',()=>{
 const s=initialState();
 assert.equal(workspaceOwnerLabel(s,'project'),'Не указан');assert.equal(workspaceOwnerLabel(s,'pilot'),'Не указан');
 assert.equal(workspaceOwnerLabel(s,'personal'),'Алексей Петров');
 s.createdWorkspaces=[{id:'own',name:'Own',description:'',color:'',members:[],server:SERVER,owner:OWNER}];
 assert.equal(workspaceOwnerLabel(s,'own'),'Алексей Петров');
 assert.equal(workspaceOwnerLabel({...s,server:{address:'elsewhere',organization:'Other'}},'own'),'Не указан');
 assert.equal(workspaceOwnerLabel({...s,authenticated:false},'own'),'Не указан');
 assert.equal(workspaceOwnerLabel({...s,createdWorkspaces:[{...s.createdWorkspaces[0],owner:'someone@example.com'}]},'own'),'Не указан');
});
