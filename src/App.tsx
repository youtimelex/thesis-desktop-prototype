import {PageNavigation} from './PageNavigation.tsx';
import { canShowFocusRecordList, FocusRecordList } from './FocusRecordList.tsx';
import {BrandHeader} from './BrandHeader.tsx';
import { SpaceNavigation } from './SpaceNavigation.tsx';
import { SettingsSidebar } from './SettingsNavigation.tsx';
import { Sidebar as VSidebar, SidebarProvider, SidebarGroup, SidebarGroupLabel, SidebarGroupAction, SidebarMenuButton, SidebarContent, SidebarFooter, SidebarMenu, SidebarMenuItem, SidebarMenuBadge, SidebarTrigger, SidebarInset, SidebarInsetHeader, useSidebar, Sheet, SheetContent, SheetTitle, SheetDescription, Alert, AlertDescription, Loader, Toggle as VToggle, Button as VButton, TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@vini-ds/ui';
import { lazy, Suspense, useEffect, useRef, useState, type CSSProperties, type RefObject, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import Library from './Library.tsx';
import MeetingHome from './MeetingHome.tsx';
import { canRead, DEFAULT_FILTERS, filterRecords, isOnServer, STORAGE_KEY, visibleRecords } from './model.ts';
import { NavigationProvider, scopeKey, useNav } from './navigation.tsx';
import { PlaybackProvider, PlayerDock, usePlayback } from './playback.tsx';
import { useStore } from './store.tsx';
import { Icon, IconButton, SecondaryPane } from './ui.tsx';
import type { Route } from './types.ts';
import './focus-shell.css';

const Assistant = lazy(() => import('./Assistant.tsx'));
const RecordPage = lazy(() => import('./RecordPage.tsx'));
const MeetingPage = lazy(() => import('./creation.tsx').then(m => ({ default: m.MeetingPage })));
const RecorderPage = lazy(() => import('./creation.tsx').then(m => ({ default: m.RecorderPage })));
const FoldersPage = lazy(() => import('./Pages.tsx').then(m => ({ default: m.FoldersPage })));
const LoginPage = lazy(() => import('./Pages.tsx').then(m => ({ default: m.LoginPage })));
const MembersPage = lazy(() => import('./Pages.tsx').then(m => ({ default: m.MembersPage })));
const SettingsPage = lazy(() => import('./Pages.tsx').then(m => ({ default: m.SettingsPage })));
const WorkspacesPage = lazy(() => import('./Pages.tsx').then(m => ({ default: m.WorkspacesPage })));
function PageLoading() { return <div className="page-loading" role="status"><Loader aria-label="Загружаем страницу"/>Загружаем…</div>; }

const previewMode = () => new URLSearchParams(window.location.search).get('preview') === '1';
const defaultListWidth = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--secondary-pane-width')) || 270;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function readListWidth() {
  if (previewMode()) return null;
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '{}');
    return typeof saved?.listWidth === 'number' && Number.isFinite(saved.listWidth) && saved.listWidth > 0 ? Math.round(saved.listWidth) : null;
  } catch { return null; }
}

function saveListWidth(width: number | null) {
  if (previewMode()) return;
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '{}');
    // Preserve any unfamiliar session data rather than replacing it.
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return;
    if (width === null) delete saved.listWidth; else saved.listWidth = width;
    if (Object.keys(saved).length) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(saved)); else sessionStorage.removeItem(STORAGE_KEY);
  } catch { /* A blocked session store must not prevent resizing. */ }
}

function initialLayoutSize() {
  const sidebar = parseFloat(getComputedStyle(document.querySelector('.desktop-app') ?? document.documentElement).getPropertyValue('--sidebar-width')) || 216;
  return { available: Math.max(0, window.innerWidth - sidebar - 10), viewport: window.innerWidth };
}

export default function App() { return <NavigationProvider><PlaybackProvider><DesktopApp /></PlaybackProvider></NavigationProvider>; }

