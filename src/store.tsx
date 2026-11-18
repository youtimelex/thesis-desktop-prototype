import { toast as viniToast } from '@vini-ds/ui';
import { createContext, useContext, useEffect, useReducer, useState, type Dispatch, type ReactNode } from 'react';
import { initialState } from './fixtures.ts';
import { withDemoScale } from './demoScale.ts';
import { hydrateState, reducer, STORAGE_KEY, type Action } from './model.ts';
import type { AppState } from './types.ts';

type Store = { state: AppState; dispatch: Dispatch<Action>; notify: (text: string) => void; storageError: boolean };
const Context = createContext<Store | null>(null);
export function useStore() { const value = useContext(Context); if (!value) throw new Error('Store is missing'); return value; }

function load() {
  const fallback = withDemoScale(initialState());
  if (new URLSearchParams(window.location.search).get('preview') === '1') return { state: fallback, unreadable: false };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return { state: fallback, unreadable: false };
    const state = hydrateState(JSON.parse(raw), fallback);
    return { state: withDemoScale(state), unreadable: state === fallback };
  } catch { return { state: fallback, unreadable: true }; }
}
export function StoreProvider({ children }: { children: ReactNode }) {
  const [loaded] = useState(load);
  const [state, dispatch] = useReducer(reducer, loaded.state);
  const [storageError, setStorageError] = useState(loaded.unreadable);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('preview') === '1' || loaded.unreadable) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); setStorageError(false); } catch { setStorageError(true); }
  }, [state]);
  useEffect(() => { const timer = setInterval(() => dispatch({ type: 'tick', now: Date.now() }), 1000); return () => clearInterval(timer); }, []);
  const notify = (text: string) => { viniToast.add({title: text, type:'info', timeout: 4000}); };
  return <Context.Provider value={{ state, dispatch, notify, storageError }}>{children}</Context.Provider>;
}
