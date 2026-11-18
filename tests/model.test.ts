import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, OWNER, SERVER } from '../src/fixtures.ts';
import { filterMeetings } from '../src/model.ts';
import { advanceRecord, answerFromSnapshots, areaAvailable, areaName, areaRecordCount, canEditTranscript, DEFAULT_FILTERS, dialogMatchesSearch, draftDestinationAvailable, filterDrafts, filterRecords, findTranscriptMatches, hydrateState, isActive, isStale, materialAvailable, materialPresentation, meetingDuration, normalizeMeetingUrl, normalizeServer, pluralConnections, pluralDrafts, pluralParticipants, pluralRecords, pluralSpeakers, pluralUtterances, recordDialog, recordDialogs, canManageInvitationDrafts, canEditDemoMembers, demoMembers, validateInvitationDrafts, reducer, retryPresentation, scopeLabel, scopeMaterials, scopeRecords, segmentAtTime, sourceError, sourceSnapshot, statusPresentation, transcriptEditReason, turnAccessible, validateFolder, validateWorkspace, versionNotice, visibleDialogs, visibleRecords, workspaceList } from '../src/model.ts';
import type { AppState, AssistantDialog, Draft, Meeting, Recording, Scope } from '../src/types.ts';

const now = Date.parse('2026-11-10T12:00:00Z');
const rec = (s: AppState, id = 'project-committee') => s.records.find(r => r.id === id)!;
const dialog = (s: AppState, id = 'dialog-decisions') => s.dialogs.find(d => d.id === id)!;
const all = { kind: 'all' as const };
const tick = (s: AppState, count: number) => { for (let i = 0; i < count; i++) s = reducer(s, { type: 'tick', now: now + i * 1000 }); return s; };

