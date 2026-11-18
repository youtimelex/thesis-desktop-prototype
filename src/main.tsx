import { Toaster } from '@vini-ds/ui';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { StoreProvider } from './store.tsx';
import App from './App.tsx';
import { AppearanceProvider } from './appearance.tsx';
import '@vini-ds/tokens/fonts.css';
import '@vini-ds/tokens/themes.css';
import '@vini-ds/tokens/typography.css';
import './tokens.css';
import './styles.css';
import '@vini-ds/ui/styles.css';
import './vini-layout.css';
import './settings-recovery.css';

createRoot(document.getElementById('root')!).render(<StrictMode><AppearanceProvider><Toaster viewportProps={{'aria-label': 'Уведомления'}}><StoreProvider><App /></StoreProvider></Toaster></AppearanceProvider></StrictMode>);

import './dashboard-shell.css';
