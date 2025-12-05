# Product Requirement Document (PRD)

**Project Name:** Browser-Based Video to Timelapse Editor **Version:** 1.0 (MVP) **Status:** Final **Source Document:** Concept Brief v1.0.md

---

## 1\. Executive Summary

The objective is to build a lightweight, browser-based video editor focused specifically on the **"Video to Timelapse" workflow**. This tool allows users to upload video clips, arrange them on a timeline, stitch them together, and export a speed-adjusted timelapse video. The MVP prioritizes privacy, speed, and simplicity by utilizing client-side processing (zero-install, no backend rendering).

---

## 2\. Problem Statement

Existing video editors (CapCut, Premiere, DaVinci Resolve) are **too complex** for simple workflows, slow to load, and require steep learning curves for users who only need a simple “upload clips → reorder → export timelapse” workflow. This PRD defines a simple, browser-based editor optimized for minimal editing and fast export.

---

## 3\. Target Audience

The primary audience is **Casual and semi-pro creators**.

* **Use Cases:** Travel vloggers creating day summaries, makers filming build processes, and creators compressing long recordings into short highlight videos.

---

## 4\. Scope (MVP)

### In Scope

* Desktop browser support (Chrome/Chromium recommended).  
* Single and multi-file upload (drag-and-drop).  
* Timeline sequencing and reordering.  
* Global speed adjustment (presets and custom multiplier).  
* Client-side rendering and local export using FFmpeg.wasm.  
* Local session persistence via IndexedDB.

### Out of Scope

* Mobile editing UI.  
* Transitions, keyframes, or multi-track editing.  
* Audio editing (audio will be stripped/muted for MVP).  
* AI stabilization, enhancement, or cloud storage of videos.

---

## 5\. Functional Requirements (User Stories)

### Epic 5.1: Clip Ingestion (Project files)

**Goal:** Add clips to a project so they can be used in the timeline.

#### Story 5.1.1 — Single & Multi-file Upload

**As a** user **I want to** upload one or more video files to my project files list **So that** I can use those clips in the timeline.

**Acceptance Criteria**

* The UI exposes an explicit Upload control (button \+ drag-and-drop area).  
* User can select multiple files at once via file selector.  
* Dragging files over the drop area shows a visual drop target.  
* Files with supported extensions (e.g., .mp4, .mov, .webm) are accepted; unsupported files are rejected with a clear error message listing supported formats.  
* Each successfully uploaded file appears in the project files list with filename, duration, resolution, file size, and a thumbnail.  
* Upload progress for each file is shown and completes to 100% before thumbnail/metadata is shown.  
* Upload cancel button is available during upload and stops the upload/cleans partial state.  
* Upload failures show an actionable error and a retry option.  
* Large file handling: UI warns if a single file exceeds the recommended client-side limit (1 GB) and offers guidance (try smaller files or use server render).

**Non-functional**

* Upload UI remains responsive during file processing.  
* Thumbnail extraction completes within 3s of upload completion for typical short clips (\< 60s).

#### Story 5.1.2 — Persist & Index Uploaded Files (local cache)

**As a** user **I want** uploaded files to be cached locally (IndexedDB) for the session **So that** I don’t need to re-upload when reloading the page during a single session.

**Acceptance Criteria**

* After successful upload, file is stored in IndexedDB (or equivalent).  
* On page reload within the same session, project files list repopulates from local cache without requiring re-upload.  
* If IndexedDB read fails, show a clear error and allow re-upload.  
* Cached files are cleaned according to retention rules or explicit user action.

---

### Epic 5.2: Timeline Ordering & Basic Editing

**Goal:** Arrange clips visually to define final sequence.

#### Story 5.2.1 — Add clip to timeline

**As a** user **I want to** add files from project files list onto the timeline **So that** I can build the sequence for the timelapse.

**Acceptance Criteria**

* User can drag a clip from the project files list onto the timeline.  
* Dropping a clip onto the timeline appends it to the end by default or inserts at drop point if dropped between clips.  
* Timeline shows the new clip with thumbnail and duration immediately after drop.  
* Project files list indicates which clips are currently used in the timeline (e.g., used badge).

#### Story 5.2.2 — Reorder clips via drag & drop

