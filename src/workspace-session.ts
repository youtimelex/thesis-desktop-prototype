import type { ListScope, RecordSection, Route } from './types.ts';

/** A browser-history entry keeps each window's workspace separate from the
 * prototype's persistent records and from other browser tabs. */
export type WorkspaceEntry = { route: Route; stack: Route[]; assistantSource: boolean };
export type WorkspaceTab = { id: string; entries: WorkspaceEntry[]; index: number };
export type WorkspaceSession = { version: 1; activeTabId: string; tabs: WorkspaceTab[] };

export const WORKSPACE_SESSION_FIELD = 'thesisWorkspaceTabs';
const MAX_TABS = 100;
const MAX_ENTRIES = 200;
const MAX_STACK = 200;
const MAX_STRING = 2048;
const MAX_ROUTES = 5000;
const MAX_SNAPSHOT_CHARS = 2_000_000;

const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const string = (v: unknown): v is string => typeof v === 'string' && v.length <= MAX_STRING;
const optionalString = (v: unknown): v is string | undefined => v === undefined || string(v);
const optionalBoolean = (v: unknown): v is boolean | undefined => v === undefined || typeof v === 'boolean';
const keys = (v: Record<string, unknown>, allowed: readonly string[]) => Object.keys(v).every(key => allowed.includes(key));
const section = (v: unknown): v is RecordSection => v === 'summary' || v === 'transcript' || v === 'assistant' || v === 'details';

function scope(v: unknown): v is ListScope {
  return object(v) && keys(v, ['kind', 'areaId', 'folderId']) &&
    (v.kind === 'all' || v.kind === 'area' || v.kind === 'folder') &&
    optionalString(v.areaId) && optionalString(v.folderId);
}

function route(v: unknown): v is Route {
  if (!object(v) || typeof v.page !== 'string') return false;
  switch (v.page) {
    case 'home': case 'workspaces': return keys(v, ['page']);
    case 'library': case 'search': return keys(v, ['page', 'scope']) && scope(v.scope);
    case 'record': return keys(v, ['page', 'id', 'section', 'listScope', 'listSearch']) && string(v.id) && !!v.id && section(v.section) && (v.listScope === undefined || scope(v.listScope)) && optionalBoolean(v.listSearch);
    case 'meeting': return keys(v, ['page', 'id', 'section', 'listScope', 'listSearch']) && string(v.id) && !!v.id && (v.section === undefined || section(v.section)) && (v.listScope === undefined || scope(v.listScope)) && optionalBoolean(v.listSearch);
    case 'assistant': return keys(v, ['page', 'id', 'listScope', 'listSearch']) && optionalString(v.id) && (v.listScope === undefined || v.listScope === null || scope(v.listScope)) && optionalBoolean(v.listSearch);
    case 'recorder': return keys(v, ['page', 'id']) && string(v.id) && !!v.id;
    case 'members': return keys(v, ['page', 'areaId']) && string(v.areaId) && !!v.areaId;
    case 'folders': return keys(v, ['page', 'areaId']) && (v.areaId === null || string(v.areaId));
    case 'settings': return keys(v, ['page', 'section']) && optionalString(v.section);
    default: return false;
  }
}

function entry(v: unknown): v is WorkspaceEntry {
  return object(v) && keys(v, ['route', 'stack', 'assistantSource']) && route(v.route) &&
    Array.isArray(v.stack) && v.stack.length <= MAX_STACK && Array.from(v.stack).every(route) && typeof v.assistantSource === 'boolean';
}

/** Validate all fields before accepting a browser history snapshot. */
export function isWorkspaceSession(v: unknown): v is WorkspaceSession {
  if (!object(v) || !keys(v, ['version', 'activeTabId', 'tabs']) || v.version !== 1 || !string(v.activeTabId) || !v.activeTabId || !Array.isArray(v.tabs) || v.tabs.length === 0 || v.tabs.length > MAX_TABS) return false;
  const ids = new Set<string>();
  let routes = 0;
  for (const tab of v.tabs) {
    if (!object(tab) || !keys(tab, ['id', 'entries', 'index']) || !string(tab.id) || !tab.id || ids.has(tab.id) || !Array.isArray(tab.entries) || tab.entries.length === 0 || tab.entries.length > MAX_ENTRIES || !Array.from(tab.entries).every(entry) || !Number.isInteger(tab.index) || (tab.index as number) < 0 || (tab.index as number) >= tab.entries.length) return false;
    for (const item of tab.entries as WorkspaceEntry[]) { routes += 1 + item.stack.length; if (routes > MAX_ROUTES) return false; }
    ids.add(tab.id);
  }
  if (!ids.has(v.activeTabId)) return false;
  try { return JSON.stringify(v).length <= MAX_SNAPSHOT_CHARS; } catch { return false; }
}

/** Only restore when the active route is the address being loaded. The caller
 * supplies the canonical path of parseRoute(location.hash), so a direct URL
 * remains authoritative rather than opening a stale browser-history session. */
export function readWorkspaceSession(state: unknown, expectedPath: string, routePath: (route: Route) => string): WorkspaceSession | null {
  if (!object(state)) return null;
  const value = state[WORKSPACE_SESSION_FIELD];
  if (!isWorkspaceSession(value)) return null;
  const active = value.tabs.find(tab => tab.id === value.activeTabId)!;
  try {
    if (routePath(active.entries[active.index].route) !== expectedPath) return null;
    // Return an independent copy rather than retaining mutable history.state objects.
    return structuredClone(value);
  } catch { return null; }
}

/** Compose a safe snapshot into the existing history stamp without mutating it.
 * Invalid or oversized snapshots remove the field instead of reviving stale tabs. */
export function withWorkspaceSession(stamp: Record<string, unknown>, tabs: WorkspaceTab[], activeTabId: string): Record<string, unknown> {
  const result = { ...stamp };
  const snapshot: WorkspaceSession = { version: 1, tabs, activeTabId };
  if (isWorkspaceSession(snapshot)) result[WORKSPACE_SESSION_FIELD] = structuredClone(snapshot);
  else delete result[WORKSPACE_SESSION_FIELD];
  return result;
}
