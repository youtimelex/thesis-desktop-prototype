import { FieldGroup, Input, Textarea } from '@vini-ds/ui';
import { useEffect, useState } from 'react';
import { validateDemoWorkspaceDetails, workspaceList } from './model.ts';
import { useStore } from './store.tsx';
import { Button, Field, MenuItem, Modal } from './ui.tsx';

// This edits a local prototype overlay, never infers server administration rights.
export function WorkspaceRenameMenuItem({workspaceId,onRename}:{workspaceId:string;onRename:(id:string)=>void}) {
 const {state}=useStore();
 if(!state.authenticated || !workspaceList(state).some(w=>w.id===workspaceId)) return null;
 return <MenuItem icon="edit" onSelect={()=>onRename(workspaceId)}>Редактировать</MenuItem>;
}
export function WorkspaceRenameDialog({workspaceId,onClose}:{workspaceId:string|null;onClose:()=>void}) {
 const {state,dispatch,notify}=useStore();const workspace=workspaceList(state).find(w=>w.id===workspaceId);
 const [name,setName]=useState(''),[description,setDescription]=useState(''),[error,setError]=useState('');
 useEffect(()=>{setName(workspace?.name??'');setDescription(workspace?.description??'');setError('');},[workspaceId]);
 return <Modal open={workspaceId!==null} onClose={onClose} title="Редактировать пространство" description="Название и описание сохраняются только в этом браузере. Права доступа и данные на сервере не изменяются."><form onSubmit={e=>{e.preventDefault();if(!workspace||!state.server)return;const error=validateDemoWorkspaceDetails(state,workspace.id,name,description);if(error){setError(error);return;}dispatch({type:'save-demo-workspace-details',id:workspace.id,name,description,server:state.server.address});onClose();notify('Изменения пространства сохранены локально');}}>
 <FieldGroup>
  <Field label="Название пространства" error={error}><Input data-vini-input="true" autoFocus aria-label="Название пространства" maxLength={80} value={name} onChange={e=>{setName(e.target.value);setError('');}}/></Field>
  <Field label="Описание"><Textarea aria-label="Описание пространства" maxLength={500} value={description} onChange={e=>setDescription(e.target.value)}/></Field>
 </FieldGroup>
 <div className="modal-actions"><Button variant="ghost" onClick={onClose}>Отмена</Button><Button type="submit" variant="primary" disabled={!workspace||!name.trim()}>Сохранить</Button></div>
 </form></Modal>;
}
