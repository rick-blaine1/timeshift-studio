/**
 * Feature Flag Configuration
 * 
 * This module provides a centralized feature flag system for controlling
 * the gradual rollout of new features, particularly the WebCodecs API migration.
 * 
 * FEATURE FLAGS:
 * - webcodecs_enabled: Controls whether the application attempts to use WebCodecs API
 *   or defaults directly to FFmpeg.wasm fallback
 * 
 * CONFIGURATION SOURCES (in priority order):
 * 1. URL Parameters: ?feature_webcodecs=true/false
 * 2. Local Storage: localStorage.getItem('feature_webcodecs')
 * 3. Environment Variables: import.meta.env.VITE_FEATURE_WEBCODECS
 * 4. Default Value: true (WebCodecs enabled by default)
 * 
 * USER OPT-IN MECHANISM:
 * Users can opt-in or opt-out of WebCodecs by:
 * - Adding ?feature_webcodecs=true or ?feature_webcodecs=false to the URL
 * - Setting localStorage.setItem('feature_webcodecs', 'true' or 'false')
 * - The setting persists across sessions via localStorage
 */

/**
 * Feature flag identifiers
 */
export enum FeatureFlag {
  WEBCODECS_ENABLED = 'webcodecs_enabled',
}

/**
 * Default feature flag values
 */
const DEFAULT_FLAGS: Record<FeatureFlag, boolean> = {
  [FeatureFlag.WEBCODECS_ENABLED]: true, // WebCodecs enabled by default
};

/**
 * Cache for feature flag values to avoid repeated lookups
 */
const flagCache = new Map<FeatureFlag, boolean>();

/**
 * Get a feature flag value from URL parameters
 * @param flagName - The feature flag name (e.g., 'webcodecs_enabled')
 * @returns The flag value from URL, or null if not present
 */
function getFlagFromURL(flagName: string): boolean | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const params = new URLSearchParams(window.location.search);
    const paramName = `feature_${flagName.replace('_enabled', '')}`;
    const value = params.get(paramName);
    
    if (value === null) return null;
    
    // Parse boolean values
    if (value === 'true' || value === '1') return true;
    if (value === 'false' || value === '0') return false;
    
    return null;
  } catch (error) {
    console.warn(`[FeatureFlags] Error reading URL parameter for ${flagName}:`, error);
    return null;
  }
}

/**
 * Get a feature flag value from localStorage
 * @param flagName - The feature flag name (e.g., 'webcodecs_enabled')
 * @returns The flag value from localStorage, or null if not present
 */
function getFlagFromStorage(flagName: string): boolean | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  
  try {
    const storageKey = `feature_${flagName.replace('_enabled', '')}`;
    const value = localStorage.getItem(storageKey);
    
    if (value === null) return null;
    
    // Parse boolean values
    if (value === 'true' || value === '1') return true;
    if (value === 'false' || value === '0') return false;
    
    return null;
  } catch (error) {
    console.warn(`[FeatureFlags] Error reading localStorage for ${flagName}:`, error);
    return null;
  }
}

/**
 * Get a feature flag value from environment variables
 * @param flagName - The feature flag name (e.g., 'webcodecs_enabled')
 * @returns The flag value from environment, or null if not present
 */
function getFlagFromEnv(flagName: string): boolean | null {
  try {
    const envKey = `VITE_FEATURE_${flagName.toUpperCase()}`;
    const value = import.meta.env[envKey];
    
    if (value === undefined) return null;
    
    // Parse boolean values
    if (value === 'true' || value === '1' || value === true) return true;
    if (value === 'false' || value === '0' || value === false) return false;
    
    return null;
  } catch (error) {
    console.warn(`[FeatureFlags] Error reading environment variable for ${flagName}:`, error);
    return null;
  }
}