test('library is seeded independently with sixteen records and one draft', () => {
  const s = initialState(); assert.equal(visibleRecords(s).length, 16); assert.equal(filterDrafts(s, all, DEFAULT_FILTERS).length, 1); assert.equal(s.records[0].id, 'project-committee');
});
test('root contains only uploaded records from its area', () => {
  const s = initialState(); const result = filterRecords(s, { kind: 'folder', areaId: 'personal', folderId: 'root' }, DEFAULT_FILTERS);
  assert.ok(result.length); assert.ok(result.every(r => r.areaId === 'personal' && r.folderId === null && isOnServer(r)));
  assert.equal(filterDrafts(s, all, { ...DEFAULT_FILTERS, folderId: 'root' }).length, 0);
});
function isOnServer(r: Recording) { return ['ready', 'processing', 'processing-error'].includes(r.status); }
test('source, area, state and query filters combine without mutation', () => {
  const s = initialState(); const filters = { ...DEFAULT_FILTERS, source: 'file' as const, areaId: 'pilot', status: 'attention' as const, query: 'пилота' };
  assert.deepEqual(filterRecords(s, all, filters).map(r => r.id), ['pilot-planning']); assert.equal(filters.source, 'file'); assert.equal(s.records.length, 16);
});
test('library date search matches both numeric and Russian dates across entry types', () => {
  const s = initialState();
  const date = new Date(2026, 7, 24, 12).toISOString();
  s.records[0].createdAt = date;
  s.drafts[0].createdAt = date;
  s.meetings = [{ id: 'date-test', title: 'Тестовая встреча', url: 'https://meet.company.ru/room', agentName: 'Тезис Агент', server: SERVER, areaId: 'project', stage: 'connecting', startedAt: Date.parse(date), pausedMs: 0 }];
  for (const query of ['24.08', '24.8', '24.08.2026', '24 августа']) {
    const filters = { ...DEFAULT_FILTERS, query };
    assert.ok(filterRecords(s, all, filters).some(record => record.id === s.records[0].id), query);
    assert.ok(filterDrafts(s, all, filters).some(draft => draft.id === s.drafts[0].id), query);
    assert.ok(filterMeetings(s, all, filters).some(item => item.id === 'date-test'), query);
  }
  assert.equal(filterMeetings(s, all, { ...DEFAULT_FILTERS, query: '25.08' }).length, 0);
});
test('drafts are private and not attention failures', () => {
  const s = initialState(); s.drafts[0].areaId = 'project';
  assert.equal(filterDrafts(s, { kind: 'area', areaId: 'personal' }, DEFAULT_FILTERS).length, 1);
  assert.equal(filterDrafts(s, all, { ...DEFAULT_FILTERS, status: 'attention' }).length, 0);
});
test('existing legacy folders are browsable without a migration', () => {
  const s = initialState(); rec(s, 'server-operations').folderId = 'legacy-projects';
  assert.deepEqual(filterRecords(s, { kind: 'folder', areaId: 'legacy', folderId: 'legacy-projects' }, DEFAULT_FILTERS).map(r => r.id), ['server-operations']);
});
test('folder validation respects area, uniqueness and connectivity', () => {
  const s = initialState(); assert.equal(validateFolder(s, 'Новая', 'personal'), null); assert.ok(validateFolder(s, 'Новая', null)); assert.ok(validateFolder(s, 'Планирование', 'project')); assert.equal(validateFolder(s, 'Планирование', 'pilot'), null);
  assert.ok(validateFolder(s, '  ', 'project')); assert.ok(validateFolder(s, 'В корне пространства', 'project'));
  s.settings.network = 'offline'; assert.ok(validateFolder(s, 'Новая', 'project'));
});
test('folder deletion preserves every record, audience and text', () => {
  const s = initialState(); const before = rec(s); const next = reducer(s, { type: 'delete-folder', id: 'project-planning' });
  assert.equal(next.records.length, s.records.length); assert.equal(rec(next).folderId, null); assert.equal(rec(next).areaId, before.areaId); assert.equal(rec(next).summary, before.summary); assert.equal(s.folders.length, 5);
});
test('folder rename cannot change its area or server', () => {
  const s = initialState(); const folder = s.folders[0]; assert.equal(reducer(s, { type: 'save-folder', folder: { ...folder, areaId: 'pilot' } }), s);
});
test('moving a recording changes audience explicitly without duplication', () => {
  const s = initialState(); const next = reducer(s, { type: 'move-area', id: 'project-committee', areaId: 'personal', now });
  assert.equal(next.records.length, s.records.length); assert.equal(rec(next).id, rec(s).id); assert.equal(rec(next).areaId, 'personal'); assert.equal(rec(next).folderId, null); assert.deepEqual(rec(next).transcript, rec(s).transcript);
});
test('folders must be compatible with the recording area', () => {
  const s = initialState(); assert.equal(reducer(s, { type: 'move-folder', id: 'project-committee', folderId: 'pilot-interviews' }), s);
});
test('offline blocks server mutations and preserves local materials', () => {
  const s = initialState(); s.settings.network = 'offline';
  for (const action of [{ type: 'move-area', id: 'project-committee', areaId: 'personal', now }, { type: 'delete-record', id: 'project-committee' }, { type: 'operation', id: 'project-committee', operation: 'summary' }] as const) assert.equal(reducer(s, action), s);
  assert.notEqual(reducer(s, { type: 'rename-record', id: 'workgroup', title: 'Локальная правка', now }), s);
});
test('a first-pass summary is never shown prematurely', () => {
  const s = initialState(); const r = { ...rec(s), status: 'processing' as const, processing: { phase: 'transcription' as const, progress: 20, ticks: 0 } };
  assert.equal(materialAvailable(r, 'summary'), false); assert.equal(materialAvailable(r, 'transcript'), true); assert.equal(canEditTranscript(s, r), false);
});
test('manual transcript editing updates revision and marks summary stale', () => {
  const s = initialState(); const next = reducer(s, { type: 'edit-transcript', id: rec(s).id, segmentId: rec(s).transcript[0].id, text: 'Уникальная ручная правка абрикос.', now });
  assert.equal(rec(next).transcriptRevision, 2); assert.equal(isStale(rec(next)), true); assert.notEqual(rec(next).transcript[0].text, rec(s).transcript[0].text);
  assert.equal(reducer(next, { type: 'edit-transcript', id: rec(s).id, segmentId: 'missing', text: 'test', now }), next);
});
test('summary regeneration uses current edited text', () => {
  let s = initialState(); s = reducer(s, { type: 'edit-transcript', id: rec(s).id, segmentId: rec(s).transcript[0].id, text: 'Уникальная ручная правка абрикос.', now });
  s = reducer(s, { type: 'operation', id: rec(s).id, operation: 'summary' }); assert.equal(materialAvailable(rec(s), 'summary'), true);
  s = tick(s, 6); assert.ok(rec(s).summary.includes('абрикос')); assert.equal(isStale(rec(s)), false);
});
test('reprocessing retains available materials and manual text', () => {
  let s = initialState(); const text = rec(s).transcript[0].text; s = reducer(s, { type: 'operation', id: rec(s).id, operation: 'reprocess' });
  assert.equal(materialAvailable(rec(s), 'summary'), true); assert.equal(canEditTranscript(s, rec(s)), false);
  s = tick(s, 20); assert.equal(rec(s).status, 'ready'); assert.equal(rec(s).operation, undefined); assert.equal(rec(s).transcript[0].text, text);
});
test('speaker operation does not regenerate the summary', () => {
  let s = initialState(); const summary = rec(s).summary; const revision = rec(s).summaryRevision; s = reducer(s, { type: 'operation', id: rec(s).id, operation: 'speakers' }); s = tick(s, 6);
  assert.equal(rec(s).summary, summary); assert.equal(rec(s).summaryRevision, revision);
});
test('errors never auto-advance and retry only the failed phase', () => {
  let s = initialState(); const failed = rec(s, 'pilot-planning'); s = tick(s, 20); assert.equal(rec(s, failed.id).status, 'processing-error');
  s = reducer(s, { type: 'retry-record', id: failed.id }); assert.equal(rec(s, failed.id).processing?.phase, 'summary'); assert.deepEqual(rec(s, failed.id).transcript, failed.transcript);
});
test('failed operations are attention, not active processing', () => {
  const r = { ...rec(initialState()), status: 'processing-error' as const, operation: 'reprocess' as const }; assert.equal(isActive(r), false);
});
test('only explicitly requested uploads resume on permitted connectivity', () => {
  const s = initialState(); const old = rec(s, 'workgroup');
  assert.equal(advanceRecord(old, s.settings, now), old);
  const queued = { ...old, uploadRequested: true }; assert.equal(advanceRecord(queued, { ...s.settings, network: 'offline' }, now), queued);
  assert.equal(advanceRecord(queued, s.settings, now).status, 'uploading');
});
test('foreign-server local records are never automatically sent', () => {
  const s = initialState(); rec(s, 'workgroup').server = 'other.company.ru'; rec(s, 'workgroup').uploadRequested = true;
  const next = tick(s, 20); assert.equal(rec(next, 'workgroup').status, 'local');
});
test('multiple drafts remain independent and finishing removes only one', () => {
  let s = initialState(); const d: Draft = { ...s.drafts[0], id: 'second', paused: false, seconds: 8 }; s = reducer(s, { type: 'create-draft', draft: d });
  assert.equal(s.drafts.length, 2); assert.equal(s.drafts[1].paused, true);
  s = reducer(s, { type: 'finish-draft', id: 'second', recordId: 'finished', now }); assert.equal(s.drafts.length, 1); assert.equal(s.records[0].id, 'finished'); assert.equal(s.records[0].duration, 8);
});
test('resuming a draft pauses other captures, restart preserves title', () => {
  let s = initialState(); s.drafts.push({ ...s.drafts[0], id: 'second', paused: false }); s = reducer(s, { type: 'update-draft', id: 'draft-first', patch: { paused: false, seconds: 0 } });
  assert.equal(s.drafts[1].paused, true); assert.equal(s.drafts[0].title, 'Запись 26.08.2026, 20:47');
});
test('a fresh recording never claims generated speech', () => {
  let s = initialState(); s = reducer(s, { type: 'finish-draft', id: 'draft-first', recordId: 'fresh', now }); s = tick(s, 25);
  assert.equal(rec(s, 'fresh').noSpeech, true); assert.equal(rec(s, 'fresh').summary, ''); assert.equal(rec(s, 'fresh').status, 'ready');
});
const meeting = (): Meeting => ({ id: 'meeting', title: 'Встреча', url: 'https://meet.company.ru/room', agentName: 'Тезис Агент', server: SERVER, areaId: 'project', stage: 'connecting', startedAt: now, pausedMs: 0 });
test('meeting connections are idempotent and cancelling produces no recording', () => {
  let s = initialState(); s = reducer(s, { type: 'connect-meeting', meeting: meeting() }); const count = s.records.length;
  assert.equal(reducer(s, { type: 'connect-meeting', meeting: { ...meeting(), id: 'duplicate' } }), s);
  s = reducer(s, { type: 'stop-meeting', id: 'meeting', now: now + 1000 }); assert.equal(s.records.length, count); assert.equal(s.meetings[0].stage, 'cancelled');
});
test('agent pause excludes paused time and keeps one stable result', () => {
  let s = initialState(); s = reducer(s, { type: 'connect-meeting', meeting: meeting() }); s = reducer(s, { type: 'tick', now: now + 20000 }); assert.equal(s.meetings[0].stage, 'recording');
  s = reducer(s, { type: 'pause-meeting', id: 'meeting', now: now + 20000 }); assert.equal(meetingDuration(s.meetings[0], now + 40000), 10);
  s = reducer(s, { type: 'pause-meeting', id: 'meeting', now: now + 40000 }); s = reducer(s, { type: 'stop-meeting', id: 'meeting', now: now + 45000 });
  assert.equal(rec(s, 'meeting-result-meeting').duration, 15); const count = s.records.length;
  s = reducer(s, { type: 'tick', now: now + 100000 }); assert.equal(s.records.length, count);
  s = reducer(s, { type: 'delete-record', id: 'meeting-result-meeting' }); s = reducer(s, { type: 'tick', now: now + 200000 }); assert.ok(!s.records.some(r => r.id === 'meeting-result-meeting'));
});
test('failed agent URL correction preserves identity, title and area', () => {
  let s = initialState(); s.meetings = [{ ...meeting(), stage: 'error' }]; s = reducer(s, { type: 'retry-meeting', id: 'meeting', url: 'https://meet.company.ru/new', now });
  assert.equal(s.meetings[0].title, 'Встреча'); assert.equal(s.meetings[0].areaId, 'project'); assert.equal(s.meetings[0].id, 'meeting'); assert.equal(s.meetings[0].url, 'https://meet.company.ru/new');
});
test('automatic, explicit and explicitly empty Assistant scopes stay distinct', () => {
  const s = initialState(); const scope: Scope = { mode: 'auto', areaId: 'all', recordIds: [] }; assert.ok(scopeRecords(s, scope).length > 3);
  assert.equal(scopeRecords(s, { ...scope, mode: 'explicit' }).length, 0); assert.ok(sourceError(s, { ...scope, mode: 'explicit' }));
  assert.equal(scopeRecords(s, { ...scope, areaId: 'unavailable' }).length, 0); assert.equal(scopeRecords(s, { ...scope, folderId: 'missing' }).length, 0);
});
test('Assistant snapshots are immutable and answers use current text on the next turn', () => {
  let s = initialState(); s = reducer(s, { type: 'update-dialog', id: 'dialog-decisions', patch: { draft: 'Какие решения приняты?' }, now }); s = reducer(s, { type: 'send', id: 'dialog-decisions', turnId: 'new-turn', now });
  const snapshot = dialog(s).turns.at(-1)!.snapshots[0].text;
  s = reducer(s, { type: 'edit-transcript', id: rec(s).id, segmentId: rec(s).transcript[0].id, text: 'Решили проверить абрикос.', now });
  assert.equal(dialog(s).turns.at(-1)!.snapshots[0].text, snapshot); assert.ok(sourceSnapshot(rec(s))?.text.includes('абрикос'));
});
test('answers cite only sources actually used; no match gets a clarification', () => {
  const snapshots = [{ recordId: 'one', title: 'Первый', revision: 1, text: 'На встрече обсуждали уникальный абрикос и проверки совместимости.' }, { recordId: 'two', title: 'Второй', revision: 1, text: 'На второй встрече говорили о погоде и расходах на электричество.' }];
  assert.deepEqual(answerFromSnapshots('Что про абрикос?', snapshots).usedRecordIds, ['one']);
  const none = answerFromSnapshots('Зебра на Марсе?', snapshots); assert.deepEqual(none.usedRecordIds, []); assert.ok(none.answer.includes('Уточните'));
});
test('dialog history searches accessible answers without exposing hidden answers', () => {
  const s = initialState(); const d = dialog(s);
  assert.equal(dialogMatchesSearch(s, d, 'sso'), true);
  d.turns.push({ ...d.turns[0], id: 'later', question: 'Ещё вопрос', answer: 'Другой ответ' });
  assert.equal(dialogMatchesSearch(s, d, ' SSO '), true);
  s.records = s.records.filter(r => r.id !== 'project-committee');
  assert.equal(dialogMatchesSearch(s, d, 'sso'), false);
  assert.equal(dialogMatchesSearch(s, d, 'Ещё вопрос'), true);
});
test('a lost unused source does not hide an answer, a lost used source does', () => {
  const s = initialState(); const turn = dialog(s).turns[0]; turn.snapshots.push({ recordId: 'unused', title: 'Unused', text: 'Text', revision: 1 });
  assert.equal(turnAccessible(s, turn), true); s.records = s.records.filter(r => r.id !== 'project-committee'); assert.equal(turnAccessible(s, turn), false);
});
test('changing sources after a question requires a new dialog and transfers the draft once', () => {
  let s = initialState(); const old = dialog(s); s = reducer(s, { type: 'update-dialog', id: old.id, patch: { draft: 'Продолжение', scope: { mode: 'auto', areaId: 'personal', recordIds: [] } }, now });
  assert.deepEqual(dialog(s).scope, old.scope);
  const next: AssistantDialog = { ...old, id: 'new-dialog', title: 'Новый диалог', turns: [], draft: 'Продолжение', scope: { mode: 'auto', areaId: 'personal', recordIds: [] } };
  s = reducer(s, { type: 'create-dialog', dialog: next, moveDraftFrom: old.id }); assert.equal(dialog(s).draft, ''); assert.equal(dialog(s, 'new-dialog').draft, 'Продолжение'); assert.equal(dialog(s).turns.length, 1);
});
test('a global dialog accepts source selection before the first question and locks it afterward', () => {
  let state = initialState();
  const chosen: Scope = { mode: 'explicit', areaId: 'all', recordIds: ['project-committee'] };
  state = reducer(state, { type: 'update-dialog', id: 'dialog-draft', patch: { scope: chosen }, now });
  assert.deepEqual(dialog(state, 'dialog-draft').scope, chosen);
  state = reducer(state, { type: 'send', id: 'dialog-draft', turnId: 'first-turn', now });
  assert.equal(dialog(state, 'dialog-draft').turns.length, 1);
  state = reducer(state, { type: 'update-dialog', id: 'dialog-draft', patch: { scope: { mode: 'auto', areaId: 'personal', recordIds: [] }, draft: 'Следующий вопрос' }, now: now + 1 });
  assert.deepEqual(dialog(state, 'dialog-draft').scope, chosen);
  assert.equal(dialog(state, 'dialog-draft').draft, 'Следующий вопрос');
});
test('Assistant retry reuses the same question and snapshots', () => {
  let s = initialState(); s = reducer(s, { type: 'update-dialog', id: 'dialog-decisions', patch: { draft: 'Кратко по записям' }, now }); s = reducer(s, { type: 'send', id: 'dialog-decisions', turnId: 'retry-me', now, failOnce: true }); s = reducer(s, { type: 'tick', now: now + 3000 });
  const before = dialog(s).turns.at(-1)!; assert.equal(before.status, 'error'); s = reducer(s, { type: 'retry-turn', id: 'dialog-decisions', turnId: 'retry-me', now: now + 4000 }); s = reducer(s, { type: 'tick', now: now + 6000 });
  assert.equal(dialog(s).turns.length, 2); assert.equal(dialog(s).turns.at(-1)!.status, 'ready'); assert.deepEqual(dialog(s).turns.at(-1)!.snapshots, before.snapshots);
});
test('server and owner isolation protect dialog history and mutations', () => {
  const s = initialState(); s.dialogs.push({ ...dialog(s), id: 'foreign', server: 'other.company.ru' }); s.dialogs.push({ ...dialog(s), id: 'other-owner', owner: 'other@sever.ru' });
  assert.equal(visibleDialogs(s).length, 3); const next = reducer(s, { type: 'delete-dialog', id: 'foreign' }); assert.equal(next.dialogs.length, 5);
});
test('rehydration pauses captures and makes interrupted requests retryable', () => {
  const s = initialState(); s.drafts[0].paused = false; dialog(s).turns[0].status = 'pending'; const next = hydrateState(s, initialState());
  assert.equal(next.drafts[0].paused, true); assert.equal(dialog(next).turns[0].status, 'error'); assert.equal(next.records.length, 16);
});
test('server validation accepts HTTPS hosts but never insecure, credential or path URLs', () => {
  assert.equal(normalizeServer('thesis.company.ru'), 'thesis.company.ru'); assert.equal(normalizeServer('https://thesis.company.ru/'), 'thesis.company.ru'); assert.equal(normalizeServer('https://thesis.company.ru:8443'), 'thesis.company.ru:8443');
  for (const input of ['http://thesis.company.ru', 'https://a.company.ru/path', 'https://u:p@company.ru', 'https://a.company.ru?x=1', 'localhost']) assert.equal(normalizeServer(input), null);
  assert.equal(normalizeMeetingUrl('http://meet.company.ru/room'), null); assert.ok(normalizeMeetingUrl('https://meet.company.ru/room'));
});
test('literal transcript find highlights within words and uses half-open playback ranges', () => {
  const segments = [{ id: 'a', speaker: 'А', start: 0, end: 5, color: '#fff', text: 'ТЕКСТ и контекст. Текст.' }, { id: 'b', speaker: 'Б', start: 10, end: 20, color: '#fff', text: 'Нет совпадений.' }];
  assert.equal(findTranscriptMatches(segments, 'текст').length, 3); assert.equal(findTranscriptMatches(segments, '.').length, 3); assert.equal(segmentAtTime(segments, 0)?.id, 'a'); assert.equal(segmentAtTime(segments, 5), undefined); assert.equal(segmentAtTime(segments, 10)?.id, 'b');
});

