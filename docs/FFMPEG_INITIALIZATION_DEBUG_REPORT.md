# FFmpeg.wasm Initialization Failure - Debug Report

**Date:** 2025-12-13  
**Issue:** FFmpeg.wasm fails to initialize, causing export progress bar to stay at 0%  
**Status:** ✅ ROOT CAUSE IDENTIFIED & SOLUTION IMPLEMENTED

---

## Executive Summary

FFmpeg.wasm initialization was failing due to a **Cross-Origin Resource Sharing (CORS) conflict** between the application's cross-origin isolation headers and the CDN-hosted FFmpeg.wasm worker files. The solution involves hosting FFmpeg.wasm files locally instead of loading them from the CDN.

---

## Root Cause Analysis

### 1. Initial Symptoms
- Export progress bar stuck at 0%
- No visible errors in the UI
- FFmpeg initialization silently failing

### 2. Investigation Process

#### Step 1: Enhanced Diagnostic Logging
Added comprehensive logging to [`ffmpeg.ts`](../src/utils/ffmpeg.ts) to track initialization flow:
- SharedArrayBuffer availability check
- Cross-origin isolation status
- FFmpeg instance creation
- Load operation timing and errors

#### Step 2: Environment Verification
Created test page ([`public/ffmpeg-test.html`](../public/ffmpeg-test.html)) to isolate the issue:
- ✅ SharedArrayBuffer: Available
- ✅ crossOriginIsolated: `true`
- ✅ Cross-origin headers correctly configured:
  - `Cross-Origin-Opener-Policy: same-origin`
  - `Cross-Origin-Embedder-Policy: credentialless`

#### Step 3: Error Discovery
When attempting to initialize FFmpeg, the following error occurred:

```
SecurityError: Failed to construct 'Worker': Script at 
'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.15/dist/esm/worker.js' 
cannot be accessed from origin 'http://localhost:8080'.
```

### 3. Root Cause

**The Problem:** Cross-origin isolation headers (`Cross-Origin-Embedder-Policy: credentialless`) prevent loading Web Workers from external origins (CDN) for security reasons.

**Why This Happens:**
1. The application requires cross-origin isolation to use `SharedArrayBuffer` (needed for FFmpeg.wasm)
2. Cross-origin isolation enforces strict CORS policies
3. FFmpeg.wasm by default tries to load worker files from CDN
4. The browser blocks this cross-origin worker loading due to the security policy
5. FFmpeg initialization fails silently

**Technical Details:**
- FFmpeg.wasm version: `@ffmpeg/ffmpeg@0.12.15`
- FFmpeg core version: `@ffmpeg/core@0.11.0`
- Required files:
  - `ffmpeg-core.js` (main library)
  - `ffmpeg-core.wasm` (WebAssembly binary)
  - `ffmpeg-core.worker.js` (Web Worker script)

---

## Solution Implemented

### 1. Copy FFmpeg Files Locally

Copied FFmpeg.wasm core files from `node_modules` to `public` directory:

```bash
xcopy /Y node_modules\@ffmpeg\core\dist\*.* public\ffmpeg-core\
```

Files copied:
- `public/ffmpeg-core/ffmpeg-core.js`
- `public/ffmpeg-core/ffmpeg-core.wasm`
- `public/ffmpeg-core/ffmpeg-core.worker.js`

### 2. Update FFmpeg Initialization

Modified [`src/utils/ffmpeg.ts`](../src/utils/ffmpeg.ts) to use local files:

```typescript
// Before (using CDN - FAILS):
const loadPromise = ffmpeg.load();

// After (using local files - WORKS):
const baseURL = window.location.origin + '/ffmpeg-core';
const loadPromise = ffmpeg.load({
  coreURL: `${baseURL}/ffmpeg-core.js`,
  wasmURL: `${baseURL}/ffmpeg-core.wasm`,
  workerURL: `${baseURL}/ffmpeg-core.worker.js`,
});
```

### 3. Enhanced Logging

Added detailed logging throughout the initialization process to help diagnose future issues:
- Environment checks (SharedArrayBuffer, crossOriginIsolated)
- Instance creation confirmation
- Load operation timing
- Detailed error reporting with stack traces

---

## Verification Steps

To verify the fix works:

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Open the application:**
   ```
   http://localhost:8080
   ```

3. **Upload video files and attempt export**

4. **Check browser console for logs:**
   - Should see: `[FFmpeg] ✓ FFmpeg core loaded successfully!`
   - Should NOT see: CORS or Worker construction errors

5. **Monitor export progress:**
   - Progress bar should advance from 0% to 100%
   - Export should complete successfully

---

## Additional Recommendations

### 1. Build Process Integration

Add a build step to automatically copy FFmpeg files:

**package.json:**
```json
{
  "scripts": {
    "prebuild": "xcopy /Y node_modules\\@ffmpeg\\core\\dist\\*.* public\\ffmpeg-core\\",
    "build": "vite build"
  }
}
```

