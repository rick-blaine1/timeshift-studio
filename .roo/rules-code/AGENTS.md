# AGENTS.md

This file provides guidance to agents when working with code in this repository.

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
- **FFmpeg Environment**: Requires `FFMPEG_CORE_PATH` if not served from `/ffmpeg-core/`
- **Audio Handling**: Speed changes require specific re-encoding steps for audio.
- **Resolution Mismatch**: Handle resolution mismatch for timeline clips.
- **Large File Storage**: IndexedDB for video blobs is critical for performance.
- **FFmpeg Progress**: Global state for FFmpeg progress (not per-instance).

## Error Handling Patterns
- **No Retry Errors**: `retryWithBackoff()` never retries `UNSUPPORTED_FORMAT` or `CORRUPTED_FILE` errors ([`errorHandling.ts:218-221`](../../src/utils/errorHandling.ts:218))
- **Memory API**: `checkMemoryUsage()` only works in Chrome (uses `performance.memory` API)
- **Custom Error Classes**: Always use `VideoProcessingError`, `StorageError`, `MemoryError` with proper error codes

## Performance Gotchas
- **Speed Changes**: Require full video re-encoding (not just metadata updates) - computationally expensive
- **Speed Multiplier**: Stored on VideoFile AND ExportSettings - file-level overrides global
- **Timeline Recalc**: Every clip operation triggers full timeline recalculation with startTime updates - avoid frequent updates
- **State Persistence**: `useEditorState` saves on EVERY state change except during initial load (`isLoading` flag)
- **Speed Change Double-Apply**: Speed changes can be double-applied if not careful (on `VideoFile` and `ExportSettings`).

## Build Configuration
- **Vite Worker Format**: Requires `format: "es"` for both main and worker bundles ([`vite.config.ts:26-31`](../../src/vite.config.ts:26))
- **Top-Level Await**: Enabled via `vite-plugin-top-level-await` for FFmpeg.wasm initialization

## Code Style Guidelines
- **TypeScript Relaxed**: `tsconfig.json` sets `noImplicitAny: false`, `strictNullChecks: false`, `noUnusedLocals: false`, `noUnusedParameters: false` (Relaxed TypeScript config)
- **ESLint Relaxed**: ESLint disables `@typescript-eslint/no-unused-vars`
- **Path Aliases**: `@/` for `src` directory imports
- **Custom Utilities**: Custom utility functions (e.g., in `src/utils/`) should be prioritized over standard library functions if they exist for specific tasks.
- **Tailwind CSS**: Class-based dark mode, custom color palette, custom border-radii, custom shadows, and animations.

## Storage Patterns
- **Dual-Write**: `useEditorState` writes to BOTH IndexedDB AND localStorage as fallback ([lines 183-202`](../../src/hooks/useEditorState.ts:183))
- **Project ID Tracking**: Current project ID stored separately in localStorage key `current-project-id`
- **IndexedDB Lazy Init**: IndexedDB storage is lazy-initialized.
- **Project Duplication**: Project duplication creates a deep clone in IndexedDB.

## Build/Lint/Test Commands
- **Vitest Single Test**: `npm test -- <path/to/test/file>` or `vitest <path/to/test/file>`
- **Playwright Single Test**: `npm run test:e2e -- <path/to/e2e/file>` or `playwright test <path/to/e2e/file>`
- **Vitest CI**: `vitest run --coverage --shard` is for CI
- **Docker Dev**: `npm run docker:dev` uses `compose.development.yaml`, port 8080, IPv6 host `::`
- **Docker Test**: `npm run docker:test` uses `--abort-on-container-exit` flag, `Dockerfile.production` target `tester`
- **Docker Production**: `docker:prod` and its specific compose files/flags.

## Non-Standard Patterns
- **Custom Progress Reporting**: Custom progress reporting heuristics for video processing.
- **Web Worker Communication**: Specific Web Worker communication pattern for preview.

## Docker-Specific
- `npm run docker:dev`: Uses compose.development.yaml (not compose.yaml), port 8080
- `npm run docker:test`: Uses `--abort-on-container-exit` flag, Dockerfile.production target `tester`
- Dev server runs on port 8080 (not 3000) with IPv6 host `::`
- Production container exposes port 80 (Nginx), health check at `/health`