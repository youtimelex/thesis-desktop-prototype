import { PageHeader, PanelHeader } from './PageHeader.tsx';
import { createPortal } from 'react-dom';
import { Item, ItemGroup, ItemMedia, ItemContent, ItemTitle, ItemDescription, ItemActions, Checkbox, Empty as VEmpty, EmptyHeader, EmptyDescription, Combobox, ComboboxInput, ComboboxContent, ComboboxList, ComboboxItem, ComboboxEmpty, InputGroupInput, Message, MessageGroup, MessageContent, MessageFooter, Bubble, BubbleContent, Button as VButton, Alert, AlertDescription, AlertAction, Loader, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuGroup, DropdownMenuLabel } from '@vini-ds/ui';
import { InputGroup, InputGroupTextarea, InputGroupAddon, InputGroupButton, Input, Textarea, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@vini-ds/ui';
import { useEffect, useId, useLayoutEffect, useRef, useState, type MouseEvent } from 'react';
import './record-history.css';
import './assistant-list.css';
import { OWNER } from './fixtures.ts';
import { SOURCE_NAMES, areaAvailable, areaName, canRead, dateLabel, dialogMatchesSearch, dialogTitle, isOnServer, pluralRecords, recordDialogs, recordInSourceScope, scopeLabel, scopeMaterials, scopeRecords, sourceError, sourceSnapshot, turnAccessible, usedSources, visibleDialogs, workspaceList } from './model.ts';
import { useNav } from './navigation.tsx';
import { useStore } from './store.tsx';
import { Button, Confirm, Empty, Field, Icon, IconButton, Markdown, Menu, MenuItem, Modal, SecondaryPane, Select } from './ui.tsx';
import type { AssistantDialog, Scope, Snapshot, Turn } from './types.ts';

function dayLabel(date: number) {
  const d = new Date(date); const today = new Date(); const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
  return d.toDateString() === today.toDateString() ? 'Сегодня' : d.toDateString() === yesterday.toDateString() ? 'Вчера' : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

/** One history control, with the owning surface supplying its scope and actions. */
function DialogHistoryMenu({ dialog, dialogs, onChoose, onNew, onAll, newDisabled = false, record = false }: {
  dialog?: AssistantDialog;
  dialogs: AssistantDialog[];
  onChoose: (id: string) => void;
  onNew: () => void;
  onAll?: () => void;
  newDisabled?: boolean;
  record?: boolean;
}) {
  const label = dialog ? dialogTitle(dialog) : 'Диалог недоступен';
  return <DropdownMenu modal={false}>
    <TooltipProvider><Tooltip><TooltipTrigger render={<DropdownMenuTrigger render={<VButton type="button" size="500" variant="text" className="assistant-dialog-trigger" endIcon={<Icon name="down" size={16}/>} aria-label={`${record ? 'История диалогов по записи' : 'История диалогов'}: ${label}`}>{label}</VButton>}/>} /><TooltipContent>{label}</TooltipContent></Tooltip></TooltipProvider>
    <DropdownMenuContent className="assistant-dialog-menu" align={record ? 'end' : 'start'} sideOffset={6} aria-label={record ? 'История диалогов по записи' : 'История диалогов'}>
      {onAll && <DropdownMenuItem onClick={onAll}><Icon name="list" size={18}/><span>Все диалоги</span></DropdownMenuItem>}
      {newDisabled ? <TooltipProvider><Tooltip><TooltipTrigger render={<DropdownMenuItem disabled onClick={onNew}><Icon name="plus" size={18}/><span>Новый диалог</span></DropdownMenuItem>} /><TooltipContent>Сначала начните текущий диалог</TooltipContent></Tooltip></TooltipProvider> : <DropdownMenuItem onClick={onNew}><Icon name="plus" size={18}/><span>Новый диалог</span></DropdownMenuItem>}
      {dialogs.length > 0 && <><DropdownMenuSeparator/><DropdownMenuGroup><DropdownMenuLabel>История диалогов</DropdownMenuLabel>{dialogs.map(d => <DropdownMenuItem key={d.id} className="assistant-dialog-menu-item" aria-current={d.id === dialog?.id ? 'true' : undefined} onClick={() => onChoose(d.id)}><TooltipProvider><Tooltip><TooltipTrigger render={<span className="assistant-dialog-menu-title" tabIndex={-1}>{dialogTitle(d)}</span>} /><TooltipContent>{dialogTitle(d)}</TooltipContent></Tooltip></TooltipProvider>{d.id === dialog?.id && <span className="assistant-dialog-menu-current">Текущий</span>}<time className="assistant-dialog-menu-date" dateTime={new Date(d.updatedAt).toISOString()}>{dayLabel(d.updatedAt)}</time></DropdownMenuItem>)}</DropdownMenuGroup></>}
    </DropdownMenuContent>
  </DropdownMenu>;
}

function DialogActions({ dialog, active }: { dialog: AssistantDialog; active: boolean }) {
  const { dispatch, notify } = useStore(); const { go, route } = useNav();
  const [action, setAction] = useState<'rename' | 'delete' | null>(null); const [title, setTitle] = useState('');
  return <><Menu label="Действия с диалогом" trigger={<IconButton icon="more" label={`Действия с диалогом: ${dialogTitle(dialog)}`} />}><MenuItem icon="edit" onSelect={() => { setTitle(dialogTitle(dialog)); setAction('rename'); }}>Переименовать диалог</MenuItem><MenuItem icon="delete" danger onSelect={() => setAction('delete')}>Удалить диалог</MenuItem></Menu>
    <Modal open={action === 'rename'} onClose={() => setAction(null)} title="Название диалога"><form onSubmit={e => { e.preventDefault(); if (!title.trim()) return; dispatch({ type: 'update-dialog', id: dialog.id, patch: { title: title.trim(), customTitle: true }, now: Date.now() }); setAction(null); notify('Название диалога изменено'); }}><Field label="Название"><Input data-vini-input="true" autoFocus aria-label="Название диалога" maxLength={90} value={title} onChange={e => setTitle(e.target.value)} /></Field><div className="modal-actions"><Button variant="ghost" onClick={() => setAction(null)}>Отмена</Button><Button type="submit" variant="primary" disabled={!title.trim()}>Сохранить</Button></div></form></Modal>
    <Confirm open={action === 'delete'} onClose={() => setAction(null)} title="Удалить диалог?" target={dialogTitle(dialog)} description="Переписка и черновик удалятся с этого устройства. Записи-источники останутся. Восстановить диалог нельзя." danger confirm="Удалить диалог" onConfirm={() => { dispatch({ type: 'delete-dialog', id: dialog.id }); setAction(null); if (active) go({ page: 'assistant', listScope: route.page==='assistant'?route.listScope:undefined, listSearch:route.page==='assistant'?route.listSearch:undefined }); notify('Диалог удалён'); }} />
  </>;
}

function SourcePicker({ dialog, open, onClose }: { dialog: AssistantDialog; open: boolean; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const sourceId = useId();
  const [scope, setScope] = useState<Scope>(dialog.scope); const [query, setQuery] = useState('');
  const locked = dialog.turns.length > 0 || Boolean(dialog.recordContextId);
  useEffect(() => { if (open) { setScope({ ...dialog.scope, recordIds: [...dialog.scope.recordIds] }); setQuery(''); } }, [open, dialog.id]);
  const selected = scope.mode === 'auto' ? scopeRecords(state, scope).map(r => r.id) : scope.recordIds;
  const candidates = state.records.filter(r => canRead(state, r) && isOnServer(r) && recordInSourceScope(r, scope));
  const shown = candidates.filter(r => r.title.toLocaleLowerCase('ru-RU').includes(query.toLocaleLowerCase('ru-RU')));
  const searching = Boolean(query.trim());
  const shownAvailable = shown.filter(sourceSnapshot);
  const selectedShown = shown.filter(r => selected.includes(r.id)).length;
  const selectedShownAvailable = shownAvailable.filter(r => selected.includes(r.id)).length;
  const selectShown = () => setScope({ ...scope, mode: 'explicit', recordIds: Array.from(new Set([...selected, ...shownAvailable.map(r => r.id)])) });
  const clearShown = () => { const shownIds = new Set(shown.map(r => r.id)); setScope({ ...scope, mode: 'explicit', recordIds: selected.filter(id => !shownIds.has(id)) }); };
  const outside = selected.filter(id => !candidates.some(r => r.id === id));
  const folders = state.folders.filter(f => f.areaId === (scope.areaId === 'legacy' ? null : scope.areaId) && f.server === state.server?.address);
  const hasLegacy = state.folders.some(f => f.areaId === null && f.server === state.server?.address);
  const areaOptions = [{ value: 'all', label: 'Все доступные записи' }, { value: 'personal', label: 'Личное' }, ...workspaceList(state).map(w => ({ value: w.id, label: w.name })), ...(hasLegacy ? [{ value: 'legacy', label: 'Папки без пространства' }] : [])];
  const folderRootLabel = scope.areaId === 'personal' || scope.areaId === 'legacy' ? 'Без папки' : 'В корне пространства';
  const changed = JSON.stringify(scope) !== JSON.stringify(dialog.scope);
  const apply = () => { if (changed && !locked) dispatch({ type: 'update-dialog', id: dialog.id, patch: { scope }, now: Date.now() }); onClose(); };
  return <Modal open={open} onClose={onClose} title="Источники ответа" description={locked ? 'Источники закреплены за диалогом. Чтобы выбрать другие, начните новый диалог.' : 'Уточните, по каким записям искать ответ. Выбор не изменяет доступ к записям.'} wide>
    {locked ? <>
      <div className="source-list-heading"><h3>{scopeLabel(state, dialog.scope)}</h3><span className="muted-copy">{dialog.scope.mode === 'auto' ? 'Все доступные записи, включая новые' : pluralRecords(selected.length)}</span></div>
      <div className="source-records" role="list" aria-label="Выбранные источники">{selected.map(recordId => {
        const record = state.records.find(r => r.id === recordId);
        return <Item key={recordId} role="listitem" size="sm"><ItemMedia><Icon name={record?.source === 'conference' ? 'conference' : 'file'} size={18}/></ItemMedia><ItemContent><ItemTitle>{record?.title ?? 'Запись недоступна'}</ItemTitle></ItemContent></Item>;
      })}{!selected.length && <VEmpty><EmptyHeader><EmptyDescription>Нет доступных записей.</EmptyDescription></EmptyHeader></VEmpty>}</div>
      <div className="modal-actions"><Button variant="primary" onClick={onClose}>Готово</Button></div>
    </> : <>
      <div className="source-scope-fields"><div className="field"><label className="field-label" htmlFor={`${sourceId}-area`}>Область поиска</label><Combobox items={areaOptions} value={areaOptions.find(option => option.value === scope.areaId) ?? null} isItemEqualToValue={(a, b) => a.value === b.value} itemToStringLabel={option => option.label} itemToStringValue={option => option.value} onValueChange={option => { if (option) setScope({ mode: 'auto', areaId: option.value, recordIds: [] }); }}><ComboboxInput data-vini-input="true" id={`${sourceId}-area`} showTrigger triggerLabel="Показать области поиска" placeholder="Найти пространство" /><ComboboxContent><ComboboxEmpty>Ничего не найдено</ComboboxEmpty><ComboboxList>{(option: { value: string; label: string }) => <ComboboxItem key={option.value} value={option}>{option.label}</ComboboxItem>}</ComboboxList></ComboboxContent></Combobox></div>{scope.areaId !== 'all' && <div className="field"><span className="field-label">Папка</span><Select label="Папка для ответа" value={scope.folderId ?? 'all'} options={[{ value: 'all', label: 'Все папки и корень' }, { value: 'root', label: folderRootLabel }, ...folders.map(f => ({ value: f.id, label: f.name }))]} onChange={folderId => setScope({ ...scope, mode: 'auto', folderId: folderId === 'all' ? undefined : folderId, recordIds: [] })} /></div>}</div>
      <div className="source-list-heading"><h3>Записи <span>{selected.length}</span></h3><div className="source-list-actions">{searching ? <>{selectedShownAvailable < shownAvailable.length && <VButton type="button" size="400" variant="text" onClick={selectShown}>Выбрать найденные</VButton>}{selectedShown > 0 && <VButton type="button" size="400" variant="text" onClick={clearShown}>Снять выбор с найденных</VButton>}</> : <>{scope.mode !== 'auto' && <VButton type="button" size="400" variant="text" onClick={() => setScope({ ...scope, mode: 'auto', recordIds: [] })}>Выбрать все в области</VButton>}{selected.length > 0 && <VButton type="button" size="400" variant="text" onClick={() => setScope({ ...scope, mode: 'explicit', recordIds: [] })}>Снять выбор со всех</VButton>}</>}</div></div>
      <div className="search-input source-search"><Icon name="search" size={18} /><Input data-vini-input="true" aria-label="Найти запись-источник" placeholder="Найти запись" value={query} onChange={e => setQuery(e.target.value)} /></div>
      <div className="source-records">{shown.map(record => { const snapshot = sourceSnapshot(record); const checked = selected.includes(record.id); const id = `${sourceId}-record-${record.id}`; return <div key={record.id} className="source-record source-record--vini" onClick={event => { if (event.target === event.currentTarget && (snapshot || checked)) setScope({ ...scope, mode: 'explicit', recordIds: checked ? selected.filter(value => value !== record.id) : [...selected, record.id] }); }}><Checkbox id={id} checked={checked} disabled={!snapshot && !checked} onCheckedChange={next => setScope({ ...scope, mode: 'explicit', recordIds: next ? [...selected, record.id] : selected.filter(value => value !== record.id) })}/><label htmlFor={id}><span><strong>{record.title}</strong><small className="vini-text-desktop-caption-regular-400">{snapshot ? `${dateLabel(record.createdAt, false)} · ${snapshot.material === 'summary' ? 'Резюме' : 'Транскрипция'}${snapshot.notice ? ` · ${snapshot.notice}` : ` · версия ${snapshot.revision}`}` : record.noSpeech ? 'Речь не обнаружена' : 'Текст пока недоступен'}</small></span><Icon name={record.source === 'conference' ? 'conference' : 'file'} size={18} /></label></div>; })}{outside.map(recordId => { const id = `${sourceId}-outside-${recordId}`; return <div key={recordId} className="source-record source-record--vini" onClick={event => { if (event.target === event.currentTarget) setScope({ ...scope, mode: 'explicit', recordIds: selected.filter(value => value !== recordId) }); }}><Checkbox id={id} checked onCheckedChange={() => setScope({ ...scope, mode: 'explicit', recordIds: selected.filter(value => value !== recordId) })}/><label htmlFor={id}><span><strong>{state.records.find(r => r.id === recordId)?.title ?? 'Запись недоступна'}</strong><small className="vini-text-desktop-caption-regular-400">Вне выбранной области · нажмите, чтобы исключить</small></span></label></div>; })}{!shown.length && !outside.length && <VEmpty><EmptyHeader><EmptyDescription>{query ? 'Записи не найдены. Измените запрос.' : 'В этой области пока нет записей.'}</EmptyDescription></EmptyHeader></VEmpty>}</div>
      <div className="modal-actions modal-actions--spread"><span className="muted-copy">{scope.mode === 'auto' ? 'Все доступные записи, включая новые' : pluralRecords(selected.length)}</span><div><Button variant="ghost" onClick={onClose}>Отмена</Button><Button variant="primary" onClick={apply}>Применить</Button></div></div>
    </>}
  </Modal>;
}

export function RecordAssistant({ recordId }: { recordId: string }) {
  const { state, dispatch } = useStore();
  const { openDialog } = useNav();
  const [toolbarHost, setToolbarHost] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => { setToolbarHost(document.getElementById('record-dialog-toolbar-slot')); }, [recordId]);
  const record = state.records.find(r => r.id === recordId);
  const dialogs = recordDialogs(state, recordId);
  const selectionKey = `thesis-home-record-dialog:${JSON.stringify([state.server?.address, OWNER, recordId])}`;
  const persistSelection = new URLSearchParams(window.location.search).get('preview') !== '1';
  const [selection, setSelection] = useState<{ key: string; id: string | null }>(() => {
    if (!persistSelection) return { key: selectionKey, id: null };
    try { return { key: selectionKey, id: localStorage.getItem(selectionKey) }; } catch { return { key: selectionKey, id: null }; }
  });
  const savedId = selection.key === selectionKey ? selection.id : null;
  const dialog = dialogs.find(d => d.id === savedId) ?? dialogs[0];
  const available = Boolean(record && canRead(state, record));
  useEffect(() => {
    if (selection.key !== selectionKey) {
      let id: string | null = null; try { if (persistSelection) id = localStorage.getItem(selectionKey); } catch { /* Session-only selection if storage is unavailable. */ }
      setSelection({ key: selectionKey, id });
    }
  }, [persistSelection, selectionKey, selection.key]);
  useEffect(() => {
    if (available && !dialog) dispatch({ type: 'ensure-record-dialog', recordId, dialogId: crypto.randomUUID(), now: Date.now() });
  }, [available, dialog?.id, recordId, dispatch]);
  const choose = (id: string) => {
    setSelection({ key: selectionKey, id });
    try { if (persistSelection) localStorage.setItem(selectionKey, id); } catch { /* Drafts remain in the application store. */ }
  };
  const newDialog = () => {
    if (!available || !dialog?.turns.length) return;
    const empty = dialogs.find(d => !d.turns.length);
    if (empty) { choose(empty.id); return; }
    const id = crypto.randomUUID();
    dispatch({ type: 'ensure-record-dialog', recordId, dialogId: id, now: Date.now(), fresh: true });
    choose(id);
  };
  if (!available) return <div className="record-chat-placeholder"><Empty icon="warning" title="Диалог недоступен" description="Подключитесь к исходному серверу записи, чтобы открыть диалог." /></div>;
  if (!dialog) return <div className="record-chat-placeholder" role="status">Подготавливаем диалог…</div>;
  const toolbar = <div className="record-dialog-toolbar">
    <DialogHistoryMenu dialog={dialog} dialogs={dialogs} onChoose={choose} onNew={newDialog} newDisabled={!dialog.turns.length} record/>
    <IconButton icon="arrowRight" label="Открыть этот диалог в Ассистенте" onClick={() => openDialog(dialog.id)}/>
  </div>;
  return <div className="record-assistant-workspace">{toolbarHost ? createPortal(toolbar, toolbarHost) : toolbar}<Assistant key={dialog.id} id={dialog.id} embeddedRecordId={recordId} /></div>;
}

export default function Assistant({ id, embeddedRecordId }: { id?: string; embeddedRecordId?: string }) {
  const { state, dispatch, notify } = useStore(); const { route, go, back, returnTarget, openDialog, dialogView, saveDialogView, startDialog } = useNav();
  const embedded = Boolean(embeddedRecordId);
  const [query, setQuery] = useState('');
  const dialogSearchRef = useRef<HTMLInputElement>(null);
  const origin = !embedded && route.page==='assistant' ? route.listScope : undefined;
  const originSearch = route.page==='assistant' && route.listSearch;
  const originAvailable = Boolean(origin?.areaId && areaAvailable(state,origin.areaId));
  const dialogs = visibleDialogs(state).filter(d=>!origin || d.scope.areaId===origin.areaId && (origin.kind!=='folder'||d.scope.folderId===origin.folderId));
  const matchingDialogs = dialogs.filter(d => dialogMatchesSearch(state, d, query));
  const dialog = state.dialogs.find(d => d.id === id && d.server === state.server?.address && d.owner === OWNER);
  const menuDialogs = dialog && !dialogs.some(d => d.id === dialog.id) ? [dialog, ...dialogs] : dialogs;
  const startContextDialog = () => startDialog(origin ? {mode:'auto',areaId:origin.areaId!,folderId:origin.kind==='folder'?origin.folderId:undefined,recordIds:[]} : undefined);
  const sourceMismatch = Boolean(origin && dialog && (dialog.scope.areaId!==origin.areaId || origin.kind==='folder' && dialog.scope.folderId!==origin.folderId));
  const linkedRecord = embeddedRecordId ? state.records.find(r => r.id === embeddedRecordId) : undefined;
  const [sources, setSources] = useState(false); const [copyText, setCopyText] = useState<string | null>(null);
  const conversation = useRef<HTMLDivElement>(null); const composer = useRef<HTMLTextAreaElement>(null); const latestQuestion = useRef<HTMLDivElement>(null);
  const restoredSource = useRef(false); const turnCount = dialog?.turns.length ?? 0;
  const previousTurns = useRef({ id, count: turnCount });
  useLayoutEffect(() => {
    const field = composer.current; if (!field) return;
    const resize = () => {
      field.style.height = '0px';
      const required = field.scrollHeight;
      field.style.height = `${Math.min(150, Math.max(36, required))}px`;
      field.style.overflowY = required > 150 ? 'auto' : 'hidden';
    };
    resize();
    let width = field.clientWidth;
    const observer = new ResizeObserver(() => { if (field.clientWidth !== width) { width = field.clientWidth; resize(); } });
    observer.observe(field);
    return () => observer.disconnect();
  }, [id, dialog?.draft]);


  useLayoutEffect(() => {
    const viewport = conversation.current; if (!viewport || !id) return;
    const saved = dialogView(id); restoredSource.current = Boolean(saved?.anchorTurnId);
    if (saved) {
      viewport.scrollTop = saved.scrollTop;
      const anchor = saved.anchorTurnId ? Array.from(viewport.querySelectorAll<HTMLElement>('[data-turn-id]')).find(node => node.dataset.turnId === saved.anchorTurnId) : undefined;
      if (anchor && saved.anchorOffset !== undefined) viewport.scrollTop += anchor.getBoundingClientRect().top - viewport.getBoundingClientRect().top - saved.anchorOffset;
      const source = anchor && saved.sourceRecordId ? Array.from(anchor.querySelectorAll<HTMLButtonElement>('[data-source-record-id]')).find(node => node.dataset.sourceRecordId === saved.sourceRecordId) : undefined;
      if (source && !embedded) requestAnimationFrame(() => source.focus({ preventScroll: true }));
    } else if (turnCount && latestQuestion.current) {
      viewport.scrollTop += latestQuestion.current.getBoundingClientRect().top - viewport.getBoundingClientRect().top - 28;
    }
    previousTurns.current = { id, count: turnCount };
  }, [id]);
  useLayoutEffect(() => {
    const previous = previousTurns.current;
    if (id && previous.id === id && turnCount > previous.count && conversation.current && latestQuestion.current) conversation.current.scrollTop += latestQuestion.current.getBoundingClientRect().top - conversation.current.getBoundingClientRect().top - 28;
    previousTurns.current = { id, count: turnCount };
  }, [id, turnCount]);
  useEffect(() => { if (id) { setSources(false); if (!embedded && !restoredSource.current) requestAnimationFrame(() => composer.current?.focus({ preventScroll: true })); } }, [id, embedded]);

  const offline = state.settings.network === 'offline'; const pendingTurn = dialog?.turns.find(t => t.status === 'pending'); const invalid = dialog ? sourceError(state, dialog.scope) : null;
  const sourcesLocked = Boolean(dialog && (dialog.turns.length > 0 || dialog.recordContextId));
  const send = () => { if (!dialog || !dialog.draft.trim() || pendingTurn || offline) return; if (invalid) { if (!embedded) setSources(true); return; } dispatch({ type: 'send', id: dialog.id, turnId: crypto.randomUUID(), now: Date.now(), failOnce: new URLSearchParams(location.search).get('assistant-outcome') === 'error' && !dialog.turns.length }); };
  const stop = (turn: Turn) => { if (dialog) dispatch({ type: 'stop-turn', id: dialog.id, turnId: turn.id, now: Date.now() }); };
  const copy = async (text: string) => { try { await navigator.clipboard.writeText(text); notify('Ответ скопирован'); } catch { setCopyText(text); } };
  const openSource = (event: MouseEvent<HTMLElement>, turn: Turn, source: Snapshot) => {
    if (!dialog) return;
    const viewport = conversation.current; const anchor = event.currentTarget.closest<HTMLElement>('[data-turn-id]');
    if (viewport && anchor) saveDialogView(dialog.id, { scrollTop: viewport.scrollTop, anchorTurnId: turn.id, anchorOffset: anchor.getBoundingClientRect().top - viewport.getBoundingClientRect().top, sourceRecordId: source.recordId });
    const section = source.material === 'transcript' ? 'transcript' : 'summary';
    if (embedded && source.recordId === embeddedRecordId && route.page === 'meeting') go({ page: 'meeting', id: route.id, section });
    else go({ page: 'record', id: source.recordId, section });
  };
  const sourceDetails = (source: Snapshot) => {
    const record = state.records.find(r => r.id === source.recordId);
    const media = { icon: record?.source === 'file' ? 'upload' as const : record?.source === 'microphone' ? 'waveform' as const : record?.source === 'conference' ? 'conference' as const : 'file' as const, type: record ? SOURCE_NAMES[record.source] : 'Запись' };
    const currentRevision = source.material === 'summary' ? record?.summaryRevision : source.material === 'transcript' ? record?.transcriptRevision : undefined;
    if (!source.material) return { ...media, label: 'Запись · откроется резюме', aria: `Открыть запись «${source.title}», резюме по умолчанию; тип материала источника не указан` };
    const material = source.material === 'summary' ? 'Резюме целиком' : 'Транскрипция целиком';
    const changed = currentRevision !== undefined && currentRevision !== source.revision;
    return { ...media, label: `${material} · версия ответа ${source.revision}${changed ? ' · материал изменён' : ''}`, aria: `Открыть ${source.material === 'summary' ? 'резюме' : 'транскрипцию'} записи «${source.title}»${changed ? ', текущая версия отличается от источника ответа' : ''}` };
  };

  const unavailableMessage = embedded && invalid ? linkedRecord && !isOnServer(linkedRecord) ? 'Вопрос можно отправить после загрузки записи и появления текста.' : 'Для этой записи пока нет доступного текста.' : invalid && sourcesLocked ? `${invalid.replace(/\s*Измените (?:источники|выбор записей)\./, '')} Чтобы выбрать другие источники, начните новый диалог.` : invalid;
  return <div className={`assistant-layout${embedded ? ' assistant-layout--record' : ''}`} data-testid={embedded ? 'record-assistant' : 'assistant-page'}>
    {!embedded && !id && <section className="assistant-index" aria-label="История диалогов">
      <PanelHeader><PageHeader title="Ассистент" actions={<VButton size="500" variant="secondary" startIcon={<Icon name="plus" size={18}/>} onClick={startContextDialog}>Новый диалог</VButton>}/>
      <div className="assistant-index-search"><InputGroup><InputGroupAddon><Icon name="search" size={18}/></InputGroupAddon><InputGroupInput ref={dialogSearchRef} data-vini-input="true" showStartIcon={false} showEndIcon={false} aria-label="Поиск диалогов" placeholder="Найти диалог" value={query} onChange={e => setQuery(e.target.value)}/>{query && <InputGroupAddon align="inline-end"><InputGroupButton iconOnly aria-label="Очистить поиск диалогов" onClick={() => { setQuery(''); dialogSearchRef.current?.focus(); }}><Icon name="close" size={16}/></InputGroupButton></InputGroupAddon>}</InputGroup></div>
      </PanelHeader>
      {origin && <p className="assistant-origin-notice vini-text-desktop-caption-regular-400">Диалоги с источниками в этой области. Те же диалоги доступны в общей истории Ассистента.</p>}<div className="assistant-index-list">{matchingDialogs.map(d => {
        const last = d.turns.at(-1); const preview = last ? (last.status === 'ready' && turnAccessible(state,last) ? last.answer : last.question) : '';
        return <div className="assistant-index-row" key={d.id}><Item render={<button type="button"/>} className="assistant-index-open" onClick={() => openDialog(d.id)} aria-label={`Открыть диалог: ${dialogTitle(d)}`}><span className="assistant-index-icon"><Icon name="chat" size={24}/></span><ItemContent><ItemTitle>{dialogTitle(d)}</ItemTitle>{preview && <ItemDescription>{preview.replace(/[#*]/g,'')}</ItemDescription>}<small className="vini-text-desktop-caption-regular-400"><time dateTime={new Date(d.updatedAt).toISOString()}>{dayLabel(d.updatedAt)}</time> · {scopeLabel(state,d.scope)}{d.draft.trim() ? ' · Черновик' : ''}</small></ItemContent></Item><div className="assistant-index-actions"><DialogActions dialog={d} active={false}/></div></div>;
      })}{!dialogs.length && <Empty icon="chat" title="Пока нет диалогов" description="Начните разговор по вашим записям."/>}{Boolean(dialogs.length) && !matchingDialogs.length && <Empty icon="search" title="Диалоги не найдены" description="Измените поисковый запрос."/>}</div>
    </section>}
    <section hidden={!embedded && !id} className="conversation-panel" aria-label={embedded ? `Ассистент по записи: ${linkedRecord?.title ?? "текущая запись"}` : "Диалог с Ассистентом"}>
      {!embedded && id && <div className="assistant-conversation-header">
        <DialogHistoryMenu dialog={dialog} dialogs={menuDialogs} onChoose={openDialog} onNew={startContextDialog} onAll={() => go({ page: 'assistant', listScope: null })}/>
        <div className="assistant-conversation-actions">{dialog && <>{['record','meeting'].includes(returnTarget().page) && <IconButton icon="file" label="Вернуться к записи" onClick={back}/>}<DialogActions dialog={dialog} active /></>}</div>
      </div>}
      {sourceMismatch && <div className="assistant-origin-notice vini-text-desktop-caption-regular-400" role="status">Источники ответа отличаются от исходного пространства или папки. Область поиска указана в поле вопроса.</div>}

      {!dialog ? <div className="conversation-no-selection"><Empty icon="chat" title={id ? 'Диалог недоступен' : 'Выберите диалог'} description={id ? 'Проверьте подключение к исходному серверу или начните новый разговор.' : 'Продолжите разговор из истории или начните новый.'}><Button icon="plus" onClick={startContextDialog}>Новый диалог</Button></Empty></div> : <>
        <div className="conversation-scroll" ref={conversation} onScroll={e => saveDialogView(dialog.id, { scrollTop: e.currentTarget.scrollTop, anchorTurnId: undefined, anchorOffset: undefined, sourceRecordId: undefined })}><div className="conversation-inner">
          {!dialog.turns.length && <div className="assistant-welcome"><span className="assistant-symbol"><Icon name="chat" size={30} weight="light" /></span><h2>Что хотите узнать?</h2><p>{embedded ? 'Найдём ответ в материалах этой записи.' : 'Найдём ответ в ваших записях.'}</p><div className="suggested-questions">{[{ title: 'Кратко о главном', text: 'Кратко по выбранным записям', icon: 'file' as const }, { title: 'Принятые решения', text: 'Какие решения приняты?', icon: 'success' as const }, { title: 'Следующие шаги', text: 'Какие следующие шаги обсудили?', icon: 'arrowRight' as const }].map(prompt => <Item key={prompt.text} render={<button type="button" />} variant="outline" size="sm" className="suggested-question" onClick={() => { dispatch({ type: 'update-dialog', id: dialog.id, patch: { draft: prompt.text }, now: Date.now() }); composer.current?.focus(); }}><ItemContent><span className="suggested-question-content"><Icon className="suggested-question-icon" name={prompt.icon} size={18} /><ItemTitle>{prompt.title}</ItemTitle><Icon className="suggested-question-add" name="plus" size={15} /></span></ItemContent></Item>)}</div></div>}
          {dialog.turns.map((turn, i) => {
            const sourcesAccessible = turn.snapshots.every(source => state.records.some(r => r.id === source.recordId && canRead(state, r)));
            const retryDisabled = offline || Boolean(pendingTurn) || !sourcesAccessible;
            return <MessageGroup className="assistant-turn" key={turn.id} data-turn-id={turn.id}>
              <Message align="end" className="assistant-message" aria-label="Ваш вопрос" role="group" ref={i === dialog.turns.length - 1 ? latestQuestion : undefined}><MessageContent><Bubble variant="default" align="end"><BubbleContent className="assistant-question-text" data-testid="question-bubble">{turn.question}</BubbleContent></Bubble></MessageContent></Message>
              <Message align="start" className="assistant-message" role="group" aria-label="Ответ Ассистента"><MessageContent className="answer-content">
                {!turnAccessible(state, turn) ? <Alert role="status"><Icon alert name="warning" size={19}/><AlertDescription>Источник недоступен. Ответ скрыт, пока доступ не восстановлен.</AlertDescription>{!embedded && <AlertAction><Button small variant="ghost" onClick={() => setSources(true)}>Посмотреть источники</Button></AlertAction>}</Alert> : turn.status === 'pending' ? <div className="assistant-pending"><span className="assistant-pending-message" role="status"><Loader aria-hidden="true" size="20"/>Готовим ответ…</span><Button small variant="ghost" icon="stop" onClick={() => stop(turn)}>Остановить</Button></div> : turn.status === 'stopped' || turn.status === 'error' ? <Alert variant={turn.status === 'error' ? 'destructive' : 'default'} role={turn.status === 'error' ? 'alert' : 'status'}><AlertDescription><p>{turn.status === 'stopped' ? 'Ответ остановлен. Вопрос и источники сохранены.' : sourcesLocked ? turn.error?.replace('Измените выбор записей.', 'Чтобы выбрать другие источники, начните новый диалог.') : turn.error}</p>{retryDisabled && <p>{offline ? 'Подключитесь к сети, чтобы повторить запрос.' : !sourcesAccessible ? 'Один из исходных материалов недоступен.' : 'Дождитесь текущего ответа.'}</p>}</AlertDescription><AlertAction><Button small variant="ghost" icon="rewind" disabled={retryDisabled} onClick={() => dispatch({ type: 'retry-turn', id: dialog.id, turnId: turn.id, now: Date.now() })}>Повторить запрос</Button></AlertAction></Alert> : <>
                  <div className="answer-notices">{[...new Set(usedSources(turn).map(s => s.notice).filter(Boolean))].map(n => <span key={n}>{n}</span>)}</div><Bubble variant="muted" align="start"><BubbleContent><Markdown>{turn.answer}</Markdown></BubbleContent></Bubble>
                  {usedSources(turn).length > 0 && <div className="answer-sources">
                    <span className="answer-sources-label">Источники ответа</span>
                    <ItemGroup className="answer-source-list" role="list" aria-label="Источники ответа">
                      {usedSources(turn).map(source => {
                        const details = sourceDetails(source);
                        return <div role="listitem" key={source.recordId}>
                          <Item render={<button type="button" />} variant="outline" size="sm" className="answer-source-item" aria-label={details.aria} data-source-record-id={source.recordId} onClick={event => openSource(event, turn, source)}>
                            <TooltipProvider><Tooltip><TooltipTrigger render={<ItemMedia role="img" aria-label={details.type} tabIndex={-1}><Icon name={details.icon} size={20} /></ItemMedia>} /><TooltipContent>{details.type}</TooltipContent></Tooltip></TooltipProvider>
                            <ItemContent><TooltipProvider><Tooltip><TooltipTrigger render={<ItemTitle tabIndex={-1}>{source.title}</ItemTitle>} /><TooltipContent>{source.title}</TooltipContent></Tooltip></TooltipProvider><ItemDescription>{details.label}</ItemDescription></ItemContent>
                            <ItemActions><Icon name="right" size={16} /></ItemActions>
                          </Item>
                        </div>;
                      })}
                    </ItemGroup>
                  </div>}
                  <MessageFooter><IconButton icon="copy" label="Копировать ответ" onClick={() => { void copy(turn.answer); }} /></MessageFooter>
                </>}
              </MessageContent></Message>
            </MessageGroup>;
          })}
        </div></div>
        <div className="composer-area">{!embedded && <div className="composer-context">
          {origin && <VButton size="400" variant="text" startIcon={<Icon name="arrowLeft" size={16}/>} disabled={!originAvailable} onClick={()=>go({page:originSearch?'search':'library',scope:origin})}>К исходному списку</VButton>}
          <div className="composer-source-row"><span className="composer-context-label">Контекст:</span><VButton className="composer-sources" size="400" variant="text" type="button" aria-label={`Источники ответа: ${scopeLabel(state, dialog.scope)}`} onClick={() => setSources(true)} startIcon={<Icon name="filters" size={16} />} endIcon={<Icon name="down" size={13} />}>{scopeLabel(state, dialog.scope)}</VButton><TooltipProvider><Tooltip><TooltipTrigger render={<span className="composer-materials">{scopeMaterials(state, dialog.scope)}</span>} /><TooltipContent>Доступные материалы для следующего вопроса</TooltipContent></Tooltip></TooltipProvider></div>
          </div>}<form className="assistant-composer" onSubmit={e => { e.preventDefault(); send(); }}><InputGroup className="vini-composer-input"><InputGroupTextarea ref={composer} aria-label="Вопрос Ассистенту" placeholder="Спросите Ассистента…" rows={1} maxLength={2000} value={dialog.draft} onChange={e => dispatch({ type: 'update-dialog', id: dialog.id, patch: { draft: e.target.value }, now: Date.now() })} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }} /><InputGroupAddon align="inline-end">{pendingTurn ? <InputGroupButton iconOnly type="button" aria-label="Остановить ответ" onClick={() => stop(pendingTurn)}><Icon name="stop" size={18} weight="fill" /></InputGroupButton> : <InputGroupButton iconOnly variant="secondary" type="submit" aria-label="Отправить вопрос" disabled={!dialog.draft.trim() || offline || Boolean(invalid)}><Icon name="send" size={20} /></InputGroupButton>}</InputGroupAddon></InputGroup>
        </form>{(offline || unavailableMessage) && <div className="composer-hint vini-text-desktop-caption-regular-400"><span className="text-warning">{offline ? 'Нет сети. Введённый вопрос сохранён.' : unavailableMessage}</span></div>}</div>
      </>}
    </section>
    {!embedded && dialog && <SourcePicker dialog={dialog} open={sources} onClose={() => setSources(false)} />}
    <Modal open={copyText !== null} onClose={() => setCopyText(null)} title="Скопируйте ответ" description="Буфер обмена недоступен. Выделите текст и скопируйте его вручную."><Textarea aria-label="Ответ для копирования" readOnly rows={10} value={copyText ?? ''} onFocus={e => e.target.select()} /><div className="modal-actions"><Button onClick={() => setCopyText(null)}>Готово</Button></div></Modal>
  </div>;
}