### 2. Production Deployment

Ensure FFmpeg files are included in production builds:
- Verify `public/ffmpeg-core/` directory is deployed
- Check that files are served with correct MIME types:
  - `.wasm` → `application/wasm`
  - `.js` → `application/javascript`

### 3. CDN Alternative (Future Consideration)

If CDN hosting is preferred, configure CORS headers on the CDN:
- Serve files with `Cross-Origin-Resource-Policy: cross-origin`
- Ensure CDN supports CORS for Web Workers
- Note: This is more complex and may not work with all CDN providers

### 4. Fallback Strategy

Consider implementing a fallback mechanism:

```typescript
async function initFFmpeg(): Promise<FFmpeg> {
  try {
    // Try local files first
    return await loadLocalFFmpeg();
  } catch (error) {
    console.warn('Local FFmpeg failed, trying CDN...');
    // Fallback to CDN (may fail with CORS)
    return await loadCDNFFmpeg();
  }
}
```

### 5. Alternative: MediaRecorder API

For simpler use cases, consider using the browser's native MediaRecorder API:

**Pros:**
- No external dependencies
- No CORS issues
- Faster initialization
- Smaller bundle size

**Cons:**
- Limited codec support
- Less control over encoding parameters
- Browser-dependent quality
- May not support all required features (speed adjustment, concatenation)

**Implementation Example:**
```typescript
const stream = canvas.captureStream(30); // 30 FPS
const recorder = new MediaRecorder(stream, {
  mimeType: 'video/webm;codecs=vp9',
  videoBitsPerSecond: 2500000
});

recorder.ondataavailable = (event) => {
  chunks.push(event.data);
};

recorder.onstop = () => {
  const blob = new Blob(chunks, { type: 'video/webm' });
  // Download or process blob
};

recorder.start();
```

---

## Technical Context

### Cross-Origin Isolation Requirements

The application uses cross-origin isolation to enable `SharedArrayBuffer`, which is required for:
- FFmpeg.wasm (multi-threaded video processing)
- High-performance video operations
- Web Workers with shared memory

**Required Headers (configured in [`vite.config.ts`](../vite.config.ts)):**
```typescript
headers: {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'credentialless',
}
```

### Why SharedArrayBuffer?

SharedArrayBuffer enables:
- Zero-copy data transfer between main thread and workers
- Significant performance improvements for video processing
- Required by FFmpeg.wasm for efficient operation

### Security Implications

Cross-origin isolation is a security feature that:
- Prevents Spectre-style attacks
- Isolates the application from other origins
- Restricts loading of cross-origin resources
- Required for high-resolution timers and SharedArrayBuffer

---

## Files Modified

1. **[`src/utils/ffmpeg.ts`](../src/utils/ffmpeg.ts)**
   - Added enhanced diagnostic logging
   - Configured local file paths for FFmpeg.wasm
   - Added detailed error reporting

2. **[`public/ffmpeg-core/`](../public/ffmpeg-core/)** (new directory)
   - `ffmpeg-core.js`
   - `ffmpeg-core.wasm`
   - `ffmpeg-core.worker.js`

3. **[`public/ffmpeg-test.html`](../public/ffmpeg-test.html)** (new file)
   - Standalone test page for FFmpeg initialization
   - Environment diagnostics
   - Detailed console logging

---

## Testing Checklist

- [x] FFmpeg initialization succeeds
- [x] SharedArrayBuffer is available
- [x] Cross-origin isolation is active
- [x] Local FFmpeg files are accessible
- [ ] Export progress advances beyond 0%
- [ ] Video export completes successfully
- [ ] Downloaded video plays correctly
- [ ] Multiple exports work consecutively
- [ ] Large files (>100MB) export successfully

---

## Known Limitations

1. **File Size:** FFmpeg.wasm files add ~30MB to the application bundle
2. **First Load:** Initial FFmpeg load takes 10-30 seconds
3. **Memory Usage:** Video processing requires significant RAM (500MB+ recommended)
4. **Browser Support:** Requires modern browsers with SharedArrayBuffer support

---

## Conclusion

The FFmpeg.wasm initialization failure was caused by a CORS conflict between cross-origin isolation headers and CDN-hosted worker files. The solution is to host FFmpeg.wasm files locally, which eliminates the cross-origin issue while maintaining all required functionality.

**Status:** ✅ Solution implemented and ready for testing

**Next Steps:**
1. Test export functionality with real video files
2. Verify progress bar updates correctly
3. Confirm exported videos play properly
4. Add build script to automate FFmpeg file copying
5. Update deployment documentation

---

## References

- [FFmpeg.wasm Documentation](https://ffmpegwasm.netlify.app/)
- [Cross-Origin Isolation Guide](https://web.dev/coop-coep/)
- [SharedArrayBuffer Requirements](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer)
- [Web Workers and CORS](https://developer.mozilla.org/en-US/docs/Web/API/Worker)