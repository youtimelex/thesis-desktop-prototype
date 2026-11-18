import {createContext, useContext, useState, type ReactNode} from 'react';
import {ThemeBrandProvider} from '@vini-ds/ui';
type Appearance = {language: 'ru' | 'en'; theme: 'light' | 'dark'; colorway: 'blue' | 'neutral' | 'orange'};
const key = 'thesis-vini-home-appearance-v1';
const defaults: Appearance = {language:'ru', theme: 'dark', colorway: 'blue'};
const Context = createContext({ ...defaults, saved: true, update: (_patch: Partial<Appearance>) => {} });
function read(): Appearance { try {const v = JSON.parse(localStorage.getItem(key) || '{}'); return {language: v.language === 'en' ? 'en' : 'ru', theme: v.theme === 'light' ? 'light' : 'dark', colorway: ['blue','neutral','orange'].includes(v.colorway) ? v.colorway : 'blue'};} catch {return defaults;} }
export function AppearanceProvider({children}: {children: ReactNode}) {
 const [value, setValue] = useState(read); const [saved,setSaved] = useState(true);
 function update(patch: Partial<Appearance>) { const next = {...value,...patch}; setValue(next); if (new URLSearchParams(window.location.search).get('preview') === '1') {setSaved(false); return;} try {localStorage.setItem(key, JSON.stringify(next));setSaved(true);} catch {setSaved(false);} }
 return <Context.Provider value={{...value,saved,update}}><ThemeBrandProvider theme={value.theme} brand="vini" colorway={value.colorway} typographyScope="desktop">{children}</ThemeBrandProvider></Context.Provider>;
}
export const useAppearance = () => useContext(Context);
