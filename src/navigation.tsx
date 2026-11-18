import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@vini-ds/ui';
import { OWNER } from './fixtures.ts';
import { areaAvailable, areaName, canEditTranscript, defaultDraftTitle, DEFAULT_FILTERS, draftDestinationAvailable, filterRecords } from './model.ts';
import { useStore } from './store.tsx';
import { Button, Confirm, Icon, Modal } from './ui.tsx';
import type { AppState, AssistantDialog, Filters, ListScope, RecordSection, Route, Scope } from './types.ts';
import { readWorkspaceSession, withWorkspaceSession, WORKSPACE_SESSION_FIELD, type WorkspaceEntry, type WorkspaceTab } from './workspace-session.ts';

export const libraryRoute: Route = { page: 'library', scope: { kind: 'all' } };
export function scopeKey(scope: ListScope) { return `${scope.kind}/${scope.areaId ?? ''}/${scope.folderId ?? ''}`; }
const listKey = (scope: ListScope, search = false) => `${search ? 'search:' : 'list:'}${scopeKey(scope)}`;
const encode = (value: string | undefined) => encodeURIComponent(value ?? '');
const allScope = (): ListScope => ({ kind: 'all' });
function listQuery(scope: ListScope | undefined, search: boolean | undefined) {
  const params = new URLSearchParams();
  if (scope?.kind !== 'all' && scope?.areaId) params.set('area', scope.areaId);
  if (scope?.kind === 'folder' && scope.folderId) params.set('folder', scope.folderId);
  if (search) params.set('search', '1');
  const query = params.toString(); return query ? `?${query}` : '';
}
function parseListContext(query: string) {
  const params = new URLSearchParams(query); const areaId = params.get('area'); const folderId = params.get('folder');
  const listScope: ListScope = areaId && folderId ? { kind: 'folder', areaId, folderId } : areaId ? { kind: 'area', areaId } : allScope();
  return { listScope, listSearch: params.get('search') === '1' };
}
export function routePath(route: Route): string {
  switch (route.page) {
    case 'home': return '/home';
    case 'library': return route.scope.kind === 'all' ? '/records' : route.scope.kind === 'folder' ? `/spaces/${encode(route.scope.areaId)}/folders/${encode(route.scope.folderId)}` : `/spaces/${encode(route.scope.areaId)}`;
    case 'search': return route.scope.kind === 'all' ? '/search/all' : route.scope.kind === 'folder' ? `/search/folder/${encode(route.scope.areaId)}/${encode(route.scope.folderId)}` : `/search/area/${encode(route.scope.areaId)}`;
    case 'record': return `/records/${encode(route.id)}/${route.section}${listQuery(route.listScope, route.listSearch)}`;
    case 'recorder': return `/recorder/${encode(route.id)}`;
    case 'meeting': return `/meetings/${encode(route.id)}${route.section && route.section !== 'summary' ? `/${route.section}` : ''}${listQuery(route.listScope, route.listSearch)}`;
    case 'assistant': return route.listScope?.areaId && route.listScope.kind !== 'all' ? `/spaces/${encode(route.listScope.areaId)}/assistant${route.id ? `/${encode(route.id)}` : ''}${listQuery(route.listScope, route.listSearch)}` : `/assistant${route.id ? `/${encode(route.id)}` : ''}`;
    case 'workspaces': return '/spaces';
    case 'members': return `/spaces/${encode(route.areaId)}/members`;
    case 'folders': return `/spaces/${encode(route.areaId ?? 'legacy')}/folders`;
    case 'settings': return `/settings/${encode(route.section ?? 'connection')}`;
  }
}
const sectionFor = (value: string | undefined): RecordSection => value === 'transcript' || value === 'assistant' ? value : 'summary';
export function parseRoute(hash: string): Route {
  let p: string[];
  const [path, query = ''] = hash.replace(/^#\/?/, '').split('?', 2);
  try { p = path.split('/').map(decodeURIComponent); } catch { return libraryRoute; }
  if (!p[0] || p[0] === 'home') return { page: 'home' };
  if (p[0] === 'records' && p[1]) return { page: 'record', id: p[1], section: sectionFor(p[2]), ...parseListContext(query) };
  if (p[0] === 'search') {
    if (p[1] === 'area' && p[2]) return { page: 'search', scope: { kind: 'area', areaId: p[2] } };
    if (p[1] === 'folder' && p[2] && p[3]) return { page: 'search', scope: { kind: 'folder', areaId: p[2], folderId: p[3] } };
    return { page: 'search', scope: { kind: 'all' } };
  }
  if (p[0] === 'recorder' && p[1]) return { page: 'recorder', id: p[1] };
  if (p[0] === 'meetings' && p[1]) return { page: 'meeting', id: p[1], section: sectionFor(p[2]), ...parseListContext(query) };
  if (p[0] === 'assistant') return { page: 'assistant', id: p[1] };
  if (p[0] === 'settings') return { page: 'settings', section: p[1] };
  if (p[0] === 'spaces') {
    if (!p[1]) return { page: 'workspaces' };
    if (p[2] === 'assistant') { const context = parseListContext(query); return { page: 'assistant', id: p[3], listScope: context.listScope.kind === 'folder' ? { ...context.listScope, areaId: p[1] } : { kind: 'area', areaId: p[1] }, listSearch: context.listSearch }; }
    if (p[2] === 'members') return { page: 'members', areaId: p[1] };
    if (p[2] === 'folders' && !p[3]) return { page: 'folders', areaId: p[1] === 'legacy' ? null : p[1] };
    if (p[2] === 'folders' && p[3]) return { page: 'library', scope: { kind: 'folder', areaId: p[1], folderId: p[3] } };
    return { page: 'library', scope: { kind: 'area', areaId: p[1] } };
  }
  return libraryRoute;
}

export function backLabel(target: Route, state: AppState) {
  if (target.page === 'home') return 'К встречам';
  if (target.page === 'assistant') return target.id ? 'К диалогу' : 'К истории диалогов';
  if (target.page === 'record' || target.page === 'meeting') return 'К записи';
  if (target.page === 'search') return 'К результатам поиска';
  if (target.page === 'library' && target.scope.kind === 'folder') {
    const folder = target.scope.folderId === 'root' ? target.scope.areaId === 'personal' || target.scope.areaId === 'legacy' ? 'Без папки' : 'В корне пространства' : state.folders.find(f => f.id === target.scope.folderId && f.server === state.server?.address)?.name ?? 'Папка';
    return `К папке «${folder}»`;
  }
  if (target.page === 'library' && target.scope.kind === 'area') return target.scope.areaId === 'personal' ? 'К личным записям' : `К пространству «${areaName(target.scope.areaId, state)}»`;
  if (target.page === 'folders') return 'К папкам';
  if (target.page === 'workspaces') return 'К пространствам';
  if (target.page === 'settings') return 'К настройкам';
  return 'К записям';
}

export type RecordView = { section: RecordSection; positions: Record<RecordSection, number>; findOpen: boolean; query: string; matchIndex: number; speaker: string; searchStartScroll: number | null; edit: { segmentId: string; text: string; original: string } | null };
export type DialogView = { scrollTop: number; anchorTurnId?: string; anchorOffset?: number; sourceRecordId?: string };
const emptyRecordView = (): RecordView => ({ section: 'summary', positions: { summary: 0, transcript: 0, assistant: 0, details: 0 }, findOpen: false, query: '', matchIndex: 0, speaker: 'all', searchStartScroll: null, edit: null });
const isList = (route: Route): route is Extract<Route, { page: 'library' | 'search' }> => route.page === 'library' || route.page === 'search';
function routeList(route: Route): { scope: ListScope; search: boolean } | undefined {
  if (isList(route)) return { scope: route.scope, search: route.page === 'search' };
  if (route.page === 'assistant' && route.listScope) return { scope: route.listScope, search: Boolean(route.listSearch) };
  if (route.page === 'record' || route.page === 'meeting') return { scope: route.listScope ?? allScope(), search: Boolean(route.listSearch) };
  return undefined;
}

export type HomeFocusList = { title: string; recordIds: string[] };

type Navigation = {
  tabs: { id: string; route: Route; closable: boolean }[]; activeTabId: string;
  openTab: (route: Route) => void; switchTab: (id: string) => void; closeTab: (id: string) => void;
  canGoBack: boolean; canGoForward: boolean; historyBack: () => void; historyForward: () => void;
  route: Route; go: (route: Route, force?: boolean) => void; back: () => void; returnTarget: () => Route; assistantSource: boolean; reliableFocusList: boolean; homeFocusList?: HomeFocusList;
  selectedRecord: (scope: ListScope, search?: boolean) => string | undefined;
  openRecord: (id: string, scope: ListScope, search?: boolean, homeList?: HomeFocusList) => void; openList: (scope: ListScope) => void; closeDetail: () => void; closeRecord: (id: string) => void;
  parentFolder: (scope: ListScope) => void; listContext: ListScope | undefined; openSearch: () => void; consumeSearchFocus: () => boolean;
  listState: (scope: ListScope, search?: boolean) => Filters; updateList: (scope: ListScope, patch: Partial<Filters>, search?: boolean) => void;
  recordView: (id: string) => RecordView; saveRecordView: (id: string, patch: Partial<RecordView>) => void;
  dialogView: (id: string) => DialogView | undefined; saveDialogView: (id: string, patch: Partial<DialogView>) => void;
  startRecording: (areaId?: string, folderId?: string | null) => void; startDialog: (scope?: Scope, moveDraftFrom?: string) => string; openDialog: (id: string) => void;
};
const Context = createContext<Navigation | null>(null);
export function useNav() { const value = useContext(Context); if (!value) throw new Error('Navigation is missing'); return value; }

function existingStack(): Route[] {
  const value = history.state as { thesis?: boolean; stack?: Route[] } | null;
  return value?.thesis && Array.isArray(value.stack) ? value.stack.filter(item => item && typeof item.page === 'string') : [];
}
function existingAssistantSource(route: Route) {
  const value = history.state as { thesis?: boolean; assistantSource?: boolean } | null;
  if (!value?.thesis) return false;
  if (typeof value.assistantSource === 'boolean') return value.assistantSource;
  // Older history entries have no intent marker; preserve their existing return link.
  const previous = existingStack();
  return (route.page === 'record' || route.page === 'meeting') && previous[previous.length - 1]?.page === 'assistant';
}
function sameRecord(a: Route, b: Route) {
  if (!((a.page === 'record' && b.page === 'record') || (a.page === 'meeting' && b.page === 'meeting'))) return false;
  if ((a.page !== 'record' && a.page !== 'meeting') || (b.page !== 'record' && b.page !== 'meeting')) return false;
  return a.id === b.id && scopeKey(a.listScope ?? allScope()) === scopeKey(b.listScope ?? allScope()) && Boolean(a.listSearch) === Boolean(b.listSearch);
}

export function NavigationProvider({ children }: { children: ReactNode }) {
  const { state, dispatch, notify } = useStore();
  // Browser history belongs to this particular window/tab and survives reload
  // without changing the prototype's localStorage data or other windows.
  const [initial] = useState(() => {
    const addressRoute = parseRoute(location.hash);
    const restored = readWorkspaceSession(history.state, routePath(addressRoute), routePath);
    if (restored) {
      const active = restored.tabs.find(tab => tab.id === restored.activeTabId)!;
      // The focus experiment has one workspace; do not revive other tabs.
      return { tabs: [active], activeTabId: active.id, entry: active.entries[active.index], entries: active.entries, index: active.index };
    }
    // An explicit address must win over a stale or malformed tab snapshot.
    const staleSnapshot = history.state && typeof history.state === 'object' && WORKSPACE_SESSION_FIELD in history.state;
    const priorStack = staleSnapshot ? [] : existingStack();
    const assistantSource = staleSnapshot ? false : existingAssistantSource(addressRoute);
    const entry: WorkspaceEntry = { route: addressRoute, stack: priorStack, assistantSource };
    const id = crypto.randomUUID();
    const entries = [entry];
    return { tabs: [{ id, entries, index: 0 }], activeTabId: id, entry, entries, index: 0 };
  });
  const [route, setRoute] = useState<Route>(() => initial.entry.route);
  const routeRef = useRef(route); routeRef.current = route;
  const [assistantSource, setAssistantSource] = useState(() => initial.entry.assistantSource);
  const assistantSourceRef = useRef(assistantSource); assistantSourceRef.current = assistantSource;
  const stack = useRef<Route[]>(initial.entry.stack);
  // Preview controls traverse native entries from this mounted session only.
  // Unknown/manual hash entries start a new bounded session rather than guessing
  // the browser's external history length or exposing a misleading Forward state.
  const [previewSession] = useState(() => crypto.randomUUID());
  const previewEntries = useRef<WorkspaceEntry[]>(initial.entries);
  // Filters live only in this mounted provider. A history snapshot or direct
  // URL cannot restore them, even when it contains a list route.
  const reliableListEntries = useRef(new WeakSet<WorkspaceEntry>());
  const homeListEntries = useRef(new WeakMap<WorkspaceEntry, HomeFocusList>());
  const previewIndex = useRef(initial.index);
  const tabsRef = useRef<WorkspaceTab[]>(initial.tabs);
  const activeTabRef = useRef(initial.activeTabId);
  const pendingTabAction = useRef<(() => void) | null>(null);
  const tabListKey = (scope: ListScope, search = false) => `${activeTabRef.current}:${listKey(scope, search)}`;
  const [, refreshHistory] = useState(0);
  const traversalBusy = useRef(false);
  const restoringIndex = useRef<number | null>(null);
  const pendingTraversal = useRef<number | null>(null);
  const refresh = () => refreshHistory(value => value + 1);
  const stamp = (index: number) => withWorkspaceSession({ ...(history.state && typeof history.state === 'object' ? history.state : {}), thesis: true, ...previewEntries.current[index], previewSession, previewIndex: index }, tabsRef.current, activeTabRef.current);
  const [lists, setLists] = useState<Record<string, Filters>>({});
  const listsRef = useRef(lists); listsRef.current = lists;
  const [pending, setPending] = useState<Route | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const allowRecorderExit = useRef(false);
  const stateRef = useRef(state); stateRef.current = state;
  const recordViews = useRef(new Map<string, RecordView>());
  const [pendingCloseTab, setPendingCloseTab] = useState<string | null>(null);
  const [closeEditError, setCloseEditError] = useState('');
  const dialogViews = useRef(new Map<string, DialogView>());
  const lastSelections = useRef(new Map<string, string>(route.page === 'record' ? [[tabListKey(route.listScope ?? allScope(), route.listSearch), route.id]] : []));
  const searchFocus = useRef(route.page === 'search');
  const detailSource = useRef<{ recordId?: string; homeScroll?: number; homeFocusLabel?: string } | null>(null);
  const sessionKey = (id: string, tabId = activeTabRef.current) => `${tabId}/${stateRef.current.server?.address ?? ''}/${OWNER}/${id}`;

  const captureListScroll = () => {
    const previous = routeRef.current;
    // A keyboard shortcut or a fast row click can occur before the browser's
    // queued scroll event. Capture the actual viewport synchronously before
    // unmounting the list so returning never loses that position.
    const previousList = routeList(previous);
    if (previousList) {
      const viewport = document.querySelector<HTMLElement>('[data-testid="library-page"]');
      if (viewport && viewport.getClientRects().length) {
        const key = tabListKey(previousList.scope, previousList.search); const scroll = viewport.scrollTop;
        setLists(current => ({ ...current, [key]: { ...(current[key] ?? DEFAULT_FILTERS), scroll } }));
      }
    }
  };
  const saveActiveTab = () => {
    const tab = tabsRef.current.find(item => item.id === activeTabRef.current);
    if (tab) { tab.entries = [...previewEntries.current]; tab.index = previewIndex.current; }
  };
  const activateTab = (id: string) => {
    const tab = tabsRef.current.find(item => item.id === id);
    if (!tab || id === activeTabRef.current) return;
    captureListScroll(); saveActiveTab(); activeTabRef.current = id;
    previewEntries.current = [...tab.entries]; previewIndex.current = tab.index;
    const entry = previewEntries.current[previewIndex.current];
    stack.current = [...entry.stack]; routeRef.current = entry.route; assistantSourceRef.current = entry.assistantSource;
    setRoute(entry.route); setAssistantSource(entry.assistantSource);
    history.replaceState(stamp(previewIndex.current), '', `#${routePath(entry.route)}`); refresh();
  };
  const guardedTabAction = (target: Route, action: () => void) => {
    const current = routeRef.current;
    if (current.page === 'recorder' && stateRef.current.drafts.some(d => d.id === current.id)) {
      pendingTraversal.current = null; pendingTabAction.current = action;
      setConfirmDelete(false); setPending(target); return;
    }
    action();
  };
  const openTab = (target: Route) => guardedTabAction(target, () => {
    const id = crypto.randomUUID();
    tabsRef.current = [...tabsRef.current, { id, entries: [{ route: target, stack: [], assistantSource: false }], index: 0 }];
    activateTab(id);
  });
  const switchTab = (id: string) => {
    const tab = tabsRef.current.find(item => item.id === id);
    if (tab && id !== activeTabRef.current) guardedTabAction(tab.entries[tab.index].route, () => activateTab(id));
  };
  const dirtyEditsForTab = (id: string) => [...recordViews.current.entries()].filter(([key, view]) => key.startsWith(`${id}/`) && view.edit && view.edit.text !== view.edit.original);
  const removeTab = (id: string) => {
    if (tabsRef.current.length <= 1 || !tabsRef.current.some(item => item.id === id)) return;
    if (id === activeTabRef.current) {
      const index = tabsRef.current.findIndex(item => item.id === id);
      const next = tabsRef.current[index - 1] ?? tabsRef.current[index + 1];
      activateTab(next.id);
    }
    tabsRef.current = tabsRef.current.filter(item => item.id !== id);
    // activateTab writes before removal; replace the snapshot again after the
    // close so the removed tab cannot reappear on reload.
    history.replaceState(stamp(previewIndex.current), '', `#${routePath(routeRef.current)}`);
    // Closed views must not leave stale beforeunload warnings behind.
    for (const key of recordViews.current.keys()) if (key.startsWith(`${id}/`)) recordViews.current.delete(key);
    for (const key of dialogViews.current.keys()) if (key.startsWith(`${id}/`)) dialogViews.current.delete(key);
    refresh();
  };
  const requestTabClose = (id: string) => {
    if (dirtyEditsForTab(id).length) { setCloseEditError(''); setPendingCloseTab(id); return; }
    removeTab(id);
  };
  const closeTab = (id: string) => {
    // Keep one working tab open, while allowing any tab to close when there
    // are other tabs to return to.
    if (tabsRef.current.length <= 1 || !tabsRef.current.some(item => item.id === id)) return;
    if (id === activeTabRef.current) {
      const next = tabsRef.current.find(item => item.id !== id)!;
      guardedTabAction(next.entries[next.index].route, () => requestTabClose(id));
    } else requestTabClose(id);
  };
  const saveEditsAndClose = () => {
    if (!pendingCloseTab) return;
    const edits = dirtyEditsForTab(pendingCloseTab);
    const changes: { id: string; segmentId: string; text: string }[] = [];
    for (const [key, view] of edits) {
      const edit = view.edit!;
      const record = stateRef.current.records.find(item => key === sessionKey(item.id, pendingCloseTab));
      const segment = record?.transcript.find(item => item.id === edit.segmentId);
      if (!record || !segment || !canEditTranscript(stateRef.current, record) || !edit.text.trim()) {
        setCloseEditError('Не удалось сохранить правку: запись недоступна или текст пуст. Вернитесь к редактированию.'); return;
      }
      if (segment.text !== edit.original && segment.text !== edit.text.trim()) {
        setCloseEditError('Текст записи изменился в другой вкладке. Вернитесь к правке и проверьте изменения.'); return;
      }
      changes.push({ id: record.id, segmentId: edit.segmentId, text: edit.text });
    }
    for (const change of changes) dispatch({ type: 'edit-transcript', ...change, now: Date.now() });
    const id = pendingCloseTab; setPendingCloseTab(null); setCloseEditError(''); removeTab(id);
    if (changes.length) notify('Правка сохранена. Резюме можно пересоздать в «Действиях».');
  };
  const commit = (next: Route, replace = false, fromAssistant = false, reliableList = false, homeList?: HomeFocusList) => {
    if (traversalBusy.current) return;
    if (routePath(next) === routePath(routeRef.current) && fromAssistant === assistantSourceRef.current) return;
    const previous = routeRef.current;
    captureListScroll();
    if (!replace) stack.current = [...stack.current, previous];
    const entry = { route: next, stack: [...stack.current], assistantSource: fromAssistant };
    if (reliableList) reliableListEntries.current.add(entry);
    if (homeList) homeListEntries.current.set(entry, homeList);
    if (replace) previewEntries.current[previewIndex.current] = entry;
    else { previewEntries.current = [...previewEntries.current.slice(0, previewIndex.current + 1), entry]; previewIndex.current += 1; }
    refresh();
    saveActiveTab();
    history.replaceState(stamp(previewIndex.current), '', `#${routePath(next)}`);
    if (next.page === 'record') lastSelections.current.set(tabListKey(next.listScope ?? allScope(), next.listSearch), next.id);
    routeRef.current = next; assistantSourceRef.current = fromAssistant; setRoute(next); setAssistantSource(fromAssistant);
  };
  const go = (next: Route, force = false, listEntry = false, homeList?: HomeFocusList) => {
    const current = routeRef.current;
    let destination = next;
    if ((next.page === 'record' || next.page === 'meeting') && !next.listScope) {
      const source = routeList(current) ?? (current.page === 'recorder' ? routeList(stack.current[stack.current.length - 1] ?? libraryRoute) : undefined);
      destination = { ...next, listScope: source?.scope ?? allScope(), listSearch: source?.search ?? false };
    }
    const same = sameRecord(current, destination);
    const currentDetail = current.page === 'record' || current.page === 'meeting';
    const destinationDetail = destination.page === 'record' || destination.page === 'meeting';
    const fromAssistant = destinationDetail && (current.page === 'assistant' && !listEntry || currentDetail && assistantSourceRef.current);
    const sourceList = isList(current) ? routeList(current) : currentDetail && reliableListEntries.current.has(previewEntries.current[previewIndex.current]) ? routeList(current) : undefined;
    const destinationList = destinationDetail ? routeList(destination) : undefined;
    const reliableList = Boolean(!fromAssistant && sourceList && destinationList && (currentDetail || listEntry) && scopeKey(sourceList.scope) === scopeKey(destinationList.scope) && sourceList.search === destinationList.search);
    if (routePath(destination) === routePath(current) && fromAssistant === assistantSourceRef.current) return;
    if (!force && current.page === 'recorder' && stateRef.current.drafts.some(d => d.id === current.id)) { pendingTraversal.current = null; setConfirmDelete(false); setPending(destination); return; }
    if (!currentDetail && destinationDetail) {
      const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      detailSource.current = { recordId: destination.page === 'record' ? destination.id : undefined, homeScroll: current.page === 'home' ? document.querySelector<HTMLElement>('.home-experiment')?.scrollTop : undefined, homeFocusLabel: current.page === 'home' ? focused?.getAttribute('aria-label') ?? undefined : undefined };
    }
    // Entering a conversation from global history is a child transition, not
    // a replacement: its Back target must be history rather than an old list.
    const replace = currentDetail && destinationDetail || same && fromAssistant === assistantSourceRef.current || current.page === 'assistant' && destination.page === 'assistant' && Boolean(current.id) && scopeKey(current.listScope ?? allScope()) === scopeKey(destination.listScope ?? allScope()) && Boolean(current.listSearch) === Boolean(destination.listSearch) || current.page === 'settings' && destination.page === 'settings' || force && current.page === 'recorder' && destination.page === 'record';
    const priorHomeList = currentDetail && destination.page === 'record' ? homeListEntries.current.get(previewEntries.current[previewIndex.current]) : undefined;
    const selectedHomeList = destination.page === 'record' ? (current.page === 'home' && homeList?.recordIds.includes(destination.id) ? homeList : priorHomeList) : undefined;
    commit(destination, replace, fromAssistant, reliableList, selectedHomeList);
  };
  const returnTarget = (): Route => {
    const current = routeRef.current;
    if (current.page === 'record' || current.page === 'meeting') {
      // Record sections and record-to-record switches belong to one focused
      // view. The nearest non-detail route is the original entry point.
      for (const previous of [...stack.current].reverse()) {
        if (previous.page !== 'record' && previous.page !== 'meeting' && previous.page !== 'recorder') return previous;
      }
      return { page: current.listSearch ? 'search' : 'library', scope: current.listScope ?? allScope() };
    }
    return stack.current[stack.current.length - 1] ?? libraryRoute;
  };
  const traverse = (index: number, confirmed = false) => {
    if (traversalBusy.current || index < 0 || index >= previewEntries.current.length || index === previewIndex.current) return;
    const current = routeRef.current;
    if (!confirmed && current.page === 'recorder' && stateRef.current.drafts.some(d => d.id === current.id)) {
      pendingTraversal.current = index; setConfirmDelete(false); setPending(previewEntries.current[index].route); return;
    }
    captureListScroll();
    const entry = previewEntries.current[index];
    previewIndex.current = index; stack.current = [...entry.stack];
    routeRef.current = entry.route; assistantSourceRef.current = entry.assistantSource;
    setRoute(entry.route); setAssistantSource(entry.assistantSource);
    saveActiveTab(); history.replaceState(stamp(index), '', `#${routePath(entry.route)}`); refresh();
  };
  const historyBack = () => traverse(previewIndex.current - 1);
  const historyForward = () => traverse(previewIndex.current + 1);
  const back = () => {
    if (previewIndex.current > 0) { historyBack(); return; }
    go(libraryRoute);
  };
  useEffect(() => {
    history.replaceState(stamp(previewIndex.current), '', `#${routePath(routeRef.current)}`);
    const onPop = () => {
      const next = parseRoute(location.hash);
      if (routePath(next) === routePath(routeRef.current)) return;
      const current = routeRef.current;
      if (current.page === 'recorder' && stateRef.current.drafts.some(d => d.id === current.id)) {
        history.replaceState(stamp(previewIndex.current), '', `#${routePath(current)}`);
        pendingTraversal.current = null; setConfirmDelete(false); setPending(next); return;
      }
      commit(next);
    };
    window.addEventListener('popstate', onPop); window.addEventListener('hashchange', onPop);
    return () => { window.removeEventListener('popstate', onPop); window.removeEventListener('hashchange', onPop); };
  }, []);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (![...recordViews.current.values()].some(view => view.edit && view.edit.text !== view.edit.original)) return;
      event.preventDefault(); event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, []);

  const previousList = () => {
    for (const previous of [...stack.current].reverse()) {
      if (isList(previous)) return previous;
      if (previous.page === 'record' || previous.page === 'meeting') return { page: previous.listSearch ? 'search' as const : 'library' as const, scope: previous.listScope ?? allScope() };
      // Assistant origin is navigation context, independent of answer sources.
      if (previous.page === 'assistant') return previous.listScope ? { page: previous.listSearch ? 'search' as const : 'library' as const, scope: previous.listScope } : undefined;
    }
    return undefined;
  };
  const scopeInHistory = (): ListScope | undefined => {
    const current = routeRef.current;
    if (isList(current)) return current.scope;
    if (current.page === 'record' || current.page === 'meeting') return current.listScope ?? allScope();
    if (current.page === 'assistant') return current.listScope ?? undefined;
    return previousList()?.scope;
  };
  const parentFolder = (scope: ListScope) => {
    if (scope.kind !== 'folder') return;
    const parent: Route = scope.areaId === 'legacy' ? { page: 'folders', areaId: null } : { page: 'library', scope: { kind: 'area', areaId: scope.areaId } };
    if (routePath(returnTarget()) === routePath(parent)) back(); else go(parent);
  };
  const openSearch = () => {
    const current = routeRef.current;
    const input = document.getElementById('library-search');
    // The list remains mounted behind a focused record. Only focus its input
    // directly when it is actually visible; otherwise navigate to search.
    if (input && isList(current) && input.getClientRects().length) { input.focus({ preventScroll: true }); return; }
    const nearest = previousList();
    searchFocus.current = true;
    if (nearest?.page === 'search' && routePath(returnTarget()) === routePath(nearest)) {
      back();
    } else {
      const scope = nearest?.scope ?? routeList(current)?.scope ?? { kind: 'all' as const };
      const source = listsRef.current[tabListKey(scope, nearest?.page === 'search')] ?? DEFAULT_FILTERS;
      setLists(currentLists => ({ ...currentLists, [tabListKey(scope, true)]: { ...source, scroll: 0 } }));
      go({ page: 'search', scope });
    }
    // Returning to the source search can reveal an already-mounted Library,
    // whose mount effect will not run again to consume the focus request.
    requestAnimationFrame(() => {
      if (routeRef.current.page !== 'search') return;
      const search = document.getElementById('library-search');
      if (search?.getClientRects().length) {
        search.focus({ preventScroll: true });
        searchFocus.current = false;
      }
    });
  };
  const openRecord = (id: string, scope: ListScope, search = false, homeList?: HomeFocusList) => {
    const section = recordViews.current.get(sessionKey(id))?.section ?? 'summary';
    go({ page: 'record', id, section, listScope: scope, listSearch: search }, false, true, homeList);
  };
  const openList = (scope: ListScope) => { go({ page: 'library', scope }); };
  const closeDetail = () => {
    const current = routeRef.current; if (current.page !== 'record' && current.page !== 'meeting') return;
    const target = returnTarget();
    const id = current.page === 'record' ? current.id : stateRef.current.meetings.find(meeting => meeting.id === current.id)?.resultId;
    // Return to the original entry instead of creating a chain of detail pages.
    // Traversing preserves the list's in-memory filters and scroll position.
    let originIndex = previewIndex.current - 1;
    while (originIndex >= 0 && routePath(previewEntries.current[originIndex].route) !== routePath(target)) originIndex--;
    if (originIndex >= 0) traverse(originIndex); else commit(target, true);
    if (isList(target)) requestAnimationFrame(() => {
      const focusId = detailSource.current?.recordId ?? id;
      const row = Array.from(document.querySelectorAll<HTMLElement>('[data-testid^="record-row-"]')).find(element => element.dataset.testid === `record-row-${focusId}`);
      (row?.querySelector<HTMLButtonElement>('.record-row-open') ?? document.getElementById('library-search'))?.focus({ preventScroll: true });
    });
    if (target.page === 'home') requestAnimationFrame(() => {
      const source = detailSource.current;
      const viewport = document.querySelector<HTMLElement>('.home-experiment');
      if (viewport && source?.homeScroll !== undefined) viewport.scrollTop = source.homeScroll;
      const byLabel = source?.homeFocusLabel && Array.from(document.querySelectorAll<HTMLElement>('[aria-label]')).find(element => element.getAttribute('aria-label') === source.homeFocusLabel);
      const byRecord = Array.from(document.querySelectorAll<HTMLElement>('[data-testid^="meeting-card-"]')).find(element => element.dataset.testid === `meeting-card-${source?.recordId ?? id}`);
      (byLabel || byRecord)?.focus({ preventScroll: true });
    });
  };
  const closeRecord = (id: string) => {
    const current = routeRef.current;
    const selectedId = current.page === 'record' ? current.id : current.page === 'meeting' ? stateRef.current.meetings.find(meeting => meeting.id === current.id)?.resultId : undefined;
    recordViews.current.delete(sessionKey(id));
    for (const [key, selected] of lastSelections.current) if (selected === id) lastSelections.current.delete(key);
    if (selectedId !== id || (current.page !== 'record' && current.page !== 'meeting')) return;
    closeDetail();
  };
  const startRecording = (areaId = 'personal', folderId: string | null = null) => {
    const current = routeRef.current;
    if (current.page === 'recorder' && state.drafts.some(d => d.id === current.id)) { notify('Сначала завершите или сохраните текущую запись.'); return; }
    const selectedFolder = folderId === 'root' ? null : folderId;
    if (!state.server || !areaAvailable(state, areaId) || selectedFolder && !state.folders.some(f => f.id === selectedFolder && f.areaId === areaId && f.server === state.server?.address)) { notify('Выберите доступное место отправки.'); return; }
    const id = crypto.randomUUID();
    dispatch({ type: 'create-draft', draft: { id, title: defaultDraftTitle(), seconds: 0, paused: false, createdAt: new Date().toISOString(), areaId, folderId: selectedFolder, server: state.server.address } });
    go({ page: 'recorder', id });
  };
  const startDialog = (scope: Scope = { mode: 'auto', areaId: 'all', recordIds: [] }, moveDraftFrom?: string) => {
    const id = crypto.randomUUID(); const now = Date.now();
    const old = state.dialogs.find(d => d.id === moveDraftFrom && d.server === state.server?.address && d.owner === OWNER);
    const dialog: AssistantDialog = { id, title: 'Новый диалог', scope, draft: old?.draft ?? '', turns: [], server: state.server?.address ?? '', owner: OWNER, createdAt: now, updatedAt: now };
    const current = routeRef.current;
    const source = current.page === 'library' || current.page === 'search' ? { listScope: current.scope, listSearch: current.page === 'search' } : current.page === 'assistant' ? { listScope: current.listScope, listSearch: current.listSearch } : scope.areaId !== 'all' ? { listScope: { kind: scope.folderId ? 'folder' as const : 'area' as const, areaId: scope.areaId, ...(scope.folderId ? { folderId: scope.folderId } : {}) } } : {};
    const origin = source.listScope?.kind !== 'all' ? source : {};
    dispatch({ type: 'create-dialog', dialog, moveDraftFrom }); go({ page: 'assistant', id, ...origin }); return id;
  };
  const openDialog = (id: string) => {
    const current = routeRef.current;
    if (current.page === 'assistant' && current.id === id) return;
    // A local view and global history address the same stored conversation.
    const origin = current.page === 'assistant' ? { listScope: current.listScope, listSearch: current.listSearch } : {};
    go({ page: 'assistant', id, ...origin });
  };
  const exitingDraft = route.page === 'recorder' ? state.drafts.find(d => d.id === route.id) : undefined;
  const closeExit = () => { pendingTraversal.current = null; pendingTabAction.current = null; setPending(null); setConfirmDelete(false); };
  const leave = () => {
    const next = pending ?? libraryRoute; const index = pendingTraversal.current; const tabAction = pendingTabAction.current; closeExit();
    if (tabAction) { tabAction(); return; }
    if (index !== null) { traverse(index, true); return; }
    commit(next, true);
  };
  // View callbacks belong to the render that created them. A component can
  // save during unmount after another tab has already become active.
  const renderTabId = activeTabRef.current;
  const value: Navigation = {
    tabs: tabsRef.current.map(tab => ({ id: tab.id, route: tab.entries[tab.index].route, closable: tabsRef.current.length > 1 })),
    activeTabId: activeTabRef.current, openTab, switchTab, closeTab,
    canGoBack: previewIndex.current > 0 && !traversalBusy.current && !pending,
    canGoForward: previewIndex.current < previewEntries.current.length - 1 && !traversalBusy.current && !pending,
    historyBack, historyForward,
    selectedRecord: (scope, search = false) => lastSelections.current.get(tabListKey(scope, search)),
    route, go, back, returnTarget, assistantSource, reliableFocusList: reliableListEntries.current.has(previewEntries.current[previewIndex.current]), homeFocusList: homeListEntries.current.get(previewEntries.current[previewIndex.current]), openRecord, openList, closeDetail, closeRecord, parentFolder, listContext: scopeInHistory(), openSearch,
    consumeSearchFocus: () => { const value = searchFocus.current; searchFocus.current = false; return value; },
    listState: (scope, search = false) => lists[tabListKey(scope, search)] ?? { ...DEFAULT_FILTERS },
    updateList: (scope, patch, search = false) => { const key = tabListKey(scope, search); setLists(current => ({ ...current, [key]: { ...(current[key] ?? DEFAULT_FILTERS), ...patch } })); },
    recordView: id => recordViews.current.get(sessionKey(id, renderTabId)) ?? emptyRecordView(),
    saveRecordView: (id, patch) => { const key = sessionKey(id, renderTabId); recordViews.current.set(key, { ...(recordViews.current.get(key) ?? emptyRecordView()), ...patch }); },
    dialogView: id => dialogViews.current.get(sessionKey(id, renderTabId)),
    saveDialogView: (id, patch) => { const key = sessionKey(id, renderTabId); dialogViews.current.set(key, { ...(dialogViews.current.get(key) ?? { scrollTop: 0 }), ...patch }); },
    startRecording, startDialog, openDialog,
  };
  return <Context.Provider value={value}>
    {children}
    <Modal open={Boolean(pendingCloseTab)} onClose={() => { setPendingCloseTab(null); setCloseEditError(''); }} title="Сохранить изменения?" description="В этой вкладке есть несохранённая правка транскрипции. Сохраните её или закройте вкладку без сохранения.">
      {closeEditError && <p role="alert">{closeEditError}</p>}
      <div className="modal-actions"><Button variant="ghost" onClick={() => { setPendingCloseTab(null); setCloseEditError(''); }}>Отмена</Button><Button variant="secondary" onClick={() => { const id = pendingCloseTab; setPendingCloseTab(null); setCloseEditError(''); if (id) removeTab(id); }}>Закрыть без сохранения</Button><Button variant="primary" onClick={saveEditsAndClose}>Сохранить и закрыть</Button></div>
    </Modal>
    <Modal open={Boolean(pending && !confirmDelete && exitingDraft)} onClose={closeExit} title="Что сделать с записью?" description={exitingDraft?.paused ? 'Запись остаётся на паузе, пока вы выбираете действие.' : 'Запись продолжается, пока вы выбираете действие.'}>
      <div className="exit-choices"><Item size="sm" render={<button type="button" />} onClick={() => { if (exitingDraft) dispatch({ type: 'update-draft', id: exitingDraft.id, patch: { paused: true } }); leave(); notify('Черновик сохранён'); }}><ItemMedia><Icon name="pause" /></ItemMedia><ItemContent><ItemTitle>Сохранить черновик и выйти</ItemTitle><ItemDescription>Продолжите позже или начните новую запись.</ItemDescription></ItemContent><Icon name="right" size={16} /></Item>
        <Item size="sm" render={<button type="button" />} onClick={() => { if (!exitingDraft || !draftDestinationAvailable(state, exitingDraft)) { notify('Выберите доступное место отправки в диктофоне.'); return; } const id = crypto.randomUUID(); const tabAction = pendingTabAction.current; dispatch({ type: 'finish-draft', id: exitingDraft.id, recordId: id, now: Date.now() }); closeExit(); go({ page: 'record', id, section: 'summary' }, true); tabAction?.(); notify('Запись добавлена'); }}><ItemMedia><Icon name="success" /></ItemMedia><ItemContent><ItemTitle>Завершить и отправить</ItemTitle><ItemDescription>Запись сохранится и перейдёт к отправке.</ItemDescription></ItemContent><Icon name="right" size={16} /></Item>
        <Item size="sm" render={<button type="button" />} onClick={() => setConfirmDelete(true)}><ItemMedia className="is-danger"><Icon name="delete" /></ItemMedia><ItemContent><ItemTitle className="is-danger">Удалить и выйти</ItemTitle><ItemDescription>Без сохранения и отправки.</ItemDescription></ItemContent><Icon name="right" size={16} /></Item></div>
      <div className="modal-actions"><Button variant="ghost" onClick={closeExit}>Продолжить запись</Button></div>
    </Modal>
    <Confirm open={Boolean(pending && confirmDelete)} onClose={() => setConfirmDelete(false)} title="Удалить запись?" target={exitingDraft?.title} description="Запись не будет отправлена. Восстановить её после удаления нельзя. Остальные черновики останутся." danger confirm="Удалить и выйти" onConfirm={() => { if (exitingDraft) dispatch({ type: 'delete-draft', id: exitingDraft.id }); leave(); notify('Черновик удалён'); }} />
  </Context.Provider>;
}
