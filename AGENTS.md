# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Critical Gotchas
- **FFmpeg Cleanup**: MUST call `ffmpeg.deleteFile()` in finally blocks to prevent memory leaks (ffmpeg.ts:60-62)
- **FFmpeg Singleton**: `initFFmpeg()` returns cached instance - calling multiple times is safe but unnecessary
- **Storage Dual-Write**: `useEditorState` writes to BOTH IndexedDB AND localStorage as fallback (lines 183-202)
- **Project ID Tracking**: Current project ID stored separately in localStorage key `current-project-id`
- **TypeScript Relaxed**: `noImplicitAny: false`, `strictNullChecks: false`, `@typescript-eslint/no-unused-vars: off`
- **Worker Format**: Vite build requires `format: "es"` for both main and worker bundles (vite.config.ts:26-31)
- **Top-Level Await**: Required plugin `vite-plugin-top-level-await` for FFmpeg.wasm initialization
- **Speed Changes**: Require full video re-encoding (not just metadata updates) - computationally expensive
- **Queue Concurrency**: `createQueue(1)` for sequential processing - concurrency >1 causes race conditions
- **Blob URL Cleanup**: Must manually call `URL.revokeObjectURL()` after use to prevent memory leaks (videoWorker.ts:53)

## Non-Standard Patterns
- **Storage Service**: Constructor calls async `initDb()` but doesn't await - check `this.db` before use (StorageService.ts:29-30)
- **Video File References**: Files use EITHER `indexedDBKey` OR `fileHandle`, never both - check both in conditionals (videoWorker.ts:23-32)
- **File Status Enum**: Import from `VideoFileStatus` enum, not string literals
- **Thumbnail Generation**: Default 5s seek may exceed video duration - wrap in `Math.min(timestamp, duration)` (thumbnailGenerator.ts:29)
- **Memory Checks**: `checkMemoryUsage()` only works in Chrome (uses `performance.memory` API)
- **Error Retry**: `retryWithBackoff()` never retries `UNSUPPORTED_FORMAT` or `CORRUPTED_FILE` errors (errorHandling.ts:218-221)
- **State Persistence**: `useEditorState` saves on EVERY state change except during initial load (isLoading flag)
- **Timeline Recalc**: Every clip operation triggers full timeline recalculation with startTime updates - avoid frequent updates
- **Video Worker Context**: Runs in Web Worker - cannot access DOM except OffscreenCanvas
- **Speed Multiplier**: Stored on VideoFile AND ExportSettings - file-level overrides global

## Docker-Specific
- `npm run docker:dev`: Uses compose.development.yaml (not compose.yaml), port 8080
- `npm run docker:test`: Uses `--abort-on-container-exit` flag, Dockerfile.production target `tester`
- Dev server runs on port 8080 (not 3000) with IPv6 host `::`
- Production container exposes port 80 (Nginx), health check at `/health`