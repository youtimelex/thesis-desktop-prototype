import { Button as VButton, Text as VText, Slider, Collapsible, CollapsibleTrigger, CollapsibleContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@vini-ds/ui';
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type SetStateAction } from 'react';
import { formatTime } from './model.ts';
import { useNav } from './navigation.tsx';
import { useStore } from './store.tsx';
import { Icon, IconButton, Menu, MenuLabel } from './ui.tsx';
import type { Recording } from './types.ts';

type Session = { recordId: string | null; position: number; duration: number; rate: number; playing: boolean };
type RememberedPlayback = { position: number; rate: number };
type PlayerState = { session: Session; recordKey: string | null; remembered: Record<string, RememberedPlayback> };
const emptySession = (): Session => ({ recordId: null, position: 0, duration: 0, playing: false, rate: 1 });
const playbackKey = (record: Pick<Recording, 'id' | 'server'>) => JSON.stringify([record.server, record.id]);
type Playback = { videoRequest: {recordId:string; key:number} | null; showVideo:(recordId:string)=>void; session: Session; select: (r: Recording) => void; toggle: () => void; seek: (position: number, play?: boolean) => void; rate: (value: number) => void; pause: () => void };
const Context = createContext<Playback | null>(null);
export function usePlayback() { const c = useContext(Context); if (!c) throw new Error('Playback provider is missing'); return c; }
export function PlaybackProvider({ children }: { children: ReactNode }) {
  const { state } = useStore();
  const [videoRequest,setVideoRequest]=useState<{recordId:string;key:number}|null>(null);
  const [player, setPlayer] = useState<PlayerState>(() => ({ session: emptySession(), recordKey: null, remembered: {} }));
  const { session } = player;
  const setSession = (action: SetStateAction<Session>) => setPlayer(current => ({ ...current, session: typeof action === 'function' ? action(current.session) : action }));
  useEffect(() => {
    if (!session.playing) return;
    const recordKey = player.recordKey;
    const timer = setInterval(() => setPlayer(current => {
      const s = current.session;
      if (!s.playing || current.recordKey !== recordKey) return current;
      const position = Math.min(s.duration, s.position + s.rate / 4);
      return { ...current, session: { ...s, position, playing: position < s.duration } };
    }), 250);
    return () => clearInterval(timer);
  }, [session.playing, player.recordKey]);
  useEffect(() => {
    const available = new Set(state.authenticated ? state.records.filter(r => r.server === state.server?.address).map(playbackKey) : []);
    setPlayer(current => {
      const remembered = Object.fromEntries(Object.entries(current.remembered).filter(([key]) => available.has(key)));
      const activeUnavailable = current.recordKey !== null && !available.has(current.recordKey);
      if (!activeUnavailable && Object.keys(remembered).length === Object.keys(current.remembered).length) return current;
      return { session: activeUnavailable ? emptySession() : current.session, recordKey: activeUnavailable ? null : current.recordKey, remembered };
    });
  }, [state.authenticated, state.server?.address, state.records]);
  const select = (record: Recording) => setPlayer(current => {
    const key = playbackKey(record);
    if (current.recordKey === key) return current;
    const remembered = { ...current.remembered };
    if (current.recordKey) remembered[current.recordKey] = { position: current.session.position, rate: current.session.rate };
    const saved = remembered[key];
    const duration = record.duration ?? 0;
    return { recordKey: key, remembered, session: { recordId: record.id, position: Math.min(duration, saved?.position ?? 0), duration, rate: saved?.rate ?? 1, playing: false } };
  });
  return <Context.Provider value={{ videoRequest, showVideo:recordId=>setVideoRequest({recordId,key:Date.now()}), session, select, toggle: () => setSession(s => s.duration ? { ...s, position: s.position >= s.duration ? 0 : s.position, playing: !s.playing } : s), seek: (position, play) => setSession(s => ({ ...s, position: Math.min(s.duration, Math.max(0, position)), playing: play ?? s.playing })), rate: rate => setSession(s => ({ ...s, rate })), pause: () => setSession(s => ({ ...s, playing: false })) }}>{children}</Context.Provider>;
}
export function Signal({ paused = false, progress, large = false }: { paused?: boolean; progress?: number; large?: boolean }) { return <div className={`signal${large ? ' signal--large' : ''}${paused ? ' is-paused' : ''}`} aria-hidden="true">{Array.from({ length: large ? 74 : 100 }, (_, i) => <span key={i} style={{ '--bar-height': `${16 + Math.abs(Math.sin(i * 1.9) * Math.cos(i * .47)) * 84}%`, '--bar-delay': `${(i % 9) * -.19}s`, ...(progress !== undefined ? { backgroundColor: i < progress ? 'var(--acc-foreground-secondary)' : 'var(--main-border-strong)' } : {}) } as CSSProperties} />)}</div>; }
function SeekButton({ label, icon, disabled, onClick }: { label: string; icon: string; disabled: boolean; onClick: () => void }) {
  const button = <VButton size="500" variant="text" startIcon={<span className="material-symbols-rounded" aria-hidden="true">{icon}</span>} aria-label={label} onClick={onClick} disabled={disabled} {...(disabled ? { 'aria-hidden': true, tabIndex: -1, style: { pointerEvents: 'none' as const } } : {})} />;
  return <Tooltip>
    {disabled
      ? <TooltipTrigger render={triggerProps => <span {...triggerProps} role="button" aria-disabled="true" tabIndex={0} aria-label={label} style={{ display: 'inline-flex', flexShrink: 0 }}>{button}</span>} />
      : <TooltipTrigger render={button} />}
    <TooltipContent>{label}</TooltipContent>
  </Tooltip>;
}
export function PlayerDock({ record, mini = false }: { record: Recording; mini?: boolean }) {
  const dockRef = useRef<HTMLElement>(null);
  // Reserve the real dock height: responsive transport and mini metadata vary.
  useLayoutEffect(() => {
    const dock = dockRef.current; const shell = dock?.closest<HTMLElement>('.desktop-app.dashboard-shell');
    if (!dock || !shell) return;
    const previous = shell.style.getPropertyValue('--player-height');
    let lastHeight = 0;
    const measure = () => { const height = Math.ceil(dock.getBoundingClientRect().height); if (height > 0 && height !== lastHeight) { lastHeight = height; shell.style.setProperty('--player-height', `${height}px`); } };
    measure(); const observer = new ResizeObserver(measure); observer.observe(dock);
    return () => { observer.disconnect(); if (previous) shell.style.setProperty('--player-height', previous); else shell.style.removeProperty('--player-height'); };
  }, []);
  const { session, toggle, seek, rate } = usePlayback();
  const { go } = useNav();
  return <><footer ref={dockRef} className={`player-dock${mini ? ' player-dock--mini' : ''}`} aria-label="Плеер записи" data-testid="player-dock">

    <div className="player-transport"><TooltipProvider><SeekButton label="Назад на 30 секунд" icon="replay_30" disabled={!session.duration} onClick={() => seek(session.position - 30)} /><VButton size="500" variant="primary" color="main" startIcon={<Icon name={session.playing ? 'pause' : 'play'} weight="fill"/>} aria-label={session.playing ? 'Поставить на паузу' : 'Воспроизвести запись'} onClick={toggle} disabled={!session.duration}/><SeekButton label="Вперёд на 30 секунд" icon="forward_30" disabled={!session.duration} onClick={() => seek(session.position + 30)} /></TooltipProvider></div>
    <div className="player-center">{mini&&(<button className="player-identity" onClick={() => go({ page: 'record', id: record.id, section: 'summary' })}><span className="player-source"><Icon name={record.source === 'conference' ? 'conference' : 'waveform'} size={23} /></span><span><strong className="vini-text-desktop-caption-regular-400">{record.title}</strong><small className="vini-text-desktop-caption-regular-400">{record.source === 'conference' ? 'Видеозапись встречи' : 'Аудиозапись'}</small></span></button>)} <div className="player-timeline"><span>{formatTime(session.position)}</span><div className="player-progress"><Slider min={0} max={session.duration || 1} step={0.1} value={[session.position]} disabled={!session.duration} aria-label="Позиция воспроизведения" getAriaValueText={() => `${formatTime(session.position)} из ${formatTime(session.duration)}`} onValueChange={value => seek(value[0])} /></div><span>{session.duration ? formatTime(session.duration) : '—:—'}</span></div></div>
    <div className="player-options"><Menu label="Скорость воспроизведения" trigger={<VButton size="400" variant="text" aria-label={`Скорость воспроизведения ${session.rate}×`} endIcon={<Icon name="down" size={12}/>}>{String(session.rate).replace('.', ',')}×</VButton>}><MenuLabel>Скорость</MenuLabel><DropdownMenuRadioGroup aria-label="Скорость воспроизведения" value={session.rate} onValueChange={(value: number) => rate(value)}>{[.75, 1, 1.25, 1.5, 2].map(value => <DropdownMenuRadioItem key={value} value={value} closeOnClick>{String(value).replace('.', ',')}×</DropdownMenuRadioItem>)}</DropdownMenuRadioGroup></Menu>{record.source !== 'conference' && <Icon name="waveform" size={20} />}</div>
  </footer></>;
}
/** No meeting media source exists in the fixture: never substitute unrelated footage. */
export function RecordVideo({record,open,onOpenChange}:{record:Recording;open:boolean;onOpenChange:(open:boolean)=>void}) {
 const {session,toggle,seek}=usePlayback();
 if(record.source !== 'conference') return null;
 return <Collapsible className="record-video" open={open} onOpenChange={onOpenChange} aria-label="Видео записи">
 <CollapsibleTrigger render={<VButton size="400" variant="text" className="record-video-heading property-heading" endIcon={<Icon name={open?'up':'down'} size={14}/>} aria-label={open?'Свернуть видео':'Развернуть видео'}/>}><VText as="span" token="desktop/control/medium/400">Видео</VText></CollapsibleTrigger>
 <CollapsibleContent><div className="record-video-unavailable"><Icon name="conference" size={30}/><strong className="vini-text-desktop-caption-medium-400">Видеофайл не подключён</strong><span className="vini-text-desktop-caption-regular-400">Прототип · демонстрация управления без изображения и звука</span></div>
 <div className="record-video-controls"><VButton className="video-play-toggle" size="400" variant="secondary" startIcon={<Icon name={session.playing?'pause':'play'}/>} aria-label={session.playing?'Приостановить видео':'Запустить видео'} disabled={!session.duration} onClick={toggle}/><div className="video-progress-track"><Slider aria-label="Позиция видео" min={0} max={session.duration || 1} step={0.1} value={[session.position]} disabled={!session.duration} onValueChange={value=>seek(value[0])}/></div><span className="video-time vini-text-desktop-caption-regular-400" aria-label="Время видео">{formatTime(session.position)} / {formatTime(session.duration)}</span></div>
 </CollapsibleContent></Collapsible>;
}
