# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Non-Obvious Commands
- `npm docker:dev`: Starts development environment using Docker Compose
- `npm docker:test`: Runs tests in a dedicated Docker container
- `npm docker:prod`: Builds and runs production Docker image

## Project-Specific Patterns
- **Video Processing**: Client-side only using FFmpeg.wasm/WebCodecs in Web Workers
- **State Management**: Custom React hooks (`useEditorState`) instead of Redux
- **Storage**: IndexedDB/File System API for persistent storage (no server DB)
- **Styling**: Extensive custom Tailwind CSS palette (`timeline-bg`, `timeline-clip`)

## Architectural Constraints
- **Single-User Focus**: No backend API or multi-user support
- **Memory Limits**: Projects capped at 4GB total size
- **Docker Deployment**: All environments use Docker containers
- **Browser Support**: Modern browsers only (Chrome, Firefox, Edge)

## Gotchas
- FFmpeg.wasm requires explicit initialization before use (call `initFFmpeg()`)
- File System API permissions vary by browser
- Memory-intensive operations require chunked processing (use sequential queues for batch operations)
- Trim handles require custom drag logic
- Relaxed TypeScript rules (`no-unused-vars` disabled)
- **Speed Changes**: Speed adjustments require re-encoding the video
- **Quality Presets**: Quality presets affect export performance and file size