function DesktopApp() {
  const { state, storageError } = useStore(); const { route, closeDetail, returnTarget, assistantSource, reliableFocusList, homeFocusList, openSearch, activeTabId } = useNav(); const playback = usePlayback();
  const [openMode] = useState<'full' | 'split'>('full');
  const [listOpen, setListOpen] = useState(false);
  const [propertiesOpen, setPropertiesOpen] = useState(() => { if (window.innerWidth < 1000) return false; if (previewMode()) return true; try { return localStorage.getItem('thesis-home-properties') !== 'closed'; } catch { return true; } });
  const listButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (route.page !== 'record' && route.page !== 'meeting') setListOpen(false); }, [route.page]);
  const [mobile,setMobile]=useState(()=>window.matchMedia('(max-width:1150px)').matches);
  const [mobileOpen,setMobileOpen]=useState(false);
  useEffect(()=>{const query=window.matchMedia('(max-width:1150px)');const sync=()=>setMobile(query.matches);query.addEventListener('change',sync);return()=>query.removeEventListener('change',sync);},[]);
  const shell = useRef<HTMLDivElement>(null);
  const [layoutSize, setLayoutSize] = useState(initialLayoutSize); const [preferredListWidth, setPreferredListWidth] = useState(readListWidth);
  useEffect(() => {
    const element = shell.current; if (!state.authenticated || !element) return;
    const measure = () => { const next = { available: element.clientWidth, viewport: window.innerWidth }; setLayoutSize(current => current.available === next.available && current.viewport === next.viewport ? current : next); };
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(element); window.addEventListener('resize', measure); measure();
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
  }, [state.authenticated]);
  // Three useful columns need room for the list, properties and reading area.
  // On crossing the narrow threshold, dismiss the list but retain properties.
  const previousAvailable = useRef(layoutSize.available);
  useEffect(() => {
    const wasWide = previousAvailable.current >= 1100;
    previousAvailable.current = layoutSize.available;
    if (!wasWide || layoutSize.available >= 1100 || !propertiesOpen || !listOpen) return;
    const focusWasInList = document.activeElement?.closest('.focus-record-list');
    setListOpen(false);
    if (focusWasInList) requestAnimationFrame(() => listButton.current?.focus({ preventScroll: true }));
  }, [layoutSize.available]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!state.authenticated || !(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k') return;
      // VINi dialogs use data-open rather than data-state="open". Do not
      // navigate away from any visible dialog and discard its in-progress input.
      const dialogOpen = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"], [role="alertdialog"], dialog[open]'))
        .some(dialog => dialog.getClientRects().length > 0 && getComputedStyle(dialog).visibility !== 'hidden');
      if (dialogOpen) { event.preventDefault(); return; }
      event.preventDefault(); openSearch();
    };
    window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler);
  }, [route, openSearch, state.authenticated]);
  if (!state.authenticated) return <><Suspense fallback={<PageLoading />}><LoginPage /></Suspense>{storageError && <div className="storage-alert"><Alert variant="destructive"><AlertDescription>Хранилище браузера недоступно. Изменения сохранятся только до закрытия страницы.</AlertDescription></Alert></div>}</>;
  // Keep the detail usable on desktop; at smaller sizes share the available space.
  const minimumDetailWidth = Math.min(500, Math.floor(layoutSize.available * .6));
  const maxListWidth = Math.max(0, Math.min(560, layoutSize.available - minimumDetailWidth));
  const minListWidth = Math.min(layoutSize.viewport <= 850 ? 205 : 230, maxListWidth);
  const listWidth = clamp(preferredListWidth ?? defaultListWidth(), minListWidth, maxListWidth);
  const resizeList = (width: number | null) => { const next = width === null ? null : Math.round(clamp(width, minListWidth, maxListWidth)); setPreferredListWidth(next); saveListWidth(next); };
  const activeRecordId = route.page === 'record' ? route.id : route.page === 'meeting' ? state.meetings.find(m => m.id === route.id)?.resultId : undefined;
  const currentRecord = state.records.find(r => r.id === activeRecordId && (!isOnServer(r) || canRead(state, r)));
  const playingRecord = state.records.find(r => r.id === playback.session.recordId && canRead(state, r));
  const dock = currentRecord ?? (playback.session.playing && route.page !== 'recorder' ? playingRecord : undefined);
  let content;
  switch (route.page) {
    case 'home': content = <MeetingHome />; break;
    case 'library': content = <Library key={scopeKey(route.scope)} scope={route.scope} />; break;
    case 'search': content = <Library key={`search:${scopeKey(route.scope)}`} scope={route.scope} searchMode />; break;
    case 'record': content = <RecordPage key={route.id} id={route.id} section={route.section} />; break;
    case 'assistant': content = <Assistant id={route.id} />; break;
    case 'recorder': content = <RecorderPage key={route.id} id={route.id} />; break;
    case 'meeting': content = <MeetingPage key={route.id} id={route.id} section={route.section} />; break;
    case 'workspaces': content = <WorkspacesPage />; break;
    case 'members': content = <MembersPage areaId={route.areaId} />; break;
    case 'folders': content = <FoldersPage key={route.areaId} areaId={route.areaId} />; break;
    case 'settings': content = <SettingsPage section={route.section} />; break;
  }
  const target = returnTarget();
  const listDetail = route.page === 'library' || route.page === 'search' || route.page === 'record' || route.page === 'meeting' && Boolean(currentRecord);
  const listScope = route.page === 'library' || route.page === 'search' ? route.scope : route.page === 'record' || route.page === 'meeting' ? route.listScope ?? { kind: 'all' as const } : { kind: 'all' as const };
  const listSearch = route.page === 'search' || (route.page === 'record' || route.page === 'meeting') && Boolean(route.listSearch);
  const belongsToList = currentRecord && filterRecords(state, listScope, DEFAULT_FILTERS).some(record => record.id === currentRecord.id);
  const changeProperties = (open: boolean) => {
    if (open && layoutSize.available < 1100 && listOpen) {
      const focusWasInList = document.activeElement?.closest('.focus-record-list');
      setListOpen(false);
      if (focusWasInList) requestAnimationFrame(() => listButton.current?.focus({ preventScroll: true }));
    }
    setPropertiesOpen(open);
  };
  const detail = route.page === 'record' ? <RecordPage key={route.id} id={route.id} section={route.section} propertiesOpen={propertiesOpen} onPropertiesChange={changeProperties} /> : route.page === 'meeting' && currentRecord ? <MeetingPage key={route.id} id={route.id} section={route.section} propertiesOpen={propertiesOpen} onPropertiesChange={changeProperties} /> : null;
  const mode = detail ? openMode : 'list';
  const focused = Boolean(detail);
  if (listDetail) content = <div className={`linear-view mode-${mode} is-dense`}>
    <div className={`list-detail-layout${focused ? ' focus-detail-layout' : ''}`}>
    {focused && <FocusRecordList open={listOpen} onClose={restoreFocus => { setListOpen(false); if (restoreFocus) requestAnimationFrame(() => listButton.current?.focus({ preventScroll: true })); }} />}
    <SecondaryPane id="records-pane" className="records-pane" label="Панель записей"><Library key={`${listSearch ? 'search:' : 'list:'}${scopeKey(listScope)}`} scope={listScope} searchMode={listSearch} /></SecondaryPane>
    <ListPaneDivider width={listWidth} min={minListWidth} max={maxListWidth} onResize={resizeList} />
    <section className="detail-pane" aria-label="Содержимое записи">
      {detail ? <>

        {listOpen && currentRecord && !belongsToList && <div className="detail-list-notice"><Alert role="status"><Icon alert name="info" size={17} /><AlertDescription>Открытая запись не входит в этот список.</AlertDescription></Alert></div>}
        <div className="meeting-materials"><div className="meeting-document"><Suspense fallback={<PageLoading />}>{detail}</Suspense></div></div>
      </> : <div className="detail-empty"><span><Icon name="file" size={29} /></span><h2>Выберите запись</h2><p>Резюме, транскрипция и диалог появятся здесь.</p></div>}
    </section>
  </div></div>;
  const settings=route.page==='settings';
  const workspace=<div className="workspace-main" role="region" aria-label="Рабочая область"><div key={activeTabId} className={`screen-area${dock ? ' has-player' : ''}`}><Suspense fallback={<PageLoading />}>{content}</Suspense></div></div>;
  const routeLabel=({home:'Главная',library:'Записи',search:'Поиск',record:'Запись',assistant:'Ассистент',recorder:'Диктофон',meeting:'Совещание',workspaces:'Пространства',members:'Участники',folders:'Папки',settings:'Настройки'} as const)[route.page];
  return <SidebarProvider className={`desktop-app granola-navigation dashboard-shell${settings?' settings-shell':''}${focused?' meeting-focus':''}${listDetail?` list-detail-app linear-navigation mode-${mode}`:''}${dock?' has-player':''}`} mobile={mobile} openMobile={mobileOpen} onOpenMobileChange={setMobileOpen} keyboardShortcut={false} toggleLabel="Переключить навигацию" mobileTitle="Навигация" mobileDescription="Разделы приложения и пространства" style={{'--records-width':`${listWidth}px`} as CSSProperties}>
    <UnifiedWindowToolbar focused={focused} listOpen={listOpen} listButton={listButton} onToggleList={() => setListOpen(value => !value)} onBack={closeDetail} showList={canShowFocusRecordList(state, route, assistantSource, target, reliableFocusList, homeFocusList)} />
    {!focused && <WindowNavigation />}
    <SidebarInset className="desktop-main content-shell dashboard-workspace" ref={shell} aria-label="Содержимое приложения">
      
      {workspace}
      {dock&&<PlayerDock record={dock} mini={!currentRecord}/>}
    </SidebarInset>
    {storageError&&<div className="storage-alert"><Alert variant="destructive"><Icon alert name="warning"/><AlertDescription>Не удалось сохранить изменения. Не закрывайте страницу: хранилище браузера недоступно.</AlertDescription></Alert></div>}
  </SidebarProvider>;
}

