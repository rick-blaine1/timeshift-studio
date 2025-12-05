# Project Architecture Rules (Non-Obvious Only)

- **Client-Side Processing Mandate:** All video processing (encoding, decoding, manipulation) must occur entirely client-side, typically leveraging Web Workers for offloading, FFmpeg.wasm, or WebCodecs. Server-side processing is explicitly forbidden for the single-user model.
- **Local Persistence Only:** Project data persistence is limited to browser-local storage (IndexedDB, LocalStorage, File System API) and Docker volumes for development/deployment. No external databases or cloud storage are part of the core architecture.
- **Schema Evolution:** Data schema changes require a formal migration strategy using the `SchemaMigrator` utility to ensure backward compatibility and data integrity.
- **Performance Constraints:** Architectural decisions must account for browser memory and CPU limitations when handling large video files. Prioritize efficient memory management, chunking, and worker thread optimization.
- **Single-User Focus:** The architecture is specifically optimized for a single concurrent user; avoid patterns that introduce multi-user complexity unless explicitly part of a future enhancement plan.
- **Docker as Deployment Target:** The entire application is containerized for consistent development and deployment. All environment configurations should be Docker-centric.
- **Web Workers:** Extensive use of Web Workers for offloading heavy video processing tasks to prevent UI freezes.