test('Russian counts decline correctly, including 11–14 and larger values', () => {
  const examples = [[0, 'реплик'], [1, 'реплика'], [2, 'реплики'], [3, 'реплики'], [4, 'реплики'], [5, 'реплик'], [11, 'реплик'], [12, 'реплик'], [14, 'реплик'], [21, 'реплика'], [22, 'реплики'], [25, 'реплик'], [111, 'реплик'], [114, 'реплик']] as const;
  for (const [count, form] of examples) assert.equal(pluralUtterances(count), `${count} ${form}`);
  assert.equal(pluralSpeakers(1), '1 спикер'); assert.equal(pluralSpeakers(3), '3 спикера'); assert.equal(pluralSpeakers(11), '11 спикеров');
  assert.equal(pluralParticipants(1), '1 участник'); assert.equal(pluralParticipants(22), '22 участника'); assert.equal(pluralParticipants(112), '112 участников');
  assert.equal(pluralRecords(21), '21 запись'); assert.equal(pluralRecords(14), '14 записей');
  assert.equal(pluralDrafts(1), '1 черновик'); assert.equal(pluralDrafts(4), '4 черновика'); assert.equal(pluralDrafts(11), '11 черновиков'); assert.equal(pluralDrafts(21), '21 черновик');
  assert.equal(pluralConnections(1), '1 подключение'); assert.equal(pluralConnections(3), '3 подключения'); assert.equal(pluralConnections(14), '14 подключений');
});
test('material state reflects the failed phase rather than claiming it is preparing', () => {
  const s = initialState(); const failedSummary = rec(s, 'pilot-planning'); const failedUpload = rec(s, 'pilot-discussion');
  const summary = materialPresentation(failedSummary, 'summary', s.settings);
  assert.equal(summary.label, 'Не удалось создать резюме'); assert.equal(summary.description, 'Транскрипция сохранена и доступна.'); assert.equal(summary.retry, true); assert.equal(summary.pending, false);
  assert.equal(materialPresentation(failedSummary, 'transcript', s.settings).label, '3 реплики');
  assert.equal(materialPresentation(failedUpload, 'summary', s.settings).label, 'Не удалось отправить запись'); assert.equal(materialPresentation(failedUpload, 'transcript', s.settings).label, 'Не удалось отправить запись');
  assert.equal(materialPresentation(failedUpload, 'summary', s.settings).pending, false); assert.equal(retryPresentation(s, failedUpload)?.label, 'Повторить отправку');
});
test('summary, transcript, partial and previous versions stay independent across phases', () => {
  const s = initialState(); const partial = rec(s, 'contractor-meeting');
  assert.equal(materialPresentation(partial, 'summary', s.settings).label, 'Ожидает транскрипции');
  assert.equal(materialPresentation(partial, 'transcript', s.settings).label, '2 реплики · дополняется');
  const failed = { ...partial, status: 'processing-error' as const };
  assert.equal(materialPresentation(failed, 'summary', s.settings).label, 'Ожидает повтора распознавания');
  assert.equal(materialPresentation(failed, 'transcript', s.settings).label, '2 реплики · ошибка распознавания');
  assert.equal(retryPresentation(s, failed)?.label, 'Повторить распознавание');
  const previous = { ...rec(s), status: 'processing-error' as const, operation: 'reprocess' as const, processing: { phase: 'summary' as const, ticks: 0 } };
  assert.equal(materialPresentation(previous, 'summary', s.settings).label, 'Предыдущая версия · обновление не завершено');
  assert.equal(versionNotice(previous, 'transcript'), undefined); assert.equal(materialPresentation(previous, 'transcript', s.settings).label, '8 реплик');
  assert.equal(materialPresentation(previous, 'summary', s.settings).retry, true);
});
test('local states and retry availability clearly reflect network, permissions and destination', () => {
  const s = initialState(); const local = rec(s, 'workgroup'); const upload = rec(s, 'pilot-discussion'); const summary = rec(s, 'pilot-planning');
  assert.equal(materialPresentation(local, 'summary', s.settings).label, 'Запись не отправлена');
  assert.equal(retryPresentation(s, local)?.label, 'Отправить запись');
  s.settings.network = 'offline'; assert.equal(statusPresentation(local, s.settings).label, 'На устройстве');
  assert.match(retryPresentation(s, summary)?.reason ?? '', /сети/); assert.match(retryPresentation(s, upload)?.reason ?? '', /сети/);
  const requested = { ...local, uploadRequested: true }; assert.equal(materialPresentation(requested, 'summary', s.settings).label, 'Ожидает подключения'); assert.equal(retryPresentation(s, requested), null);
  s.settings.network = 'mobile'; s.settings.wifiOnly = true; assert.match(retryPresentation(s, upload)?.reason ?? '', /Wi-Fi/);
  assert.match(retryPresentation(s, { ...summary, canManage: false })?.reason ?? '', /права/);
  assert.match(retryPresentation(s, { ...upload, server: 'other.example.ru' })?.reason ?? '', /исходному серверу/);
});
test('completed speechless or unavailable materials never show a loading skeleton', () => {
  const s = initialState(); const silent = rec(s, 'no-speech');
  assert.equal(materialPresentation(silent, 'summary', s.settings).label, 'Нет текста для резюме'); assert.equal(materialPresentation(silent, 'transcript', s.settings).label, 'Речь не обнаружена');
  assert.equal(materialPresentation(silent, 'summary', s.settings).pending, false);
  const missing = { ...rec(s), transcript: [], summary: '', materials: { transcript: false, summary: false } };
  assert.equal(materialPresentation(missing, 'summary', s.settings).label, 'Резюме недоступно'); assert.equal(materialPresentation(missing, 'summary', s.settings).pending, false);
});
test('summary failure does not lock a complete transcript; active or failed recognition does', () => {
  const s = initialState(); const summaryFailure = rec(s, 'pilot-planning'); const partial = rec(s, 'contractor-meeting');
  assert.equal(canEditTranscript(s, summaryFailure), true);
  const edited = reducer(s, { type: 'edit-transcript', id: summaryFailure.id, segmentId: summaryFailure.transcript[0].id, text: 'Сохранённая правка.', now });
  assert.equal(rec(edited, summaryFailure.id).transcript[0].text, 'Сохранённая правка.');
  assert.equal(canEditTranscript(s, partial), false); assert.match(transcriptEditReason(s, partial) ?? '', /после завершения обработки/);
  const stopped = { ...partial, status: 'processing-error' as const }; assert.equal(canEditTranscript(s, stopped), false); assert.match(transcriptEditReason(s, stopped) ?? '', /Распознавание остановлено/);
  s.settings.network = 'offline'; assert.match(transcriptEditReason(s, summaryFailure) ?? '', /Подключитесь к сети/);
  assert.match(transcriptEditReason(s, { ...summaryFailure, canManage: false }) ?? '', /Нет права/);
});

