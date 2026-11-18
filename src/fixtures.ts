import type { AppState, AssistantDialog, Recording, Segment, Workspace } from './types.ts';

export const SERVER = 'thesis.sever.ru';
export const OWNER = 'alexey.petrov@sever.ru';
export const WORKSPACES: Workspace[] = [
  { id: 'project', name: 'Проектный комитет', description: 'Развитие Тезиса, обсуждения команды и решения по релизу.', color: '#72b6e9', members: [
    { name: 'Алексей Петров', role: 'Участник', email: OWNER },
    { name: 'Мария Соколова', role: 'Участник', email: 'm.sokolova@sever.ru' },
    { name: 'Дмитрий Волков', role: 'Администратор', email: 'd.volkov@sever.ru' },
  ] },
  { id: 'pilot', name: 'Пилот с заказчиком', description: 'Подготовка пилота и встречи с командой заказчика.', color: '#8a9ae8', members: [
    { name: 'Алексей Петров', role: 'Участник', email: OWNER },
    { name: 'Анна Смирнова', role: 'Администратор', email: 'a.smirnova@sever.ru' },
  ] },
];

const people = [
  { speaker: 'Алексей Петров', color: '#72b6e9' },
  { speaker: 'Мария Соколова', color: '#76b6a0' },
  { speaker: 'Дмитрий Волков', color: '#b49ade' },
];
const projectText = [
  'Коллеги, предлагаю зафиксировать состав первого мобильного релиза Тезиса. Основной сценарий — записать встречу и быстро найти её итоги.',
  'В первый релиз оставляем корпоративный вход через SSO, запись с устройства, загрузку файлов и список записей с понятными статусами.',
  'Результаты обработки получаем с сервера: резюме, транскрипцию и сведения об исходной записи. Транскрипция должна быть доступна, даже если резюме ещё готовится.',
  'Для закрытого контура отдельно проверим отправку при восстановлении сети и удаление локальной копии только после подтверждения сервера.',
  'Макеты должны показывать ценность готовой записи. Важно, чтобы можно было быстро проверить договорённость и перейти к нужной реплике.',
  'Черновики сохраняем независимо друг от друга. Наличие незавершённой записи не должно мешать начать новую встречу.',
  'По пространствам договорились: участники получают доступ к отправленной записи. До отправки черновик остаётся личным.',
  'Следующие шаги — проверить весь сценарий, подготовить макеты и собрать обратную связь команды. Ответственных и точные сроки сегодня не фиксируем.',
];
export const projectTranscript: Segment[] = projectText.map((text, i) => ({ id: `project-${i}`, ...people[i % 3], start: [0, 32, 68, 120, 185, 250, 320, 390][i], end: [28, 62, 112, 174, 241, 309, 380, 440][i], text }));
export const projectSummary = `Обсудили первый мобильный релиз **Тезиса** и согласовали основной сценарий: записать встречу, получить материалы и быстро найти договорённости.

## Что решили

- В первый релиз входят **вход по SSO, диктофон и загрузка файлов**.
- Записи, черновики и подключения агента находятся в одной библиотеке. Статусы отправки и обработки видны в списке.
- Готовая запись открывается с резюме. Транскрипция и сведения об источнике доступны отдельно.
- Черновик остаётся личным до отправки. Записи пространства доступны его участникам.

## Следующие шаги

1. Проверить отправку при восстановлении связи и сохранность локальной записи.
2. Проверить удаление локальной копии после подтверждения сервера.
3. Подготовить макеты и собрать обратную связь команды.

> Ответственные и точные сроки в обсуждении не зафиксированы.`;

