import { useId } from 'react';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@vini-ds/ui';
import { areaName } from './model.ts';
import { useNav } from './navigation.tsx';
import { useStore } from './store.tsx';
import { Button } from './ui.tsx';
import type { ListScope } from './types.ts';

/** One page-level action; the recorder itself owns its active controls. */
export function RecordingAction({ scope }: { scope: ListScope }) {
  const { state } = useStore(); const { listState, startRecording } = useNav();
  const descriptionId = useId(); const filters = listState(scope);
  const requestedArea = scope.kind !== 'all' && scope.areaId !== 'legacy' ? scope.areaId : undefined;
  const recordingArea = requestedArea ?? 'personal';
  const selectedFolder = requestedArea === recordingArea && scope.kind === 'folder' ? scope.folderId : requestedArea === recordingArea && scope.kind === 'area' ? filters.folderId : undefined;
  const recordingFolder = selectedFolder && selectedFolder !== 'all' && selectedFolder !== 'root' ? selectedFolder : null;
  const folder = recordingFolder ? state.folders.find(f => f.id === recordingFolder && f.areaId === recordingArea && f.server === state.server?.address) : undefined;
  const destination = `${areaName(recordingArea, state)} · ${recordingFolder ? folder?.name ?? 'Папка недоступна' : recordingArea === 'personal' ? 'Без папки' : 'В корне пространства'}`;
  return <><TooltipProvider><Tooltip><TooltipTrigger render={<Button variant="record" icon="microphone" className="section-record-action" aria-label="Записать" aria-describedby={descriptionId} onClick={() => startRecording(recordingArea, recordingFolder)}>Записать</Button>}/><TooltipContent>Записать · {destination}</TooltipContent></Tooltip></TooltipProvider><span id={descriptionId} className="sr-only">После отправки: {destination}</span></>;
}
