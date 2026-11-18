import { OWNER, WORKSPACES } from './fixtures.ts';
import type { AppState } from './types.ts';
/** Display only an explicit ownership field, never infer ownership from administrator role. */
export function workspaceOwnerLabel(state: AppState, workspaceId: string): string {
 if (!state.authenticated || !state.server) return 'Не указан';
 const owner = workspaceId === 'personal' ? OWNER : state.createdWorkspaces?.find(w => w.id === workspaceId && w.server === state.server?.address && w.owner === OWNER)?.owner;
 if (!owner) return 'Не указан';
 const profile = WORKSPACES.flatMap(w=>w.members).find(m=>m.email===owner);
 return profile?.name ?? owner;
}
