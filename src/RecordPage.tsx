import { RecordExport } from './RecordExport.tsx';
import './record-properties.css';
import './record-context-header.css';
import { Badge, ItemMedia, Card, CardContent, InputGroup, InputGroupInput, InputGroupAddon, InputGroupButton, Kbd, KbdGroup, Button as VButton, Text as VText, Skeleton, Loader, Alert, AlertDescription, AlertAction, Collapsible, CollapsibleTrigger, CollapsibleContent, TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@vini-ds/ui';
import { RecordBreadcrumbs, type RecordBreadcrumbLevel } from './RecordBreadcrumbs.tsx';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@vini-ds/ui';
import { Input, Textarea } from '@vini-ds/ui';
import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { areaAvailable, areaName, canEditTranscript, canRead, dateLabel, findTranscriptMatches, formatDuration, formatTime, isCreatedWorkspace, isOnServer, isStale, materialPresentation, pluralSpeakers, pluralUtterances, retryPresentation, segmentAtTime, SOURCE_NAMES, statusPresentation, transcriptEditReason, versionNotice } from './model.ts';
import { useNav } from './navigation.tsx';
import { RecordVideo, usePlayback } from './playback.tsx';
import { RecordMenu } from './record-actions.tsx';
import { useStore } from './store.tsx';
import { Avatar, Button, Empty, Icon, IconButton, Markdown, Modal, Select } from './ui.tsx';
import type { ListScope, Recording, RecordSection, Route, Segment } from './types.ts';

const RecordAssistant = lazy(() => import('./Assistant.tsx').then(m => ({ default: m.RecordAssistant })));

export default function RecordPage({ id, section, propertiesOpen, onPropertiesChange }: { id: string; section: RecordSection; propertiesOpen?: boolean; onPropertiesChange?: (open: boolean) => void }) {
  const { state, dispatch, notify } = useStore(); const { route, go, openList, closeDetail, closeRecord, recordView, saveRecordView, returnTarget } = useNav();
  const playback = usePlayback();
  const [toolbarTarget, setToolbarTarget] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => { setToolbarTarget(document.getElementById('focus-record-actions-slot')); }, []);
  const preview = new URLSearchParams(window.location.search).get('preview') === '1';
  const [localProperties, setLocalProperties] = useState(() => {if (window.innerWidth < 1000) return false; if (preview) return true; try{return localStorage.getItem('thesis-home-properties') !== 'closed';}catch{return true;}});
  const [narrow, setNarrow] = useState(() => window.innerWidth < 1000);
  const [videoOpen,setVideoOpen] = useState(true);
  useEffect(()=>setVideoOpen(true),[id]);
  const propertiesTrigger = useRef<HTMLButtonElement>(null);
  useEffect(() => { const update = () => setNarrow(window.innerWidth < 1000); window.addEventListener('resize',update); return () => window.removeEventListener('resize',update); }, []);
  const propertiesVisible = propertiesOpen ?? localProperties;
  const setProperties = (open: boolean) => { if (onPropertiesChange) onPropertiesChange(open); else setLocalProperties(open); };
  function toggleProperties() {
    const next = !propertiesVisible;
    if (!preview && !narrow) try{localStorage.setItem('thesis-home-properties',next?'open':'closed');}catch{}
    setProperties(next);
  }

  useEffect(()=>{if(playback.videoRequest?.recordId !== id)return;setVideoOpen(true);setProperties(true);if (!narrow && !preview) try{localStorage.setItem('thesis-home-properties','open');}catch{}},[playback.videoRequest,id,narrow,preview]);
  const record = state.records.find(r => r.id === id);
  const initialView = useRef(recordView(id));
  const scroll = useRef<HTMLDivElement>(null); const positions = useRef({ ...initialView.current.positions, assistant: initialView.current.positions.assistant ?? 0 });
  const [query, setQuery] = useState(initialView.current.query); const [findOpen, setFindOpen] = useState(initialView.current.findOpen); const [matchIndex, setMatchIndex] = useState(initialView.current.matchIndex); const [speaker, setSpeaker] = useState(initialView.current.speaker);
  const [editing, setEditing] = useState<string | null>(initialView.current.edit?.segmentId ?? null); const [editText, setEditText] = useState(initialView.current.edit?.text ?? ''); const [improve, setImprove] = useState(false);
  const editOriginal = useRef(initialView.current.edit?.original ?? '');
  const [shareOpen, setShareOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false); const [exportMaterial,setExportMaterial] = useState<'summary'|'transcript'>('summary');
  const [copyFallback, setCopyFallback] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null); 
  const findPanelRef = useRef<HTMLDivElement>(null); const searchStartScroll = useRef<number | null>(initialView.current.searchStartScroll);
  const tabsRef = useRef<HTMLDivElement>(null);
  const findKey = JSON.stringify([findOpen, query, speaker, matchIndex]); const previousFindKey = useRef(findKey);
  const segments = useMemo(() => (record?.transcript ?? []).filter(s => speaker === 'all' || s.speaker === speaker), [record?.transcript, speaker]);
  const matches = useMemo(() => findTranscriptMatches(segments, query), [segments, query]);
  const index = Math.min(matchIndex, Math.max(0, matches.length - 1)); const current = matches[index];
  useLayoutEffect(() => { if (record) playback.select(record); }, [id]);
  useLayoutEffect(() => { if (scroll.current) scroll.current.scrollTop = positions.current[section]; }, [section]);
  useLayoutEffect(() => { saveRecordView(id, { positions: { ...positions.current }, findOpen, query, matchIndex, speaker, searchStartScroll: searchStartScroll.current }); }, [id, findOpen, query, matchIndex, speaker]);
  useLayoutEffect(() => { saveRecordView(id, { section, edit: editing ? { segmentId: editing, text: editText, original: editOriginal.current } : null }); }, [id, section, editing, editText]);
  useLayoutEffect(() => {
    if (previousFindKey.current === findKey) return;
    previousFindKey.current = findKey;
    if (!findOpen || !query || section !== 'transcript' || !current || !scroll.current) return;
    const element = scroll.current.querySelector<HTMLElement>('[data-current-match="true"]'); if (!element) return;
    const viewport = scroll.current.getBoundingClientRect(); const bounds = element.getBoundingClientRect();
    const panel = findPanelRef.current; const panelBottom = panel?.getBoundingClientRect().bottom ?? viewport.top;
    const readableTop = Math.max(viewport.top + (panel?.offsetHeight ?? 0), panelBottom) + 16;
    if (bounds.top < readableTop || bounds.bottom > viewport.bottom - 28) {
      const segment = element.closest<HTMLElement>('.transcript-segment');
      const contextTop = Math.max(segment?.getBoundingClientRect().top ?? bounds.top, bounds.top - 64);
      scroll.current.scrollTop += contextTop - (viewport.top + (panel?.offsetHeight ?? 0) + 16);
    }
  }, [findKey, current?.segmentId, current?.start, section]);
  const openSearch = () => { if (!findOpen) searchStartScroll.current = scroll.current?.scrollTop ?? 0; setFindOpen(true); };
  const closeSearch = () => {
    setFindOpen(false); setQuery(''); setMatchIndex(0);
    const restore = searchStartScroll.current; searchStartScroll.current = null;
    requestAnimationFrame(() => { if (scroll.current && restore !== null) scroll.current.scrollTop = restore; searchRef.current?.focus({ preventScroll: true }); });
  };
  useEffect(() => { const handler = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f' && section === 'transcript') { e.preventDefault(); openSearch(); requestAnimationFrame(() => searchRef.current?.focus({ preventScroll: true })); } }; window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler); }, [section, findOpen]);
  if (!record || (isOnServer(record) && !canRead(state, record))) return <Empty title="Запись недоступна" description="Запись удалена или у вас больше нет к ней доступа. Проверьте подключение к серверу."><Button onClick={() => go({ page: 'library', scope: { kind: 'all' } })}>К записям</Button></Empty>;
  const status = statusPresentation(record, state.settings);
  const summaryView = materialPresentation(record, 'summary', state.settings); const transcriptView = materialPresentation(record, 'transcript', state.settings);
  const transcriptAvailable = transcriptView.available; const summaryAvailable = summaryView.available;
  const editable = canEditTranscript(state, record); const retry = retryPresentation(state, record);
  const folder = state.folders.find(f => f.id === record.folderId && f.server === record.server && f.areaId === record.areaId);
  const onServer = isOnServer(record);
  const placeName = record.areaId ? areaName(record.areaId, state) : 'Без пространства';
  const placeAvailable = Boolean(record.areaId && areaAvailable(state, record.areaId));
  const accessLabel = !onServer ? 'Пока доступно только вам' : record.areaId === 'personal' ? 'Доступно только вам' : isCreatedWorkspace(state, record.areaId) ? 'Доступ определяется правами пространства' : record.areaId ? 'Доступно участникам пространства' : 'Доступ по корпоративным правам';
  const speakers = [...new Set(record.transcript.map(s => s.speaker))];
  const previous = returnTarget();
  // The collection is the record's source context, even after another record or a direct link.
  const origin: Route = previous.page === 'home' || previous.page === 'assistant' ? previous : route.page === 'record' || route.page === 'meeting' ? { page: route.listSearch ? 'search' : 'library', scope: route.listScope ?? { kind: 'all' } } : previous;
  const originIsPlacement = origin.page === 'library' && (origin.scope.kind === 'area' && origin.scope.areaId === record.areaId || origin.scope.kind === 'folder' && origin.scope.folderId === folder?.id);
  const returnToOrigin = () => {if(origin.page === 'library' || origin.page === 'search') go(origin); else closeDetail();};
  const folderTarget: ListScope | undefined = folder && record.server === state.server?.address ? {kind:'folder',areaId:record.areaId ?? 'legacy',folderId:folder.id} : undefined;
  const breadcrumbLevels: RecordBreadcrumbLevel[] = [];
  if (placeAvailable && record.server === state.server?.address) breadcrumbLevels.push({ label: placeName, title: `Пространство: ${placeName}`, currentOrigin: originIsPlacement && origin.page === 'library' && origin.scope.kind === 'area', onSelect: () => { if (originIsPlacement && origin.page === 'library' && origin.scope.kind === 'area') returnToOrigin(); else openList({kind:'area',areaId:record.areaId!}); } });
  if (folderTarget && folder) breadcrumbLevels.push({ label: folder.name, title: `Папка: ${folder.name}`, currentOrigin: originIsPlacement && origin.page === 'library' && origin.scope.kind === 'folder', onSelect: () => { if (originIsPlacement && origin.page === 'library' && origin.scope.kind === 'folder') returnToOrigin(); else openList(folderTarget); } });
  else if (record.folderId) breadcrumbLevels.push({ label: 'Папка недоступна', title: 'Папка недоступна' });
  const currentSegment = segmentAtTime(record.transcript, playback.session.position);
  const partial = transcriptAvailable && ['processing', 'processing-error'].includes(record.status) && record.processing?.phase === 'transcription' && !record.operation;
  const goSection = (next: RecordSection) => route.page === 'meeting' || route.page === 'record' ? go({ ...route, section: next }) : go({ page: 'record', id, section: next });
  const shareText = [record.title, isStale(record) ? 'Резюме не обновлено после изменения транскрипции.' : versionNotice(record, 'summary'), record.summary].filter(Boolean).join('\n\n');
  const copy = async () => {
    if (!summaryAvailable || record.canExport === false) return;
    try { await navigator.clipboard.writeText(shareText); notify('Итоги скопированы'); } catch { if(shareOpen) { notify('Выделите и скопируйте текст вручную: буфер обмена недоступен.'); } else setCopyFallback(shareText); }
  };
  const share = async () => {
    if (!summaryAvailable || record.canExport === false) return;
    // This prototype has no server-issued share link. Share the available text,
    // never the localhost address, which cannot grant access to the recording.
    if (typeof navigator.share !== 'function') { setShareOpen(true); return; }
    try { await navigator.share({ title: record.title, text: shareText }); }
    catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      setShareOpen(true);
    }
  };
  const highlight = (segment: Segment) => {
    const result = []; let from = 0;
    for (const match of matches.filter(m => m.segmentId === segment.id)) { result.push(segment.text.slice(from, match.start)); const active = match === current; result.push(<mark key={match.start} className={active ? 'is-current' : ''} data-current-match={active ? 'true' : undefined} aria-current={active ? 'true' : undefined}>{segment.text.slice(match.start, match.end)}</mark>); from = match.end; }
    result.push(segment.text.slice(from)); return result;
  };
  const saveEdit = () => { if (!editable || !editing || !editText.trim()) return; dispatch({ type: 'edit-transcript', id, segmentId: editing, text: editText, now: Date.now() }); setEditing(null); notify('Правка сохранена. Резюме можно пересоздать в «Действиях».'); };
  const propertiesContent = <div className="record-properties-content">{record.source === "conference" && <Card size="sm" className="property-surface"><CardContent><RecordVideo record={record} open={videoOpen} onOpenChange={setVideoOpen}/></CardContent></Card>}<Card size="sm" className="property-surface"><CardContent><Collapsible defaultOpen><CollapsibleTrigger render={<VButton size="400" variant="text" className="property-heading" endIcon={<Icon name="down" size={14}/>} />}><VText as="span" token="desktop/control/medium/400">Участники</VText></CollapsibleTrigger><CollapsibleContent>{speakers.length ? <ul>{speakers.map(name=><li key={name}><Avatar name={name} size="normal"/><span>{name}</span></li>)}</ul> : <p>Участники появятся после распознавания речи.</p>}</CollapsibleContent></Collapsible></CardContent></Card><Card size="sm" className="property-surface"><CardContent><RecordDetails record={record} speakers={speakers} showSpeakers={transcriptAvailable} accessLabel={accessLabel}/></CardContent></Card></div>;
  const shareDisabled = !summaryAvailable || record.canExport === false;
  const shareButton = <VButton size="400" variant="text" startIcon={<Icon name="share"/>} aria-label="Поделиться" onClick={()=>{void share();}} disabled={shareDisabled} style={shareDisabled ? {pointerEvents: "none"} : undefined}/>;
  const recordActions = <><RecordMenu record={record} onVideo={()=>playback.showVideo(record.id)} trigger={<IconButton icon="more" label="Действия" />} onDelete={() => closeRecord(id)} /><TooltipProvider><Tooltip>{shareDisabled ? <TooltipTrigger render={(triggerProps) => <span {...triggerProps} role="group" tabIndex={0} aria-disabled="true" aria-label="Поделиться" style={{display: "inline-flex"}}>{shareButton}</span>} /> : <TooltipTrigger render={shareButton} />}<TooltipContent>Поделиться</TooltipContent></Tooltip></TooltipProvider></>;
  return <Tabs className={`record-workspace linear-card${toolbarTarget ? ' has-window-actions' : ''}${propertiesVisible && !narrow ? " with-properties" : ""}`} value={section === "details" ? "summary" : section} onValueChange={value => {if(value === "summary" || value === "transcript" || value === "assistant") goSection(value);}}>
    {toolbarTarget ? createPortal(recordActions, toolbarTarget) : <div className="detail-toolbar record-context-header"><RecordBreadcrumbs title={record.title} levels={breadcrumbLevels} onAllRecords={() => openList({kind:'all'})}/><div className="detail-toolbar-actions">{recordActions}</div></div>}
      <div className="record-local-toolbar" ref={tabsRef}><TabsList variant="default" className="vini-material-tabs" aria-label="Материалы записи">{([
        { id: 'summary' as const, name: 'Обзор', icon: 'file' as const, label: summaryView.label, tone: summaryView.tone },
        { id: 'transcript' as const, name: 'Транскрипция', icon: 'waveform' as const, label: transcriptView.label, tone: transcriptView.tone },
        { id: 'assistant' as const, name: 'Ассистент', icon: 'chat' as const, label: 'По этой записи', tone: 'neutral' },


      ]).map(tab => <TabsTrigger key={tab.id} value={tab.id} aria-label={`${tab.name}: ${tab.label}`}><span>{tab.name}</span></TabsTrigger>)}</TabsList><div className="record-toolbar-actions"><div id="record-dialog-toolbar-slot"/><TooltipProvider><Tooltip><TooltipTrigger render={<VButton ref={propertiesTrigger} size="500" variant={propertiesVisible ? 'secondary' : 'text'} startIcon={<Icon name="panel" weight={propertiesVisible ? 'fill' : 'regular'}/>} aria-label="Свойства записи" aria-pressed={propertiesVisible} aria-expanded={propertiesVisible} aria-controls="record-properties" onClick={toggleProperties} onKeyDown={event => { if (event.key === 'Escape' && propertiesVisible) { event.preventDefault(); event.stopPropagation(); setProperties(false); } }}/>} /><TooltipContent>{propertiesVisible ? 'Скрыть свойства записи' : 'Показать свойства записи'}</TooltipContent></Tooltip></TooltipProvider></div></div>
    <div className="page-scroll record-page" ref={scroll} onScroll={e => { positions.current[section] = e.currentTarget.scrollTop; saveRecordView(id, { positions: { ...positions.current } }); }} data-testid="record-page">
    <div className="page-inner record-inner">


      <div className="record-main">
        {section === 'summary' || section === 'details' ? <TabsContent value="summary" className="summary-card">      <header className="record-heading"><div>
        <div className="record-title-with-type"><TooltipProvider><Tooltip><TooltipTrigger render={<ItemMedia variant="icon" className="record-source-frame" role="img" aria-label={SOURCE_NAMES[record.source]}/>}><Icon name={record.source === "file" ? "upload" : record.source === "microphone" ? "waveform" : "conference"} size={26}/></TooltipTrigger><TooltipContent>{SOURCE_NAMES[record.source]}</TooltipContent></Tooltip></TooltipProvider><div className="record-title-copy"><h1><TooltipProvider><Tooltip><TooltipTrigger render={<span/>}>{record.title}</TooltipTrigger><TooltipContent>{record.title}</TooltipContent></Tooltip></TooltipProvider></h1><div className="record-meta"><span>{dateLabel(record.createdAt)}</span><i /><span>{formatDuration(record.duration)}</span></div></div></div><RecordTags record={record} showCounts={transcriptAvailable}/>

        </div>
      </header><div className="section-heading"><h2>Резюме</h2>{summaryAvailable && <div className="summary-actions"><IconButton icon="copy" label="Копировать итоги" disabled={record.canExport === false} onClick={() => { void copy(); }} /><IconButton icon="download" label="Экспорт резюме" onClick={()=>{setExportMaterial('summary');setExportOpen(true);}} disabled={!summaryAvailable || record.canExport === false}/></div>}</div>
          {section === 'summary' && retry && !summaryView.retry && <Alert role="status" variant={status.tone === 'danger' ? 'destructive' : 'default'}><Icon alert name={status.tone === 'danger' ? 'warning' : 'info'} size={16} /><AlertDescription>{status.label}</AlertDescription><AlertAction><RetryAction record={record} compact /></AlertAction></Alert>}
          {summaryView.notice && <Alert role="status" variant={summaryView.tone === "danger" ? "destructive" : "default"}><Icon alert name={summaryView.tone === 'danger' ? 'warning' : 'clock'} size={16} /><AlertDescription>{summaryView.notice}</AlertDescription>{summaryView.retry && <AlertAction><RetryAction record={record} compact /></AlertAction>}</Alert>}
          {isStale(record) && !record.operation && <Alert role="note"><Icon alert name="info" size={16}/><AlertDescription>Транскрипция изменена. Пересоздайте резюме в «Действиях».</AlertDescription></Alert>}
          {summaryAvailable ? <Markdown>{record.summary}</Markdown> : <PendingMaterial record={record} material="summary" />}
        </TabsContent> : section === 'transcript' ? <TabsContent value="transcript" className="transcript-card"><div className="transcript-sticky-header" ref={findPanelRef}><div className="section-heading"><h2>Транскрипция</h2>{transcriptAvailable&&<span className="transcript-speaker-count vini-text-desktop-caption-regular-400">{pluralSpeakers(speakers.length)}</span>}{transcriptAvailable&&<IconButton icon="download" label="Экспорт транскрипции" disabled={record.canExport===false} onClick={()=>{setExportMaterial('transcript');setExportOpen(true);}}/>}{transcriptAvailable && <IconButton icon="improve" label="Улучшить текст" title={transcriptEditReason(state,record) ?? "Улучшить текст"} disabled={!editable} onClick={()=>setImprove(true)}/>}</div>
          {transcriptView.notice && <Alert className="transcript-processing-alert" role="status" variant={transcriptView.tone === "danger" ? "destructive" : "default"}>{transcriptView.tone === 'accent' ? <span data-icon="alert" aria-hidden="true"><Loader size="20" aria-hidden="true"/></span> : <Icon alert name="warning" size={16}/>}<AlertDescription className="transcript-processing-description"><span>{transcriptView.notice}</span>{transcriptView.tone === 'accent' && record.processing?.progress !== undefined && <strong>{record.processing.progress}%</strong>}</AlertDescription>{transcriptView.retry && <AlertAction><RetryAction record={record} compact /></AlertAction>}</Alert>}
          {transcriptAvailable ? <><div className="transcript-find-panel" role="search" aria-label="Поиск в транскрипции"><div className="transcript-tools"><InputGroup className="transcript-search"><InputGroupAddon align="inline-start"><Icon name="search" size={18}/></InputGroupAddon><InputGroupInput data-vini-input="true" showStartIcon={false} showEndIcon={false} ref={searchRef} aria-label="Поиск в транскрипции" placeholder="Поиск в транскрипции" value={query} onFocus={openSearch} onChange={e=>{setQuery(e.target.value);setMatchIndex(0);setFindOpen(true);}} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();closeSearch();}if(e.key==='Enter'&&matches.length){e.preventDefault();setMatchIndex((index+(e.shiftKey?-1:1)+matches.length)%matches.length);}}}/><InputGroupAddon align="inline-end">{query ? <InputGroupButton iconOnly aria-label="Очистить поиск в транскрипции" onClick={()=>{setQuery('');setMatchIndex(0);searchRef.current?.focus();}}><Icon name="close" size={16}/></InputGroupButton> : <KbdGroup aria-label={/Mac|iPhone|iPad/.test(navigator.platform) ? 'Command + F' : 'Control + F'}><Kbd aria-hidden="true">{/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl'}</Kbd><Kbd aria-hidden="true">F</Kbd></KbdGroup>}</InputGroupAddon></InputGroup><Select label="Спикер" value={speaker} options={[{ value: 'all', label: 'Все спикеры' }, ...speakers.map(name => ({ value: name, label: name }))]} onChange={value => { setSpeaker(value); setMatchIndex(0); }} />
            {findOpen && <div className="find-navigation"><span className="vini-text-desktop-control-regular-400" role="status" aria-live="polite" aria-atomic="true" aria-label={query.trim() ? `${matches.length ? `Совпадение ${index + 1} из ${matches.length}` : 'Совпадений нет'}${partial ? ' по распознанной части' : ''}` : partial ? 'По распознанной части. Введите запрос' : 'Введите запрос'}>{query.trim() ? matches.length ? `${index + 1} из ${matches.length}` : 'Нет совпадений' : ''}{partial && <small>{query.trim() ? ' · по распознанной части' : 'По распознанной части'}</small>}</span><IconButton icon="up" label="Предыдущее совпадение" disabled={matches.length < 2} onPointerDown={e => e.preventDefault()} onClick={() => setMatchIndex((index - 1 + matches.length) % matches.length)} /><IconButton icon="down" label="Следующее совпадение" disabled={matches.length < 2} onPointerDown={e => e.preventDefault()} onClick={() => setMatchIndex((index + 1) % matches.length)} /></div>}
          </div></div>

          </> : null}</div>
          {transcriptAvailable ? <><div className="transcript-segments">{segments.map(segment => { const active = currentSegment?.id === segment.id; const playing = active && playback.session.playing; return <article key={segment.id} className={`transcript-segment${active ? ' is-active' : ''}`} data-testid={`segment-${segment.id}`}>
              <header><VButton size="400" variant={playing ? 'primary' : 'secondary'} color={playing ? 'accent' : 'main'} aria-label={active ? playing ? 'Приостановить реплику' : 'Продолжить реплику' : `Воспроизвести с ${formatTime(segment.start)}`} startIcon={<Icon name={playing ? 'pause' : 'play'} weight="fill" size={14} />} onClick={() => active ? playback.toggle() : playback.seek(segment.start, true)} /><strong className="vini-text-desktop-caption-medium-400">{segment.speaker}</strong><VButton size="400" variant="text" onClick={() => playback.seek(segment.start, true)}>{formatTime(segment.start)}</VButton>{active && <span className="segment-playing-label vini-text-desktop-control-regular-400">{playing ? 'Воспроизводится' : 'На паузе'}</span>}<IconButton icon="edit" label={`Редактировать реплику ${formatTime(segment.start)}`} className="segment-edit" disabled={!editable || Boolean(editing && editing !== segment.id)} onClick={() => { if (editing === segment.id) return; editOriginal.current = segment.text; setEditing(segment.id); setEditText(segment.text); }} /></header>
              {editing === segment.id ? <div className="segment-editor"><Textarea autoFocus aria-label="Текст реплики" rows={4} value={editText} onChange={e => setEditText(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') setEditing(null); if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') saveEdit(); }} /><div><Button small variant="ghost" onClick={() => setEditing(null)}>Отмена</Button><Button small variant="primary" disabled={!editable || !editText.trim()} onClick={saveEdit}>Сохранить</Button></div></div> : <p>{highlight(segment)}</p>}
            </article>; })}</div>
          </> : <PendingMaterial record={record} material="transcript" />}
        </TabsContent> : section === 'assistant' ? <TabsContent value="assistant" className="record-chat-card"><Suspense fallback={<div className="record-chat-placeholder" role="status">Загружаем диалог…</div>}><RecordAssistant recordId={id} /></Suspense></TabsContent> : null}
      </div>
    </div>
    </div>
    {propertiesVisible && <aside tabIndex={0} id="record-properties" className={`record-properties${narrow ? ' record-properties--overlay' : ''}`} aria-label="Свойства записи" onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setProperties(false); propertiesTrigger.current?.focus({ preventScroll: true }); } }}>{narrow && <header><h2>Свойства записи</h2><IconButton icon="close" label="Закрыть свойства записи" onClick={() => { setProperties(false); propertiesTrigger.current?.focus({ preventScroll: true }); }}/></header>}{propertiesContent}</aside>}
    <RecordExport record={record} material={exportMaterial} open={exportOpen} onClose={()=>setExportOpen(false)}/>
    <Modal open={shareOpen} onClose={()=>setShareOpen(false)} title="Поделиться резюме" description="Системная передача недоступна. Скопируйте резюме; ссылка на запись пока недоступна."><Textarea readOnly rows={8} aria-label="Резюме для передачи" value={shareText} onFocus={e=>e.target.select()}/><div className="modal-actions"><Button variant="ghost" onClick={()=>setShareOpen(false)}>Закрыть</Button><Button icon="copy" disabled={record.canExport === false || !summaryAvailable} onClick={()=>{void copy();}}>Копировать итоги</Button></div></Modal>
    <Modal open={improve} onClose={() => setImprove(false)} title="Улучшить текст" description="Привести пробелы и пунктуацию реплик к единому оформлению. Имена спикеров и таймкоды не изменятся."><p className="muted-copy">Резюме потребуется пересоздать, если текст изменится.</p><div className="modal-actions"><Button variant="ghost" onClick={() => setImprove(false)}>Отмена</Button><Button variant="primary" disabled={!editable} onClick={() => { let count = 0; for (const s of record.transcript) { const text = s.text.trim().replace(/\s+/g, ' ').replace(/\s+([,.;!?])/g, '$1'); if (text !== s.text) { count++; dispatch({ type: 'edit-transcript', id, segmentId: s.id, text, now: Date.now() }); } } setImprove(false); notify(count ? 'Оформление текста обновлено' : 'Текст уже оформлен'); }}>Применить</Button></div></Modal>
    <Modal open={copyFallback !== null} onClose={() => setCopyFallback(null)} title="Скопируйте итоги" description="Буфер обмена недоступен. Выделите и скопируйте текст вручную."><Textarea readOnly rows={10} aria-label="Итоги для копирования" value={copyFallback ?? ''} onFocus={e => e.target.select()} /><div className="modal-actions"><Button onClick={() => setCopyFallback(null)}>Готово</Button></div></Modal>
  </Tabs>;
}

