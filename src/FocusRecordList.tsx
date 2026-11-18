import { useEffect, useState } from 'react';
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@vini-ds/ui';
import { areaAvailable, areaName, dateLabel, DEFAULT_FILTERS, filterRecords, formatDuration, pluralRecords, SOURCE_NAMES } from './model.ts';
import { RecordSource } from './Library.tsx';
import { useNav, type HomeFocusList } from './navigation.tsx';
import { useStore } from './store.tsx';
import { IconButton } from './ui.tsx';
import type { AppState, ListScope, Route } from './types.ts';
import './focus-record-list.css';

const allRecords: ListScope = { kind: 'all' };
const overlayQuery = '(max-width: 1100px)';

export function canShowFocusRecordList(state: AppState, route: Route, assistantSource: boolean, target: Route, reliableFocusList: boolean, homeFocusList?: HomeFocusList) {
  if (route.page !== 'record' || assistantSource) return false;
  if (target.page === 'home') return Boolean(homeFocusList);
  if (!reliableFocusList || !['library', 'search'].includes(target.page)) return false;
  const scope = route.listScope ?? allRecords;
  if (scope.kind === 'all') return true;
  if (!scope.areaId || (scope.areaId !== 'legacy' && !areaAvailable(state, scope.areaId))) return false;
  if (scope.kind !== 'folder') return true;
  if (!scope.folderId) return false;
  return scope.folderId === 'root' || state.folders.some(folder => folder.id === scope.folderId && folder.areaId === (scope.areaId === 'legacy' ? null : scope.areaId) && folder.server === state.server?.address);
}

function useOverlay() {
  const [overlay, setOverlay] = useState(() => window.matchMedia(overlayQuery).matches);
  useEffect(() => {
    const media = window.matchMedia(overlayQuery);
    const onChange = () => setOverlay(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);
  return overlay;
}

export function FocusRecordList({ open, onClose }: { open: boolean; onClose: (restoreFocus?: boolean) => void }) {
  const { state } = useStore();
  const { route, assistantSource, reliableFocusList, homeFocusList, openRecord, returnTarget } = useNav();
  const overlay = useOverlay();
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || document.querySelector('[role="dialog"][data-state="open"]')) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('.focus-record-list') || target?.getAttribute('aria-controls') === 'focus-record-list') {
        event.preventDefault(); onClose(true);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);
  if (!open || !canShowFocusRecordList(state, route, assistantSource, returnTarget(), reliableFocusList, homeFocusList) || route.page !== 'record') return null;

  const scope = route.listScope ?? allRecords;
  const title = scope.kind === 'all' ? 'Все записи' : scope.kind === 'folder'
    ? scope.folderId === 'root' ? (scope.areaId === 'personal' || scope.areaId === 'legacy' ? 'Без папки' : 'В корне пространства')
      : state.folders.find(folder => folder.id === scope.folderId && folder.server === state.server?.address)?.name ?? 'Папка недоступна'
    : areaName(scope.areaId, state);
  const records = filterRecords(state, scope, DEFAULT_FILTERS).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const contents = <>
    <div className="focus-record-list-context"><TooltipProvider><Tooltip><TooltipTrigger render={<span/>}>{title}</TooltipTrigger><TooltipContent>{title}</TooltipContent></Tooltip></TooltipProvider><span>{pluralRecords(records.length)}</span></div>
    <div id="focus-record-list" className="focus-record-list-items" role="list" aria-label="Записи текущего списка">
      {records.map(record => <div key={record.id} role="listitem" className={`focus-record-list-row${record.id === route.id ? ' is-selected' : ''}`}>
        <Item size="sm" render={<button type="button" />} aria-current={record.id === route.id ? 'true' : undefined} aria-label={`${record.title}, ${SOURCE_NAMES[record.source]}, ${dateLabel(record.createdAt, false)}, ${formatDuration(record.duration)}`} onClick={() => openRecord(record.id, scope, Boolean(route.listSearch))}>
          <ItemMedia><RecordSource record={record}/></ItemMedia><ItemContent><ItemTitle>{record.title}</ItemTitle><ItemDescription>{dateLabel(record.createdAt, false)} · {formatDuration(record.duration)}</ItemDescription></ItemContent>
        </Item>
      </div>)}
      {!records.length && <p className="focus-record-list-empty">В этом списке нет записей.</p>}
    </div>
  </>;
  return <aside className={`focus-record-list${overlay ? ' is-overlay' : ''}`} aria-label="Записи текущего списка">
    <div className="focus-record-list-header"><h2>Записи</h2><IconButton icon="close" label="Закрыть список записей" onClick={() => onClose(true)} /></div>
    {contents}
  </aside>;
}
