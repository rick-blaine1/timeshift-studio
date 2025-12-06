# Project Debug Rules (Non-Obvious Only)

- **Containerized Debugging**: Check Docker container logs for runtime issues
- **Performance Monitoring**: Use `PerformanceMonitor` for memory/CPU metrics
- **FFmpeg.wasm Errors**: Check worker thread console logs for details
- **Memory Limits**: Watch for OOM errors with files >2GB
- **Browser DevTools**: Use Performance/Memory tabs for video processing
- **Vitest UI**: Requires `npm test:ui` instead of direct command
- **Error Handling**: Use `getUserFriendlyErrorMessage()` for error translation
- **Memory Checks**: Implement `checkMemoryUsage()` before heavy operations