# Feature Flag User Guide: WebCodecs API

## Overview

Timeshift Studio uses a feature flag system to control the gradual rollout of the WebCodecs API for video processing. This guide explains how users can opt-in or opt-out of the WebCodecs implementation.

## What is WebCodecs?

WebCodecs is a modern browser API that provides direct access to video encoding and decoding capabilities. It offers:
- **Better Performance**: Faster video processing in supported browsers
- **Smaller Bundle Size**: Eliminates the need for the 30MB FFmpeg.wasm library
- **Native Integration**: Uses browser-native video processing capabilities

## Current Status

WebCodecs is **enabled by default** in Timeshift Studio. The application will automatically:
1. Attempt to use WebCodecs if your browser supports it
2. Fall back to FFmpeg.wasm if WebCodecs is unavailable or fails
3. Provide a seamless experience regardless of which processor is used

## User Control Methods

### Method 1: URL Parameter (Temporary)

Add a URL parameter to enable or disable WebCodecs for the current session:

**Enable WebCodecs:**
```
https://your-app-url.com/?feature_webcodecs=true
```

**Disable WebCodecs:**
```
https://your-app-url.com/?feature_webcodecs=false
```

**Use Case**: Quick testing or troubleshooting without affecting saved preferences.

### Method 2: Browser Console (Persistent)

Open your browser's developer console (F12) and run one of these commands:

**Enable WebCodecs:**
```javascript
localStorage.setItem('feature_webcodecs', 'true');
location.reload();
```

**Disable WebCodecs:**
```javascript
localStorage.setItem('feature_webcodecs', 'false');
location.reload();
```

**Reset to Default:**
```javascript
localStorage.removeItem('feature_webcodecs');
location.reload();
```

**Use Case**: Persistent preference that survives browser restarts.

### Method 3: Settings UI (Future Enhancement)

A user-friendly settings toggle could be added to the application UI:

```
Settings > Advanced > Video Processing
[ ] Use WebCodecs API (recommended for modern browsers)
```

**Implementation Concept:**
```typescript
import { setFeatureFlag, FeatureFlag } from '@/utils/featureFlags';

function SettingsPanel() {
  const [useWebCodecs, setUseWebCodecs] = useState(
    isFeatureEnabled(FeatureFlag.WEBCODECS_ENABLED)
  );

  const handleToggle = (enabled: boolean) => {
    setFeatureFlag(FeatureFlag.WEBCODECS_ENABLED, enabled);
    setUseWebCodecs(enabled);
    // Optionally reload or notify user to refresh
  };

  return (
    <Switch
      checked={useWebCodecs}
      onCheckedChange={handleToggle}
      label="Use WebCodecs API"
    />
  );
}
```

## Priority Order

When multiple configuration sources are present, the system uses this priority:

1. **URL Parameter** (highest priority) - `?feature_webcodecs=true/false`
2. **localStorage** - `feature_webcodecs`
3. **Environment Variable** - `VITE_FEATURE_WEBCODECS_ENABLED`
4. **Default Value** (lowest priority) - `true`

## Browser Compatibility

### Supported Browsers (WebCodecs Available)
- ✅ Chrome/Edge 94+
- ✅ Opera 80+
- ⚠️ Firefox 130+ (partial support, may have limitations)

### Unsupported Browsers (Automatic Fallback)
- ❌ Safari (all versions as of December 2024)
- ❌ Older browser versions

**Note**: The application automatically detects browser support and falls back to FFmpeg.wasm when WebCodecs is unavailable.

## Troubleshooting

### How do I know which processor is being used?

Open your browser's developer console (F12) and look for log messages:

**WebCodecs Active:**
```
[FeatureFlags] webcodecs_enabled = true (from localStorage)
[VideoProcessor] WebCodecs API detected, initializing WebCodecs Worker...
[VideoProcessor] ✓ WebCodecs Worker initialized successfully
```

**FFmpeg Fallback:**
```
[FeatureFlags] webcodecs_enabled = false (from localStorage)
[VideoProcessor] WebCodecs feature flag is disabled, using FFmpeg fallback
```

