import { canManageInvitationDrafts } from './model.ts';
import {WorkspaceRenameMenuItem,WorkspaceRenameDialog} from './WorkspaceRename.tsx';
import {PageHeader, PanelHeader} from './PageHeader.tsx';
import { Badge as VBadge, Button as VButton, ToggleGroup, ToggleGroupItem, InputGroup, InputGroupInput, InputGroupAddon, InputGroupButton, Kbd, KbdGroup, Item, Loader, Combobox, ComboboxInput, ComboboxContent, ComboboxList, ComboboxItem, ComboboxEmpty, DropdownMenuRadioGroup, DropdownMenuRadioItem, TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@vini-ds/ui';
import { Input } from '@vini-ds/ui';
import { lazy, Suspense, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactElement } from 'react';
import { areaAvailable, areaName, areaRecordCount, countFilters, dateLabel, DEFAULT_FILTERS, filterDrafts, filterMeetings, filterRecords, formatDuration, formatTime, isCreatedWorkspace, meetingDuration, meetingLabel, pluralConnections, pluralDrafts, pluralRecords, SOURCE_NAMES, statusPresentation, workspaceList } from './model.ts';
import { backLabel, useNav } from './navigation.tsx';
import { usePlayback } from './playback.tsx';
import { RecordMenu } from './record-actions.tsx';
import { RecordingAction } from './RecordingAction.tsx';
import { useStore } from './store.tsx';
import { AreaPicker, Avatar, Badge, Button, Confirm, Empty, Icon, IconButton, Menu, MenuItem, MenuLabel, MenuSeparator, Modal, Select } from './ui.tsx';
import type { Draft, Filters, ListScope, Meeting, Recording } from './types.ts';
import './filter-dialog.css';
import './quick-filter.css';

function LibraryTooltip({ label, trigger }: { label: string; trigger: ReactElement }) {
  return <TooltipProvider><Tooltip><TooltipTrigger render={trigger}/><TooltipContent>{label}</TooltipContent></Tooltip></TooltipProvider>;
}

const ImportDialog = lazy(() => import('./creation.tsx').then(m => ({ default: m.ImportDialog })));
const MeetingDialog = lazy(() => import('./creation.tsx').then(m => ({ default: m.MeetingDialog })));

export function AddMenu({ areaId = 'personal', folderId, prominent = false }: { areaId?: string; folderId?: string; prominent?: boolean }) {
  const { startRecording } = useNav();
  const [dialog, setDialog] = useState<'import' | 'meeting' | null>(null);
  return <><Menu label="Добавить запись" trigger={<VButton size="500" variant={prominent ? "primary" : "secondary"} startIcon={<Icon name="plus"/>}>Добавить</VButton>}>
    <MenuItem icon="microphone" onSelect={() => startRecording(areaId, folderId)}>Записать на диктофон</MenuItem><MenuItem icon="conference" onSelect={() => setDialog('meeting')}>Записать встречу</MenuItem><MenuItem icon="upload" onSelect={() => setDialog('import')}>Загрузить файл</MenuItem>
  </Menu>{dialog && <Suspense fallback={null}>{dialog === 'import' ? <ImportDialog open onClose={() => setDialog(null)} initialArea={areaId} /> : <MeetingDialog open onClose={() => setDialog(null)} initialArea={areaId} />}</Suspense>}</>;
}

function FilterDialog({ open, onClose, filters, onApply, scope }: { open: boolean; onClose: () => void; filters: Filters; onApply: (f: Filters) => void; scope: ListScope }) {
  const { state } = useStore();
  const [pending, setPending] = useState(filters);
  const [showAllAreas, setShowAllAreas] = useState(false);
  const areaChoicesId = useId();
  const area = scope.areaId ?? pending.areaId;
  const choices = (label: string, key: 'areaId' | 'source' | 'status' | 'folderId', options: { value: string; label: string }[]) => {
    const canExpand = key === 'areaId' && options.length > 6;
    const selectedIndex = options.findIndex(option => option.value === pending[key]);
    // Keep the current selection visible, even if it comes after the initial six.
    const visibleOptions = canExpand && !showAllAreas
      ? options.filter((option, index) => index < (selectedIndex >= 6 ? 5 : 6) || option.value === pending[key])
      : options;
    return <fieldset className="filter-section"><legend>{label}</legend><ToggleGroup id={key === 'areaId' ? areaChoicesId : undefined} className="vini-filter-options" aria-label={label} multiple={false} variant="outline" size="default" spacing={1} value={[pending[key]]} onValueChange={values=>{if(values.length)setPending(p=>({...p,[key]:values[0],...(key==='areaId'?{folderId:'all'}:{})}));}}>{visibleOptions.map(o=><ToggleGroupItem key={o.value} value={o.value}>{o.label}</ToggleGroupItem>)}</ToggleGroup>{canExpand && <div className="filter-expand"><VButton variant="text" size="400" aria-expanded={showAllAreas} aria-controls={areaChoicesId} endIcon={<Icon name={showAllAreas ? 'up' : 'down'} size={16}/>} onClick={() => setShowAllAreas(value => !value)}>{showAllAreas ? 'Свернуть' : `Показать ещё ${options.length - visibleOptions.length}`}</VButton></div>}</fieldset>;
  };
  return <Modal open={open} onClose={onClose} title="Фильтры" description={scope.kind === 'all' ? 'Все записи' : areaName(scope.areaId, state)} footer={<div className="modal-actions modal-actions--spread"><Button variant="ghost" onClick={() => setPending({ ...DEFAULT_FILTERS, query: filters.query, sort: filters.sort })}>Сбросить</Button><div><Button variant="ghost" onClick={onClose}>Отмена</Button><Button variant="secondary" onClick={() => { onApply(pending); onClose(); }}>Применить</Button></div></div>}>
    {scope.kind === 'all' && choices('Пространство', 'areaId', [{ value: 'all', label: 'Все пространства' }, { value: 'personal', label: 'Личное' }, ...workspaceList(state).map(w => ({ value: w.id, label: w.name }))])}
    {scope.kind === 'all' && pending.folderId !== 'all' && <p className="muted-copy">Ранее выбранный фильтр папки: {pending.folderId === 'root' ? area === 'personal' ? 'Без папки' : 'В корне пространства' : state.folders.find(f => f.id === pending.folderId && f.server === state.server?.address)?.name ?? 'Папка недоступна'}. Его можно снять кнопкой «Сбросить».</p>}
    {choices('Источник', 'source', [{ value: 'all', label: 'Все источники' }, { value: 'microphone', label: 'Диктофон' }, { value: 'file', label: 'Файлы' }, { value: 'conference', label: 'ВКС' }])}
    {choices('Состояние', 'status', [{ value: 'all', label: 'Все состояния' }, { value: 'ready', label: 'Обработаны' }, { value: 'processing', label: 'В обработке' }, { value: 'attention', label: 'Требуют внимания' }])}
    {scope.kind === 'area' && area !== 'all' && choices('Папка', 'folderId', [{ value: 'all', label: 'Все папки' }, { value: 'root', label: area === 'personal' ? 'Без папки' : 'В корне пространства' }, ...state.folders.filter(f => f.areaId === area && f.server === state.server?.address).map(f => ({ value: f.id, label: f.name }))])}
  </Modal>;
}

export default function Library({ scope, searchMode = false }: { scope: ListScope; searchMode?: boolean }) {
  const [renameWorkspaceId,setRenameWorkspaceId]=useState<string|null>(null);
  const { state, dispatch, notify } = useStore();
  const { go, back, returnTarget, parentFolder, startDialog, listState, updateList, consumeSearchFocus } = useNav();
  const filters = listState(scope, searchMode);
  const [filterOpen, setFilterOpen] = useState(false);
  const [deleteDraft, setDeleteDraft] = useState<Draft | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null); const searchRef = useRef<HTMLInputElement>(null); const filterButtonRef = useRef<HTMLButtonElement>(null);
  const title = scope.kind === 'all' ? 'Все записи' : scope.kind === 'folder' ? scope.folderId === 'root' ? scope.areaId === 'personal' || scope.areaId === 'legacy' ? 'Без папки' : 'В корне пространства' : state.folders.find(f => f.id === scope.folderId)?.name ?? 'Папка недоступна' : areaName(scope.areaId, state);
  const workspace = workspaceList(state).find(w => w.id === scope.areaId);
  const creationArea = scope.areaId === 'legacy' ? 'personal' : scope.areaId ?? 'personal';
  const area = scope.areaId ?? (filters.areaId !== 'all' ? filters.areaId : undefined);
  const records = filterRecords(state, scope, filters);
  const drafts = filterDrafts(state, scope, filters);
  const meetings = filterMeetings(state, scope, filters);
  const rows = [
    ...records.map(record => ({ kind: 'record' as const, item: record, date: record.createdAt })),
    ...drafts.map(draft => ({ kind: 'draft' as const, item: draft, date: draft.createdAt })),
    ...meetings.map(meeting => ({ kind: 'meeting' as const, item: meeting, date: new Date(meeting.startedAt).toISOString() })),
  ].sort((a, b) => filters.sort === 'title' ? a.item.title.localeCompare(b.item.title, 'ru') : (filters.sort === 'oldest' ? 1 : -1) * (Date.parse(a.date) - Date.parse(b.date)));
  const resultsLabel = [pluralRecords(records.length), ...(drafts.length ? [pluralDrafts(drafts.length)] : []), ...(meetings.length ? [pluralConnections(meetings.length)] : [])].join(' · ');
  const total = filterRecords(state, scope, DEFAULT_FILTERS).length + filterDrafts(state, scope, DEFAULT_FILTERS).length + filterMeetings(state, scope, DEFAULT_FILTERS).length;
  const titleCount = scope.kind === 'area' && scope.areaId ? areaRecordCount(state, scope.areaId) : total;
  const controlsDisabled = total === 0;
  const hasFilters = countFilters(filters) > 0 || Boolean(filters.query);
  const update = (patch: Partial<Filters>) => { updateList(scope, { ...patch, scroll: 0 }, searchMode); if (scrollRef.current) scrollRef.current.scrollTop = 0; };
  const resetFilters = () => { update({ ...DEFAULT_FILTERS, query: filters.query, sort: filters.sort }); filterButtonRef.current?.focus(); };
  const clearSearch = () => { update({ query: '' }); searchRef.current?.focus(); };
  useLayoutEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = filters.scroll; if (searchMode && consumeSearchFocus()) searchRef.current?.focus({ preventScroll: true }); }, [scope.kind, scope.areaId, scope.folderId, searchMode]);
  useLayoutEffect(() => { if (filters.folderId !== 'all' && filters.folderId !== 'root' && !state.folders.some(f => f.id === filters.folderId && f.server === state.server?.address)) updateList(scope, { folderId: 'all' }, searchMode); }, [state.folders, filters.folderId]);
  const areaOptions = [{ value: 'all', label: 'Все пространства' }, { value: 'personal', label: 'Личное' }, ...workspaceList(state).map(w => ({ value: w.id, label: w.name }))];
  const filteredFolder = area && scope.kind !== 'folder' && filters.folderId !== 'all' ? filters.folderId : undefined;
  const filteredFolderName = filteredFolder === 'root' ? area === 'personal' ? 'Без папки' : 'В корне пространства' : state.folders.find(f => f.id === filteredFolder && f.server === state.server?.address)?.name;
  const searchScope = scope.kind === 'folder' ? `папка «${title}» · ${areaName(scope.areaId, state)}` : scope.kind === 'area' ? areaName(scope.areaId, state) : filters.areaId !== 'all' ? `Все записи · ${areaName(filters.areaId, state)}` : 'Все записи';
  const searchScopeLabel = `${searchScope}${filteredFolderName ? ` · папка «${filteredFolderName}»` : ''}`;
  const selectedFolder = scope.kind === 'folder' ? scope.folderId : filteredFolder;
  const assistantDescription = `Новый диалог по папке «${title}»`;
  const recordingFolder = scope.kind === 'all' || scope.areaId === 'legacy' ? undefined : selectedFolder;
  const searchInput = <InputGroupInput disabled={controlsDisabled} data-vini-input="true" showStartIcon={false} showEndIcon={false} ref={searchRef} id="library-search" type="search" aria-label={`Поиск: ${searchScopeLabel}`} aria-describedby="library-search-scope" placeholder="Название, дата" value={filters.query} onChange={e=>update({query:e.target.value})}/>;
  // Keep the input group's layout intact; its disabled input cannot receive focus or hover.
  const searchGroup = <InputGroup className="library-search-group" role={controlsDisabled ? 'group' : undefined} tabIndex={controlsDisabled ? 0 : undefined} aria-label={controlsDisabled ? `Поиск недоступен: ${searchScopeLabel}` : undefined} aria-describedby={controlsDisabled ? 'library-search-scope' : undefined}><InputGroupAddon align="inline-start"><Icon name="search" size={18}/></InputGroupAddon>{controlsDisabled ? searchInput : <LibraryTooltip label="Поиск по названию или дате" trigger={searchInput} />}<InputGroupAddon align="inline-end">{filters.query ? <InputGroupButton iconOnly aria-label="Очистить поиск" onClick={()=>{update({query:''});searchRef.current?.focus();}}><Icon name="close"/></InputGroupButton> : <KbdGroup aria-label={/Mac|iPhone|iPad/.test(navigator.platform) ? 'Command + K' : 'Control + K'}><Kbd aria-hidden="true">{/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl'}</Kbd><Kbd aria-hidden="true">K</Kbd></KbdGroup>}</InputGroupAddon></InputGroup>;
  const moveListFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!(event.target instanceof HTMLButtonElement) || !event.target.classList.contains('record-row-open')) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const key = event.key.toLowerCase();
    if (!['arrowdown', 'arrowup', 'home', 'end', 'j', 'k'].includes(key)) return;
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('.record-row-open:not(:disabled)'));
    const index = items.indexOf(event.target); if (index < 0 || !items.length) return;
    const next = key === 'home' ? 0 : key === 'end' ? items.length - 1 : key === 'arrowdown' || key === 'j' ? Math.min(index + 1, items.length - 1) : Math.max(index - 1, 0);
    event.preventDefault(); items[next].focus();
  };
  if (scope.kind !== 'all' && scope.areaId !== 'legacy' && (!scope.areaId || !areaAvailable(state, scope.areaId))) return <div className="page-scroll"><div className="page-inner"><Empty icon="warning" title="Пространство недоступно" description="Проверьте подключение к исходному серверу или вернитесь к записям."><Button onClick={() => go({ page: 'library', scope: { kind: 'all' } })}>К записям</Button></Empty></div></div>;
  return <div className="library-panel"><WorkspaceRenameDialog workspaceId={renameWorkspaceId} onClose={()=>setRenameWorkspaceId(null)}/>
    <PanelHeader className="library-panel-header">
      <PageHeader title={searchMode ? 'Поиск' : title} count={searchMode ? rows.length : titleCount} description={scope.kind==='area'&&!searchMode?workspace?.description:undefined} descriptionBelowActions truncateTitle={scope.kind==='area'&&!searchMode} actions={<>
          {!searchMode && <RecordingAction scope={scope} />}
          {!searchMode && scope.kind === 'area' && <LibraryTooltip label={`Контекст: ${title}`} trigger={<Button icon="chat" variant="secondary" onClick={()=>startDialog({mode:'auto',areaId:scope.areaId??'personal',recordIds:[]})}>Ассистент</Button>}/>}
          {!searchMode && scope.kind === 'folder' && scope.folderId && scope.folderId !== 'root' && <><LibraryTooltip label={assistantDescription} trigger={<Button icon="chat" variant="secondary" aria-describedby="assistant-context-description" onClick={() => startDialog({ mode: 'auto', areaId: scope.areaId ?? 'personal', folderId: scope.folderId, recordIds: [] })}>Ассистент<Icon name="arrowRight" size={15} /></Button>}/><span id="assistant-context-description" className="sr-only">{assistantDescription}</span></>}
          {!searchMode && <AddMenu areaId={creationArea} folderId={recordingFolder} />}
          {!searchMode && scope.kind !== 'all' && <Menu label="Действия пространства" trigger={<IconButton icon="more" label="Ещё" />}><WorkspaceRenameMenuItem workspaceId={scope.areaId??'personal'} onRename={setRenameWorkspaceId}/>{workspace && (workspace.members.length > 0 || canManageInvitationDrafts(state,workspace.id)) && <MenuItem icon="users" onSelect={() => go({ page: 'members', areaId: workspace.id })}>Участники</MenuItem>}<MenuItem icon="folder" onSelect={() => go({ page: 'folders', areaId: scope.areaId === 'legacy' ? null : scope.areaId ?? 'personal' })}>Управление папками</MenuItem></Menu>}
        </>}/>
      <div className="library-controls"><Menu label="Сортировка" trigger={<IconButton disabled={controlsDisabled} icon="sort" label={`Сортировка: ${filters.sort === 'newest' ? 'Сначала новые' : filters.sort === 'oldest' ? 'Сначала старые' : 'По названию'}`} />}><MenuLabel>Сортировка</MenuLabel><DropdownMenuRadioGroup aria-label="Сортировка" value={filters.sort} onValueChange={(value: Filters['sort']) => update({ sort: value })}>{[{ value: 'newest', label: 'Сначала новые' }, { value: 'oldest', label: 'Сначала старые' }, { value: 'title', label: 'По названию' }].map(o => <DropdownMenuRadioItem key={o.value} value={o.value} closeOnClick>{o.label}</DropdownMenuRadioItem>)}</DropdownMenuRadioGroup></Menu><span className="library-filter-control"><LibraryTooltip label="Все фильтры" trigger={controlsDisabled ? <span role="group" tabIndex={0} aria-disabled="true" aria-label="Фильтры"><VButton size="500" variant="secondary" className="library-filter-button" disabled aria-label="Фильтры" startIcon={<Icon name="filters" size={19}/>} /></span> : <VButton ref={filterButtonRef} size="500" variant="secondary" color={countFilters(filters) ? "accent" : "main"} className="library-filter-button" aria-label={countFilters(filters) ? `Фильтры: ${countFilters(filters)} активно` : "Фильтры"} startIcon={<Icon name="filters" size={19}/>} onClick={() => setFilterOpen(true)} />}/>{Boolean(countFilters(filters)) && <VBadge className="filter-count" variant="default" aria-hidden="true">{countFilters(filters)}</VBadge>}</span>{controlsDisabled ? <LibraryTooltip label="Поиск по названию или дате" trigger={searchGroup}/> : searchGroup}
        <div className={`quick-filters${scope.kind === 'all' ? ' quick-filters--all' : ''}`}>{scope.kind === 'all' && <div className="quick-filter-area"><Combobox items={areaOptions} value={areaOptions.find(option => option.value === filters.areaId) ?? { value: filters.areaId, label: 'Пространство недоступно' }} disabled={controlsDisabled} itemToStringLabel={option => option.label} itemToStringValue={option => option.value} isItemEqualToValue={(a, b) => a.value === b.value} onValueChange={option => { if (option) update({ areaId: option.value, folderId: 'all' }); }}><ComboboxInput data-vini-input="true" aria-label="Пространство" triggerLabel="Показать пространства" placeholder="Найти пространство" /><ComboboxContent><ComboboxEmpty>Пространства не найдены</ComboboxEmpty><ComboboxList>{(option: { value: string; label: string }) => <ComboboxItem key={option.value} value={option}>{option.label}</ComboboxItem>}</ComboboxList></ComboboxContent></Combobox></div>}
          <Select disabled={controlsDisabled} label="Источник" value={filters.source} options={[{ value: 'all', label: 'Все источники' }, { value: 'microphone', label: 'Диктофон' }, { value: 'file', label: 'Файлы' }, { value: 'conference', label: 'ВКС' }]} onChange={source => update({ source: source as Filters['source'] })} className={filters.source !== 'all' ? 'is-active' : ''} />
          <Select disabled={controlsDisabled} label="Состояние" value={filters.status} options={[{ value: 'all', label: 'Все состояния' }, { value: 'ready', label: 'Обработаны' }, { value: 'processing', label: 'В обработке' }, { value: 'attention', label: 'Требуют внимания' }]} onChange={status => update({ status: status as Filters['status'] })} className={filters.status !== 'all' ? 'is-active' : ''} />
        </div><div className="control-divider" />
        
      </div>
      <span className="sr-only" id="library-search-scope">Поиск в: {searchScopeLabel}{countFilters(filters) > 0 ? ' · с выбранными фильтрами' : ''}</span>
      <span className="sr-only" role="status">{hasFilters ? resultsLabel : ''}</span>
    </PanelHeader>
    <div className="page-scroll library-page" ref={scrollRef} onScroll={e => updateList(scope, { scroll: e.currentTarget.scrollTop }, searchMode)} data-testid="library-page">
      {rows.length ? <div className={`record-table${scope.kind !== 'all' ? ' record-table--scoped' : ''}`} role="region" aria-label="Список записей" aria-describedby="list-keyboard-hint" onKeyDown={moveListFocus}><span id="list-keyboard-hint" className="sr-only">Стрелки или J и K перемещают фокус по списку, Enter открывает выбранную запись.</span><div className="table-heading"><span>Название</span>{scope.kind === 'all' && <span>Пространство</span>}<span>Дата и время</span><span>Длительность</span><span /></div>
        {rows.map(row => row.kind === 'record' ? <RecordRow key={row.item.id} record={row.item} scope={scope} searchMode={searchMode} /> : row.kind === 'draft' ? <DraftRow key={row.item.id} draft={row.item} scoped={scope.kind !== 'all'} onDelete={() => setDeleteDraft(row.item)} /> : <MeetingRow key={row.item.id} meeting={row.item} scoped={scope.kind !== 'all'} />)}
        <div className="table-footer"><span>{resultsLabel}</span><span><Icon name="shield" size={14} />В корпоративном контуре</span></div>
      </div> : <Empty title={hasFilters ? 'Ничего не найдено' : 'Пока нет записей'} description={hasFilters ? 'Попробуйте изменить запрос или снять фильтры. Область поиска не меняется автоматически.' : 'Запишите встречу, подключите агента или загрузите файл. Записи и материалы появятся здесь.'}>{hasFilters && <>{countFilters(filters) > 0 && <Button onClick={resetFilters}>Сбросить фильтры</Button>}{filters.query && <Button variant="ghost" onClick={clearSearch}>Очистить поиск</Button>}{scope.kind !== 'all' && <Button variant="ghost" onClick={() => { updateList({ kind: 'all' }, { ...filters, areaId: 'all', folderId: 'all' }, searchMode); go({ page: searchMode ? 'search' : 'library', scope: { kind: 'all' } }); }}>Искать во всех записях</Button>}</>}</Empty>}
    </div>
    {filterOpen && <FilterDialog open={filterOpen} onClose={() => setFilterOpen(false)} filters={filters} onApply={f => update(f)} scope={scope} />}
    <Confirm open={Boolean(deleteDraft)} onClose={() => setDeleteDraft(null)} title="Удалить черновик?" description="Запись не будет отправлена. Восстановить её после удаления нельзя. Остальные черновики останутся." target={deleteDraft?.title} danger confirm="Удалить черновик" onConfirm={() => { if (deleteDraft) dispatch({ type: 'delete-draft', id: deleteDraft.id }); setDeleteDraft(null); notify('Черновик удалён'); }} />
  </div>;
}

