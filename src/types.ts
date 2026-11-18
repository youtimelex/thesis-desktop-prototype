export type Source = 'microphone' | 'file' | 'conference';
export type RecordStatus = 'ready' | 'processing' | 'uploading' | 'local' | 'upload-error' | 'processing-error';
export type Operation = 'reprocess' | 'summary' | 'speakers';
export type Phase = 'transcription' | 'summary' | 'speakers';
export type Segment = { id: string; speaker: string; color: string; start: number; end: number; text: string };
export type Recording = {
  id: string;
  title: string;
  source: Source;
  createdAt: string;
  updatedAt?: string;
  duration: number | null;
  server: string;
  areaId: string | null;
  folderId: string | null;
  status: RecordStatus;
  transcript: Segment[];
  summary: string;
  transcriptRevision: number;
  summaryRevision: number;
  materials: { transcript: boolean; summary: boolean };
  processing?: { phase: Phase; progress?: number; ticks: number };
  uploadProgress?: number;
  uploadRequested?: boolean;
  operation?: Operation;
  noSpeech?: boolean;
  frozen?: boolean;
  canManage?: boolean;
  canExport?: boolean;
  bridgeId?: string;
};
export type Draft = { id: string; title: string; seconds: number; paused: boolean; createdAt: string; areaId: string; server: string; folderId?: string | null };
export type Workspace = { id: string; name: string; description: string; color: string; members: { name: string; role: string; email: string }[] };
export type WorkspaceInvitationDraft = { email: string; name: string; status: 'not-sent' };
export type CreatedWorkspace = Workspace & { server: string; owner: string; invitationDrafts?: WorkspaceInvitationDraft[] };
export type Folder = { id: string; name: string; areaId: string | null; server: string };
export type Meeting = {
  id: string; title: string; url: string; agentName: string; areaId: string; server: string;
  stage: 'connecting' | 'waiting' | 'recording' | 'error' | 'completed' | 'cancelled';
  startedAt: number; pausedAt?: number; pausedMs: number; endedAt?: number; resultId?: string; failOnce?: boolean;
};
export type Scope = { mode: 'auto' | 'explicit'; areaId: string; folderId?: string; recordIds: string[] };
// Older locally saved answers may not specify a material. Never infer one from
// the recording's current state or fabricate an utterance/timestamp.
export type Snapshot = { recordId: string; title: string; text: string; revision: number; material?: 'summary' | 'transcript'; notice?: string };
export type Turn = {
  id: string; question: string; status: 'pending' | 'ready' | 'error' | 'stopped'; snapshots: Snapshot[];
  usedRecordIds: string[]; answer: string; dueAt: number; failOnce?: boolean; error?: string;
};
export type AssistantDialog = {
  id: string; title: string; customTitle?: boolean; draft: string; server: string; owner: string;
  scope: Scope; turns: Turn[]; createdAt: number; updatedAt: number;
  // Only the dedicated record-tab conversation carries this link; older and
  // globally created one-source conversations are left untouched.
  recordContextId?: string;
};
export type Settings = { network: 'wifi' | 'mobile' | 'offline'; wifiOnly: boolean; deleteLocal: boolean; notifications: boolean; quality: '64' | '128'; agentName: string };
export type Connection = { address: string; organization: string };
// Optional for browser data saved before workspace creation was added.
export type AppState = { version: 1; demoScaleVersion?: number; records: Recording[]; drafts: Draft[]; folders: Folder[]; meetings: Meeting[]; dialogs: AssistantDialog[]; createdWorkspaces?: CreatedWorkspace[]; workspaceDetails?: {workspaceId:string;server:string;owner:string;name:string;description:string}[]; memberSelections?: {workspaceId:string;server:string;owner:string;members:Workspace['members']}[]; settings: Settings; server: Connection | null; authenticated: boolean };
export type Filters = { areaId: string; source: Source | 'all'; status: 'all' | 'processing' | 'attention' | 'ready'; folderId: string; sort: 'newest' | 'oldest' | 'title'; query: string; scroll: number };
export type ListScope = { kind: 'all' | 'area' | 'folder'; areaId?: string; folderId?: string };
export type RecordSection = 'summary' | 'transcript' | 'assistant' | 'details';
export type Route =
  | { page: 'home' }
  | { page: 'library'; scope: ListScope }
  | { page: 'search'; scope: ListScope }
  | { page: 'record'; id: string; section: RecordSection; listScope?: ListScope; listSearch?: boolean }
  | { page: 'recorder'; id: string }
  | { page: 'meeting'; id: string; section?: RecordSection; listScope?: ListScope; listSearch?: boolean }
  | { page: 'assistant'; id?: string; listScope?: ListScope | null; listSearch?: boolean }
  | { page: 'workspaces' }
  | { page: 'members'; areaId: string }
  | { page: 'folders'; areaId: string | null }
  | { page: 'settings'; section?: string };
