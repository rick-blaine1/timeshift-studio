# Project Debug Rules (Non-Obvious Only)

- **Containerized Debugging:** When running in Docker (e.g., `npm docker:dev`), debug logs and application output should be checked within the Docker container logs.
- **Performance Debugging:** Due to client-side video processing, closely monitor browser memory and CPU usage in developer tools, especially for large video files (2-4GB projects). Out-of-memory errors are common.
- **FFmpeg.wasm Errors:** FFmpeg.wasm operations can fail silently or with cryptic messages; thoroughly check worker thread console logs for detailed errors.
- **Missing Vitest UI:** `vitest --ui` may not work as expected when run directly. Refer to `npm test:ui` script for correct usage.