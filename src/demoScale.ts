import { OWNER, SERVER } from './fixtures.ts';
import type { AppState, CreatedWorkspace, Folder, Recording } from './types.ts';

// Fictional, deterministic content for evaluating long lists. Not imported meetings,
// not server discovery and not a claim about actual people or access permissions.
export const DEMO_SCALE_VERSION = 2;
// Deliberately uneven, deterministic distribution for evaluating counters and lists.
const recordCounts = [18, 12, 9, 19, 11, 16, 10, 8, 14, 13, 17, 15];
const scenarios = [
  ['platform', 'Разработка платформы', 'устойчивость сервисов', 'план нагрузочного тестирования'],
  ['design', 'Дизайн продукта', 'согласованность интерфейса', 'проверку экранов на разных размерах'],
  ['research', 'Исследования пользователей', 'навигацию по материалам', 'сценарий следующего интервью'],
  ['support', 'Клиентское сопровождение', 'типовые обращения', 'обновление базы ответов'],
  ['integrations', 'Интеграции', 'обмен событиями между системами', 'контрольный набор данных'],
  ['quality', 'Тестирование и качество', 'регрессионные сценарии', 'проверку критических переходов'],
  ['infrastructure', 'Инфраструктура', 'наблюдаемость сервисов', 'перечень диагностических метрик'],
  ['security', 'Информационная безопасность', 'границы доступа к материалам', 'ревью схемы ролей'],
  ['analytics', 'Продуктовая аналитика', 'качество продуктовых метрик', 'словарь событий'],
  ['documentation', 'Документация', 'структуру справочного раздела', 'редактуру инструкции'],
  ['implementation', 'Внедрение и обучение', 'подготовку учебного стенда', 'программу вводного занятия'],
  ['partnerships', 'Партнёрские проекты', 'согласование технических требований', 'список вопросов для следующей встречи'],
] as const;
const formats = ['Планирование недели', 'Разбор обратной связи', 'Обзор решений', 'Рабочая синхронизация', 'Проверка готовности', 'Разбор рисков', 'Обсуждение следующего этапа', 'Итоги итерации'];
const speakers = ['Ирина Лебедева', 'Павел Миронов', 'Светлана Орлова'];

function pack(): {workspaces: CreatedWorkspace[]; records: Recording[]; folders: Folder[]} {
  const workspaces: CreatedWorkspace[] = [], records: Recording[] = [], folders: Folder[] = [];
  scenarios.forEach(([slug, name, topic, next], i) => {
    const areaId = `demo-scale-${slug}`;
    workspaces.push({id:areaId,name:`${name} · демо`,description:`Вымышленное пространство для проверки масштабирования. Тематика: ${topic}. Все участники и материалы демонстрационные.`,color:'#8b919b',server:SERVER,owner:OWNER,members:[
      {name:'Алексей Петров',role:'Участник',email:OWNER},
      ...speakers.map((person,j)=>({name:person,role:'Участник',email:`demo.member.${j+1}@example.test`})),
    ]});
    const planning=`${areaId}-planning`, reviews=`${areaId}-reviews`;
    folders.push({id:planning,name:'Планирование',areaId,server:SERVER},{id:reviews,name:'Обзоры и итоги',areaId,server:SERVER});
    Array.from({length:recordCounts[i]},(_,j)=>j).forEach(j=>{
      const format = formats[j % formats.length] + (j >= formats.length ? ` · обзор ${Math.floor(j / formats.length) + 1}` : '');
      const id=`${areaId}-record-${j+1}`;
      const texts=[
        `Демонстрационная встреча: ${name.toLocaleLowerCase('ru')}. Обсуждаем ${topic}. Все реплики вымышлены для проверки прототипа.`,
        `На этом этапе важно разделить уже согласованные решения и вопросы, для которых ещё не хватает данных.`,
        `В демонстрационном сценарии предложили ${next}. Результат обсудим на отдельном обзоре.`,
        `Ответственных и точные сроки в этом примере не назначаем. Открытые вопросы сохраняем в материалах встречи.`,
      ];
      const createdAt=new Date(Date.UTC(2026,7,17-Math.floor((i*8+j)/4),9+(j%7),j%2?30:0)).toISOString();
      records.push({id,title:`${format}: ${name.toLocaleLowerCase('ru')} (демо)`,source:(['conference','file','microphone'] as const)[(i+j)%3],createdAt,duration:(18+((i*11+j*7)%65))*60,server:SERVER,areaId,folderId:j%3===0?null:j%3===1?planning:reviews,status:'ready',transcript:texts.map((text,k)=>({id:`${id}-segment-${k+1}`,speaker:speakers[k%3],color:'#8b919b',start:k*60,end:k*60+48,text})),summary:`**Демонстрационные материалы.** Встреча, участники и решения вымышлены для проверки интерфейса.\n\nОбсудили ${topic}.\n\n## Результат обсуждения\n\n- Отделили согласованные решения от вопросов, требующих проверки.\n- Предложили ${next}.\n- Следующий обзор посвятим результатам проверки.\n\n## Открытые вопросы\n\nОтветственные и сроки в этом демонстрационном примере не назначены.`,transcriptRevision:1,summaryRevision:1,materials:{transcript:true,summary:true}});
    });
  });
  return {workspaces,records,folders};
}

/** Versioned, append-only enrichment. Existing IDs always win. Version 2 adds
 * only new (9+) records to unchanged demo workspaces. Deleted records/folders or
 * workspaces are never recreated, and renamed/customized spaces are left alone. */
export function withDemoScale(state: AppState): AppState {
  const version = state.demoScaleVersion ?? 0;
  if (version >= DEMO_SCALE_VERSION) return state;
  const {workspaces,records,folders}=pack();
  const recordIds=new Set(state.records.map(r=>r.id));
  const folderIds=new Set(state.folders.map(f=>f.id));
  const existingWorkspaces = state.createdWorkspaces ?? [];
  const workspaceIds=new Set(existingWorkspaces.map(w=>w.id));
  const unchanged = new Set(workspaces.filter(expected => {
    const existing = existingWorkspaces.find(w=>w.id===expected.id);
    return existing ? JSON.stringify(existing)===JSON.stringify(expected) : version < 1;
  }).map(w=>w.id));
  const newRecords=records.filter(r=>!recordIds.has(r.id) && unchanged.has(r.areaId!) && (version < 1 || Number(r.id.split('-').at(-1)) > 8)).map(r=>version >= 1 && r.folderId && !folderIds.has(r.folderId) ? {...r,folderId:null} : r);
  return {...state,demoScaleVersion:DEMO_SCALE_VERSION,records:[...state.records,...newRecords],...(version < 1 ? {
    folders:[...state.folders,...folders.filter(f=>!folderIds.has(f.id) && unchanged.has(f.areaId!))],
    createdWorkspaces:[...existingWorkspaces,...workspaces.filter(w=>!workspaceIds.has(w.id))],
  } : {})};
}