test('folder-scoped Assistant uses only the folder, not filters or the entire space', () => {
  const s = initialState(); const scope: Scope = { mode: 'auto', areaId: 'project', folderId: 'project-planning', recordIds: [] };
  assert.deepEqual(scopeRecords(s, scope).map(r => r.id), ['project-committee']);
  assert.equal(scopeLabel(s, scope), 'Проектный комитет · Планирование');
  assert.equal(scopeMaterials(s, scope), '1 запись · резюме');
  assert.equal(sourceError(s, scope), null);
  const missing = { ...scope, folderId: 'deleted' }; assert.deepEqual(scopeRecords(s, missing), []); assert.match(sourceError(s, missing) ?? '', /Папка недоступна/);
});
test('Assistant root and legacy folders stay separate from personal and shared areas', () => {
  const s = initialState(); rec(s, 'server-operations').folderId = 'legacy-projects';
  const root: Scope = { mode: 'auto', areaId: 'project', folderId: 'root', recordIds: [] };
  assert.ok(scopeRecords(s, root).length); assert.ok(scopeRecords(s, root).every(r => r.areaId === 'project' && r.folderId === null));
  assert.equal(scopeLabel(s, root), 'Проектный комитет · В корне пространства');
  const legacy: Scope = { mode: 'auto', areaId: 'legacy', folderId: 'legacy-projects', recordIds: [] };
  assert.deepEqual(scopeRecords(s, legacy).map(r => r.id), ['server-operations']); assert.equal(sourceError(s, legacy), null);
  const other = { ...legacy, folderId: 'project-planning' }; assert.deepEqual(scopeRecords(s, other), []); assert.match(sourceError(s, other) ?? '', /Папка недоступна/);
});
test('source snapshots identify the actual material and retain its version without timecodes', () => {
  const s = initialState(); const summary = sourceSnapshot(rec(s))!; const transcript = sourceSnapshot(rec(s, 'contractor-meeting'))!;
  assert.equal(summary.material, 'summary'); assert.equal(summary.revision, rec(s).summaryRevision);
  assert.equal(transcript.material, 'transcript'); assert.equal(transcript.notice, 'По распознанной части');
  assert.equal('timestamp' in summary, false); assert.equal('segmentId' in transcript, false);
});
test('stopping a pending Assistant turn prevents completion and retries the same snapshots once', () => {
  let s = initialState(); s = reducer(s, { type: 'update-dialog', id: 'dialog-decisions', patch: { draft: 'Кратко по записям' }, now });
  s = reducer(s, { type: 'send', id: 'dialog-decisions', turnId: 'stop-me', now });
  const started = dialog(s).turns.at(-1)!; assert.equal(started.status, 'pending');
  s = reducer(s, { type: 'stop-turn', id: 'dialog-decisions', turnId: 'stop-me', now: now + 500 });
  assert.equal(dialog(s).turns.at(-1)!.status, 'stopped'); assert.equal(dialog(s).turns.at(-1)!.answer, '');
  s = reducer(s, { type: 'tick', now: now + 10000 }); assert.equal(dialog(s).turns.at(-1)!.status, 'stopped');
  assert.equal(reducer(s, { type: 'stop-turn', id: 'dialog-decisions', turnId: 'stop-me', now: now + 11000 }), s);
  s = reducer(s, { type: 'retry-turn', id: 'dialog-decisions', turnId: 'stop-me', now: now + 12000 });
  assert.equal(dialog(s).turns.at(-1)!.status, 'pending'); assert.deepEqual(dialog(s).turns.at(-1)!.snapshots, started.snapshots);
  s = reducer(s, { type: 'tick', now: now + 14000 }); assert.equal(dialog(s).turns.at(-1)!.status, 'ready'); assert.equal(dialog(s).turns.filter(t => t.id === 'stop-me').length, 1);
  assert.equal(reducer(s, { type: 'stop-turn', id: 'dialog-decisions', turnId: 'stop-me', now: now + 15000 }), s);
});
test('retry after stop respects offline and deleted source without broadening', () => {
  let s = initialState(); s = reducer(s, { type: 'update-dialog', id: 'dialog-decisions', patch: { draft: 'Какие решения?' }, now }); s = reducer(s, { type: 'send', id: 'dialog-decisions', turnId: 'stopped', now }); s = reducer(s, { type: 'stop-turn', id: 'dialog-decisions', turnId: 'stopped', now });
  const offline = { ...s, settings: { ...s.settings, network: 'offline' as const } }; assert.equal(reducer(offline, { type: 'retry-turn', id: 'dialog-decisions', turnId: 'stopped', now }), offline);
  s = { ...s, records: s.records.filter(r => r.id !== 'project-committee') }; s = reducer(s, { type: 'retry-turn', id: 'dialog-decisions', turnId: 'stopped', now }); assert.equal(dialog(s).turns.at(-1)!.status, 'stopped');
});

