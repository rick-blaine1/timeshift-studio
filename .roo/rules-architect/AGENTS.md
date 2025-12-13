# AGENTS.md

This file provides guidance to agents when working in architect mode.

## Architectural Constraints
- **Client-Side Only**: No backend server - all video processing must happen in browser using FFmpeg.wasm with Web Worker isolation
- **Webview Isolation**: React hooks pattern used because the app is designed for potential Electron/webview embedding - no class components
- **Stateless Providers**: UI components are stateless; all state managed by `useEditorState` hook with dual persistence (IndexedDB + localStorage)

## System Boundaries & Coupling
- **FFmpeg Singleton**: Global FFmpeg instance shared across all components - must be cleaned up with `ffmpeg.deleteFile()` to prevent memory leaks
- **Worker Isolation**: Video processing runs in separate Web Worker thread - cannot access DOM (except OffscreenCanvas) and communicates via IPC
- **Dual Storage Coupling**: State persistence writes to BOTH IndexedDB (primary) AND localStorage (fallback) - creates coupling but ensures data survival
- **Schema Forward-Only**: Migrations in `SchemaMigrator.ts` are forward-only - no rollback support, breaking changes require new version

## Design Decisions & Trade-offs
- **Speed Change Re-encoding**: Speed adjustments require full video re-encoding (not metadata) - chosen for accuracy over performance
- **Queue Concurrency**: Default `concurrency=1` (sequential) chosen to avoid race conditions in video processing - limits throughput
- **Dual File References**: Video files stored via EITHER IndexedDB OR File System Access API - never both - due to browser API limitations
- **Timeline Recalculation**: Every clip operation triggers full timeline recalculation (startTime updates) - simple but O(n) performance

## Performance Bottlenecks
- **Memory Limits**: Browser IndexedDB quotas cap projects at ~4GB total size - constrains video library size
- **FFmpeg Memory**: FFmpeg.wasm runs in same thread as UI - long processing blocks main thread (mitigated by Web Worker)
- **State Persistence Overhead**: `useEditorState` saves on EVERY state change - can cause UI jank during rapid updates
- **Thumbnail Generation**: Blocking operation that can delay UI - but cached in IndexedDB after first generation

## Build & Deployment Constraints
- **Vite Worker Format**: Requires `format: "es"` for both main and worker bundles - limits compatibility with older browsers
- **Top-Level Await**: Required for FFmpeg.wasm initialization - forces use of `vite-plugin-top-level-await`
- **Docker Port Configuration**: Development server uses port 8080 (not 3000) with IPv6 host `::` due to Docker networking
- **Production Health Check**: Nginx container exposes port 80 with health check at `/health` - no authentication