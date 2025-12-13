# AGENTS.md

This file provides guidance to agents when working in code mode.

## Critical Implementation Details
- **FFmpeg Cleanup**: MUST call `ffmpeg.deleteFile()` in finally blocks to prevent memory leaks ([`ffmpeg.ts:60-62`](../../src/utils/ffmpeg.ts:60))
- **FFmpeg Singleton**: `initFFmpeg()` returns cached instance - calling multiple times safe but unnecessary
- **Queue Concurrency**: Use `createQueue(1)` for sequential processing - concurrency >1 causes race conditions
- **Storage Service Init**: Constructor calls async `initDb()` but doesn't await - check `this.db` before use ([`StorageService.ts:29-30`](../../src/services/storage/StorageService.ts:29))
- **Video Worker Context**: Runs in Web Worker - cannot access DOM except OffscreenCanvas
- **Dual Storage Keys**: Files use EITHER `indexedDBKey` OR `fileHandle`, never both - check both in conditionals ([`videoWorker.ts:23-32`](../../src/utils/videoWorker.ts:23))
- **Thumbnail Timestamp**: Default 5s seek may exceed video duration - wrap in `Math.min(timestamp, duration)` ([`thumbnailGenerator.ts:29`](../../src/utils/thumbnailGenerator.ts:29))
- **File Status Enum**: Import from `VideoFileStatus` enum, not string literals
- **Blob URL Cleanup**: Must manually call `URL.revokeObjectURL()` after use to prevent memory leaks ([`videoWorker.ts:53`](../../src/utils/videoWorker.ts:53))

## Error Handling Patterns
- **No Retry Errors**: `retryWithBackoff()` never retries `UNSUPPORTED_FORMAT` or `CORRUPTED_FILE` errors ([`errorHandling.ts:218-221`](../../src/utils/errorHandling.ts:218))
- **Memory API**: `checkMemoryUsage()` only works in Chrome (uses `performance.memory` API)
- **Custom Error Classes**: Always use `VideoProcessingError`, `StorageError`, `MemoryError` with proper error codes

## Performance Gotchas
- **Speed Changes**: Require full video re-encoding (not just metadata updates) - computationally expensive
- **Speed Multiplier**: Stored on VideoFile AND ExportSettings - file-level overrides global
- **Timeline Recalc**: Every clip operation triggers full timeline recalculation with startTime updates - avoid frequent updates
- **State Persistence**: `useEditorState` saves on EVERY state change except during initial load (`isLoading` flag)

## Build Configuration
- **Vite Worker Format**: Requires `format: "es"` for both main and worker bundles ([`vite.config.ts:26-31`](../../vite.config.ts:26))
- **Top-Level Await**: Enabled via `vite-plugin-top-level-await` for FFmpeg.wasm initialization

## TypeScript Relaxations
- `tsconfig.json` sets `noImplicitAny: false`, `strictNullChecks: false`, `noUnusedLocals: false`
- ESLint disables `@typescript-eslint/no-unused-vars` - unused parameters/variables allowed

## Storage Patterns
- **Dual-Write**: `useEditorState` writes to BOTH IndexedDB AND localStorage as fallback ([lines 183-202](../../src/hooks/useEditorState.ts:183))
- **Project ID Tracking**: Current project ID stored separately in localStorage key `current-project-id`