function AreaCell({ id }: { id: string | null }) { const { state } = useStore(); return <LibraryTooltip label={areaName(id, state)} trigger={<span className="row-area">{areaName(id, state)}</span>}/>; }
function CompactRowContent({ title, status, tone = 'neutral', areaId, scoped, date, duration }: { title: string; status?: string; tone?: string; areaId: string | null; scoped: boolean; date: string; duration: string }) {
  const shortStatus = status?.replace('Черновик · продолжить', 'Черновик').replace('Распознаём речь', 'Распознаём').replace('Не удалось отправить запись', 'Ошибка отправки').replace('Не удалось создать резюме', 'Ошибка резюме').replace('Не удалось распознать речь', 'Ошибка распознавания').replace('Не удалось определить спикеров', 'Ошибка спикеров');
  const shortDate = date.replace(/(января|февраля|марта|апреля|августа|сентября|октября|ноября|декабря)/g, month => month.slice(0,3));
  return <span className="compact-row-body compact-row-content"><span className="compact-row-top"><LibraryTooltip label={title} trigger={<strong>{title}</strong>}/></span><span className="compact-row-details">{(status || !scoped) && <span className="compact-row-meta vini-text-body-regular-500">{status && <LibraryTooltip label={status} trigger={<span className={`row-kind text-${tone}`}><span className="row-full-label">{status}</span><span className="row-short-label">{shortStatus}</span></span>}/>}{status && !scoped && <i aria-hidden="true"/>}{!scoped && <AreaCell id={areaId} />}</span>}<span className="compact-row-time vini-text-body-regular-500"><LibraryTooltip label={date} trigger={<span className="row-date"><span className="row-full-label">{date}</span><span className="row-short-label">{shortDate}</span></span>}/><i aria-hidden="true"/><span className="row-duration">{duration}</span></span></span></span>;
}
function RecordRow({ record, scope, searchMode }: { record: Recording; scope: ListScope; searchMode: boolean }) {
  const { state } = useStore(); const { route, openRecord, closeRecord } = useNav();
  const scoped = scope.kind !== 'all';
  const selected = route.page === 'record' && route.id === record.id || route.page === 'meeting' && state.meetings.some(meeting => meeting.id === route.id && meeting.resultId === record.id);
  const status = statusPresentation(record, state.settings);
  const ordinary = record.status === 'ready' && !record.operation && !record.noSpeech;
  const statusText = `${status.label}${status.percent !== undefined ? ` · ${status.percent}%` : ''}`;
  return <Item className={`record-row${selected ? ' is-selected' : ''}`} data-testid={`record-row-${record.id}`}><button className="record-row-open" aria-current={selected ? 'true' : undefined} onClick={() => openRecord(record.id, scope, searchMode)} aria-label={`${record.title}, ${SOURCE_NAMES[record.source]}, ${!scoped ? `${areaName(record.areaId, state)}, ` : ''}${dateLabel(record.createdAt)}, ${formatDuration(record.duration)}, ${statusText}`}>
    <RecordSource record={record}/><CompactRowContent title={record.title} status={ordinary ? undefined : statusText} tone={status.tone} areaId={record.areaId} scoped={scoped} date={dateLabel(record.createdAt, false)} duration={formatDuration(record.duration)}/>
  </button><span className="row-actions"><RecordMenu record={record} onDelete={() => closeRecord(record.id)} /></span></Item>;
}
export function RecordSource({record, size = 19}:{record:Recording; size?: 19 | 24}) {
 const {state}=useStore();const status=statusPresentation(record,state.settings);const ordinary=record.status==='ready'&&!record.operation&&!record.noSpeech;
 return <LibraryTooltip label={SOURCE_NAMES[record.source]} trigger={<span className={`row-source${!ordinary?` row-source--${status.tone}`:''}`} aria-hidden="true">{status.tone==='accent'?<Loader aria-hidden="true" size={size === 24 ? '24' : '20'}/>:<span className="material-symbols-rounded" style={{fontSize:size,lineHeight:1}}>{record.source==='file'?'upload_file':record.source==='microphone'?'graphic_eq':'videocam'}</span>}</span>}/>;
}
function DraftRow({ draft, scoped, onDelete }: { draft: Draft; scoped: boolean; onDelete: () => void }) {
  const { go } = useNav(); const { state } = useStore(); const { pause } = usePlayback();
  const status = draft.paused ? 'Черновик · продолжить' : 'Идёт запись';
  return <Item className="record-row record-row--draft" data-testid={`draft-row-${draft.id}`}><button className="record-row-open" onClick={() => { pause(); go({ page: 'recorder', id: draft.id }); }} aria-label={`${draft.title}, Диктофон, ${status}, ${dateLabel(draft.createdAt)}, ${formatTime(draft.seconds)}. Видно только вам. Место отправки: ${areaName(draft.areaId, state)}`}><LibraryTooltip label="Диктофон" trigger={<span className="row-source" aria-hidden="true"><span className="material-symbols-rounded" style={{fontSize:19,lineHeight:1}}>graphic_eq</span></span>}/><CompactRowContent title={draft.title} status={status} tone="warning" areaId="personal" scoped={scoped} date={dateLabel(draft.createdAt, false)} duration={formatTime(draft.seconds)}/></button><span className="row-actions"><IconButton icon="delete" label={`Удалить черновик: ${draft.title}`} onClick={onDelete} /></span></Item>;
}
function MeetingRow({ meeting, scoped }: { meeting: Meeting; scoped: boolean }) {
  const { state } = useStore(); const { go } = useNav(); const offline = state.settings.network === 'offline';
  const status = meetingLabel(meeting, offline); const date = new Date(meeting.startedAt).toISOString();
  const duration = meeting.stage === 'recording' ? offline ? '—:—' : formatTime(meetingDuration(meeting, Date.now())) : '—';
  return <Item className="record-row" data-testid={`meeting-row-${meeting.id}`}><button className="record-row-open" onClick={() => go({ page: 'meeting', id: meeting.id })} aria-label={`${meeting.title}, ВКС, ${status}, ${!scoped ? `${areaName(meeting.areaId, state)}, ` : ''}${dateLabel(date)}, ${duration}`}><LibraryTooltip label="ВКС" trigger={<span className={`row-source row-source--${meeting.stage === 'error' ? 'danger' : 'accent'}`} aria-hidden="true"><span className="material-symbols-rounded" style={{fontSize:19,lineHeight:1}}>videocam</span></span>}/><CompactRowContent title={meeting.title} status={status} tone={meeting.stage === 'error' || meeting.stage === 'recording' && !meeting.pausedAt ? 'danger' : 'accent'} areaId={meeting.areaId} scoped={scoped} date={dateLabel(date, false)} duration={duration}/></button></Item>;
}