const contractorSummary = `Обсудили поставку оборудования и подготовку к пилоту.

## Договорённости

- Тестовый комплект ожидается **до 4 сентября**.
- Приёмка — после проверки совместимости с сервером VINTEO.
- Список проверок нужно подготовить к пятнице.

## Открытый вопрос

Дату промышленного запуска согласуют после пилота.`;
const pilotSummary = `Предложен **двухнедельный пилот для десяти сотрудников** отдела сопровождения.

## Что проверяем

- Вход через корпоративную учётную запись.
- Запись встреч и отправку аудио.
- Поиск договорённостей по резюме и транскрипции.

## Следующие шаги

Собрать обратную связь в пятницу. Для старта требуется подтверждение администратора.`;
const interviewSummary = `Заказчику важно быстро находить договорённости после длинных встреч, не переслушивая запись целиком.

## Основные потребности

- Краткое резюме сразу после обработки.
- Поиск в транскрипции, чтобы проверить детали.
- Сохранность записи при потере связи и понятный статус отправки.

Сроки внедрения на встрече не определены.`;
function otherTranscript(texts: string[]): Segment[] {
  return texts.map((text, i) => ({ id: `segment-${i}`, ...people[i % 3], start: i * 45, end: i * 45 + 38, text }));
}
const contractorTranscript = otherTranscript(['Тестовый комплект оборудования поставим до 4 сентября.', 'Приёмку проведём после проверки совместимости с сервером VINTEO.', 'Подготовим список проверок к пятнице. Дату промышленного запуска согласуем после пилота.']);
const pilotTranscript = otherTranscript(['Начнём пилот с отдела сопровождения: десять участников, две недели.', 'Проверим вход через корпоративную учётную запись и отправку аудио.', 'Обратную связь соберём в пятницу. Для старта пилота нужно подтверждение администратора.']);
const interviewTranscript = otherTranscript(['После встречи мне нужно быстро найти договорённости, не переслушивая час аудио.', 'В первую очередь нужно краткое резюме. Поиск в транскрипции поможет проверить детали.', 'В дороге важны понятный статус отправки и сохранение записи при потере связи.']);

function record(id: string, title: string, source: Recording['source'], areaId: string | null, date: string, duration: number, patch: Partial<Recording> = {}): Recording {
  return { id, title, source, areaId, createdAt: date, duration, server: SERVER, folderId: null, status: 'ready', transcript: projectTranscript.map(s => ({ ...s })), summary: projectSummary, transcriptRevision: 1, summaryRevision: 1, materials: { transcript: true, summary: true }, ...patch };
}

