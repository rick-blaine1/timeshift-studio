# Project Architecture Rules (Non-Obvious Only)

- **Client-Side Mandate**: All processing must occur in browser
- **Local Persistence**: Use IndexedDB/File System API only
- **Schema Evolution**: Implement migrations with `SchemaMigrator`
- **Performance Constraints**: Optimize for 4GB memory limit
- **Single-User Focus**: Avoid multi-user patterns
- **Docker Deployment**: Design for containerized environment
- **Web Workers**: Required for video processing tasks
- **Memory Management**: Implement chunked processing for large files
- **Browser Compatibility**: Target Chrome/Edge/Firefox only
- **FFmpeg.wasm**: Must be initialized before use