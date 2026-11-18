import { Alert, AlertDescription, Button as VButton, FieldGroup, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@vini-ds/ui';
import { Input } from '@vini-ds/ui';
import { useEffect, useId, useRef, useState, type DragEvent } from 'react';
import { areaAvailable, areaName, dateLabel, draftDestinationAvailable, formatTime, meetingDuration, meetingLabel, normalizeMeetingUrl, waitingReason } from './model.ts';
import { backLabel, useNav } from './navigation.tsx';
import { usePlayback, Signal } from './playback.tsx';
import RecordPage from './RecordPage.tsx';
import { useStore } from './store.tsx';
import { AreaPicker, Badge, Button, Confirm, Empty, Field, Icon, Modal, Select } from './ui.tsx';
import type { Recording, RecordSection } from './types.ts';
import './creation-fields.css';

export function ImportDialog({ open, onClose, initialArea }: { open: boolean; onClose: () => void; initialArea: string }) {
  const { state, dispatch, notify } = useStore();
  const [area, setArea] = useState(initialArea);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState<number | null>(null);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const readVersion = useRef(0);
  const fileErrorId = useId();
  useEffect(() => { if (open) { readVersion.current++; setArea(initialArea); setFile(null); setTitle(''); setError(''); setDuration(null); setReading(false); } }, [open, initialArea]);
  useEffect(() => {
    if (!file) return;
    let active = true;
    const version = readVersion.current;
    const url = URL.createObjectURL(file);
    const media = document.createElement(file.type.startsWith('video') ? 'video' : 'audio');
    setReading(true);
    const finish = (duration: number | null) => { if (!active || version !== readVersion.current) return; setDuration(duration); setReading(false); };
    const timeout = setTimeout(() => finish(null), 4000);
    media.preload = 'metadata'; media.onloadedmetadata = () => { clearTimeout(timeout); finish(Number.isFinite(media.duration) ? Math.round(media.duration) : null); }; media.onerror = () => { clearTimeout(timeout); finish(null); }; media.src = url;
    return () => { active = false; clearTimeout(timeout); media.removeAttribute('src'); media.load(); URL.revokeObjectURL(url); };
  }, [file]);
  const choose = (next?: File) => {
    if (!next) return;
    readVersion.current++;
    if (!/\.(mp3|m4a|wav|ogg|mp4|webm|aac|flac)$/i.test(next.name) || !next.size) {
      setFile(null); setTitle(''); setDuration(null); setReading(false);
      setError(!/\.(mp3|m4a|wav|ogg|mp4|webm|aac|flac)$/i.test(next.name) ? 'Выберите аудио- или видеофайл: MP3, M4A, WAV, OGG, AAC, FLAC, MP4 или WEBM.' : 'Файл пуст. Выберите другой файл.');
      return;
    }
    setError(''); setFile(next); setTitle(next.name.replace(/\.[^.]+$/, '')); setDuration(null);
  };
  const drop = (e: DragEvent) => { e.preventDefault(); setDragging(false); choose(e.dataTransfer.files[0]); };
  const submit = () => {
    if (!file || !title.trim() || !state.server || !areaAvailable(state, area)) return;
    const record: Recording = { id: crypto.randomUUID(), title: title.trim(), source: 'file', areaId: area, server: state.server.address, folderId: null, createdAt: new Date().toISOString(), duration, status: waitingReason(state.settings) ? 'local' : 'uploading', uploadRequested: true, uploadProgress: 0, transcript: [], summary: '', transcriptRevision: 0, summaryRevision: 0, materials: { transcript: false, summary: false } };
    dispatch({ type: 'import', record }); onClose(); notify('Запись добавлена');
  };
  return <Modal open={open} onClose={onClose} title="Загрузить запись" description="Добавьте аудио или видео. После отправки появятся транскрипция и резюме." wide className="import-modal"><form onSubmit={e => { e.preventDefault(); submit(); }}>
    <FieldGroup className="creation-form-fields"><div className={`drop-zone${dragging ? ' is-dragging' : ''}${file ? ' has-file' : ''}`} onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={drop}>
      <span className="drop-icon"><Icon name={file ? 'file' : 'cloudUpload'} size={32} weight="light" /></span><strong>{file ? file.name : 'Перетащите файл сюда'}</strong><p>{file ? <>{(file.size / 1024 / 1024).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} МБ{duration ? ` · ${formatTime(duration)}` : ''}</> : 'или выберите его на компьютере'}</p><Button small={Boolean(file)} variant={file ? 'ghost' : 'secondary'} icon={file ? undefined : 'upload'} aria-describedby={error ? fileErrorId : undefined} onClick={() => input.current?.click()}>{file ? 'Выбрать другой файл' : 'Выбрать файл'}</Button>{!file && <small>MP3, M4A, WAV, OGG, AAC, FLAC, MP4, WEBM</small>}
      <input ref={input} className="sr-only" type="file" tabIndex={-1} accept="audio/*,video/mp4,video/webm" aria-label="Аудио- или видеофайл" aria-invalid={Boolean(error)} aria-describedby={error ? fileErrorId : undefined} onChange={e => { const next = e.currentTarget.files?.[0]; choose(next); if (next) e.currentTarget.value = ''; }} />
    </div>{error && <p id={fileErrorId} className="field-error" role="alert">{error}</p>}
    {file && <Field label="Название записи"><Input data-vini-input="true" aria-label="Название записи" value={title} onChange={e => setTitle(e.target.value)} maxLength={120} /></Field>}
    <AreaPicker value={area} onChange={setArea} />{waitingReason(state.settings) && <Alert role="note" className="vini-inline-notice"><Icon alert name="clock" size={17} /><AlertDescription>Файл останется на устройстве. Отправка начнётся при подходящем подключении, пока приложение открыто.</AlertDescription></Alert>}</FieldGroup>
    <div className="modal-actions"><Button variant="ghost" onClick={onClose}>Отмена</Button><Button type="submit" variant="primary" icon="upload" disabled={!reading && (!file || !title.trim() || !areaAvailable(state, area))} state={reading ? 'progress' : undefined}>{reading ? 'Читаем файл…' : 'Загрузить запись'}</Button></div>
  </form></Modal>;
}

export function MeetingDialog({ open, onClose, initialArea, initialTitle = '' }: { open: boolean; onClose: () => void; initialArea: string; initialTitle?: string }) {
  const { state, dispatch, notify } = useStore(); const { go } = useNav();
  const [area, setArea] = useState(initialArea);
  const [url, setUrl] = useState(''); const [title, setTitle] = useState(''); const [name, setName] = useState(state.settings.agentName); const [custom, setCustom] = useState(false); const [error, setError] = useState('');
  const missingProfile = new URLSearchParams(location.search).get('bridge-profile') === 'missing';
  useEffect(() => { if (open) { setArea(initialArea); setUrl(''); setTitle(initialTitle); setError(''); setName(state.settings.agentName); setCustom(!['Тезис Агент', 'Агент admin'].includes(state.settings.agentName)); } }, [open, initialArea, initialTitle]);
  const existing = state.meetings.find(m => m.url === normalizeMeetingUrl(url) && m.server === state.server?.address && ['connecting', 'waiting', 'recording'].includes(m.stage));
  const submit = () => {
    const normalized = normalizeMeetingUrl(url);
    if (!normalized) { setError('Введите полную HTTPS-ссылку на встречу.'); return; }
    if (!name.trim() || name.trim().length > 60) { setError('Укажите имя агента: от 1 до 60 символов.'); return; }
    if (state.settings.network === 'offline' || missingProfile || !state.server || !areaAvailable(state, area)) return;
    if (existing) { onClose(); go({ page: 'meeting', id: existing.id }); return; }
    dispatch({ type: 'connect-meeting', meeting: { id: crypto.randomUUID(), url: normalized, title: title.trim() || 'Встреча по ссылке', agentName: name.trim(), areaId: area, server: state.server.address, stage: 'connecting', startedAt: Date.now(), pausedMs: 0, failOnce: new URLSearchParams(location.search).get('bridge-outcome') === 'error' } }); onClose(); notify('Демонстрация подключения агента');
  };
  return <Modal open={open} onClose={onClose} title="Записать встречу" description="Демонстрация: агент не подключается к встрече, запись имитируется." className="meeting-modal"><form onSubmit={e => { e.preventDefault(); submit(); }}>
    <FieldGroup className="creation-form-fields">{missingProfile && <Alert role="note" className="vini-inline-notice"><Icon alert name="warning" /><AlertDescription>Профиль агента не настроен. Подключение новых встреч недоступно.</AlertDescription></Alert>}
    <Field label="Ссылка на встречу" hint="Вставьте ссылку из приглашения." error={error}><Input data-vini-input="true" type="url" autoFocus aria-label="Ссылка на встречу" placeholder="https://meet.company.ru/room" value={url} onChange={e => { setUrl(e.target.value); setError(''); }} /></Field>
    {existing && <Alert role="note" className="vini-inline-notice"><AlertDescription>Для этой ссылки уже есть демонстрационное подключение. При продолжении оно откроется.</AlertDescription></Alert>}
    <Field label="Имя во встрече" hint="Имя для демонстрации. Реальные участники его не увидят."><Select label="Имя во встрече" value={custom ? 'custom' : name} options={[{ value: 'Тезис Агент', label: 'Тезис Агент' }, { value: 'Агент admin', label: 'Агент admin' }, { value: 'custom', label: 'Своё имя' }]} onChange={value => { setCustom(value === 'custom'); setName(value === 'custom' ? '' : value); }} /></Field>
    {custom && <Field label="Своё имя"><Input data-vini-input="true" aria-label="Своё имя" value={name} onChange={e => setName(e.target.value)} maxLength={60} /></Field>}
    <Field label="Название записи" optional><Input data-vini-input="true" aria-label="Название записи" placeholder="Например, проектный комитет" value={title} onChange={e => setTitle(e.target.value)} maxLength={120} /></Field>
    <AreaPicker value={area} onChange={setArea} /><p className="security-inline"><Icon name="info" size={16} />Предупредите участников о записи встречи.</p>
    {state.settings.network === 'offline' && <p className="field-error" role="status">Для подключения агента нужна сеть.</p>}</FieldGroup>
    <div className="modal-actions"><Button variant="ghost" onClick={onClose}>Отмена</Button><Button type="submit" variant="primary" icon="conference" disabled={missingProfile || state.settings.network === 'offline' || !url.trim() || !name.trim() || !areaAvailable(state, area)}>{existing ? 'Открыть подключение' : 'Имитировать подключение'}</Button></div>
  </form></Modal>;
}

export function RecorderPage({ id }: { id: string }) {
  const { state, dispatch, notify } = useStore(); const { go } = useNav(); const { pause } = usePlayback();
  const [restart, setRestart] = useState(false);
  const draft = state.drafts.find(d => d.id === id);
  useEffect(() => { pause(); }, [id]);
  if (!draft) return <Empty title="Черновик недоступен" description="Возможно, запись уже отправлена или удалена."><Button onClick={() => go({ page: 'library', scope: { kind: 'all' } })}>К записям</Button></Empty>;
  const areaReady = draft.server === state.server?.address && areaAvailable(state, draft.areaId);
  const folders = state.folders.filter(f => f.server === draft.server && f.areaId === draft.areaId);
  const selectedFolder = draft.folderId ? folders.find(f => f.id === draft.folderId) : undefined;
  const folderMissing = Boolean(draft.folderId && !selectedFolder);
  const rootLabel = draft.areaId === 'personal' ? 'Без папки' : 'В корне пространства';
  const finish = () => {
    if (!draftDestinationAvailable(state, draft)) { notify('Выберите доступное место отправки.'); return; }
    const recordId = crypto.randomUUID(); dispatch({ type: 'finish-draft', id, recordId, now: Date.now() }); go({ page: 'record', id: recordId, section: 'summary' }, true); notify('Запись добавлена');
  };
  const restartRecording = () => { dispatch({ type: 'update-draft', id, patch: { seconds: 0, paused: false } }); setRestart(false); };
  return <div className="page-scroll"><div className="recorder-layout" data-testid="recorder-page"><h1 className="sr-only">Диктофон</h1>
    <div className="recorder-card"><div className={`recording-status${draft.paused ? ' is-paused' : ''}`}><i />{draft.paused ? 'Запись на паузе' : 'Идёт запись'}</div><div className="recorder-signal"><Signal large paused={draft.paused} /></div><div className="recorder-time">{formatTime(draft.seconds)}</div><p className="recorder-caption">Демонстрация · звук не записывается</p>
      <FieldGroup className="recorder-fields creation-form-fields"><Field label="Название записи"><Input data-vini-input="true" aria-label="Название записи" value={draft.title} onChange={e => dispatch({ type: 'update-draft', id, patch: { title: e.target.value } })} maxLength={120} /></Field><AreaPicker value={draft.areaId} destinationServer={draft.server} local showAudience={false} onChange={areaId => dispatch({ type: 'update-draft', id, patch: { areaId, folderId: null, server: state.server!.address } })} /><Field label="Папка после отправки" hint={!areaReady ? "Выберите доступное пространство." : folderMissing ? "Выберите доступную папку или корень." : undefined}><Select label="Папка после отправки" disabled={!areaReady} value={folderMissing ? '__unavailable' : draft.folderId ?? 'root'} options={[...(folderMissing ? [{ value: '__unavailable', label: 'Папка недоступна', disabled: true }] : []), { value: 'root', label: rootLabel }, ...folders.map(f => ({ value: f.id, label: f.name }))]} onChange={folderId => dispatch({ type: 'update-draft', id, patch: { folderId: folderId === 'root' ? null : folderId } })} /></Field></FieldGroup>
      <div className="recorder-controls recorder-controls--dictaphone"><div className="recorder-control-stack"><VButton type="button" variant="secondary" size="700" aria-label="Заново" startIcon={<Icon name="rewind" size={24}/>} onClick={() => draft.seconds ? setRestart(true) : restartRecording()}/><span>Заново</span></div><div className="recorder-control-stack"><TooltipProvider><Tooltip><TooltipTrigger render={<VButton type="button" variant="secondary" size="700" aria-label={draft.paused ? 'Продолжить' : 'Пауза'} startIcon={<Icon name={draft.paused ? 'play' : 'pause'} size={24} weight="fill"/>} onClick={() => dispatch({ type: 'update-draft', id, patch: { paused: !draft.paused } })}/>} /><TooltipContent>При выходе можно сохранить черновик и продолжить позже.</TooltipContent></Tooltip></TooltipProvider><span>{draft.paused ? 'Продолжить' : 'Пауза'}</span></div><div className="recorder-control-stack"><VButton type="button" variant="primary" color="error" size="700" aria-label="Завершить" startIcon={<Icon name="stop" size={24} weight="fill"/>} data-testid="finish-recording" onClick={finish}/><span>Завершить</span></div></div>
    </div>
    <Confirm open={restart} onClose={() => setRestart(false)} title="Начать запись заново?" description={`Текущий фрагмент ${formatTime(draft.seconds)} будет удалён. Название и место отправки сохранятся. ${draft.paused ? 'Пока вы выбираете действие, запись остаётся на паузе.' : 'Пока вы выбираете действие, запись продолжается.'}`} target={draft.title} danger confirm="Начать заново" onConfirm={restartRecording} />
  </div></div>;
}

export function MeetingPage({ id, section = 'summary', propertiesOpen, onPropertiesChange }: { id: string; section?: RecordSection; propertiesOpen?: boolean; onPropertiesChange?: (open: boolean) => void }) {
  const { state, dispatch, notify } = useStore(); const { go, back, returnTarget } = useNav();
  const [confirmation, setConfirmation] = useState<'stop' | 'remove' | null>(null);
  const [editUrl, setEditUrl] = useState(false); const [url, setUrl] = useState(''); const [urlError, setUrlError] = useState('');
  const meeting = state.meetings.find(m => m.id === id && m.server === state.server?.address);
  const result = state.records.find(r => r.id === meeting?.resultId);
  if (result) return <RecordPage id={result.id} section={section} propertiesOpen={propertiesOpen} onPropertiesChange={onPropertiesChange} />;
  if (!meeting) return <Empty title="Подключение недоступно" description="Проверьте, что вы подключены к исходному серверу."><Button onClick={back}>К записям</Button></Empty>;
  const offline = state.settings.network === 'offline'; const recording = meeting.stage === 'recording'; const error = meeting.stage === 'error';
  const retry = () => { dispatch({ type: 'retry-meeting', id, url: meeting.url, now: Date.now() }); notify('Повторяем подключение'); };
  return <div className="page-scroll"><div className="recorder-layout" data-testid="meeting-page"><div className="recorder-page-top"><Button variant="ghost" icon="arrowLeft" onClick={back}>{backLabel(returnTarget(), state)}</Button><span>Запись встречи</span><div /></div><div className="recorder-card agent-recorder">
    <div className={`recording-status${!recording || meeting.pausedAt || offline ? ' is-paused' : ''}`}><i />{meetingLabel(meeting, offline)}</div><div className="recorder-signal"><Signal large paused={!recording || Boolean(meeting.pausedAt) || offline} /></div><div className="recorder-time">{recording ? offline ? '—:—' : formatTime(meetingDuration(meeting, Date.now())) : '00:00'}</div><p className="recorder-caption">{offline ? 'Состояние записи уточняется' : meeting.stage === 'waiting' ? 'Ожидаем допуска организатором' : recording ? meeting.pausedAt ? 'Агент остаётся во встрече' : 'Запись сохраняется на сервере' : error ? 'Не удалось войти во встречу' : meeting.stage === 'cancelled' ? 'Запись не создавалась' : 'Запись ещё не началась'}</p>
    <div className="agent-title"><span className="field-label">Название записи</span><strong>{meeting.title}</strong><p>{meeting.agentName} · {new URL(meeting.url).hostname}</p><span className="agent-area"><Icon name="users" size={15} />{areaName(meeting.areaId, state)}</span></div>
    {meeting.stage !== 'completed' && meeting.stage !== 'cancelled' ? <div className="recorder-controls recorder-controls--dictaphone"><span /><div className="recorder-control-stack"><VButton variant="secondary" size="700" aria-label={meeting.pausedAt ? 'Продолжить' : 'Пауза'} disabled={!recording || offline} startIcon={<Icon name={meeting.pausedAt ? 'play' : 'pause'} size={24} weight="fill" />} onClick={() => dispatch({ type: 'pause-meeting', id, now: Date.now() })}/><span>{meeting.pausedAt ? 'Продолжить' : 'Пауза'}</span></div><div className="recorder-control-stack"><VButton variant={recording ? 'primary' : 'secondary'} color={recording ? 'error' : 'main'} size="700" aria-label={recording ? 'Завершить' : error ? 'Повторить' : 'Отменить'} disabled={offline || (error && new URLSearchParams(location.search).get('bridge-profile') === 'missing')} startIcon={<Icon name={recording ? 'stop' : error ? 'rewind' : 'close'} size={24} weight={recording ? 'fill' : 'regular'} />} onClick={() => error ? retry() : setConfirmation('stop')}/><span>{recording ? 'Завершить' : error ? 'Повторить' : 'Отменить'}</span></div></div> : <Button onClick={back}>К записям</Button>}
    {error && <div className="agent-recovery"><p>Проверьте, что ссылка действительна и встреча доступна.</p><Button small variant="ghost" icon="link" onClick={() => { setUrl(meeting.url); setUrlError(''); setEditUrl(true); }}>Изменить ссылку</Button><Button small variant="ghost" icon="delete" onClick={() => setConfirmation('remove')}>Убрать попытку</Button></div>}
  </div><div className="recorder-assurance"><Icon name={offline ? 'offline' : 'shield'} size={21} /><div><strong>{offline ? 'Нет связи с сервером' : meeting.stage === 'waiting' ? 'Попросите организатора допустить агента' : recording ? 'Запись ведёт агент' : 'Подключение к встрече'}</strong><p>{offline ? 'Это не означает, что агент прекратил запись. Последнее состояние обновится после восстановления связи.' : recording ? 'Можно выйти с экрана. После завершения появятся материалы записи.' : meeting.stage === 'waiting' ? `Участник во встрече — «${meeting.agentName}». Запись начнётся после допуска.` : 'Состояние подключения доступно в библиотеке записей.'}</p></div></div>
    <Confirm open={confirmation === 'stop'} onClose={() => setConfirmation(null)} title={recording ? 'Завершить запись?' : 'Отменить подключение?'} description={recording ? 'Агент покинет встречу. Записанная часть сохранится и перейдёт в обработку.' : 'Агент не начнёт запись встречи. Запись не будет создана.'} target={meeting.title} confirm={recording ? 'Завершить запись' : 'Отменить подключение'} disabled={offline} onConfirm={() => { dispatch({ type: 'stop-meeting', id, now: Date.now() }); setConfirmation(null); }} />
    <Confirm open={confirmation === 'remove'} onClose={() => setConfirmation(null)} title="Убрать попытку?" description="Агент не подключился, запись не создавалась. Остальные встречи и записи останутся." target={meeting.title} confirm="Убрать попытку" danger onConfirm={() => { dispatch({ type: 'dismiss-meeting', id }); setConfirmation(null); go({ page: 'library', scope: { kind: 'all' } }); notify('Попытка убрана'); }} />
    <Modal open={editUrl} onClose={() => setEditUrl(false)} title="Ссылка на встречу" description="Название и выбранное пространство сохранятся."><form onSubmit={e => { e.preventDefault(); if (!normalizeMeetingUrl(url)) { setUrlError('Введите полную HTTPS-ссылку на встречу.'); return; } dispatch({ type: 'retry-meeting', id, url, now: Date.now() }); setEditUrl(false); notify('Повторяем подключение по новой ссылке'); }}><Field label="Ссылка" error={urlError}><Input data-vini-input="true" autoFocus aria-label="Новая ссылка на встречу" value={url} onChange={e => { setUrl(e.target.value); setUrlError(''); }} /></Field><div className="modal-actions"><Button variant="ghost" onClick={() => setEditUrl(false)}>Отмена</Button><Button type="submit" variant="primary" disabled={offline || !url.trim()}>Сохранить и подключить</Button></div></form></Modal>
  </div></div>;
}
