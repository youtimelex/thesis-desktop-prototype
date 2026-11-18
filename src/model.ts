import { OWNER, SERVER, WORKSPACES } from './fixtures.ts';
import type { AppState, AssistantDialog, CreatedWorkspace, Draft, Filters, Folder, ListScope, Meeting, Operation, Recording, Scope, Segment, Settings, Snapshot, Turn, WorkspaceInvitationDraft } from './types.ts';

export const STORAGE_KEY = 'vinteo-thesis-desktop-vini-home-v1';
export const DEFAULT_FILTERS: Filters = { areaId: 'all', source: 'all', status: 'all', folderId: 'all', sort: 'newest', query: '', scroll: 0 };
export const SOURCE_NAMES = { microphone: 'Диктофон', file: 'Файл', conference: 'ВКС' };
export const OPERATION_NAMES = { reprocess: 'Переобработать запись', summary: 'Пересоздать резюме', speakers: 'Идентифицировать спикеров' };

export function workspaceList(state: AppState) {
  if (!state.server) return [];
  const existing = state.server.address === SERVER ? WORKSPACES : [];
  const created = (state.createdWorkspaces ?? []).filter(w => w.server === state.server?.address && w.owner === OWNER);
  return [...existing, ...created].map(w => { const detail = state.workspaceDetails?.find(d => d.workspaceId === w.id && d.server === state.server?.address && d.owner === OWNER); return detail ? {...w, name:detail.name, description:detail.description} : w; });
}
export function areaAvailable(state: AppState, id: string) { return id === 'personal' || workspaceList(state).some(w => w.id === id); }
export function isCreatedWorkspace(state: AppState, id: string | null | undefined) { return Boolean(id && state.createdWorkspaces?.some(w => w.id === id && w.server === state.server?.address && w.owner === OWNER)); }
export function areaName(id: string | null | undefined, state: AppState) { return id === 'all' ? 'Все пространства' : id === 'personal' ? 'Личное' : id === 'legacy' ? 'Папки без пространства' : id == null ? 'Сервер ВКС' : workspaceList(state).find(w => w.id === id)?.name ?? 'Пространство недоступно'; }
function pluralCount(n: number, one: string, few: string, many: string) {
  const count = Math.abs(n);
  return `${n} ${count % 100 >= 11 && count % 100 <= 14 ? many : count % 10 === 1 ? one : count % 10 >= 2 && count % 10 <= 4 ? few : many}`;
}
export function pluralRecords(n: number) { return pluralCount(n, 'запись', 'записи', 'записей'); }
export function pluralDrafts(n: number) { return pluralCount(n, 'черновик', 'черновика', 'черновиков'); }
export function pluralConnections(n: number) { return pluralCount(n, 'подключение', 'подключения', 'подключений'); }
export function pluralUtterances(n: number) { return pluralCount(n, 'реплика', 'реплики', 'реплик'); }
export function pluralSpeakers(n: number) { return pluralCount(n, 'спикер', 'спикера', 'спикеров'); }
export function pluralParticipants(n: number) { return pluralCount(n, 'участник', 'участника', 'участников'); }
export function formatTime(seconds: number) { const s = Math.max(0, Math.floor(seconds)); return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`; }
export function formatDuration(seconds: number | null) { if (seconds === null) return '—'; if (seconds < 60) return `${Math.floor(seconds)} сек`; const m = Math.round(seconds / 60); return m < 60 ? `${m} мин` : `${Math.floor(m / 60)} ч${m % 60 ? ` ${m % 60} мин` : ''}`; }
export function dateLabel(date: string, withTime = true) { const d = new Date(date); return `${d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}${withTime ? `, ${d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}` : ''}`; }
export function defaultDraftTitle(now = new Date()) { return `Новая запись · ${now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`; }
export function isOnServer(record: Recording) { return ['ready', 'processing', 'processing-error'].includes(record.status); }
export function isActive(record: Recording) { return record.status === 'processing' || record.status === 'uploading' || (record.status === 'ready' && Boolean(record.operation)); }
export function isAttention(record: Recording) { return ['local', 'upload-error', 'processing-error'].includes(record.status); }
export function waitingReason(settings: Settings) { return settings.network === 'offline' ? 'offline' : settings.wifiOnly && settings.network !== 'wifi' ? 'wifi' : undefined; }
export function canRead(state: AppState, record: Recording) { return Boolean(state.server) && record.server === state.server!.address && (record.areaId === null || areaAvailable(state, record.areaId)); }
export function canManage(state: AppState, record: Recording) { return record.canManage !== false && (!isOnServer(record) || (canRead(state, record) && state.settings.network !== 'offline')); }
export function materialAvailable(record: Recording, material: 'summary' | 'transcript') {
  if (material === 'summary' && ['processing', 'processing-error'].includes(record.status) && !record.operation) return false;
  return record.materials[material] && (material === 'summary' ? Boolean(record.summary.trim()) : record.transcript.some(s => s.text.trim()));
}
export function transcriptEditReason(state: AppState, record: Recording): string | undefined {
  if (!materialAvailable(record, 'transcript')) return 'Распознанный текст недоступен.';
  if (record.canManage === false) return 'Нет права редактировать транскрипцию.';
  if (isOnServer(record) && !canRead(state, record)) return 'Запись недоступна на этом сервере.';
  if (isActive(record)) return 'Редактирование доступно после завершения обработки.';
  if (record.status === 'processing-error' && (record.processing?.phase ?? 'transcription') === 'transcription') return 'Распознавание остановлено. Повторите его, чтобы редактировать текст.';
  if (isOnServer(record) && state.settings.network === 'offline') return 'Подключитесь к сети, чтобы редактировать транскрипцию.';
  if (record.status !== 'ready' && record.status !== 'processing-error') return 'Редактирование недоступно в текущем состоянии.';
  return undefined;
}
export function canEditTranscript(state: AppState, record: Recording) { return transcriptEditReason(state, record) === undefined; }
export function isStale(record: Recording) { return materialAvailable(record, 'summary') && record.summaryRevision < record.transcriptRevision; }
export function versionNotice(record: Recording, material: 'summary' | 'transcript') {
  if (!materialAvailable(record, material)) return undefined;
  const updating = material === 'summary' ? record.operation === 'summary' || record.operation === 'reprocess' : record.operation === 'reprocess';
  const affected = material === 'transcript' ? updating && record.processing?.phase === 'transcription' : updating;
  return affected ? record.status === 'processing-error' ? 'Предыдущая версия · обновление не завершено' : 'Предыдущая версия · обновляется' : undefined;
}
export function statusPresentation(record: Recording, settings: Settings) {
  if (record.status === 'ready' && !record.operation) return { label: record.noSpeech ? 'Речь не обнаружена' : 'Обработано', tone: record.noSpeech ? 'neutral' : 'success', percent: undefined as number | undefined };
  if (record.status === 'local') return { label: !record.uploadRequested ? 'На устройстве' : waitingReason(settings) === 'offline' ? 'Ожидаем подключение' : waitingReason(settings) === 'wifi' ? 'Ожидаем Wi-Fi' : 'Готовим отправку', tone: 'warning', percent: undefined };
  if (record.status === 'upload-error') return { label: 'Не удалось отправить запись', tone: 'danger', percent: undefined };
  if (record.status === 'processing-error') return { label: record.processing?.phase === 'summary' ? 'Не удалось создать резюме' : record.processing?.phase === 'speakers' ? 'Не удалось определить спикеров' : 'Не удалось распознать речь', tone: 'danger', percent: undefined };
  return { label: record.status === 'uploading' ? 'Отправляем запись' : record.processing?.phase === 'summary' ? record.operation === 'summary' ? 'Пересоздаём резюме' : 'Создаём резюме' : record.processing?.phase === 'speakers' ? 'Определяем спикеров' : 'Распознаём речь', tone: 'accent', percent: record.status === 'uploading' ? record.uploadProgress : record.processing?.progress };
}

type Material = 'summary' | 'transcript';
type MaterialPresentation = {
  available: boolean;
  label: string;
  title: string;
  description: string;
  tone: 'neutral' | 'accent' | 'warning' | 'danger';
  notice?: string;
  retry: boolean;
  pending: boolean;
};

/** One source of truth for the overview, material page and sidebar. */
export function materialPresentation(record: Recording, material: Material, settings: Settings): MaterialPresentation {
  const available = materialAvailable(record, material);
  const phase = record.processing?.phase ?? 'transcription';
  const isSummary = material === 'summary';
  const failed = record.status === 'processing-error';
  const previous = versionNotice(record, material);
  const readyLabel = isSummary ? 'Основные итоги встречи' : pluralUtterances(record.transcript.length);

  if (available) {
    if (previous) return { available, label: previous, title: '', description: '', tone: failed ? 'danger' : 'accent', notice: previous, retry: failed, pending: false };
    if (!isSummary && phase === 'transcription' && !record.operation && (record.status === 'processing' || failed)) {
      return failed
        ? { available, label: `${readyLabel} · ошибка распознавания`, title: '', description: '', tone: 'danger', notice: 'Распознавание остановлено. Доступна распознанная часть.', retry: true, pending: false }
        : { available, label: `${readyLabel} · дополняется`, title: '', description: '', tone: 'accent', notice: 'Текст дополняется · по распознанной части', retry: false, pending: false };
    }
    if (!isSummary && phase === 'speakers' && (isActive(record) || failed)) {
      return failed
        ? { available, label: `${readyLabel} · ошибка определения спикеров`, title: '', description: '', tone: 'danger', notice: 'Не удалось определить спикеров. Транскрипция сохранена.', retry: true, pending: false }
        : { available, label: `${readyLabel} · определяем спикеров`, title: '', description: '', tone: 'accent', notice: 'Определяем спикеров', retry: false, pending: false };
    }
    return { available, label: readyLabel, title: '', description: '', tone: 'neutral', retry: false, pending: false };
  }

  if (record.noSpeech && record.status === 'ready' && !record.operation) return {
    available, label: isSummary ? 'Нет текста для резюме' : 'Речь не обнаружена', title: 'Речь не обнаружена',
    description: 'Обработка завершена. Исходную запись можно прослушать.', tone: 'neutral', retry: false, pending: false,
  };
  if (record.status === 'upload-error') return {
    available, label: 'Не удалось отправить запись', title: 'Не удалось отправить запись',
    description: 'Запись сохранена на устройстве. Материалы появятся после успешной отправки.', tone: 'danger', retry: true, pending: false,
  };
  if (record.status === 'local') {
    if (!record.uploadRequested) return {
      available, label: 'Запись не отправлена', title: 'Запись на устройстве',
      description: 'Отправьте запись, чтобы подготовить транскрипцию и резюме.', tone: 'warning', retry: true, pending: false,
    };
    const reason = waitingReason(settings);
    return {
      available, label: reason === 'wifi' ? 'Ожидает Wi-Fi' : reason === 'offline' ? 'Ожидает подключения' : 'Ожидает отправки',
      title: reason === 'wifi' ? 'Ожидаем Wi-Fi' : reason === 'offline' ? 'Ожидаем подключение' : 'Готовим отправку',
      description: 'Запись сохранена на устройстве. Отправка продолжится при подходящем подключении, пока приложение открыто.',
      tone: 'warning', retry: false, pending: false,
    };
  }
  if (record.status === 'uploading') return {
    available, label: 'Отправляем запись', title: 'Отправляем запись',
    description: 'После отправки начнётся подготовка материалов.', tone: 'accent', retry: false, pending: true,
  };
  if (failed) {
    if (phase === 'summary' && isSummary) return {
      available, label: 'Не удалось создать резюме', title: 'Не удалось создать резюме',
      description: materialAvailable(record, 'transcript') ? 'Транскрипция сохранена и доступна.' : 'Запись сохранена. Транскрипция пока недоступна.',
      tone: 'danger', retry: true, pending: false,
    };
    if (phase === 'summary') return {
      available, label: 'Транскрипция недоступна', title: 'Транскрипция недоступна',
      description: 'Текст транскрипции недоступен для этой записи.', tone: 'neutral', retry: false, pending: false,
    };
    if (phase === 'speakers') return {
      available, label: isSummary ? 'Ожидает повтора обработки' : 'Не удалось определить спикеров',
      title: 'Не удалось определить спикеров', description: 'Обработка остановлена. Повторите определение спикеров.',
      tone: 'danger', retry: true, pending: false,
    };
    return {
      available, label: isSummary ? 'Ожидает повтора распознавания' : 'Не удалось распознать речь',
      title: isSummary ? 'Транскрипция не готова' : 'Не удалось распознать речь',
      description: isSummary ? 'Распознавание остановлено. Повторите его, чтобы подготовить резюме.' : 'Запись сохранена. Повторите распознавание, чтобы получить текст.',
      tone: 'danger', retry: true, pending: false,
    };
  }
  if (isActive(record)) {
    if (phase === 'transcription') return {
      available, label: isSummary ? 'Ожидает транскрипции' : 'Распознаём речь', title: isSummary ? 'Ожидаем транскрипцию' : 'Распознаём речь',
      description: isSummary ? 'После распознавания начнётся создание резюме.' : 'Текст с таймкодами появится по мере готовности.', tone: 'accent', retry: false, pending: true,
    };
    if (phase === 'summary' && isSummary) return {
      available, label: 'Создаём резюме', title: 'Создаём резюме',
      description: materialAvailable(record, 'transcript') ? 'Транскрипция доступна. Готовим основные темы и решения.' : 'Выделяем основные темы и решения.',
      tone: 'accent', retry: false, pending: true,
    };
    if (phase === 'speakers') return {
      available, label: 'Ожидает определения спикеров', title: 'Определяем спикеров',
      description: 'Материалы появятся после завершения текущего этапа.', tone: 'accent', retry: false, pending: true,
    };
  }
  return {
    available, label: isSummary ? 'Резюме недоступно' : 'Транскрипция недоступна',
    title: isSummary ? 'Резюме недоступно' : 'Транскрипция недоступна',
    description: 'Материал пока недоступен для этой записи.', tone: 'neutral', retry: false, pending: false,
  };
}

/** The same phase-specific action and availability rules apply in every recovery surface. */
export function retryPresentation(state: AppState, record: Recording): { label: string; reason?: string } | null {
  if (!['local', 'upload-error', 'processing-error'].includes(record.status) || (record.status === 'local' && record.uploadRequested)) return null;
  const phase = record.processing?.phase ?? 'transcription';
  const label = record.status === 'local' ? 'Отправить запись' : record.status === 'upload-error' ? 'Повторить отправку' : phase === 'summary' ? 'Повторить создание резюме' : phase === 'speakers' ? 'Повторить определение спикеров' : 'Повторить распознавание';
  if (record.canManage === false) return { label, reason: 'Нет права изменять запись.' };
  if (record.server !== state.server?.address) return { label, reason: 'Подключитесь к исходному серверу записи.' };
  if (record.areaId && !areaAvailable(state, record.areaId)) return { label, reason: 'Пространство записи недоступно.' };
  if (record.status === 'processing-error' && state.settings.network === 'offline') return { label, reason: 'Подключитесь к сети, чтобы повторить обработку.' };
  const waiting = record.status !== 'processing-error' ? waitingReason(state.settings) : undefined;
  if (waiting) return { label, reason: waiting === 'wifi' ? 'Подключитесь к Wi-Fi, чтобы отправить запись.' : 'Подключитесь к сети, чтобы отправить запись.' };
  return { label };
}
export function visibleRecords(state: AppState) { return state.records.filter(r => !isOnServer(r) || canRead(state, r)); }
/** Visible recordings in this area's root and folders; drafts and agent connections are not recordings yet. */
export function areaRecordCount(state: AppState, areaId: string) { return visibleRecords(state).filter(r => r.areaId === areaId).length; }
function matchesText(text: string, query: string) { return text.toLocaleLowerCase('ru-RU').includes(query.trim().toLocaleLowerCase('ru-RU')); }
function matchesLibraryEntry(title: string, date: string, query: string) {
  const parsed = new Date(date);
  const numericDate = parsed.toLocaleDateString('ru-RU');
  const unpaddedDate = `${parsed.getDate()}.${parsed.getMonth() + 1}.${parsed.getFullYear()}`;
  return matchesText(`${title} ${dateLabel(date)} ${numericDate} ${unpaddedDate}`, query);
}
export function filterRecords(state: AppState, scope: ListScope, filters: Filters) {
  return visibleRecords(state).filter(r => {
    if (scope.kind !== 'all' && r.areaId !== (scope.areaId === 'legacy' ? null : scope.areaId)) return false;
    if (scope.kind === 'folder' && (!isOnServer(r) || (scope.folderId === 'root' ? r.folderId !== null : r.folderId !== scope.folderId))) return false;
    if (filters.areaId !== 'all' && r.areaId !== filters.areaId) return false;
    if (filters.source !== 'all' && r.source !== filters.source) return false;
    if (filters.folderId !== 'all' && (!isOnServer(r) || (filters.folderId === 'root' ? r.folderId !== null : r.folderId !== filters.folderId))) return false;
    if (filters.status === 'ready' && (r.status !== 'ready' || Boolean(r.operation))) return false;
    if (filters.status === 'attention' && !isAttention(r)) return false;
    if (filters.status === 'processing' && !isActive(r)) return false;
    return matchesLibraryEntry(r.title, r.createdAt, filters.query);
  });
}
export function filterDrafts(state: AppState, scope: ListScope, filters: Filters) {
  if (scope.kind === 'folder' || filters.folderId !== 'all' || !['all', 'microphone'].includes(filters.source) || filters.status !== 'all') return [];
  return state.drafts.filter(d => (scope.kind === 'all' || scope.areaId === 'personal' || (d.areaId === scope.areaId && d.server === state.server?.address)) && (filters.areaId === 'all' || filters.areaId === 'personal' || (d.areaId === filters.areaId && d.server === state.server?.address)) && matchesLibraryEntry(d.title, d.createdAt, filters.query));
}
export function filterMeetings(state: AppState, scope: ListScope, filters: Filters) {
  if (scope.kind === 'folder' || filters.folderId !== 'all' || !['all', 'conference'].includes(filters.source) || filters.status === 'ready') return [];
  return state.meetings.filter(m => m.server === state.server?.address && !['completed', 'cancelled'].includes(m.stage) && (scope.kind === 'all' || m.areaId === scope.areaId) && (filters.areaId === 'all' || m.areaId === filters.areaId) && (filters.status === 'all' || (filters.status === 'attention' ? m.stage === 'error' : m.stage !== 'error')) && matchesLibraryEntry(m.title, new Date(m.startedAt).toISOString(), filters.query));
}
export function countFilters(filters: Filters) { return Number(filters.areaId !== 'all') + Number(filters.source !== 'all') + Number(filters.status !== 'all') + Number(filters.folderId !== 'all'); }

export function normalizeServer(value: string): string | null {
  const input = value.trim();
  if (!input || /^http:\/\//i.test(input)) return null;
  try {
    const url = new URL(/^https:\/\//i.test(input) ? input : `https://${input}`);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname) || !url.hostname.includes('.')) return null;
    if (!url.hostname.split('.').every(p => /^[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/i.test(p))) return null;
    return url.host.toLocaleLowerCase('ru-RU');
  } catch { return null; }
}
export function normalizeMeetingUrl(value: string): string | null {
  try { const u = new URL(value.trim()); return u.protocol === 'https:' && u.hostname.includes('.') && !u.username && !u.password ? u.href : null; } catch { return null; }
}
export function validateFolder(state: AppState, name: string, areaId: string | null, id?: string) {
  if (state.settings.network === 'offline') return 'Для изменения папок подключитесь к сети.';
  if (!id && !areaId) return 'Новую папку можно создать в личном или общем пространстве.';
  if (areaId && !areaAvailable(state, areaId)) return 'Пространство недоступно.';
  const normalized = name.trim().replace(/\s+/g, ' ').normalize('NFC');
  if (!normalized || normalized.length > 80) return 'Введите название от 1 до 80 символов.';
  if (['без папки', 'в корне пространства', 'все папки', 'все'].includes(normalized.toLocaleLowerCase('ru-RU'))) return 'Это название уже используется в навигации.';
  if (state.folders.some(f => f.id !== id && f.areaId === areaId && f.server === state.server?.address && f.name.toLocaleLowerCase('ru-RU') === normalized.toLocaleLowerCase('ru-RU'))) return 'Папка с таким названием уже есть в этом пространстве.';
  return null;
}
export function validateDemoWorkspaceDetails(state:AppState, id:string, name:string, description:string) {
  if (!state.authenticated || !state.server || !workspaceList(state).some(w=>w.id===id)) return 'Пространство недоступно.';
  const normalized = name.trim().replace(/\s+/g, ' ').normalize('NFC');
  if (!normalized || normalized.length>80) return 'Введите название от 1 до 80 символов.';
  if (description.length>500) return 'Описание должно быть не длиннее 500 символов.';
  const key=normalized.toLocaleLowerCase('ru-RU');
  if (['личное','все пространства','все записи'].includes(key) || workspaceList(state).some(w=>w.id!==id && w.name.toLocaleLowerCase('ru-RU')===key)) return 'Пространство с таким названием уже есть.';
  return null;
}
export function canRenameWorkspace(state: AppState, id: string) {
  return state.authenticated && Boolean(state.server) && state.settings.network !== 'offline' &&
    !['personal', 'all', 'legacy', 'root'].includes(id) && !WORKSPACES.some(w => w.id === id) &&
    Boolean(state.createdWorkspaces?.some(w => w.id === id && w.owner === OWNER && w.server === state.server?.address));
}
export function canEditDemoMembers(state:AppState,id:string) { return state.authenticated && Boolean(state.server) && workspaceList(state).some(w=>w.id===id); }
export function demoMembers(state:AppState,id:string) {
 const workspace=workspaceList(state).find(w=>w.id===id);if(!workspace)return [];
 const overlay=state.memberSelections?.find(v=>v.workspaceId===id&&v.server===state.server?.address&&v.owner===OWNER);
 if(overlay)return overlay.members;
 const drafts=state.createdWorkspaces?.find(w=>w.id===id&&w.server===state.server?.address&&w.owner===OWNER)?.invitationDrafts??[];
 return [...workspace.members,...drafts.filter(d=>!workspace.members.some(m=>m.email.toLowerCase()===d.email.toLowerCase())).map(d=>({name:d.name||d.email,email:d.email,role:'Выбран в демо'}))];
}
export function canManageInvitationDrafts(state: AppState, id: string) {
  return state.authenticated && isCreatedWorkspace(state, id);
}
export function validateInvitationDrafts(drafts: WorkspaceInvitationDraft[]) {
  if (!Array.isArray(drafts) || drafts.length > 50) return 'Можно сохранить до 50 черновиков.';
  const seen = new Set<string>();
  for (const d of drafts) {
    if (!d || typeof d.email !== 'string' || typeof d.name !== 'string' || d.name.length > 120 || d.status !== 'not-sent' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim()) || d.email.length > 254) return 'Проверьте адрес электронной почты.';
    const email = d.email.trim().toLowerCase();
    if (email === OWNER.toLowerCase()) return 'Вы уже владелец пространства.';
    if (seen.has(email)) return 'Этот адрес уже добавлен.';
    seen.add(email);
  }
  return null;
}
const normalizeInvitationDrafts = (drafts: WorkspaceInvitationDraft[]) => drafts.map(d => ({email:d.email.trim().toLowerCase(),name:d.name.trim(),status:'not-sent' as const}));
export function validateWorkspace(state: AppState, name: string, excludeId?: string) {
  if (excludeId && !canRenameWorkspace(state, excludeId)) return 'Пространство недоступно для переименования.';
  if (!state.server || state.settings.network === 'offline') return 'Для создания пространства подключитесь к серверу.';
  const normalized = name.trim().replace(/\s+/g, ' ').normalize('NFC');
  if (!normalized || normalized.length > 80) return 'Введите название от 1 до 80 символов.';
  const key = normalized.toLocaleLowerCase('ru-RU');
  if (['личное', 'все пространства', 'все записи'].includes(key) || workspaceList(state).some(w => w.id !== excludeId && w.name.trim().replace(/\s+/g, ' ').normalize('NFC').toLocaleLowerCase('ru-RU') === key)) return 'Пространство с таким названием уже есть.';
  return null;
}
export function draftDestinationAvailable(state: AppState, draft: Pick<Draft, 'server' | 'areaId' | 'folderId'>) {
  return draft.server === state.server?.address && areaAvailable(state, draft.areaId) && (!draft.folderId || state.folders.some(f => f.id === draft.folderId && f.server === draft.server && f.areaId === draft.areaId));
}