test('new empty workspace persists without changing existing records, folders or dialogs', () => {
  const before = initialState();
  const after = reducer(before, { type: 'create-workspace', id: 'new-space', name: '  Рабочая   группа  ', server: SERVER });
  assert.equal(after.createdWorkspaces?.length, 1); assert.equal(areaName('new-space', after), 'Рабочая группа');
  assert.equal(areaAvailable(after, 'new-space'), true); assert.equal(areaRecordCount(after, 'new-space'), 0);
  assert.deepEqual(after.createdWorkspaces?.[0].members, []);
  assert.equal(after.records, before.records); assert.equal(after.folders, before.folders); assert.equal(after.dialogs, before.dialogs); assert.equal(after.drafts, before.drafts);
  const reloaded = hydrateState(JSON.parse(JSON.stringify(after)), initialState());
  assert.equal(areaName('new-space', reloaded), 'Рабочая группа'); assert.equal(reloaded.records.length, before.records.length);
  const moved = reducer(reloaded, { type: 'move-area', id: 'project-committee', areaId: 'new-space', now });
  assert.equal(rec(moved).folderId, null); assert.equal(areaRecordCount(moved, 'new-space'), 1);
  assert.equal(scopeLabel(moved, { mode: 'auto', areaId: 'new-space', recordIds: [] }), 'Рабочая группа');
  const elsewhere = reducer(moved, { type: 'server', server: { address: 'other.company.ru', organization: 'Другая организация' } });
  assert.equal(workspaceList(elsewhere).some(w => w.id === 'new-space'), false); assert.equal(elsewhere.createdWorkspaces?.length, 1);
  assert.equal(areaAvailable(elsewhere, 'new-space'), false); assert.equal(elsewhere.records.length, before.records.length);
});

test('workspace creation validates names, server and connectivity without inventing members', () => {
  const s = initialState();
  for (const name of ['', 'Личное', 'проектный комитет', 'Все записи', 'x'.repeat(81)]) assert.ok(validateWorkspace(s, name));
  assert.equal(validateWorkspace(s, 'Новая команда'), null);
  assert.equal(reducer(s, { type: 'create-workspace', id: 'duplicate-id', name: 'Проектный комитет', server: SERVER }), s);
  assert.equal(reducer(s, { type: 'create-workspace', id: 'personal', name: 'Новая команда', server: SERVER }), s);
  assert.equal(reducer(s, { type: 'create-workspace', id: 'other-server', name: 'Новая команда', server: 'other.company.ru' }), s);
  const offline = { ...s, settings: { ...s.settings, network: 'offline' as const } };
  assert.ok(validateWorkspace(offline, 'Новая команда')); assert.equal(reducer(offline, { type: 'create-workspace', id: 'offline', name: 'Новая команда', server: SERVER }), offline);
});