/**
 * Check if a feature flag is enabled
 * 
 * Priority order:
 * 1. URL parameter (?feature_webcodecs=true/false)
 * 2. localStorage (feature_webcodecs)
 * 3. Environment variable (VITE_FEATURE_WEBCODECS_ENABLED)
 * 4. Default value
 * 
 * @param flag - The feature flag to check
 * @returns True if the feature is enabled, false otherwise
 */
export function isFeatureEnabled(flag: FeatureFlag): boolean {
  // Check cache first
  if (flagCache.has(flag)) {
    return flagCache.get(flag)!;
  }
  
  // Check URL parameters (highest priority)
  const urlValue = getFlagFromURL(flag);
  if (urlValue !== null) {
    console.log(`[FeatureFlags] ${flag} = ${urlValue} (from URL)`);
    flagCache.set(flag, urlValue);
    return urlValue;
  }
  console.log(`[FeatureFlags] ${flag} not found in URL. Checking next source.`);
  
  // Check localStorage (second priority)
  const storageValue = getFlagFromStorage(flag);
  if (storageValue !== null) {
    console.log(`[FeatureFlags] ${flag} = ${storageValue} (from localStorage)`);
    flagCache.set(flag, storageValue);
    return storageValue;
  }
  console.log(`[FeatureFlags] ${flag} not found in localStorage. Checking next source.`);
  
  // Check environment variables (third priority)
  const envValue = getFlagFromEnv(flag);
  if (envValue !== null) {
    console.log(`[FeatureFlags] ${flag} = ${envValue} (from environment)`);
    flagCache.set(flag, envValue);
    return envValue;
  }
  console.log(`[FeatureFlags] ${flag} not found in environment variables. Using default.`);
  
  // Use default value (lowest priority)
  const defaultValue = DEFAULT_FLAGS[flag];
  console.log(`[FeatureFlags] ${flag} = ${defaultValue} (default)`);
  flagCache.set(flag, defaultValue);
  return defaultValue;
}

/**
 * Set a feature flag value in localStorage
 * This allows users to persist their preference across sessions
 * 
 * @param flag - The feature flag to set
 * @param enabled - Whether to enable or disable the feature
 */
export function setFeatureFlag(flag: FeatureFlag, enabled: boolean): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    console.warn('[FeatureFlags] localStorage not available, cannot persist flag');
    return;
  }
  
  try {
    const storageKey = `feature_${flag.replace('_enabled', '')}`;
    localStorage.setItem(storageKey, enabled.toString());
    
    // Clear cache to force re-evaluation
    flagCache.delete(flag);
    
    console.log(`[FeatureFlags] Set ${flag} = ${enabled} in localStorage`);
  } catch (error) {
    console.error(`[FeatureFlags] Error setting ${flag} in localStorage:`, error);
  }
}

/**
 * Clear a feature flag from localStorage
 * This resets the flag to use environment or default values
 * 
 * @param flag - The feature flag to clear
 */
export function clearFeatureFlag(flag: FeatureFlag): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  
  try {
    const storageKey = `feature_${flag.replace('_enabled', '')}`;
    localStorage.removeItem(storageKey);
    
    // Clear cache to force re-evaluation
    flagCache.delete(flag);
    
    console.log(`[FeatureFlags] Cleared ${flag} from localStorage`);
  } catch (error) {
    console.error(`[FeatureFlags] Error clearing ${flag} from localStorage:`, error);
  }
}

/**
 * Get all feature flag values for debugging
 * @returns Object containing all feature flags and their current values
 */
export function getAllFeatureFlags(): Record<string, boolean> {
  const flags: Record<string, boolean> = {};
  
  for (const flag of Object.values(FeatureFlag)) {
    flags[flag] = isFeatureEnabled(flag);
  }
  
  return flags;
}

/**
 * Clear all feature flag caches
 * Useful for testing or when flags need to be re-evaluated
 */
export function clearFeatureFlagCache(): void {
  flagCache.clear();
  console.log('[FeatureFlags] Cache cleared');
}