function RetryAction({ record, compact = false }: { record: Recording; compact?: boolean }) {
  const { state, dispatch } = useStore();
  const retry = retryPresentation(state, record);
  if (!retry) return null;
  return <div className={`recovery-action${compact ? ' recovery-action--compact' : ''}`}>
    <Button variant={compact ? 'ghost' : 'secondary'} icon="rewind" disabled={Boolean(retry.reason)} aria-describedby={retry.reason ? `${record.id}-retry-reason` : undefined} onClick={() => dispatch({ type: 'retry-record', id: record.id })}>{retry.label}</Button>
    {retry.reason && <small id={`${record.id}-retry-reason`}>{retry.reason}</small>}
  </div>;
}
function PendingMaterial({ record, material }: { record: Recording; material: 'summary' | 'transcript' }) {
  const { state } = useStore();
  const view = materialPresentation(record, material, state.settings);
  return <div className={`pending-material pending-material--${view.tone}`}>
    <span className="pending-icon"><Icon name={view.tone === 'danger' ? 'warning' : record.noSpeech ? 'waveform' : view.tone === 'warning' ? 'clock' : 'file'} size={30} weight="light" /></span>
    <h3>{view.title}</h3><p>{view.description}</p>
    {view.retry ? <RetryAction record={record} /> : view.pending ? <div className="vini-material-skeleton" aria-hidden="true"><Skeleton/><Skeleton/><Skeleton/></div> : null}
  </div>;
}
function RecordDetails({ record, speakers, showSpeakers, accessLabel }: { record: Recording; speakers: string[]; showSpeakers: boolean; accessLabel: string }) {
  const facts = [['Источник', record.bridgeId ? 'Агент встречи' : SOURCE_NAMES[record.source]], ['Тип', record.source === 'conference' ? 'Видеоконференция' : 'Аудиозапись'], ['Длительность', formatDuration(record.duration)], ['Добавлено', dateLabel(record.createdAt)], ['Обновлено', dateLabel(record.updatedAt ?? record.createdAt)], ['Хранение', isOnServer(record) ? 'На сервере' : 'На устройстве · не отправлено'], ['Доступ', accessLabel], ['Сервер', record.server], ...(isOnServer(record) ? [['ID записи', record.id]] : []), ['Изменение и удаление', record.canManage === false ? 'Недоступны для вашей роли' : 'Доступны для вашей роли']];
  return <article className="details-card" aria-label="Сведения о записи"><Collapsible defaultOpen><CollapsibleTrigger render={<VButton size="400" variant="text" className="property-heading" endIcon={<Icon name="down" size={14}/>} />}><VText as="span" token="desktop/control/medium/400">Сведения о записи</VText></CollapsibleTrigger><CollapsibleContent><dl className="record-facts">{facts.map(([label, value]) => <div key={label}><dt className="vini-text-desktop-body-regular-400">{label}</dt><dd className="vini-text-desktop-body-regular-400">{value}</dd></div>)}</dl></CollapsibleContent></Collapsible></article>;
}

function RecordTags({record,showCounts}:{record:Recording;showCounts:boolean}) {
 const speakers=new Set(record.transcript.map(s=>s.speaker));
 return <div className="record-parameter-tags" aria-label="Параметры записи"><Badge variant="secondary" color="main">{SOURCE_NAMES[record.source]}</Badge>{showCounts&&<><Badge variant="secondary" color="main">Реплик: {record.transcript.length}</Badge><Badge variant="secondary" color="main">Спикеров: {speakers.size}</Badge></>}</div>;
}
