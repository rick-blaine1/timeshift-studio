# AGENTS.md

This file provides guidance to agents when working in debug mode.

## Chrome-Specific Debugging
- **Memory API**: `checkMemoryUsage()` only works in Chrome - uses `performance.memory` API (not available in Firefox/Safari)
- **IndexedDB Inspector**: Chrome DevTools > Application > IndexedDB shows `timeshift-studio` database with `projects`, `files`, `thumbnails` stores

## Error Handling Quirks
- **Silent Retry Exclusions**: `retryWithBackoff()` never retries `UNSUPPORTED_FORMAT` or `CORRUPTED_FILE` errors ([`errorHandling.ts:218-221`](../../src/utils/errorHandling.ts:218))
- **Custom Error Codes**: Check `error.code` property on `VideoProcessingError`, `StorageError`, `MemoryError` for specific failure reasons
- **FFmpeg Errors**: FFmpeg.wasm errors logged to console but may not propagate - check browser console for native logs

## Worker Debugging
- **Web Worker Context**: Video processing runs in separate worker thread - use `console.log` in [`videoWorker.ts`](../../src/utils/videoWorker.ts) to debug
- **Worker Communication**: IPC messages logged with `[VideoWorker]` prefix - filter console by this string
- **OffscreenCanvas Only**: Worker cannot access DOM - only OffscreenCanvas available for rendering
- **Blob URL Leaks**: If memory grows unexpectedly, check for missing `URL.revokeObjectURL()` calls ([`videoWorker.ts:53`](../../src/utils/videoWorker.ts:53))

## Storage Debugging
- **Dual Storage Check**: Files stored in EITHER IndexedDB OR File System Access API - check both ([`videoWorker.ts:23-32`](../../src/utils/videoWorker.ts:23))
- **Async Init Race**: `StorageService` constructor calls async `initDb()` without await - `this.db` may be undefined initially ([`StorageService.ts:29-30`](../../src/services/storage/StorageService.ts:29))
- **State Persistence**: `useEditorState` writes to BOTH IndexedDB AND localStorage - check both for state issues ([lines 183-202](../../src/hooks/useEditorState.ts:183))
- **Project ID Location**: Current project ID stored separately in localStorage key `current-project-id`

## Performance Debugging
- **Timeline Recalc**: Every clip operation triggers full timeline recalculation - use React DevTools Profiler to identify excessive renders
- **FFmpeg Memory**: Check for missing `ffmpeg.deleteFile()` calls in finally blocks ([`ffmpeg.ts:60-62`](../../src/utils/ffmpeg.ts:60))
- **Queue Concurrency**: If race conditions occur, verify `createQueue(1)` is used (not higher concurrency)
- **Speed Encoding**: Speed changes require full re-encode - expect long processing times

## Common Failure Points
- **Thumbnail Generation**: Default 5s seek fails on videos <5s - check for `Math.min(timestamp, duration)` wrapper ([`thumbnailGenerator.ts:29`](../../src/utils/thumbnailGenerator.ts:29))
- **File Status Enum**: String literals instead of `VideoFileStatus` enum cause silent failures
- **State Save Timing**: `useEditorState` saves on EVERY change except during `isLoading` - may cause performance issues