function finishNoSpeech(record: Recording, now: number): Recording { return { ...record, status: 'ready', noSpeech: true, processing: undefined, operation: undefined, materials: { transcript: false, summary: false }, updatedAt: new Date(now).toISOString() }; }
export function advanceRecord(record: Recording, settings: Settings, now: number): Recording {
  if (record.frozen) return record;
  if (record.status === 'local' && record.uploadRequested) return waitingReason(settings) ? record : { ...record, status: 'uploading' };
  if (record.status === 'uploading') {
    if (waitingReason(settings)) return { ...record, status: 'local', uploadRequested: true };
    const uploadProgress = (record.uploadProgress ?? 0) + 16;
    return uploadProgress < 100 ? { ...record, uploadProgress } : { ...record, status: 'processing', uploadProgress: undefined, processing: { phase: 'transcription', progress: 0, ticks: 0 } };
  }
  if ((record.status !== 'processing' && record.status !== 'ready') || !record.processing || (record.status === 'ready' && !record.operation)) return record;
  const job = record.processing;
  if (job.phase === 'transcription') {
    const progress = (job.progress ?? 0) + 8;
    if (progress < 100) return { ...record, processing: { ...job, progress } };
    if (!record.transcript.some(s => s.text.trim())) return finishNoSpeech(record, now);
    return { ...record, transcriptRevision: record.transcriptRevision + 1, materials: { transcript: true, summary: Boolean(record.operation) && record.materials.summary }, processing: { phase: 'summary', ticks: 0 } };
  }
  const ticks = job.ticks + 1;
  if (ticks < 5) return { ...record, processing: { ...job, ticks, progress: job.phase === 'speakers' ? ticks * 20 : undefined } };
  if (job.phase === 'speakers') return { ...record, status: 'ready', operation: undefined, processing: undefined, updatedAt: new Date(now).toISOString() };
  if (!record.transcript.some(s => s.text.trim())) return finishNoSpeech(record, now);
  const summary = isStale(record) || !record.summary.trim() ? `## Итоги записи\n\n${record.transcript.map(s => `- ${s.text.trim()}`).join('\n\n')}` : record.summary;
  return { ...record, status: 'ready', summary, summaryRevision: record.transcriptRevision, processing: undefined, operation: undefined, materials: { transcript: true, summary: true }, updatedAt: new Date(now).toISOString() };
}
export function recordFromDraft(draft: Draft, id: string, state: AppState, now: number): Recording {
  return { id, title: draft.title.trim() || defaultDraftTitle(new Date(now)), source: 'microphone', createdAt: new Date(now).toISOString(), duration: Math.max(1, draft.seconds), server: draft.server, areaId: draft.areaId, folderId: draft.folderId ?? null, status: waitingReason(state.settings) ? 'local' : 'uploading', uploadProgress: 0, uploadRequested: true, transcript: [], summary: '', transcriptRevision: 0, summaryRevision: 0, materials: { transcript: false, summary: false } };
}
export function meetingDuration(meeting: Meeting, now: number) { return Math.max(0, Math.floor(((meeting.pausedAt ?? meeting.endedAt ?? now) - meeting.startedAt - meeting.pausedMs - 10000) / 1000)); }
export function meetingLabel(meeting: Meeting, offline = false) { return offline ? 'Нет связи · последнее состояние' : meeting.stage === 'connecting' ? 'Подключаем агента' : meeting.stage === 'waiting' ? 'Ожидаем допуска' : meeting.stage === 'recording' ? meeting.pausedAt ? 'Запись на паузе' : 'Идёт запись' : meeting.stage === 'error' ? 'Не удалось подключиться' : meeting.stage === 'cancelled' ? 'Подключение отменено' : 'Запись завершена'; }
function meetingResult(meeting: Meeting, now: number): Recording { return { id: meeting.resultId!, bridgeId: meeting.id, title: meeting.title, source: 'conference', createdAt: new Date(meeting.startedAt).toISOString(), duration: Math.max(1, meetingDuration(meeting, now)), server: meeting.server, areaId: meeting.areaId, folderId: null, status: 'processing', processing: { phase: 'transcription', progress: 0, ticks: 0 }, transcript: [], summary: '', transcriptRevision: 0, summaryRevision: 0, materials: { transcript: false, summary: false } }; }