function ListPaneDivider({ width, min, max, onResize }: { width: number; min: number; max: number; onResize: (width: number | null) => void }) {
  const drag = useRef<{ pointerId: number; x: number; width: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    if (!dragging) return;
    document.body.classList.add('resizing-list-pane');
    return () => document.body.classList.remove('resizing-list-pane');
  }, [dragging]);
  const start = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !event.isPrimary || min === max) return;
    event.preventDefault(); event.currentTarget.focus({ preventScroll: true });
    drag.current = { pointerId: event.pointerId, x: event.clientX, width };
    event.currentTarget.setPointerCapture(event.pointerId); setDragging(true);
  };
  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId === event.pointerId) onResize(drag.current.width + event.clientX - drag.current.x);
  };
  const stop = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null; setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const key = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const next = event.key === 'ArrowLeft' ? width - 16 : event.key === 'ArrowRight' ? width + 16 : event.key === 'Home' ? min : event.key === 'End' ? max : null;
    if (next === null) return;
    event.preventDefault(); onResize(next);
  };
  return <>
    <span id="list-divider-hint" className="sr-only">Стрелки меняют ширину, Home и End устанавливают границы. Двойной щелчок восстанавливает ширину по умолчанию.</span>
    <TooltipProvider><Tooltip><TooltipTrigger render={<div className={`list-pane-divider${dragging ? ' is-dragging' : ''}`} role="separator" tabIndex={0} aria-label="Ширина списка записей" aria-describedby="list-divider-hint" aria-controls="records-pane" aria-orientation="vertical" aria-valuemin={min} aria-valuemax={max} aria-valuenow={width} aria-valuetext={`${width} пикселей`} aria-disabled={min === max || undefined} onPointerDown={start} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop} onKeyDown={key} onDoubleClick={() => onResize(null)} />}/><TooltipContent>Перетащите границу; двойной щелчок — сбросить ширину</TooltipContent></Tooltip></TooltipProvider>
  </>;
}

