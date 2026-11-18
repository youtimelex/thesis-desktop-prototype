import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readWorkspaceSession, withWorkspaceSession, WORKSPACE_SESSION_FIELD, type WorkspaceTab } from '../src/workspace-session.ts';
import type { Route } from '../src/types.ts';

const path = (route: Route) => route.page === 'record' ? `/records/${route.id}/${route.section}` : `/${route.page}`;
const initialTabs = (): WorkspaceTab[] => [
  { id: 'first', index: 1, entries: [
    { route: { page: 'home' }, stack: [], assistantSource: false },
    { route: { page: 'record', id: 'one', section: 'transcript' }, stack: [{ page: 'home' }], assistantSource: false },
  ] },
  { id: 'second', index: 0, entries: [{ route: { page: 'home' }, stack: [], assistantSource: false }] },
];

test('retains separate tab histories in the browser history stamp', () => {
  const tabs = initialTabs();
  const stamp = withWorkspaceSession({ thesis: true, previewIndex: 1 }, tabs, 'first');
  const restored = readWorkspaceSession(stamp, '/records/one/transcript', path);
  assert.deepEqual(restored?.tabs, tabs);
  assert.equal(restored?.activeTabId, 'first');
  assert.equal(stamp.previewIndex, 1);
  tabs[0].entries[0].route = { page: 'workspaces' };
  assert.equal(restored?.tabs[0].entries[0].route.page, 'home');
});

test('does not replace a different explicit address with a stale snapshot', () => {
  const stamp = withWorkspaceSession({ thesis: true }, initialTabs(), 'first');
  assert.equal(readWorkspaceSession(stamp, '/home', path), null);
  assert.equal(readWorkspaceSession(null, '/home', path), null);
});

test('rejects malformed data instead of restoring a broken session', () => {
  const snapshot = { version: 1, activeTabId: 'first', tabs: initialTabs() };
  const rejects = [
    { ...snapshot, version: 2 },
    { ...snapshot, activeTabId: 'missing' },
    { ...snapshot, tabs: [snapshot.tabs[0], snapshot.tabs[0]] },
    { ...snapshot, tabs: [{ ...snapshot.tabs[0], index: 7 }] },
    { ...snapshot, tabs: [{ ...snapshot.tabs[0], entries: [{ route: { page: 'unsupported' }, stack: [], assistantSource: false }] }] },
    { ...snapshot, tabs: [{ ...snapshot.tabs[0], entries: Array(2) }] },
  ];
  for (const value of rejects) assert.equal(readWorkspaceSession({ [WORKSPACE_SESSION_FIELD]: value }, '/home', path), null);
});

test('drops an invalid snapshot field and preserves unrelated history', () => {
  const stamp = withWorkspaceSession({ thesis: true, [WORKSPACE_SESSION_FIELD]: 'stale' }, [], 'missing');
  assert.equal(stamp.thesis, true);
  assert.equal(WORKSPACE_SESSION_FIELD in stamp, false);
});