test('older saved data remains intact without a workspace field and malformed new data is not replaced', () => {
  const legacy = initialState(); legacy.records[0].title = 'Сохранённое название'; legacy.dialogs[0].draft = 'Сохранённый вопрос';
  assert.equal(legacy.createdWorkspaces, undefined);
  const restored = hydrateState(JSON.parse(JSON.stringify(legacy)), initialState());
  assert.equal(restored.records[0].title, 'Сохранённое название'); assert.equal(restored.dialogs[0].draft, 'Сохранённый вопрос');
  assert.equal(restored.createdWorkspaces, undefined); assert.equal(restored.folders.length, legacy.folders.length);
  const fallback = initialState(); const malformed = { ...legacy, createdWorkspaces: [{ id: 'broken' }] };
  assert.equal(hydrateState(malformed, fallback), fallback);
});

test('personal folder creation and deletion preserve recordings and draft destinations', () => {
  let s = initialState(); const before = rec(s, 'learning');
  const folder = { id: 'personal-new', name: 'Личные заметки', areaId: 'personal', server: SERVER };
  s = reducer(s, { type: 'save-folder', folder }); assert.ok(s.folders.some(f => f.id === folder.id));
  s = reducer(s, { type: 'move-folder', id: before.id, folderId: folder.id });
  s = reducer(s, { type: 'update-draft', id: 'draft-first', patch: { folderId: folder.id } });
  const after = reducer(s, { type: 'delete-folder', id: folder.id });
  assert.equal(rec(after, before.id).id, before.id); assert.equal(rec(after, before.id).summary, before.summary); assert.equal(rec(after, before.id).folderId, null);
  assert.equal(after.drafts.find(d => d.id === 'draft-first')?.folderId, null); assert.equal(after.records.length, s.records.length);
});

test('space counts include recordings in folders but exclude drafts and unfinished connections', () => {
  let s = initialState();
  assert.equal(areaRecordCount(s, 'personal'), 5); assert.equal(areaRecordCount(s, 'project'), 6); assert.equal(areaRecordCount(s, 'pilot'), 4);
  const projectBefore = areaRecordCount(s, 'project');
  assert.ok(s.records.some(r => r.areaId === 'project' && r.folderId === 'project-planning'));
  s = reducer(s, { type: 'move-folder', id: 'project-committee', folderId: null }); assert.equal(areaRecordCount(s, 'project'), projectBefore);
  s = reducer(s, { type: 'create-draft', draft: { ...s.drafts[0], id: 'new-project-draft', areaId: 'project' } });
  s = reducer(s, { type: 'connect-meeting', meeting: meeting() }); assert.equal(areaRecordCount(s, 'project'), projectBefore);
  s = reducer(s, { type: 'move-area', id: 'project-committee', areaId: 'personal', now });
  assert.equal(areaRecordCount(s, 'project'), projectBefore - 1); assert.equal(areaRecordCount(s, 'personal'), 6);
});

test('draft keeps its chosen space and folder through finish and rejects an unavailable destination', () => {
  let s = initialState();
  const draft: Draft = { id: 'folder-draft', title: 'Рабочая запись', seconds: 12, paused: false, createdAt: new Date(now).toISOString(), areaId: 'project', folderId: 'project-planning', server: SERVER };
  s = reducer(s, { type: 'create-draft', draft }); assert.equal(draftDestinationAvailable(s, draft), true);
  const moved = reducer(s, { type: 'update-draft', id: draft.id, patch: { areaId: 'personal' } });
  assert.equal(moved.drafts.find(d => d.id === draft.id)?.folderId, null);
  const invalid = { ...s, folders: s.folders.filter(f => f.id !== 'project-planning') };
  assert.equal(draftDestinationAvailable(invalid, draft), false); assert.equal(reducer(invalid, { type: 'finish-draft', id: draft.id, recordId: 'blocked', now }), invalid);
  s = reducer(s, { type: 'finish-draft', id: draft.id, recordId: 'new-record', now });
  assert.equal(rec(s, 'new-record').areaId, 'project'); assert.equal(rec(s, 'new-record').folderId, 'project-planning');
  assert.equal(s.drafts.some(d => d.id === draft.id), false);
});

test('record Assistant creates one linked dialog without repurposing older one-source history', () => {
  const before = initialState(); const old = dialog(before);
  let state = reducer(before, { type: 'ensure-record-dialog', recordId: 'project-committee', dialogId: 'record-chat', now });
  const linked = recordDialog(state, 'project-committee')!;
  assert.equal(linked.id, 'record-chat'); assert.equal(linked.recordContextId, 'project-committee');
  assert.deepEqual(linked.scope, { mode: 'explicit', areaId: 'all', recordIds: ['project-committee'] });
  assert.equal(dialog(state), old); assert.equal(visibleDialogs(state).some(d => d.id === 'record-chat'), false);
  assert.equal(reducer(state, { type: 'ensure-record-dialog', recordId: 'project-committee', dialogId: 'duplicate', now: now + 1 }), state);
  state = reducer(state, { type: 'update-dialog', id: linked.id, patch: { draft: 'Что решили?' }, now });
  assert.equal(visibleDialogs(state).some(d => d.id === linked.id), true); assert.equal(recordDialog(state, 'project-committee')?.draft, 'Что решили?');
  const restored = hydrateState(JSON.parse(JSON.stringify(state)), initialState());
  assert.equal(recordDialog(restored, 'project-committee')?.id, linked.id); assert.equal(recordDialog(restored, 'project-committee')?.draft, 'Что решили?');
});

test('record Assistant stays pinned to one source when scope changes or the recording moves', () => {
  let state = initialState(); state = reducer(state, { type: 'ensure-record-dialog', recordId: 'project-committee', dialogId: 'record-chat', now });
  state = reducer(state, { type: 'update-dialog', id: 'record-chat', patch: { draft: 'Какие решения?', scope: { mode: 'auto', areaId: 'personal', recordIds: [] } }, now });
  assert.deepEqual(recordDialog(state, 'project-committee')?.scope.recordIds, ['project-committee']);
  state = reducer(state, { type: 'move-area', id: 'project-committee', areaId: 'personal', now });
  state = reducer(state, { type: 'send', id: 'record-chat', turnId: 'turn-record', now });
  assert.equal(recordDialog(state, 'project-committee')?.turns[0].snapshots[0].recordId, 'project-committee');
  assert.equal(recordDialog(state, 'project-committee')?.turns[0].snapshots.length, 1);
});

test('record Assistant enforces server and owner isolation, and unavailable records cannot create dialogs', () => {
  let state = initialState(); const originalCount = state.dialogs.length;
  assert.equal(reducer(state, { type: 'ensure-record-dialog', recordId: 'missing', dialogId: 'missing-chat', now }), state);
  rec(state, 'workgroup').server = 'other.company.ru';
  assert.equal(reducer(state, { type: 'ensure-record-dialog', recordId: 'workgroup', dialogId: 'foreign-chat', now }), state);
  assert.equal(state.dialogs.length, originalCount);
  state = reducer(state, { type: 'ensure-record-dialog', recordId: 'project-committee', dialogId: 'record-chat', now });
  const foreign = { ...state, server: { address: 'other.company.ru', organization: 'Другая' } };
  assert.equal(recordDialog(foreign, 'project-committee'), undefined); assert.equal(state.dialogs.some(d => d.id === 'record-chat'), true);
  const differentOwner = { ...state, dialogs: state.dialogs.map(d => d.id === 'record-chat' ? { ...d, owner: 'other@sever.ru' } : d) };
  assert.equal(recordDialog(differentOwner, 'project-committee'), undefined);
});