function WindowNavigation() {
  const { isMobile, openMobile, setOpenMobile } = useSidebar();
  const [container, setContainer] = useState<HTMLElement | null>(null);
  useEffect(() => { setContainer(document.querySelector<HTMLElement>('.desktop-app')); }, []);
  if (!isMobile) return <Sidebar />;
  return <Sheet open={openMobile} onOpenChange={setOpenMobile}>
    {container && <SheetContent side="left" showCloseButton={false} className="window-navigation-sheet" portalProps={{container}} overlayProps={{className:'window-navigation-overlay'}} viewportProps={{className:'window-navigation-viewport'}}>
      <div className="sr-only"><SheetTitle>Навигация</SheetTitle><SheetDescription>Разделы приложения и пространства</SheetDescription></div>
      <Sidebar />
    </SheetContent>}
  </Sheet>;
}

function Sidebar() {
  const { state } = useStore(); const { route, go, openList, listContext, returnTarget, assistantSource } = useNav();
  const previousAppRoute = useRef<Route>({page:'home'});
  const {isMobile:mobile,setOpenMobile}=useSidebar();
  const navigate=(action:()=>void)=>{action();setOpenMobile(false);};
  useEffect(() => { if (route.page !== 'settings') previousAppRoute.current = route; }, [route]);
  const contextualRecord = route.page === 'record' || route.page === 'meeting' || route.page === 'recorder';
  const target = returnTarget(); const sourceFromAssistant = contextualRecord && assistantSource && target.page === 'assistant';
  const area = sourceFromAssistant && target.page==='assistant' && target.listScope ? target.listScope.areaId : route.page === 'assistant' && route.listScope ? route.listScope.areaId : route.page === 'members' || route.page === 'folders' ? route.areaId : !sourceFromAssistant && (isListPage(route) || contextualRecord) && listContext?.kind !== 'all' ? listContext?.areaId : undefined;
  const assistantActive = route.page === 'assistant' && !route.listScope || sourceFromAssistant && !(target.page==='assistant'&&target.listScope);
  const allActive = !assistantActive && (isListPage(route) || contextualRecord) && (!listContext || listContext.kind === 'all');
  const connected = Boolean(state.server) && state.settings.network !== 'offline';
  if (route.page === 'settings') return <SettingsSidebar onBack={() => go(previousAppRoute.current)} compact={mobile} />;
  return <VSidebar variant="inset" collapsible={mobile ? 'none' : 'offcanvas'} className="atlas-sidebar" aria-label="Главная навигация">
      <BrandHeader/>
      <SidebarContent><nav aria-label="Основная навигация"><SidebarGroup><SidebarMenu>
        <SidebarMenuItem><SidebarMenuButton isActive={route.page==='home'} aria-label="Главная" aria-current={route.page==='home'?'page':undefined} onClick={()=>navigate(()=>go({page:'home'}))}><Icon name="home" size={16}/><span>Главная</span></SidebarMenuButton></SidebarMenuItem>
        <SidebarMenuItem><SidebarMenuButton isActive={allActive} aria-label="Все записи" aria-current={allActive?'page':undefined} onClick={()=>navigate(()=>openList({kind:'all'}))}><Icon name="list" size={16}/><span>Все записи</span></SidebarMenuButton><SidebarMenuBadge>{visibleRecords(state).length+state.drafts.length+state.meetings.filter(m=>m.server===state.server?.address&&!['completed','cancelled'].includes(m.stage)).length}</SidebarMenuBadge></SidebarMenuItem>
        <SidebarMenuItem><SidebarMenuButton isActive={assistantActive} aria-label="Ассистент" aria-current={assistantActive?'page':undefined} onClick={()=>navigate(()=>go({page:'assistant',listScope:null}))}><Icon name="chat" size={16}/><span>Ассистент</span></SidebarMenuButton></SidebarMenuItem>
      </SidebarMenu></SidebarGroup></nav>
      <SidebarGroup><SidebarGroupLabel>Пространства</SidebarGroupLabel><SpaceNavigation activeArea={area}/></SidebarGroup>
      </SidebarContent>
      <SidebarFooter><SidebarMenu><SidebarMenuItem><SidebarMenuButton aria-label="Настройки" onClick={()=>navigate(()=>go({page:'settings'}))}><Icon name="settings" size={16}/><span>Настройки</span></SidebarMenuButton></SidebarMenuItem></SidebarMenu></SidebarFooter>
    </VSidebar>;
}
function isListPage(route: Route) { return route.page === 'library' || route.page === 'search'; }

