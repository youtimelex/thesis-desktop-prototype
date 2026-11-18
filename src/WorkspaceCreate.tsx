import { InvitationDraftPicker } from './WorkspaceInvitations.tsx';
import type { WorkspaceInvitationDraft } from './types.ts';
import { FieldGroup, Input } from '@vini-ds/ui';
import { useId, useState } from 'react';
import { validateWorkspace, validateInvitationDrafts } from './model.ts';
import { useNav } from './navigation.tsx';
import { useStore } from './store.tsx';
import { Button, Field, Modal } from './ui.tsx';

export function CreateWorkspaceButton() {
  const formId = useId();
  const { state, dispatch, notify } = useStore(); const { go } = useNav();
  const [open, setOpen] = useState(false); const [name, setName] = useState(''); const [error, setError] = useState('');
  const [invitations,setInvitations]=useState<WorkspaceInvitationDraft[]>([]);
  const disabled = !state.server || state.settings.network === 'offline';
  const begin = () => { setInvitations([]); setName(''); setError(''); setOpen(true); };
  const create = () => {
    const validation = validateWorkspace(state, name) ?? validateInvitationDrafts(invitations);
    if (validation || !state.server) { setError(validation ?? 'Сервер недоступен.'); return; }
    const id = crypto.randomUUID();
    dispatch({ type: 'create-workspace', id, name, server: state.server.address, invitationDrafts:invitations });
    setOpen(false); go({ page: 'library', scope: { kind: 'area', areaId: id } }); notify('Пространство создано');
  };
  return <>
    <Button icon="plus" disabled={disabled} onClick={begin}>Создать пространство</Button>
    <Modal open={open} onClose={() => setOpen(false)} title="Новое пространство" description="Демонстрационное пространство для записей и папок." footer={<div className="modal-actions"><Button variant="ghost" onClick={() => setOpen(false)}>Отмена</Button><Button type="submit" form={formId} variant="primary" disabled={disabled || !name.trim()}>Создать пространство</Button></div>}>
      <form id={formId} onSubmit={event => { event.preventDefault(); create(); }}>
        <FieldGroup>
        <Field label="Название пространства" error={error}><Input data-vini-input="true" autoFocus aria-label="Название пространства" maxLength={80} placeholder="Например, проектная команда" value={name} onChange={event => { setName(event.target.value); setError(''); }} /></Field>
        <InvitationDraftPicker value={invitations} onChange={setInvitations}/>
        </FieldGroup>
      </form>
    </Modal>
  </>;
}