test('record Assistant and global history refer to the same turn and draft', () => {
  let state = initialState(); state = reducer(state, { type: 'ensure-record-dialog', recordId: 'project-committee', dialogId: 'record-chat', now });
  state = reducer(state, { type: 'update-dialog', id: 'record-chat', patch: { draft: 'Какие решения приняты?' }, now });
  state = reducer(state, { type: 'send', id: 'record-chat', turnId: 'shared-turn', now });
  state = reducer(state, { type: 'tick', now: now + 4000 });
  state = reducer(state, { type: 'update-dialog', id: 'record-chat', patch: { draft: 'Следующий вопрос' }, now: now + 5000 });
  const linked = recordDialog(state, 'project-committee')!; const fromHistory = visibleDialogs(state).find(d => d.id === linked.id)!;
  assert.equal(fromHistory, linked); assert.equal(fromHistory.turns[0].id, 'shared-turn'); assert.equal(fromHistory.turns[0].status, 'ready'); assert.equal(fromHistory.draft, 'Следующий вопрос');
});


test('scale demo appends fictional data without changing original fixture semantics', async () => {
  const {withDemoScale}=await import('../src/demoScale.ts'); const original=initialState(); const s=withDemoScale(original);
  assert.equal(original.records.length,16); assert.equal(s.records.length,178); assert.equal(workspaceList(s).length,14);
  assert.equal(s.createdWorkspaces?.length,12); assert.equal(s.folders.length,29);
  assert.equal(s.records[0],original.records[0]); assert.equal(s.drafts,original.drafts); assert.equal(s.settings,original.settings); assert.equal(s.dialogs,original.dialogs);
  assert.equal(new Set(s.records.map(r=>r.id)).size,s.records.length);
  assert.equal(visibleRecords(s).length,178);
  assert.deepEqual(filterRecords(s,all,DEFAULT_FILTERS).slice(0,6).map(r=>r.id),filterRecords(original,all,DEFAULT_FILTERS).slice(0,6).map(r=>r.id));
  const counts=[18,12,9,19,11,16,10,8,14,13,17,15];
  for(const [i,w] of s.createdWorkspaces!.entries()){assert.match(w.name,/демо/);assert.equal(areaRecordCount(s,w.id),counts[i]);assert.equal(filterRecords(s,{kind:'area',areaId:w.id},DEFAULT_FILTERS).length,counts[i]);}
  for(const r of s.records.slice(16)){assert.match(r.title,/демо/);assert.match(r.summary,/вымышлены/);assert.ok(r.folderId===null||s.folders.some(f=>f.id===r.folderId&&f.areaId===r.areaId));assert.ok(r.transcript.every(t=>t.end<r.duration!));}
  assert.equal(withDemoScale(s),s);
});
test('scale demo is append-only for saved edits and does not restore later deletions', async () => {
 const {withDemoScale}=await import('../src/demoScale.ts');const original=initialState();original.records[0].title='Сохранённое название';original.settings.network='offline';original.drafts[0].seconds=975;
 const enriched=withDemoScale(original);assert.equal(enriched.records[0].title,'Сохранённое название');assert.equal(enriched.settings.network,'offline');assert.equal(enriched.drafts[0].seconds,975);
 const deleted={...enriched,records:enriched.records.filter(r=>r.id!=='demo-scale-platform-record-1')};const restored=hydrateState(JSON.parse(JSON.stringify(deleted)),initialState());assert.equal(withDemoScale(restored).records.length,177);assert.equal(withDemoScale(restored),restored);
 const foreign={...enriched,server:{address:'other.example.test',organization:'Другой сервер'}};assert.equal(workspaceList(foreign).length,0);assert.ok(!visibleRecords(foreign).some(r=>r.id.startsWith('demo-scale-')));
});


test('scale demo v2 appends uneven counts without restoring v1 deletions or replacing edits', async () => {
 const {withDemoScale}=await import('../src/demoScale.ts');const full=withDemoScale(initialState());
 const v1={...full,demoScaleVersion:1,records:full.records.filter(r=>!r.id.startsWith('demo-scale-')||Number(r.id.split('-').at(-1))<=8)};
 assert.equal(v1.records.length,112);
 const changedRecord=v1.records.find(r=>r.id==='demo-scale-platform-record-2')!;changedRecord.title='Мой сохранённый заголовок';
 v1.records=v1.records.filter(r=>r.id!=='demo-scale-platform-record-1');
 v1.folders=v1.folders.filter(f=>f.id!=='demo-scale-platform-planning');
 const renamed=v1.createdWorkspaces!.find(w=>w.id==='demo-scale-design')!;renamed.name='Моя команда';
 v1.createdWorkspaces=v1.createdWorkspaces!.filter(w=>w.id!=='demo-scale-research');
 const next=withDemoScale(v1);
 assert.equal(next.demoScaleVersion,2);assert.equal(next.records.find(r=>r.id===changedRecord.id),changedRecord);assert.ok(!next.records.some(r=>r.id==='demo-scale-platform-record-1'));
 assert.equal(next.createdWorkspaces,v1.createdWorkspaces);assert.equal(next.folders,v1.folders);assert.ok(!next.records.some(r=>r.id==='demo-scale-design-record-9'));assert.ok(!next.records.some(r=>r.id==='demo-scale-research-record-9'));
 assert.equal(next.records.find(r=>r.id==='demo-scale-platform-record-11')?.folderId,null);
 assert.equal(areaRecordCount(next,'demo-scale-platform'),17);assert.equal(areaRecordCount(next,'demo-scale-support'),19);assert.equal(areaRecordCount(next,'demo-scale-design'),8);
 assert.equal(withDemoScale(next),next);
});


test('record history includes legacy exact-source chats but excludes mixed sources and foreign context', () => {
 const s=initialState(); const old=dialog(s);
 s.dialogs.push({...old,id:'mixed',scope:{...old.scope,recordIds:['project-committee','budget']}});
 s.dialogs.push({...old,id:'wrong-context',recordContextId:'budget'});
 s.dialogs.push({...old,id:'foreign-owner',owner:'other'});
 assert.deepEqual(recordDialogs(s,'project-committee').map(d=>d.id),['dialog-decisions']);
 assert.equal(recordDialogs(s,'missing').length,0);
 assert.equal(recordDialogs({...s,server:{address:'other',organization:'Other'}},'project-committee').length,0);
 assert.equal(recordDialogs(s,'project-committee')[0],old);
});

test('fresh record dialog reuses empty session without losing previous conversation', () => {
 let s=initialState();
 s=reducer(s,{type:'ensure-record-dialog',recordId:'project-committee',dialogId:'empty',now,fresh:true});
 const same=reducer(s,{type:'ensure-record-dialog',recordId:'project-committee',dialogId:'duplicate',now:now+1,fresh:true});
 assert.equal(same,s);
 s=reducer(s,{type:'update-dialog',id:'empty',patch:{draft:'Вопрос'},now});
 s=reducer(s,{type:'send',id:'empty',turnId:'one',now});
 s=reducer(s,{type:'ensure-record-dialog',recordId:'project-committee',dialogId:'next',now:now+2,fresh:true});
 assert.equal(recordDialogs(s,'project-committee').length,3);
 assert.equal(s.dialogs.find(d=>d.id==='empty').turns.length,1);
 assert.equal(s.dialogs.find(d=>d.id==='next').turns.length,0);
});