### WebCodecs is causing issues, how do I disable it?

**Quick Fix (URL Parameter):**
Add `?feature_webcodecs=false` to your URL and reload.

**Permanent Fix (localStorage):**
```javascript
localStorage.setItem('feature_webcodecs', 'false');
location.reload();
```

### I want to test WebCodecs again after disabling it

**Clear the localStorage setting:**
```javascript
localStorage.removeItem('feature_webcodecs');
location.reload();
```

Or use the URL parameter:
```
?feature_webcodecs=true
```

## A/B Testing & Gradual Rollout

### For Administrators

The feature flag system supports various rollout strategies:

**1. Percentage-Based Rollout (Server-Side)**
```javascript
// Server generates URL with feature flag based on user ID
const enableWebCodecs = (userId % 100) < rolloutPercentage;
const url = `https://app.com/?feature_webcodecs=${enableWebCodecs}`;
```

**2. User Group Testing**
```javascript
// Enable for beta testers
if (user.isBetaTester) {
  localStorage.setItem('feature_webcodecs', 'true');
}
```

**3. Environment-Based Configuration**
```bash
# Production (enabled)
VITE_FEATURE_WEBCODECS_ENABLED=true

# Staging (disabled for testing)
VITE_FEATURE_WEBCODECS_ENABLED=false
```

## Performance Comparison

Users can compare performance between WebCodecs and FFmpeg:

**Test WebCodecs:**
```
?feature_webcodecs=true
```

**Test FFmpeg:**
```
?feature_webcodecs=false
```

**Metrics to Compare:**
- Processing time for video operations
- Memory usage during processing
- Browser responsiveness
- Output video quality

## Feedback & Reporting Issues

If you experience issues with WebCodecs:

1. **Disable WebCodecs** using the methods above
2. **Collect Information**:
   - Browser version
   - Video file details (format, size, duration)
   - Error messages from console
   - Steps to reproduce
3. **Report the Issue** with the collected information

## Advanced Usage

### Programmatic Control

For developers integrating Timeshift Studio:

```typescript
import {
  isFeatureEnabled,
  setFeatureFlag,
  clearFeatureFlag,
  getAllFeatureFlags,
  FeatureFlag
} from '@/utils/featureFlags';

// Check if WebCodecs is enabled
const isEnabled = isFeatureEnabled(FeatureFlag.WEBCODECS_ENABLED);

// Enable WebCodecs
setFeatureFlag(FeatureFlag.WEBCODECS_ENABLED, true);

// Disable WebCodecs
setFeatureFlag(FeatureFlag.WEBCODECS_ENABLED, false);

// Reset to default
clearFeatureFlag(FeatureFlag.WEBCODECS_ENABLED);

// Get all feature flags
const flags = getAllFeatureFlags();
console.log(flags); // { webcodecs_enabled: true }
```

### Custom Feature Detection

```typescript
import { isWebCodecsSupported } from '@/utils/webcodecs';

// Check if browser supports WebCodecs
if (isWebCodecsSupported()) {
  console.log('WebCodecs is available in this browser');
} else {
  console.log('WebCodecs is not supported, will use FFmpeg');
}
```

## Future Enhancements

Potential improvements to the user opt-in mechanism:

1. **Settings UI**: Visual toggle in application settings
2. **Performance Dashboard**: Real-time comparison of processor performance
3. **Smart Recommendations**: Suggest optimal processor based on browser/hardware
4. **Automatic Fallback**: Detect WebCodecs failures and auto-switch to FFmpeg
5. **User Notifications**: Inform users when processor changes occur

## Summary

The feature flag system provides flexible control over WebCodecs adoption:
- **Default**: WebCodecs enabled for better performance
- **Fallback**: Automatic FFmpeg.wasm when needed
- **User Control**: Multiple methods to enable/disable
- **Persistent**: Settings saved across sessions
- **Flexible**: Supports various rollout strategies

For most users, the default configuration (WebCodecs enabled) provides the best experience. The opt-out mechanism is available for troubleshooting or preference.