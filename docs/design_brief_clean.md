# **Lovable-Optimized Design Brief — Timelapse Editor (MVP)**

## **1\. Product Summary**

A browser-based timelapse editor where users upload video clips, arrange them on a timeline, set a speed multiplier, preview the result, and export a stitched timelapse.  
 All processing is **client-side** (FFmpeg.wasm \+ WebCodecs).  
 MVP target: desktop browsers (≥1280px width).

---

## **2\. Core Screens to Generate**

1. **Landing / Upload Screen**

2. **Editor Workspace**

   * File Sidebar

   * Preview Player

   * Timeline

   * Right-side Controls

3. **Export Modal (+ Export Progress)**

4. **Error States**

5. **Settings (minimal for MVP)**

Each screen should be standalone and navigable.

---

## **3\. Screen Specifications**

---

### **3.1 Landing / Upload Screen**

**Purpose:** Start a new project.

**Elements:**

* Large drag-and-drop zone

* “Upload clips” button

* Supported formats text

* Simple tagline (e.g., “Create a timelapse in seconds. Files never leave your device.”)

**Functionality:**

* Accept multi-file upload

* After upload → navigate to Editor Workspace with files listed

---

### **3.2 Editor Workspace**

This is the main screen. 3-column layout:

---

#### **A. Left Sidebar — Files**

**Elements per file:**

* Thumbnail

* Filename

* Duration

* Resolution

* File size

* Status: *Ready*, *On timeline*, *Error*

**Interactions:**

* Drag a file from sidebar → drop into timeline

* Reorder inside sidebar optional (not required for MVP)

* Delete file (with confirmation)

* Add more files (upload button)

---

#### **B. Main Panel — Preview Player \+ Timeline**

##### **Preview Player**

* 16:9 video container

* Play / Pause

* Current Time / Total Time (adjusted by speed multiplier)

* Scrub bar

* “Preview Quality” indicator (Proxy / High Quality)

##### **Timeline**

* Horizontal row of clip segments

* Clip segment shows: thumbnail, filename short label, duration

* Drag to reorder

* Snap behavior when hovering insertion points

* Playhead moves during playback

* User can click timeline to scrub

* Optional zoom control (Fit / 1x)

---

#### **C. Right Panel — Controls**

**Speed Controls:**

* Presets: 1×, 2×, 4×, 8×

* Numeric input: 1.0–100.0 allowed (validate input)

**Preview Quality Toggle:**

* Proxy (default)

* High Quality

**Export Button:**

* Primary action: opens Export Modal

* Subtext: “Files never leave your device.”

**Additional actions:**

* Clear project

* Save snapshot (local only)

* Settings link

---

## **3.3 Export Modal**

**Sections:**

**Summary:**

* Estimated output duration

* Resolution (same as source for MVP)

* Audio will be removed (timelapse default)

**Actions:**

* Start Export

* Cancel/Close

**Export Progress:**

* Progress bar with %

* Status messages (Preparing → Encoding → Packaging → Done)

**Success State:**

* Download button

* “Share” button (optional)

**Failure State:**

* Error message

* Suggested actions:

  * Reduce number/size of clips

  * Lower preview quality

  * Try again

---

## **4\. Required User Flows**

---

### **Flow A: New Project**

1. User uploads files

2. Files appear in sidebar

3. User drags files to timeline

4. User adjusts speed

5. User previews playback

6. User exports the timelapse

---

### **Flow B: Auto-Restore Project**

**Behavior:**  
 If IndexedDB data exists, reload previous project:

* Files

* Timeline order

* Speed setting

If not, show empty workspace with an upload prompt.

---

### **Flow C: Export Error Handling**

Show modal with:

* Error message

* “Try again”

* “Reduce clips”

* “Lower quality preview”

---

## **5\. Interaction Behaviors & States**

### **Timeline Interactions**

* Smooth drag-and-drop

* Highlight drop targets

* Clip selection bordered on click

* Playhead scrubs timeline

### **Upload Interactions**

* Show per-file upload progress

* Reject unsupported files with toast

### **Preview**

* Applies speed multiplier

* Proxy mode indicates reduced-quality playback

### **Toasts**

* Upload success

* Upload failure

* File deleted

* Restore loaded

---

## **6\. Accessibility Requirements**

* Fully keyboard accessible

* Space \= play/pause

* Arrow keys \= timeline navigation

* High contrast for text

* Motion-reduced mode if OS preference detected

---

## **7\. Visual Style (Lovable-ready)**

* Clean, modern, minimal

* Light neutral background

* Card-based layout

* Rounded corners (6–12px)

* Typography: Inter or System UI

* Primary accent color for:

  * CTA buttons

  * Timeline active states

* Use subtle shadows for elevation

---

## **8\. Sample Data (for prototype)**

Include 3–6 placeholder video objects:

`[`  
  `{ "id": "1", "name": "beach.mp4", "duration": 12, "thumbnail": "thumb1.png", "resolution": "1080p" },`  
  `{ "id": "2", "name": "city.mp4", "duration": 45, "thumbnail": "thumb2.png", "resolution": "1080p" },`  
  `{ "id": "3", "name": "workshop.mp4", "duration": 120, "thumbnail": "thumb3.png", "resolution": "720p" }`  
`]`

---

## **9\. Components Lovable Should Generate**

* UploadArea

* FileCard

* FileListSidebar

* VideoPlayer (Preview)

* Timeline

* TimelineClip

* Playhead

* SpeedControl (presets \+ input)

* PreviewQualityToggle

* ExportModal

* ProgressBar

* ErrorCard

* Toast component

* TopNav

* PageLayout (3-column)

---

## **10\. MVP Requirements Checklist**

* Multi-file upload

* Display file metadata

* Drag-and-drop timeline

* Speed presets \+ numeric speed input

* Preview with speed applied

* Export modal \+ progress UI

* Download final file

* Auto-restore project

* Proxy mode indicator

* Error states for upload \+ export

