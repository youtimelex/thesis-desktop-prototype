import { useEffect, useState } from 'react';
import { Button as VButton } from '@vini-ds/ui';
import { Button, Icon, Modal } from './ui.tsx';
import { useStore } from './store.tsx';
import { formatTime, isStale, materialAvailable, versionNotice } from './model.ts';
import { exportSummary, type ExportFormat } from './record-export.ts';
import type { Recording } from './types.ts';

export function RecordExport({record,material='summary',open,onClose}:{record:Recording;material?:'summary'|'transcript';open:boolean;onClose:()=>void}) {
 const {notify}=useStore();const [busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{setError('');},[open,material]);
 const available=record.canExport!==false&&materialAvailable(record,material);
 const download=async(format:ExportFormat)=>{if(!available||busy)return;setError('');setBusy(true);try {
   const result=await exportSummary({title:record.title+(material==='transcript'?' — транскрипция':''),summary:material==='summary'?record.summary:record.transcript.map(s=>`## ${formatTime(s.start)} · ${s.speaker}\n\n${s.text}`).join('\n\n'),notice:material==='summary'&&isStale(record)?'Резюме не обновлено после изменения транскрипции.':versionNotice(record,material)},format);
   if(result==='print')notify('Открыта версия для печати. Выберите «Сохранить как PDF».');else notify(`Файл ${format.toUpperCase()} подготовлен для скачивания`);
   onClose();
 }catch(e){setError(e instanceof Error?e.message:'Не удалось подготовить экспорт. Попробуйте ещё раз.');}finally{setBusy(false);}};
 return <Modal open={open} onClose={onClose} title={material==='summary'?'Экспорт резюме':'Экспорт транскрипции'} description="Текстовые форматы сохраняются локально. PDF открывается через печать браузера.">
 <p className="export-record-name">{record.title}</p>
 <div className="export-audio"><VButton variant="secondary" color="main" startIcon={<Icon name="download"/>} disabled aria-describedby="export-audio-note">Скачать аудио</VButton><p id="export-audio-note">В прототипе нет исходного аудиофайла. Скачивание аудио недоступно.</p></div>
 <div className="export-format-list" aria-label="Форматы экспорта">{(['docx','html','md','pdf','txt'] as ExportFormat[]).map(format=><VButton key={format} variant="text" color="main" disabled={!available||busy} onClick={()=>void download(format)}><span>{format.toUpperCase()}</span>{format==='pdf'&&<small>Через печать браузера</small>}<Icon name="download" size={18}/></VButton>)}</div>
 {!available&&<p role="status">Экспорт этого материала недоступен.</p>}{error&&<p role="alert" className="export-error">{error}</p>}
 <div className="modal-actions"><Button variant="ghost" onClick={onClose}>Закрыть</Button></div>
 </Modal>;
}