test('local invitation drafts persist separately from members and enforce owner/server/authentication',()=>{
 let s=initialState();const drafts=[{name:'Example',email:' Person@Example.com ',status:'not-sent' as const}];
 s=reducer(s,{type:'create-workspace',id:'invite-demo',name:'Приглашения демо',server:SERVER,invitationDrafts:drafts});
 const w=s.createdWorkspaces!.find(w=>w.id==='invite-demo')!;
 assert.equal(w.members.length,0);assert.equal(w.invitationDrafts![0].email,'person@example.com');assert.equal(w.invitationDrafts![0].status,'not-sent');assert.equal(canManageInvitationDrafts(s,w.id),true);
 const saved=reducer(s,{type:'save-invitation-drafts',id:w.id,server:SERVER,invitationDrafts:[]});assert.equal(saved.createdWorkspaces![0].invitationDrafts!.length,0);
 for(const invalid of [{...s,authenticated:false},{...s,server:{address:'other',organization:'Other'}},{...s,createdWorkspaces:[{...w,owner:'other'}]}]) {assert.equal(canManageInvitationDrafts(invalid,w.id),false);assert.equal(reducer(invalid,{type:'save-invitation-drafts',id:w.id,server:SERVER,invitationDrafts:[]}),invalid);}
 assert.equal(reducer(s,{type:'save-invitation-drafts',id:'project',server:SERVER,invitationDrafts:drafts}),s);
 assert.ok(validateInvitationDrafts([...drafts,...drafts]));assert.ok(validateInvitationDrafts([{name:'',email:OWNER,status:'not-sent'}]));assert.ok(validateInvitationDrafts([{name:'',email:'invalid',status:'not-sent'}]));
 const restored=hydrateState(JSON.parse(JSON.stringify(s)));assert.deepEqual(restored.createdWorkspaces?.find(v=>v.id===w.id)?.invitationDrafts,w.invitationDrafts);
 const signedOut={...s,authenticated:false};assert.equal(reducer(signedOut,{type:'create-workspace',id:'denied',name:'Denied',server:SERVER}),signedOut);
});


test('invalid optional invitation drafts never reset saved records or dialogs',()=>{
 const s=reducer(initialState(),{type:'create-workspace',id:'safe',name:'Saved space',server:SERVER});
 s.records[0].title='Сохранённое изменение';s.dialogs[0].draft='Мой черновик';
 const malformed=JSON.parse(JSON.stringify(s));malformed.createdWorkspaces[0].invitationDrafts=[{email:'invalid',name:'',status:'sent'},{email:'valid@example.com',name:'Valid',status:'not-sent'},{email:'VALID@example.com',name:'Duplicate',status:'not-sent'}];
 const restored=hydrateState(malformed);
 assert.equal(restored.records[0].title,'Сохранённое изменение');assert.equal(restored.dialogs[0].draft,'Мой черновик');assert.equal(restored.createdWorkspaces![0].invitationDrafts!.length,1);assert.equal(restored.createdWorkspaces![0].invitationDrafts![0].email,'valid@example.com');
 malformed.createdWorkspaces[0].invitationDrafts='broken';assert.equal(hydrateState(malformed).records[0].title,'Сохранённое изменение');
});


test('demo member overlay edits fixture without mutating fixture members or ACL and survives reload',()=>{
 const original=initialState();const baseline=workspaceList(original).find(w=>w.id==='project')!.members;
 assert.equal(canEditDemoMembers(original,'project'),true);
 const members=[{name:'Example',email:'demo@example.com',role:'Выбран в демо'}];
 const next=reducer(original,{type:'save-demo-members',id:'project',server:SERVER,members});
 assert.deepEqual(demoMembers(next,'project'),members);assert.equal(workspaceList(next).find(w=>w.id==='project')!.members,baseline);assert.equal(demoMembers(original,'project').length,3);
 assert.deepEqual(demoMembers(hydrateState(JSON.parse(JSON.stringify(next))),'project'),members);
 for(const denied of [{...original,authenticated:false},{...original,server:{address:'other',organization:'Other'}}])assert.equal(reducer(denied,{type:'save-demo-members',id:'project',server:SERVER,members}),denied);
 const otherOwner={...next,memberSelections:next.memberSelections!.map(v=>({...v,owner:'other'}))};assert.equal(demoMembers(otherOwner,'project').length,3);
});

test('saved custom invitation emails remain visible and retained after demo selection changes',()=>{
 const drafts=[{name:'Custom',email:'custom@example.com',status:'not-sent' as const}];
 const s=reducer(initialState(),{type:'create-workspace',id:'custom-invite',name:'Custom',server:SERVER,invitationDrafts:drafts});
 assert.equal(demoMembers(s,'custom-invite')[0].email,'custom@example.com');
 const next=reducer(s,{type:'save-demo-members',id:'custom-invite',server:SERVER,members:[]});
 assert.equal(demoMembers(next,'custom-invite').length,0);assert.deepEqual(next.createdWorkspaces![0].invitationDrafts,drafts);assert.equal(next.createdWorkspaces![0].members.length,0);
});


test('two old conversations for one record retain distinct identities and drafts regardless of ordering',()=>{
 const s=initialState();const base=dialog(s);
 s.dialogs.push({...base,id:'older-one',recordContextId:'project-committee',scope:{mode:'explicit',areaId:'all',recordIds:['project-committee']},title:'Новый диалог',draft:'',turns:[],updatedAt:now-2});
 s.dialogs.push({...base,id:'older-two',recordContextId:'project-committee',scope:{mode:'explicit',areaId:'all',recordIds:['project-committee']},title:'Новый диалог',draft:'Второй черновик',turns:[],updatedAt:now-1});
 const restored=hydrateState(JSON.parse(JSON.stringify(s)));const rows=recordDialogs(restored,'project-committee');
 assert.equal(rows.find(d=>d.id==='older-one')!.draft,'');assert.equal(rows.find(d=>d.id==='older-two')!.draft,'Второй черновик');
 assert.equal(new Set(rows.map(d=>d.id)).size,rows.length);assert.ok(rows.findIndex(d=>d.id==='older-two')<rows.findIndex(d=>d.id==='older-one'));
});

test('local workspace details survive hydration without mutating original data',()=>{
 const before=initialState(), source=JSON.stringify(before);const previous=workspaceList(before).find(w=>w.id==='project')!;
 const edited=reducer(before,{type:'save-demo-workspace-details',id:'project',name:'  Новое   имя  ',description:'Локальное описание',server:SERVER});
 assert.equal(JSON.stringify(before),source);assert.deepEqual(edited.records,before.records);assert.deepEqual(edited.createdWorkspaces,before.createdWorkspaces);
 const restored=hydrateState(JSON.parse(JSON.stringify(edited)),initialState());assert.equal(areaName('project',restored),'Новое имя');assert.equal(workspaceList(restored).find(w=>w.id==='project')?.description,'Локальное описание');assert.equal(workspaceList(initialState()).find(w=>w.id==='project')?.name,previous.name);
});
test('local workspace details reject wrong server, personal space and duplicate names',()=>{
 const s=initialState();const save=(id:string,name:string,server=SERVER)=>reducer(s,{type:'save-demo-workspace-details',id,name,description:'',server});
 assert.equal(save('project','Имя','other.server'),s);assert.equal(save('personal','Имя'),s);assert.equal(save('project','Личное'),s);
});
