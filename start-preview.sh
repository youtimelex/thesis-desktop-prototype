#!/bin/sh
cd "$(dirname "$0")"
exec node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4192 --strictPort