function HistoryButton({ label, icon, available, onClick }: { label: string; icon: 'arrowLeft' | 'arrowRight'; available: boolean; onClick: () => void }) {
  const button = <VButton type="button" size="400" variant="text" aria-label={label} aria-hidden={!available || undefined} tabIndex={available ? undefined : -1} startIcon={<Icon name={icon} size={16}/>} disabled={!available} onClick={onClick} style={available ? undefined : {pointerEvents: 'none'}}/>;
  return <Tooltip><TooltipTrigger render={available ? button : <span role="button" tabIndex={0} aria-label={label} aria-disabled="true" style={{display: 'inline-flex'}}>{button}</span>}/><TooltipContent>{label}</TooltipContent></Tooltip>;
}

function UnifiedWindowToolbar({ focused, listOpen, listButton, onToggleList, onBack, showList }: { focused: boolean; listOpen: boolean; listButton: RefObject<HTMLButtonElement>; onToggleList: () => void; onBack: () => void; showList: boolean }) {
  const { canGoBack, canGoForward, historyBack, historyForward } = useNav();
  const [framed, setFramed] = useState(true);
  useEffect(() => {
    const onMessage = (event: MessageEvent) => { if (event.source === window.parent && event.origin === location.origin && event.data?.type === 'thesis-preview-frame') setFramed(Boolean(event.data.framed)); };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);
  return <SidebarInsetHeader className="dashboard-topbar unified-window-toolbar" aria-label={focused ? 'Управление записью' : 'Навигация окна'}>
    {framed && <span className="preview-traffic" aria-hidden="true"><i/><i/><i/></span>}
    {focused ? <>
      <div className="focus-record-controls">
      <VButton size="400" variant="text" startIcon={<Icon name="arrowLeft" size={16}/>} onClick={onBack}>Назад</VButton>
      {showList && <VToggle ref={listButton} size="sm" pressed={listOpen} onPressedChange={onToggleList} aria-expanded={listOpen} aria-controls="focus-record-list"><Icon name="list" size={16}/>Записи</VToggle>}
      </div>
      <div className="focus-record-actions">
      <div id="focus-record-actions-slot" />
      </div>
    </> : <>
      <div className="window-navigation-controls"><SidebarTrigger size="400" aria-label="Переключить навигацию"/><TooltipProvider><HistoryButton label="Назад по истории" icon="arrowLeft" available={canGoBack} onClick={historyBack}/><HistoryButton label="Вперёд по истории" icon="arrowRight" available={canGoForward} onClick={historyForward}/></TooltipProvider></div>
      <div className="page-navigation-fallback"><PageNavigation/></div><div id="page-toolbar-slot"/>
    </>}
  </SidebarInsetHeader>;
}