export function scopeAreaAvailable(state: AppState, areaId: string) {
  return areaId === 'all' || areaId === 'legacy' && Boolean(state.server) || areaAvailable(state, areaId);
}
export function recordInSourceScope(record: Recording, scope: Pick<Scope, 'areaId' | 'folderId'>) {
  const inArea = scope.areaId === 'all' || record.areaId === (scope.areaId === 'legacy' ? null : scope.areaId);
  const inFolder = !scope.folderId || (scope.folderId === 'root' ? record.folderId === null : record.folderId === scope.folderId);
  return inArea && inFolder;
}
export function sourceFolderAvailable(state: AppState, scope: Pick<Scope, 'areaId' | 'folderId'>) {
  if (!scope.folderId) return true;
  if (scope.folderId === 'root') return scope.areaId !== 'all' && scopeAreaAvailable(state, scope.areaId);
  return state.folders.some(f => f.id === scope.folderId && f.server === state.server?.address && f.areaId === (scope.areaId === 'legacy' ? null : scope.areaId));
}
export function scopeRecords(state: AppState, scope: Scope): Recording[] {
  if (!scopeAreaAvailable(state, scope.areaId) || !sourceFolderAvailable(state, scope)) return [];
  if (scope.mode === 'explicit') return scope.recordIds.flatMap(id => { const r = state.records.find(r => r.id === id && canRead(state, r) && isOnServer(r)); return r ? [r] : []; });
  return state.records.filter(r => canRead(state, r) && isOnServer(r) && recordInSourceScope(r, scope) && sourceSnapshot(r));
}
export function sourceSnapshot(record: Recording): Snapshot | null {
  const summary = materialAvailable(record, 'summary') && !isStale(record);
  const transcript = materialAvailable(record, 'transcript');
  if (!summary && !transcript) return null;
  return { recordId: record.id, title: record.title, text: summary ? record.summary : record.transcript.map(s => s.text).join('\n\n'), revision: summary ? record.summaryRevision : record.transcriptRevision, material: summary ? 'summary' : 'transcript', notice: versionNotice(record, summary ? 'summary' : 'transcript') ?? (['processing', 'processing-error'].includes(record.status) && record.processing?.phase === 'transcription' && !record.operation ? 'По распознанной части' : undefined) };
}
export function scopeLabel(state: AppState, scope: Scope) {
  if (scope.mode === 'explicit') return scope.recordIds.length === 1 ? state.records.find(r => r.id === scope.recordIds[0])?.title ?? 'Запись недоступна' : scope.recordIds.length ? `Выбрано: ${pluralRecords(scope.recordIds.length)}` : 'Источники не выбраны';
  const folder = scope.folderId === 'root' ? scope.areaId === 'personal' || scope.areaId === 'legacy' ? 'Без папки' : 'В корне пространства' : state.folders.find(f => f.id === scope.folderId && f.server === state.server?.address && f.areaId === (scope.areaId === 'legacy' ? null : scope.areaId))?.name ?? 'Папка недоступна';
  return `${scope.areaId === 'all' ? 'Все доступные записи' : areaName(scope.areaId, state)}${scope.folderId ? ` · ${folder}` : ''}`;
}
export function scopeMaterials(state: AppState, scope: Scope) {
  const sources = scopeRecords(state, scope).map(sourceSnapshot).filter((item): item is Snapshot => item !== null);
  if (!sources.length) return 'Нет доступного текста';
  const summaries = sources.some(source => source.material === 'summary');
  const transcripts = sources.some(source => source.material === 'transcript');
  return `${pluralRecords(sources.length)} · ${summaries && transcripts ? 'резюме и транскрипции' : summaries ? 'резюме' : 'транскрипции'}`;
}
export function sourceError(state: AppState, scope: Scope) {
  if (!scopeAreaAvailable(state, scope.areaId)) return 'Пространство недоступно. Измените источники.';
  if (!sourceFolderAvailable(state, scope)) return 'Папка недоступна. Измените источники.';
  if (scope.mode === 'explicit' && !scope.recordIds.length) return 'Выберите записи для ответа.';
  const records = scopeRecords(state, scope);
  if (scope.mode === 'explicit' && records.length !== scope.recordIds.length) return 'Один из источников недоступен. Измените выбор записей.';
  if (!records.length || records.some(r => !sourceSnapshot(r))) return 'В выбранных источниках пока нет распознанного текста.';
  return null;
}
export function answerFromSnapshots(question: string, snapshots: Snapshot[]) {
  const general = /кратко|итоги|резюме|решени|договор|следующ|открыт|подготов/iu.test(question);
  const words = question.toLocaleLowerCase('ru-RU').match(/[\p{L}\d]{4,}/gu) ?? [];
  const used: string[] = [];
  const excerpts: string[] = [];
  for (const s of snapshots) {
    const paragraphs = s.text.split(/\n+/).map(x => x.replace(/^[-\d.\s>#]+/, '').replace(/\*\*/g, '').trim()).filter(x => x.length > 30);
    const matches = paragraphs.filter(p => words.some(w => p.toLocaleLowerCase('ru-RU').includes(w.slice(0, Math.max(4, w.length - 2)))));
    const selected = matches.length ? matches.slice(0, 2) : general ? paragraphs.slice(0, 2) : [];
    if (selected.length && excerpts.length < 6) { used.push(s.recordId); excerpts.push(...selected.map(p => `- ${p}`)); }
    if (used.length >= 3) break;
  }
  return used.length ? { answer: `В выбранных записях зафиксировано:\n\n${excerpts.join('\n\n')}`, usedRecordIds: used } : { answer: 'В демонстрационном поиске не удалось найти совпадения по словам вопроса. Это не означает, что сведений нет в записях. Уточните, пожалуйста, встречу или тему и попробуйте ещё раз.', usedRecordIds: [] };
}
export function usedSources(turn: Turn) { return Array.isArray(turn.usedRecordIds) ? turn.snapshots.filter(s => turn.usedRecordIds.includes(s.recordId)) : turn.snapshots; }
export function turnAccessible(state: AppState, turn: Turn) { return usedSources(turn).every(s => state.records.some(r => r.id === s.recordId && canRead(state, r))); }
export type TranscriptMatch = { segmentId: string; start: number; end: number };
export function findTranscriptMatches(segments: Segment[], query: string): TranscriptMatch[] {
  if (!query.trim()) return [];
  const needle = query.toLocaleLowerCase('ru-RU');
  return segments.flatMap(segment => { const text = segment.text.toLocaleLowerCase('ru-RU'); const matches: TranscriptMatch[] = []; let from = 0; let at: number; while ((at = text.indexOf(needle, from)) !== -1) { matches.push({ segmentId: segment.id, start: at, end: at + needle.length }); from = at + needle.length; } return matches; });
}
export function segmentAtTime(segments: Segment[], seconds: number) { return segments.find(s => seconds >= s.start && seconds < s.end); }
export function dialogTitle(dialog: AssistantDialog) { return dialog.customTitle || dialog.turns.length ? dialog.title : dialog.draft.trim() || 'Новый диалог'; }
export function dialogMatchesSearch(state: AppState, dialog: AssistantDialog, query: string) {
  const searchable = [dialogTitle(dialog), scopeLabel(state, dialog.scope), dialog.draft, ...dialog.turns.flatMap(turn => [turn.question, ...(turn.status === 'ready' && turnAccessible(state, turn) ? [turn.answer.replace(/[#*]/g, '')] : [])])];
  return searchable.join(' ').toLocaleLowerCase('ru-RU').includes(query.trim().toLocaleLowerCase('ru-RU'));
}
export function visibleDialogs(state: AppState) { return state.dialogs.filter(d => d.server === state.server?.address && d.owner === OWNER && (d.turns.length || d.draft.trim() || d.customTitle)).sort((a, b) => b.updatedAt - a.updatedAt); }
export function recordDialogs(state: AppState, recordId: string) {
  const source = state.records.find(r => r.id === recordId);
  if (!source || !canRead(state, source)) return [];
  return state.dialogs.filter(d => d.server === state.server?.address && d.owner === OWNER && (!d.recordContextId || d.recordContextId === recordId) && d.scope.mode === 'explicit' && d.scope.recordIds.length === 1 && d.scope.recordIds[0] === recordId).sort((a, b) => b.updatedAt - a.updatedAt);
}
export function recordDialog(state: AppState, recordId: string) { return recordDialogs(state, recordId).find(d => d.recordContextId === recordId); }


export type Action =
  | { type: 'tick'; now: number }
  | { type: 'settings'; patch: Partial<Settings> }
  | { type: 'rename-record'; id: string; title: string; now: number }
  | { type: 'delete-record'; id: string }
  | { type: 'move-area'; id: string; areaId: string; now: number }
  | { type: 'move-folder'; id: string; folderId: string | null }
  | { type: 'operation'; id: string; operation: Operation }
  | { type: 'retry-record'; id: string }
  | { type: 'edit-transcript'; id: string; segmentId: string; text: string; now: number }
  | { type: 'create-workspace'; id: string; name: string; server: string; invitationDrafts?: WorkspaceInvitationDraft[] }
  | { type: 'save-demo-members'; id:string; server:string; members:{name:string;email:string;role:string}[] }
  | { type: 'save-invitation-drafts'; id: string; server: string; invitationDrafts: WorkspaceInvitationDraft[] }
  | { type: 'save-demo-workspace-details'; id:string; name:string; description:string; server:string }
  | { type: 'rename-workspace'; id: string; name: string; server: string }
  | { type: 'save-folder'; folder: Folder }
  | { type: 'delete-folder'; id: string }
  | { type: 'create-draft'; draft: Draft }
  | { type: 'update-draft'; id: string; patch: Partial<Omit<Draft, 'id' | 'createdAt'>> }
  | { type: 'delete-draft'; id: string }
  | { type: 'finish-draft'; id: string; recordId: string; now: number }
  | { type: 'import'; record: Recording }
  | { type: 'connect-meeting'; meeting: Meeting }
  | { type: 'pause-meeting'; id: string; now: number }
  | { type: 'stop-meeting'; id: string; now: number }
  | { type: 'retry-meeting'; id: string; url: string; now: number }
  | { type: 'dismiss-meeting'; id: string }
  | { type: 'ensure-record-dialog'; recordId: string; dialogId: string; now: number; fresh?: boolean }
  | { type: 'create-dialog'; dialog: AssistantDialog; moveDraftFrom?: string }
  | { type: 'update-dialog'; id: string; patch: Partial<Pick<AssistantDialog, 'title' | 'customTitle' | 'draft' | 'scope'>>; now: number }
  | { type: 'delete-dialog'; id: string }
  | { type: 'send'; id: string; turnId: string; now: number; failOnce?: boolean }
  | { type: 'stop-turn'; id: string; turnId: string; now: number }
  | { type: 'retry-turn'; id: string; turnId: string; now: number }
  | { type: 'server'; server: AppState['server'] }
  | { type: 'sign-in' }
  | { type: 'sign-out' };

export function reducer(state: AppState, action: Action): AppState {
  const record = 'id' in action ? state.records.find(r => r.id === action.id) : undefined;
  const updateRecord = (fn: (r: Recording) => Recording) => record ? { ...state, records: state.records.map(r => r.id === record.id ? fn(r) : r) } : state;
  const ownDialog = (d: AssistantDialog) => d.server === state.server?.address && d.owner === OWNER;
  switch (action.type) {
    case 'settings': return { ...state, settings: { ...state.settings, ...action.patch } };
    case 'rename-record': return record && canManage(state, record) && action.title.trim() ? updateRecord(r => ({ ...r, title: action.title.trim().slice(0, 120), updatedAt: new Date(action.now).toISOString() })) : state;
    case 'delete-record': return record && canManage(state, record) ? { ...state, records: state.records.filter(r => r.id !== record.id) } : state;
    case 'move-area': return record && isOnServer(record) && canManage(state, record) && areaAvailable(state, action.areaId) ? updateRecord(r => ({ ...r, areaId: action.areaId, folderId: null, updatedAt: new Date(action.now).toISOString() })) : state;
    case 'move-folder': {
      if (!record || !isOnServer(record) || !canManage(state, record)) return state;
      const folder = state.folders.find(f => f.id === action.folderId);
      if (action.folderId && (!folder || folder.server !== record.server || folder.areaId !== record.areaId)) return state;
      return updateRecord(r => ({ ...r, folderId: action.folderId }));
    }
    case 'operation': return record && record.status === 'ready' && !record.operation && canManage(state, record) && (action.operation === 'reprocess' || materialAvailable(record, 'transcript')) ? updateRecord(r => ({ ...r, frozen: false, operation: action.operation, processing: { phase: action.operation === 'reprocess' ? 'transcription' : action.operation, progress: action.operation === 'summary' ? undefined : 0, ticks: 0 } })) : state;
    case 'retry-record': {
      if (!record || record.canManage === false || !['local', 'upload-error', 'processing-error'].includes(record.status) || record.server !== state.server?.address || (record.areaId && !areaAvailable(state, record.areaId))) return state;
      if (record.status === 'processing-error') return state.settings.network === 'offline' ? state : updateRecord(r => ({ ...r, frozen: false, status: 'processing', processing: { phase: r.processing?.phase ?? 'transcription', progress: r.processing?.phase === 'summary' ? undefined : 0, ticks: 0 } }));
      return updateRecord(r => ({ ...r, frozen: false, uploadRequested: true, status: waitingReason(state.settings) ? 'local' : 'uploading', uploadProgress: r.uploadProgress ?? 0 }));
    }
    case 'edit-transcript': return record && canEditTranscript(state, record) && action.text.trim() && record.transcript.some(s => s.id === action.segmentId && s.text !== action.text.trim()) ? updateRecord(r => ({ ...r, transcript: r.transcript.map(s => s.id === action.segmentId ? { ...s, text: action.text.trim() } : s), transcriptRevision: r.transcriptRevision + 1, updatedAt: new Date(action.now).toISOString() })) : state;
    case 'create-workspace': {
      if (!state.authenticated || validateInvitationDrafts(action.invitationDrafts ?? []) || action.server !== state.server?.address || !action.id || ['personal', 'legacy', 'all', 'root'].includes(action.id) || WORKSPACES.some(w => w.id === action.id) || state.createdWorkspaces?.some(w => w.id === action.id) || validateWorkspace(state, action.name)) return state;
      const workspace: CreatedWorkspace = { id: action.id, name: action.name.trim().replace(/\s+/g, ' ').normalize('NFC'), description: '', color: '#72b6e9', members: [], invitationDrafts: normalizeInvitationDrafts(action.invitationDrafts ?? []), server: action.server, owner: OWNER };
      return { ...state, createdWorkspaces: [...(state.createdWorkspaces ?? []), workspace] };
    }
    case 'save-demo-members': {
      if(action.server!==state.server?.address||!canEditDemoMembers(state,action.id)||!Array.isArray(action.members)||action.members.length>50)return state;
      const seen=new Set<string>();
      if(action.members.some(m=>{if(!m||typeof m.email!=='string'||typeof m.name!=='string'||typeof m.role!=='string'||!/^\S+@\S+\.\S+$/.test(m.email)||m.email.length>254||m.name.length>120)return true;const key=m.email.toLowerCase();if(seen.has(key))return true;seen.add(key);return false;}))return state;
      return {...state,memberSelections:[...(state.memberSelections??[]).filter(v=>!(v.workspaceId===action.id&&v.server===action.server&&v.owner===OWNER)),{workspaceId:action.id,server:action.server,owner:OWNER,members:action.members.map(m=>({...m,email:m.email.toLowerCase()}))}]};
    }
    case 'save-invitation-drafts': {
      if (action.server !== state.server?.address || !canManageInvitationDrafts(state,action.id) || validateInvitationDrafts(action.invitationDrafts)) return state;
      const workspace=state.createdWorkspaces!.find(w=>w.id===action.id && w.server===action.server && w.owner===OWNER)!;
      if(action.invitationDrafts.some(d=>workspace.members.some(m=>m.email.toLowerCase()===d.email.trim().toLowerCase()))) return state;
      return {...state,createdWorkspaces:state.createdWorkspaces!.map(w=>w===workspace?{...w,invitationDrafts:normalizeInvitationDrafts(action.invitationDrafts)}:w)};
    }
    case 'save-demo-workspace-details': {
      if(action.server!==state.server?.address || validateDemoWorkspaceDetails(state,action.id,action.name,action.description)) return state;
      const detail={workspaceId:action.id,server:action.server,owner:OWNER,name:action.name.trim().replace(/\s+/g,' ').normalize('NFC'),description:action.description.trim()};
      return {...state,workspaceDetails:[...(state.workspaceDetails??[]).filter(d=>!(d.workspaceId===action.id&&d.server===action.server&&d.owner===OWNER)),detail]};
    }
    case 'rename-workspace': {
      if (action.server !== state.server?.address || !canRenameWorkspace(state, action.id) || validateWorkspace(state, action.name, action.id)) return state;
      const name = action.name.trim().replace(/\s+/g, ' ').normalize('NFC');
      const current = state.createdWorkspaces!.find(w => w.id === action.id && w.server === action.server && w.owner === OWNER)!;
      if (current.name === name) return state;
      return { ...state, createdWorkspaces: state.createdWorkspaces!.map(w => w === current ? { ...w, name } : w) };
    }
    case 'save-folder': {
      const existing = state.folders.find(f => f.id === action.folder.id);
      if (existing && (existing.areaId !== action.folder.areaId || existing.server !== action.folder.server)) return state;
      return validateFolder(state, action.folder.name, action.folder.areaId, existing ? action.folder.id : undefined) || action.folder.server !== state.server?.address ? state : { ...state, folders: existing ? state.folders.map(f => f.id === action.folder.id ? { ...action.folder, name: action.folder.name.trim().replace(/\s+/g, ' ') } : f) : [...state.folders, { ...action.folder, name: action.folder.name.trim().replace(/\s+/g, ' ') }] };
    }
    case 'delete-folder': {
      const folder = state.folders.find(f => f.id === action.id && f.server === state.server?.address);
      return !folder || state.settings.network === 'offline' ? state : { ...state, folders: state.folders.filter(f => f.id !== folder.id), records: state.records.map(r => r.folderId === folder.id && r.server === folder.server ? { ...r, folderId: null } : r), drafts: state.drafts.map(d => d.folderId === folder.id && d.server === folder.server && d.areaId === folder.areaId ? { ...d, folderId: null } : d) };
    }
    case 'create-draft': return { ...state, drafts: [action.draft, ...state.drafts.map(d => ({ ...d, paused: true }))] };
    case 'update-draft': return { ...state, drafts: state.drafts.map(d => {
      if (d.id !== action.id) return action.patch.paused === false ? { ...d, paused: true } : d;
      const moved = action.patch.areaId !== undefined && action.patch.areaId !== d.areaId || action.patch.server !== undefined && action.patch.server !== d.server;
      return { ...d, ...action.patch, ...(moved && action.patch.folderId === undefined ? { folderId: null } : {}) };
    }) };
    case 'delete-draft': return { ...state, drafts: state.drafts.filter(d => d.id !== action.id) };
    case 'finish-draft': {
      const draft = state.drafts.find(d => d.id === action.id);
      if (!draft || !draftDestinationAvailable(state, draft)) return state;
      return { ...state, records: [recordFromDraft(draft, action.recordId, state, action.now), ...state.records], drafts: state.drafts.filter(d => d.id !== draft.id) };
    }
    case 'import': return action.record.server === state.server?.address && action.record.areaId && areaAvailable(state, action.record.areaId) ? { ...state, records: [action.record, ...state.records] } : state;
    case 'connect-meeting': return state.settings.network === 'offline' || action.meeting.server !== state.server?.address || !areaAvailable(state, action.meeting.areaId) || state.meetings.some(m => m.server === action.meeting.server && m.url === action.meeting.url && ['connecting', 'waiting', 'recording'].includes(m.stage)) ? state : { ...state, meetings: [action.meeting, ...state.meetings], settings: { ...state.settings, agentName: action.meeting.agentName } };
    case 'pause-meeting': return state.settings.network === 'offline' ? state : { ...state, meetings: state.meetings.map(m => m.id === action.id && m.server === state.server?.address && m.stage === 'recording' ? m.pausedAt ? { ...m, pausedMs: m.pausedMs + action.now - m.pausedAt, pausedAt: undefined } : { ...m, pausedAt: action.now } : m) };
    case 'stop-meeting': {
      const m = state.meetings.find(m => m.id === action.id && m.server === state.server?.address);
      if (!m || state.settings.network === 'offline' || !['connecting', 'waiting', 'recording'].includes(m.stage)) return state;
      const next: Meeting = m.stage === 'recording' ? { ...m, stage: 'completed', endedAt: action.now, resultId: `meeting-result-${m.id}` } : { ...m, stage: 'cancelled' };
      return { ...state, meetings: state.meetings.map(m => m.id === next.id ? next : m), records: next.resultId && !state.records.some(r => r.id === next.resultId) ? [meetingResult(next, action.now), ...state.records] : state.records };
    }
    case 'retry-meeting': {
      const url = normalizeMeetingUrl(action.url);
      return !url || state.settings.network === 'offline' || state.meetings.some(m => m.id !== action.id && m.server === state.server?.address && m.url === url && ['connecting', 'waiting', 'recording'].includes(m.stage)) ? state : { ...state, meetings: state.meetings.map(m => m.id === action.id && m.stage === 'error' && m.server === state.server?.address ? { ...m, url, startedAt: action.now, pausedAt: undefined, pausedMs: 0, stage: 'connecting', failOnce: false } : m) };
    }
    case 'dismiss-meeting': return { ...state, meetings: state.meetings.filter(m => !(m.id === action.id && m.stage === 'error' && !m.resultId && m.server === state.server?.address)) };
    case 'ensure-record-dialog': {
      const source = state.records.find(r => r.id === action.recordId);
      if (!source || !canRead(state, source) || (!action.fresh && recordDialog(state, source.id)) || (action.fresh && recordDialogs(state, source.id).some(d => !d.turns.length)) || !action.dialogId || state.dialogs.some(d => d.id === action.dialogId)) return state;
      const dialog: AssistantDialog = { id: action.dialogId, title: 'Новый диалог', draft: '', server: source.server, owner: OWNER, recordContextId: source.id, scope: { mode: 'explicit', areaId: 'all', recordIds: [source.id] }, turns: [], createdAt: action.now, updatedAt: action.now };
      return { ...state, dialogs: [dialog, ...state.dialogs] };
    }
    case 'create-dialog': return ownDialog(action.dialog) ? { ...state, dialogs: [action.dialog, ...state.dialogs.map(d => d.id === action.moveDraftFrom && ownDialog(d) ? { ...d, draft: '' } : d)] } : state;
    case 'update-dialog': return { ...state, dialogs: state.dialogs.map(d => d.id === action.id && ownDialog(d) ? { ...d, ...action.patch, ...((d.turns.length || d.recordContextId) && action.patch.scope ? { scope: d.scope } : {}), updatedAt: action.now } : d) };
    case 'delete-dialog': return { ...state, dialogs: state.dialogs.filter(d => !(d.id === action.id && ownDialog(d))) };
    case 'send': return { ...state, dialogs: state.dialogs.map(d => {
      if (d.id !== action.id || !ownDialog(d) || !d.draft.trim() || d.turns.some(t => t.status === 'pending') || state.settings.network === 'offline' || sourceError(state, d.scope)) return d;
      const question = d.draft.trim();
      const snapshots = scopeRecords(state, d.scope).map(sourceSnapshot).filter((s): s is Snapshot => s !== null);
      return { ...d, title: d.turns.length || d.customTitle ? d.title : question.slice(0, 90), draft: '', updatedAt: action.now, turns: [...d.turns, { id: action.turnId, question, status: 'pending', snapshots, usedRecordIds: [], answer: '', dueAt: action.now + 3000, failOnce: action.failOnce }] };
    }) };
    case 'stop-turn': {
      const dialog = state.dialogs.find(d => d.id === action.id && ownDialog(d));
      if (!dialog?.turns.some(t => t.id === action.turnId && t.status === 'pending')) return state;
      return { ...state, dialogs: state.dialogs.map(d => d.id === dialog.id && ownDialog(d) ? { ...d, updatedAt: action.now, turns: d.turns.map(t => t.id === action.turnId && t.status === 'pending' ? { ...t, status: 'stopped', error: undefined } : t) } : d) };
    }
    case 'retry-turn': return state.settings.network === 'offline' ? state : { ...state, dialogs: state.dialogs.map(d => d.id === action.id && ownDialog(d) && !d.turns.some(t => t.status === 'pending') ? { ...d, updatedAt: action.now, turns: d.turns.map(t => t.id === action.turnId && (t.status === 'error' || t.status === 'stopped') && t.snapshots.every(s => state.records.some(r => r.id === s.recordId && canRead(state, r))) ? { ...t, status: 'pending', failOnce: false, dueAt: action.now + 2000, error: undefined } : t) } : d) };
    case 'server': return { ...state, server: action.server, authenticated: false, drafts: state.drafts.map(d => ({ ...d, paused: true })) };
    case 'sign-in': return state.server ? { ...state, authenticated: true } : state;
    case 'sign-out': return { ...state, authenticated: false, drafts: state.drafts.map(d => ({ ...d, paused: true })) };
    case 'tick': {
      if (!state.authenticated) return state;
      let changed = false;
      let records = state.records.map(r => {
        if (r.server !== state.server?.address) return r;
        const next = advanceRecord(r, state.settings, action.now);
        if (next !== r) changed = true;
        return next;
      });
      const drafts = state.drafts.map(d => { if (d.paused) return d; changed = true; return { ...d, seconds: d.seconds + 1 }; });
      const meetings = state.meetings.map(m => {
        if (m.server !== state.server?.address || state.settings.network === 'offline' || m.pausedAt || !['connecting', 'waiting', 'recording'].includes(m.stage)) return m;
        const elapsed = action.now - m.startedAt - m.pausedMs;
        const stage: Meeting['stage'] = m.failOnce && elapsed >= 3500 ? 'error' : elapsed < 4000 ? 'connecting' : elapsed < 10000 ? 'waiting' : elapsed < 70000 ? 'recording' : 'completed';
        if (stage === m.stage) return m;
        changed = true;
        const next: Meeting = { ...m, stage, ...(stage === 'completed' ? { resultId: `meeting-result-${m.id}`, endedAt: action.now } : {}) };
        if (next.resultId && !records.some(r => r.id === next.resultId)) records = [meetingResult(next, action.now), ...records];
        return next;
      });
      const dialogs = state.dialogs.map(d => {
        if (!ownDialog(d)) return d;
        const turns = d.turns.map(t => {
          if (t.status !== 'pending' || action.now < t.dueAt) return t;
          changed = true;
          if (state.settings.network === 'offline' || t.failOnce) return { ...t, status: 'error' as const, failOnce: false, error: 'Не удалось получить ответ. Вопрос и выбранные источники сохранены.' };
          if (!t.snapshots.every(s => state.records.some(r => r.id === s.recordId && canRead(state, r)))) return { ...t, status: 'error' as const, error: 'Один из источников больше недоступен. Измените выбор записей.' };
          return { ...t, status: 'ready' as const, ...answerFromSnapshots(t.question, t.snapshots) };
        });
        return turns.some((t, i) => t !== d.turns[i]) ? { ...d, turns } : d;
      });
      return changed ? { ...state, records, drafts, meetings, dialogs } : state;
    }
  }
}

export function hydrateState(value: unknown, fallback: AppState): AppState {
  if (!value || typeof value !== 'object') return fallback;
  const s = value as AppState;
  if (s.version !== 1 || !Array.isArray(s.records) || !Array.isArray(s.drafts) || !Array.isArray(s.dialogs) || !Array.isArray(s.folders) || !Array.isArray(s.meetings) || !s.settings) return fallback;
  if (!['wifi', 'mobile', 'offline'].includes(s.settings.network)) return fallback;
  if (!s.records.every(r => r && typeof r.id === 'string' && typeof r.title === 'string' && Array.isArray(r.transcript) && r.materials && typeof r.server === 'string')) return fallback;
  if (s.createdWorkspaces !== undefined && (!Array.isArray(s.createdWorkspaces) || !s.createdWorkspaces.every(w => w && typeof w.id === 'string' && typeof w.name === 'string' && typeof w.description === 'string' && typeof w.color === 'string' && typeof w.server === 'string' && typeof w.owner === 'string' && Array.isArray(w.members) && w.members.every(m => m && typeof m.name === 'string' && typeof m.role === 'string' && typeof m.email === 'string')))) return fallback;
  const createdWorkspaces = s.createdWorkspaces?.map(w => {
    if (w.invitationDrafts === undefined) return w;
    const safe: WorkspaceInvitationDraft[] = [];
    for (const draft of Array.isArray(w.invitationDrafts) ? w.invitationDrafts : []) {
      if (!validateInvitationDrafts([...safe, draft]) && !w.members.some(m => m.email.toLowerCase() === draft.email.trim().toLowerCase())) safe.push(draft);
    }
    return { ...w, invitationDrafts: normalizeInvitationDrafts(safe) };
  });
  const memberSelections = Array.isArray(s.memberSelections) ? s.memberSelections.filter(v=>v&&typeof v.workspaceId==='string'&&typeof v.server==='string'&&typeof v.owner==='string'&&Array.isArray(v.members)&&v.members.length<=50&&v.members.every(m=>m&&typeof m.name==='string'&&typeof m.email==='string'&&typeof m.role==='string')) : [];
  const workspaceDetails = Array.isArray(s.workspaceDetails) ? s.workspaceDetails.filter(d=>d&&typeof d.workspaceId==='string'&&typeof d.server==='string'&&typeof d.owner==='string'&&typeof d.name==='string'&&d.name.trim().length>0&&d.name.length<=80&&typeof d.description==='string'&&d.description.length<=500) : [];
  return { ...s, createdWorkspaces, memberSelections, workspaceDetails, drafts: s.drafts.map(d => ({ ...d, paused: true })), dialogs: s.dialogs.map(d => ({ ...d, turns: d.turns.map(t => t.status === 'pending' ? { ...t, status: 'error', error: 'Запрос прерван. Повторите, чтобы получить ответ.' } : t) })) };
}