**As a** user **I want to** reorder clips on the timeline by dragging them **So that** I can control final sequence.

**Acceptance Criteria**

* User can click/tap and drag any clip to a new position on the timeline.  
* While dragging, a clear placeholder shows the drop location and adjacent clips shift.  
* Dropping moves the clip and updates the timeline immediately.  
* Preview playback reflects the new order without needing to reload the page.  
* Invalid drops (outside timeline) revert the clip to original position.  
* Drag interactions are smooth; no major jank or UI freeze during drag on supported desktop browsers.

#### Story 5.2.3 — Remove clip from timeline

**As a** user **I want to** remove a clip from the timeline **So that** I can correct mistakes or change the flow.

**Acceptance Criteria**

* Each clip on the timeline exposes a delete action (icon or context menu).  
* Clicking delete opens a confirmation modal.  
* After confirmation, the clip is removed, remaining clips shift left to close gap.  
* Preview updates immediately to reflect removal.

---

### Epic 5.3: Speed Control (Timelapse)

**Goal:** Define how much to speed up the combined video.

#### Story 5.3.1 — Global speed multiplier control (MVP)

**As a** user **I want to** set a global speed multiplier for the final export **So that** the exported video plays as a timelapse.

**Acceptance Criteria**

* UI exposes a speed control (preset buttons such as 2x, 4x, 8x and a numeric input for custom multiplier with one decimal place).  
* Default multiplier is 1.0.  
* Numeric input validates: only numbers ≥ 1 with max reasonable cap (e.g., 100.0); invalid input shows inline error.  
* Changing the multiplier updates the preview playback speed immediately (if device supports real-time) or within the indicated render preview timeframe.  
* Exported video duration equals original\_total\_duration ÷ multiplier within ±0.5s for typical projects.cts.

#### Story 5.3.2 — Audio policy when speeding

**As a** user **I want to** understand and control what happens to audio when creating a timelapse **So that** I can avoid poor audio results.

**Acceptance Criteria**

* Only available behavior on export is to **mute/strip audio** (recommended for timelapse). This is communicated in UI.

---

### Epic 5.4: Preview Playback

**Goal:** Let users reliably preview how final video will look before export.

#### Story 5.4.1 — Play stitched preview

**As a** user **I want to** play the stitched sequence from the timeline at the selected speed **So that** I can verify order and timing before exporting.

**Acceptance Criteria**

* Play/pause controls play the current timeline order from the start or from current scrub position.  
* Scrubbing is supported (drag timeline playhead) and preview jumps to correct timestamp.  
* Clicking a clip jumps preview to that clip’s start.  
* The preview honors the global speed multiplier (i.e., plays faster/slower).  
* Timeline edits (reorder/remove/add) update preview state within the app’s latency goal (target: ≤ 300 ms for typical edits on desktop).  
* Preview uses a low-res proxy if necessary to keep performance acceptable on lower-end devices; UI indicates proxy mode.

#### Story 5.4.2 — Preview quality vs responsiveness

**As a** user **I want** preview playback to be responsive even if it sacrifices final export fidelity **So that** editing remains fast.

**Acceptance Criteria**

* Preview defaults to a proxy resolution (e.g., 540p) if project total size or device capability exceeds thresholds.  
* Users can toggle “High quality preview” if device supports it; otherwise control is disabled with explanation.  
* The switch between proxy and high quality is reflected in UI and persisted per session.

---

### Epic 5.5: Export / Render

**Goal:** Produce a downloadable timelapse video using the timeline \+ speed settings.

#### Story 5.5.1 — Local (browser) export

**As a** user **I want to** export & download the final timelapse processed in my browser **So that** I can get my final video quickly without uploads.

**Acceptance Criteria**

* Export button triggers client-side render and shows a progress indicator (percentage \+ status message).  
* The processing runs in a Web Worker and does not block the main UI thread.  
* Progress updates are parsed from the processing engine and shown with an ETA where possible.  
* User can cancel export; cancelation terminates processing and cleans up temporary artifacts.  
* On success a downloadable Blob is generated and a download link/button appears automatically.  
* Export respects chosen resolution/format presets (e.g., 1080p MP4).  
* Export respects global speed multiplier so final duration ≈ original\_total ÷ multiplier (±0.5s).  
* Error handling: If render fails due to device limits (OOM, WASM error), UI shows a clear error and suggests alternatives (reduce project size, use cloud render).  
* Security: default behavior sends no data to any server; no automatic uploads occur.

