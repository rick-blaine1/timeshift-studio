# Project Debug Rules (Non-Obvious Only)
- Webview dev tools accessed via Command Palette > "Developer: Open Webview Developer Tools" (not F12)
- IPC messages fail silently if not wrapped in try/catch in packages/ipc/src/
- Production builds require NODE_ENV=production or certain features break without error
- Database migrations must run from packages/evals/ directory, not root
- Extension logs only visible in "Extension Host" output channel, not Debug Console
- The unhandled IndexedDB error in Vitest tests due to `indexedDB is not defined` (needs mocking or browser env).
- Debugging `useEditorState` dual-write: Be aware of state inconsistencies between IndexedDB and localStorage during debugging.