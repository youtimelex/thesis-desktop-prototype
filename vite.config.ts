import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));
const sharedDependencies = realpathSync(join(projectRoot, 'node_modules'));

export default defineConfig({
  plugins: [react()],
  server: { host: '127.0.0.1', port: 4192, strictPort: true, fs: { allow: [projectRoot, sharedDependencies] } },
  preview: { host: '127.0.0.1', port: 4192, strictPort: true },
});