export function initialState(): AppState {
  const records: Recording[] = [
    record('project-committee', 'Проектный комитет', 'file', 'project', '2026-08-26T20:47:00+03:00', 1080, { folderId: 'project-planning' }),
    record('server-operations', 'Оперативное совещание', 'conference', null, '2026-08-25T11:30:00+03:00', 1860),
    record('budget-discussion', 'Обсуждение бюджета', 'microphone', 'personal', '2026-08-24T15:00:00+03:00', 2520, { summary: pilotSummary, transcript: pilotTranscript }),
    record('contractor-meeting', 'Встреча с подрядчиком', 'file', 'pilot', '2026-08-24T14:00:00+03:00', 4320, { status: 'processing', processing: { phase: 'transcription', progress: 64, ticks: 0 }, materials: { transcript: true, summary: false }, summary: '', transcript: contractorTranscript.slice(0, 2), frozen: true }),
    record('customer-interview', 'Интервью с заказчиком', 'file', 'pilot', '2026-08-24T12:30:00+03:00', 3120, { summary: interviewSummary, transcript: interviewTranscript, folderId: 'pilot-interviews' }),
    record('architecture-review', 'Архитектурный комитет', 'conference', 'project', '2026-08-23T16:00:00+03:00', 3480, { folderId: 'project-releases' }),
    record('team-sync', 'Синхронизация команды', 'microphone', 'project', '2026-08-23T10:00:00+03:00', 1440, { summary: pilotSummary, transcript: pilotTranscript }),
    record('pilot-planning', 'Планирование пилота', 'file', 'pilot', '2026-08-22T15:00:00+03:00', 2280, { status: 'processing-error', processing: { phase: 'summary', ticks: 0 }, summary: '', transcript: pilotTranscript, materials: { transcript: true, summary: false } }),
    record('supplier-deadline', 'Уточнение сроков поставки', 'conference', 'pilot', '2026-08-22T11:00:00+03:00', 1080, { summary: contractorSummary, transcript: contractorTranscript }),
    record('workgroup', 'Рабочая группа', 'microphone', 'personal', '2026-08-21T16:00:00+03:00', 1440, { status: 'local', transcript: [], summary: '', materials: { transcript: false, summary: false } }),
    record('release-review', 'Подготовка к релизу', 'conference', 'project', '2026-08-21T11:30:00+03:00', 2700, { folderId: 'project-releases' }),
    record('pilot-discussion', 'Обсуждение пилота', 'microphone', 'personal', '2026-08-20T14:00:00+03:00', 720, { status: 'upload-error', transcript: [], summary: '', materials: { transcript: false, summary: false } }),
    record('design-review', 'Обсуждение интерфейса', 'conference', 'project', '2026-08-20T10:00:00+03:00', 3060),
    record('learning', 'Заметки после встречи', 'microphone', 'personal', '2026-08-19T17:00:00+03:00', 540, { summary: interviewSummary, transcript: interviewTranscript, folderId: 'personal-review' }),
    record('weekly', 'Итоги рабочей недели', 'file', 'project', '2026-08-19T11:00:00+03:00', 2040, { summary: pilotSummary, transcript: pilotTranscript, canManage: false }),
    record('no-speech', 'Запись без речи', 'microphone', 'personal', '2026-08-18T10:00:00+03:00', 12, { transcript: [], summary: '', noSpeech: true, materials: { transcript: false, summary: false } }),
  ];
  const dialogs: AssistantDialog[] = [
    { id: 'dialog-decisions', title: 'Что решили на проектном комитете?', draft: '', server: SERVER, owner: OWNER, scope: { mode: 'explicit', areaId: 'project', recordIds: ['project-committee'] }, createdAt: Date.parse('2026-08-26T18:00:00Z'), updatedAt: Date.parse('2026-08-26T18:00:00Z'), turns: [
      { id: 'turn-decisions', question: 'Что решили на проектном комитете?', status: 'ready', snapshots: [{ recordId: 'project-committee', title: 'Проектный комитет', text: projectSummary, revision: 1, material: 'summary' }], usedRecordIds: ['project-committee'], answer: 'На проектном комитете согласовали состав первого мобильного релиза:\n\n- **Вход по SSO, диктофон и загрузка файлов.**\n- Единая библиотека записей, черновиков и подключений агента.\n- Резюме и транскрипция помогают проверить содержание встречи.\n- Черновики остаются личными до отправки.\n\nДалее нужно проверить отправку при восстановлении связи и подготовить макеты. Ответственные и сроки не зафиксированы.', dueAt: 0 },
    ] },
    { id: 'dialog-pilot', title: 'Как подготовиться к пилоту?', draft: '', server: SERVER, owner: OWNER, scope: { mode: 'auto', areaId: 'pilot', recordIds: [] }, createdAt: Date.parse('2026-08-25T14:00:00Z'), updatedAt: Date.parse('2026-08-25T14:00:00Z'), turns: [
      { id: 'turn-pilot', question: 'Как подготовиться к пилоту?', status: 'ready', snapshots: [{ recordId: 'supplier-deadline', title: 'Уточнение сроков поставки', text: contractorSummary, revision: 1, material: 'summary' }], usedRecordIds: ['supplier-deadline'], answer: 'В обсуждении зафиксировали следующие шаги:\n\n1. Дождаться тестового комплекта оборудования **до 4 сентября**.\n2. Проверить совместимость с сервером VINTEO перед приёмкой.\n3. Подготовить список проверок к пятнице.\n\nДата промышленного запуска пока не согласована — её определят после пилота.', dueAt: 0 },
    ] },
    { id: 'dialog-draft', title: 'Новый диалог', draft: 'Какие вопросы остались открытыми?', server: SERVER, owner: OWNER, scope: { mode: 'auto', areaId: 'all', recordIds: [] }, createdAt: Date.parse('2026-08-24T12:00:00Z'), updatedAt: Date.parse('2026-08-24T12:00:00Z'), turns: [] },
  ];
  return { version: 1, records, dialogs, drafts: [{ id: 'draft-first', title: 'Запись 26.08.2026, 20:47', seconds: 137, paused: true, createdAt: '2026-08-26T17:47:00Z', areaId: 'personal', server: SERVER }], folders: [
    { id: 'project-planning', name: 'Планирование', areaId: 'project', server: SERVER },
    { id: 'project-releases', name: 'Релизы', areaId: 'project', server: SERVER },
    { id: 'pilot-interviews', name: 'Интервью', areaId: 'pilot', server: SERVER },
    { id: 'personal-review', name: 'Для разбора', areaId: 'personal', server: SERVER },
    { id: 'legacy-projects', name: 'Проекты VINTEO', areaId: null, server: SERVER },
  ], meetings: [], authenticated: true, server: { address: SERVER, organization: 'АО Север' }, settings: { network: 'wifi', wifiOnly: true, deleteLocal: true, notifications: true, quality: '64', agentName: 'Тезис Агент' } };
}