**Non-functional**

* For a 1-minute final video on a mid-tier laptop, average render time should target\< 180s (documented as expected SLA for QA).  
* For projects ≤ 2GB total input size, success rate target ≥ 90% on supported desktop browsers.

---

### Epic 5.6: Project Management & Persistence

**Goal:** Keep user projects editable across session.

#### Story 5.6.1 — Save & Load Project (local session)

**As a** user **I want** my project state (order, speed, selected clips) to persist in the browser during the session **So that** I can continue editing after accidental refresh.

**Acceptance Criteria**

* Project state is saved to local storage or IndexedDB automatically on change.  
* After refresh, the project restores to the last saved state including clip order and speed multiplier.  
* If the stored clips are missing (cache cleared), the user sees a clear message with steps to re-add files.

### Epic 5.7: UX / Accessibility / Error Handling (cross-cutting)

#### Story 5.7.1 — Clear error messages & guidance

**As a** user **I want** clear, actionable error messages when problems occur **So that** I can recover or understand next steps.

**Acceptance Criteria**

* Errors include human-readable message \+ suggested remediation (retry, smaller file, cloud render).  
* For OOM or WASM crashes, UI suggests cloud render with an option to export project state for support.

---

## 6\. Non-Functional Requirements

* **Performance:** For a 1-minute final video on a mid-tier laptop, average render time should target \< 180s (documented as expected SLA for QA).  
* **Latency:** Timeline edits must update preview state within ≤ 300ms.  
* **Reliability:** For projects ≤ 2GB total input size, success rate target ≥ 90% on supported desktop browsers.  
* **Security/Privacy:** All processing runs client-side; user videos never leave the device.

---

## 7\. Technical Architecture

### **7.1 Approach: In-Browser Rendering First (MVP)**

The core philosophy for the Minimum Viable Product (MVP) is **In-Browser Rendering**. All primary video operations—**Stitching**, **Speed adjustments**, and **Transcoding/export**—will be performed entirely client-side. This approach directly supports the project's goals of **Zero rendering cost**, **Fast iteration**, and **Privacy-safe** operation, ensuring user videos never leave their device (Story 5.5.1 Security).

### **7.2 Core Components**

To achieve the speed and functionality defined in the user stories, the MVP will utilize:

* **FFmpeg.wasm:** Primary engine for video stitching and processing workflows (Stories 5.2.1, 5.3.1).  
* **WebCodecs:** Used for performance-optimized encoding to help achieve the \< 180s render time goal (Non-functional requirement).  
* **Web Workers:** Essential for executing the processing engine **off the main UI thread**. This is required to ensure the UI remains responsive and does not block during resource-intensive tasks like rendering and file indexing (Story 5.5.1).  
* **IndexedDB/Local Storage:** Used for persistent storage of uploaded files (local cache) and project state (Story 5.1.2 and Story 5.6.1).

  ### **7.3 Known Constraints**

  The client-side approach is constrained by:  
* **Browser Memory Limits:** Typically approx. 2-4GB per session, which may cause crashes on large videos.  
* **Device Performance:** Performance can be slow on low-power devices.

  ### **7.4 Future-Proofing: Hybrid Architecture**

  The system is architected with a **Processing Engine Abstraction**. This modular design will allow for future integration of external engines, such as:  
* **Server-side GPU rendering** (for large video files or mobile users).  
* **Queued render jobs via a backend pipeline**.  
* **Heavy effects or stabilization**.

---

## 8\. Risks & Mitigations

| Risks | Impact | Mitigation |
| :---- | :---- | :---- |
| Browser memory limits for long videos | Crashes | Warn users early; offer server render later |
| Slow performance on older devices | Bad UX | Device detection to enable optional low-power mode |
| FFmpeg.wasm performance variance by browser | Inconsistency | Recommend Chrome; use WebCodecs fallback |
| Large file uploads | Lag | Chunked processing; resolution auto-downscaling option |

