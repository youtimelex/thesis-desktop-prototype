import { Checkbox } from '@vini-ds/ui';
import { useId, useState } from 'react';
import { OWNER, WORKSPACES } from './fixtures.ts';
import { canEditDemoMembers, demoMembers, workspaceList } from './model.ts';
import { useStore } from './store.tsx';
import { Button, Modal } from './ui.tsx';
import type { WorkspaceInvitationDraft } from './types.ts';
import './workspace-invitations.css';
const candidates = [...new Map(WORKSPACES.flatMap(w=>w.members).filter(m=>m.email!==OWNER).map(m=>[m.email,m])).values()];
function InvitationChoice({ name, email, checked, onChange }: { name: string; email: string; checked: boolean; onChange: (checked: boolean) => void }) {
 const id = useId();
 return <div className="invitation-choice"><Checkbox id={id} checked={checked} onCheckedChange={onChange}/><label htmlFor={id}>{name}<small>{email}</small></label></div>;
}
export function InvitationDraftPicker({value,onChange}:{value:WorkspaceInvitationDraft[];onChange:(v:WorkspaceInvitationDraft[])=>void}) {
 return <section className="invitation-draft-picker" aria-label="Выбор коллег"><strong>Коллеги</strong>{candidates.map(c=><InvitationChoice key={c.email} name={c.name} email={c.email} checked={value.some(d=>d.email.toLowerCase()===c.email)} onChange={checked=>onChange(checked?[...value,{email:c.email,name:c.name,status:'not-sent'}]:value.filter(d=>d.email.toLowerCase()!==c.email))}/>)}</section>;
}
export function WorkspaceInvitationEditor({workspaceId}:{workspaceId:string}) {
 const {state,dispatch,notify}=useStore();const [open,setOpen]=useState(false);const [selected,setSelected]=useState<string[]>([]);
 if(!canEditDemoMembers(state,workspaceId))return null;
 const members=demoMembers(state,workspaceId);
 const baseline=workspaceList(state).find(w=>w.id===workspaceId)?.members??[];
 const saved=state.createdWorkspaces?.find(w=>w.id===workspaceId&&w.server===state.server?.address&&w.owner===OWNER)?.invitationDrafts??[];
 const people=[...new Map([...baseline,...saved.map(d=>({name:d.name||d.email,email:d.email,role:'Выбран в демо'})),...candidates,...members].map(m=>[m.email,m])).values()];
 return <><Button icon="users" onClick={()=>{setSelected(members.map(m=>m.email));setOpen(true);}}>Изменить участников</Button><Modal open={open} onClose={()=>setOpen(false)} title="Участники пространства" description="Локальный демосписок. Без отправки приглашений и изменения доступа." footer={<div className="modal-actions"><Button variant="ghost" onClick={()=>setOpen(false)}>Отмена</Button><Button variant="primary" onClick={()=>{if(!state.server||!canEditDemoMembers(state,workspaceId))return;dispatch({type:'save-demo-members',id:workspaceId,server:state.server.address,members:people.filter(m=>selected.includes(m.email))});setOpen(false);notify('Демосписок сохранён локально');}}>Сохранить</Button></div>}><div className="invitation-draft-picker">{people.map(m=><InvitationChoice key={m.email} name={m.name} email={m.email} checked={selected.includes(m.email)} onChange={checked=>setSelected(checked?[...selected,m.email]:selected.filter(v=>v!==m.email))}/>)}</div></Modal></>;
}
