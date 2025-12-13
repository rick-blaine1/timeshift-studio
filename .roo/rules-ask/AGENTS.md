# AGENTS.md

This file provides guidance to agents when working in ask mode.

## Project Architecture Context
- **Client-Side Only**: No backend server - all processing happens in browser using FFmpeg.wasm
- **Dual Storage Strategy**: Uses BOTH IndexedDB (primary) AND localStorage (fallback) for state persistence ([`useEditorState.ts:183-202`](../../src/hooks/useEditorState.ts:183))
- **Project ID Separation**: Current project ID stored separately in localStorage key `current-project-id` (not in main state)
- **File Storage Duality**: Video files stored via EITHER IndexedDB OR File System Access API, never both ([`videoWorker.ts:23-32`](../../src/utils/videoWorker.ts:23))

## Schema & Data Model
- **Schema Location**: Type definitions in [`src/types/schema/`](../../src/types/schema/) directory
- **Forward-Only Migrations**: Schema migrations in [`SchemaMigrator.ts`](../../src/utils/schema/SchemaMigrator.ts) - no rollback support
- **Speed Multiplier Duality**: Stored on BOTH VideoFile AND ExportSettings - file-level overrides global setting
- **Timeline Auto-Recalc**: Timeline startTime values recalculated on every clip operation (not cached)

## Non-Obvious Patterns
- **FFmpeg Singleton**: `initFFmpeg()` returns cached instance - safe to call multiple times but unnecessary
- **Worker Isolation**: Video processing runs in Web Worker - cannot access DOM except OffscreenCanvas
- **Async Init Pattern**: `StorageService` constructor calls async `initDb()` without await - `this.db` may be undefined initially ([`StorageService.ts:29-30`](../../src/services/storage/StorageService.ts:29))
- **State Save Frequency**: `useEditorState` persists on EVERY state change except during initial load (`isLoading` flag)

## Build & Configuration
- **Vite Worker Format**: Both main and worker bundles require `format: "es"` ([`vite.config.ts:26-31`](../../vite.config.ts:26))
- **Top-Level Await**: Enabled via `vite-plugin-top-level-await` for FFmpeg.wasm initialization
- **TypeScript Relaxed**: `noImplicitAny: false`, `strictNullChecks: false` - more permissive than typical React projects
- **Docker Dev Port**: Development server runs on port 8080 (not 3000) with IPv6 host `::`

## Performance Characteristics
- **Speed Changes**: Require full video re-encoding (not just metadata updates) - computationally expensive
- **Queue Concurrency**: Defaults to sequential processing (`concurrency=1`) - higher values cause race conditions
- **Memory Limits**: Projects capped at 4GB total size (browser-specific IndexedDB quotas)
- **Chrome-Only Features**: `checkMemoryUsage()` uses Chrome-specific `performance.memory` API