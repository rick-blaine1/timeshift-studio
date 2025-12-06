import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PerformanceMonitor, performanceMonitor } from '../performanceMonitor';

// Mock performance API
const mockPerformance = {
  timeOrigin: 1000,
  now: vi.fn(() => 2000),
  memory: {
    usedJSHeapSize: 100 * 1024 * 1024,
    totalJSHeapSize: 200 * 1024 * 1024,
    jsHeapSizeLimit: 1000 * 1024 * 1024,
  },
};

// Mock PerformanceObserver
const mockObserver = {
  observe: vi.fn(),
  disconnect: vi.fn(),
  callback: null as any,
};

const mockPerformanceObserver = vi.fn().mockImplementation((callback) => {
  mockObserver.callback = callback;
  return mockObserver;
});

// Mock DOM
const mockDocument = {
  readyState: 'loading',
  addEventListener: vi.fn(),
};

const mockWindow = {
  addEventListener: vi.fn(),
};

// Mock sessionStorage
const mockSessionStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};

// Mock console
const mockConsole = {
  group: vi.fn(),
  groupEnd: vi.fn(),
  log: vi.fn(),
  warn: vi.fn(),
};

// Setup global mocks
Object.defineProperty(global, 'performance', { value: mockPerformance, configurable: true });
Object.defineProperty(global, 'PerformanceObserver', { value: mockPerformanceObserver, configurable: true });
Object.defineProperty(global, 'document', { value: mockDocument, configurable: true });
Object.defineProperty(global, 'window', { value: mockWindow, configurable: true });
Object.defineProperty(global, 'sessionStorage', { value: mockSessionStorage, configurable: true });
Object.defineProperty(console, 'group', { value: mockConsole.group });
Object.defineProperty(console, 'groupEnd', { value: mockConsole.groupEnd });
Object.defineProperty(console, 'log', { value: mockConsole.log });
Object.defineProperty(console, 'warn', { value: mockConsole.warn });

describe('PerformanceMonitor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPerformance.now.mockReturnValue(2000);
    mockDocument.readyState = 'loading';
    mockSessionStorage.getItem.mockReturnValue(null);
  });

  afterEach(() => {
    // Clean up any observers
    if (performanceMonitor) {
      performanceMonitor.dispose();
    }
  });

  describe('Singleton Pattern', () => {
    it('returns the same instance', () => {
      const instance1 = PerformanceMonitor.getInstance();
      const instance2 = PerformanceMonitor.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('exports singleton instance', () => {
      expect(performanceMonitor).toBeInstanceOf(PerformanceMonitor);
    });
  });

  describe('Observer Initialization', () => {
    it('initializes performance observers when supported', () => {
      const monitor = PerformanceMonitor.getInstance();
      
      expect(mockPerformanceObserver).toHaveBeenCalledTimes(2); // Paint and navigation observers
      expect(mockObserver.observe).toHaveBeenCalledWith({ entryTypes: ['paint'] });
      expect(mockObserver.observe).toHaveBeenCalledWith({ entryTypes: ['navigation'] });
    });

    it('handles observer initialization errors gracefully', () => {
      mockObserver.observe.mockImplementation(() => {
        throw new Error('Observer not supported');
      });
      
      expect(() => PerformanceMonitor.getInstance()).not.toThrow();
      expect(mockConsole.warn).toHaveBeenCalled();
    });
  });

  describe('Memory Usage', () => {
    it('returns memory usage when available', () => {
      const monitor = PerformanceMonitor.getInstance();
      const memoryUsage = monitor.getMemoryUsage();
      
      expect(memoryUsage).toEqual({
        used: 100 * 1024 * 1024,
        total: 200 * 1024 * 1024,
        limit: 1000 * 1024 * 1024,
        usagePercent: 10, // 100MB / 1000MB * 100
      });
    });

    it('returns null when memory API not available', () => {
      Object.defineProperty(performance, 'memory', { value: undefined });
      
      const monitor = PerformanceMonitor.getInstance();
      const memoryUsage = monitor.getMemoryUsage();
      
      expect(memoryUsage).toBeNull();
    });
  });

  describe('Video Processing Tracking', () => {
    it('starts and ends video processing tracking', () => {
      const monitor = PerformanceMonitor.getInstance();
      
      const sessionId = monitor.startVideoProcessing(3, 180);
      
      expect(sessionId).toMatch(/^processing-\d+$/);
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        `perf-${sessionId}`,
        JSON.stringify({
          startTime: 2000,
          fileCount: 3,
          totalDuration: 180,
        })
      );
    });

    it('calculates processing metrics correctly', () => {
      const monitor = PerformanceMonitor.getInstance();
      
      // Mock session data
      mockSessionStorage.getItem.mockReturnValue(JSON.stringify({
        startTime: 1000,
        fileCount: 2,
        totalDuration: 120,
      }));
      
      mockPerformance.now.mockReturnValue(3000); // 2 seconds later
      
      monitor.endVideoProcessing('processing-123');
      
      const metrics = monitor.getMetrics();
      
      expect(metrics.videoProcessing).toEqual({
        totalFiles: 2,
        totalDuration: 120,
        processingTime: 2, // (3000 - 1000) / 1000
        averageProcessingSpeed: 60, // 120 / 2
      });
      
      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('perf-processing-123');
    });

    it('handles missing session data gracefully', () => {
      const monitor = PerformanceMonitor.getInstance();
      
      mockSessionStorage.getItem.mockReturnValue(null);
      
      expect(() => monitor.endVideoProcessing('invalid-session')).not.toThrow();
    });
  });

  describe('Performance Health Check', () => {
    it('returns good status for normal conditions', () => {
      const monitor = PerformanceMonitor.getInstance();
      
      const health = monitor.checkPerformanceHealth();
      
      expect(health.status).toBe('good');
      expect(health.issues).toEqual([]);
      expect(health.recommendations).toEqual([]);
    });

    it('detects high memory usage', () => {
      mockPerformance.memory.usedJSHeapSize = 800 * 1024 * 1024; // 80% usage
      
      const monitor = PerformanceMonitor.getInstance();
      const health = monitor.checkPerformanceHealth();
      
      expect(health.status).toBe('warning');
      expect(health.issues).toContain('High memory usage');
      expect(health.recommendations).toContain('Consider using smaller video files');
    });

    it('detects critical memory usage', () => {
      mockPerformance.memory.usedJSHeapSize = 950 * 1024 * 1024; // 95% usage
      
      const monitor = PerformanceMonitor.getInstance();
      const health = monitor.checkPerformanceHealth();
      
      expect(health.status).toBe('critical');
      expect(health.issues).toContain('Very high memory usage');
      expect(health.recommendations).toContain('Close other browser tabs and applications');
    });

    it('detects slow load times', () => {
      const monitor = PerformanceMonitor.getInstance();
      
      // Mock slow load time
      const metrics = monitor.getMetrics();
      metrics.timing.loadComplete = 6000; // 6 seconds
      
      const health = monitor.checkPerformanceHealth();
      
      expect(health.status).toBe('warning');
      expect(health.issues).toContain('Slow page load time');
      expect(health.recommendations).toContain('Check internet connection and browser performance');
    });

    it('detects slow video processing', () => {
      const monitor = PerformanceMonitor.getInstance();
      
      // Set up slow processing metrics
      mockSessionStorage.getItem.mockReturnValue(JSON.stringify({
        startTime: 1000,
        fileCount: 1,
        totalDuration: 60,
      }));
      
      mockPerformance.now.mockReturnValue(61000); // 60 seconds later (1x realtime = slow)
      monitor.endVideoProcessing('processing-123');
      
      const health = monitor.checkPerformanceHealth();
      
      expect(health.status).toBe('warning');
      expect(health.issues).toContain('Slow video processing');
      expect(health.recommendations).toContain('Consider using lower quality settings');
    });

    it('detects very slow video processing', () => {
      const monitor = PerformanceMonitor.getInstance();
      
      // Set up very slow processing metrics
      mockSessionStorage.getItem.mockReturnValue(JSON.stringify({
        startTime: 1000,
        fileCount: 1,
        totalDuration: 60,
      }));
      
      mockPerformance.now.mockReturnValue(601000); // 600 seconds later (0.1x realtime = very slow)
      monitor.endVideoProcessing('processing-123');
      
      const health = monitor.checkPerformanceHealth();
      
      expect(health.status).toBe('critical');
      expect(health.issues).toContain('Very slow video processing');
      expect(health.recommendations).toContain('Try reducing video quality or file size');
    });
  });

  describe('Metrics Export', () => {
    it('exports metrics in JSON format', () => {
      const monitor = PerformanceMonitor.getInstance();
      
      const exported = monitor.exportMetrics();
      const parsed = JSON.parse(exported);
      
      expect(parsed).toHaveProperty('timestamp');
      expect(parsed).toHaveProperty('userAgent');
      expect(parsed).toHaveProperty('metrics');
      expect(parsed).toHaveProperty('health');
      
      expect(parsed.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });

  describe('Paint Timing Observer', () => {
    it('handles paint timing entries', () => {
      const monitor = PerformanceMonitor.getInstance();
      
      // Simulate paint timing entries
      const paintEntries = [
        { name: 'first-paint', startTime: 100 },
        { name: 'first-contentful-paint', startTime: 150 },
      ];
      
      // Get the paint observer callback
      const paintObserverCall = mockPerformanceObserver.mock.calls.find(call => 
        call[0].toString().includes('first-paint')
      );
      
      if (paintObserverCall) {
        const callback = paintObserverCall[0];
        callback({
          getEntries: () => paintEntries,
        });
      }
      
      const metrics = monitor.getMetrics();
      
      expect(metrics.timing.firstPaint).toBe(100);
      expect(metrics.timing.firstContentfulPaint).toBe(150);
    });
  });

  describe('Navigation Timing Observer', () => {
    it('handles navigation timing entries', () => {
      const monitor = PerformanceMonitor.getInstance();
      
      // Simulate navigation timing entry
      const navEntries = [{
        entryType: 'navigation',
        startTime: 0,
        loadEventEnd: 2000,
        domContentLoadedEventEnd: 1500,
      }];
      
      // Get the navigation observer callback
      const navObserverCall = mockPerformanceObserver.mock.calls.find(call => 
        call[0].toString().includes('navigation')
      );
      
      if (navObserverCall) {
        const callback = navObserverCall[0];
        callback({
          getEntries: () => navEntries,
        });
      }
      
      const metrics = monitor.getMetrics();
      
      expect(metrics.timing.navigationStart).toBe(0);
      expect(metrics.timing.loadComplete).toBe(2000);
      expect(metrics.timing.domContentLoaded).toBe(1500);
    });
  });

  describe('DOM Event Handling', () => {
    it('sets up DOM event listeners', () => {
      PerformanceMonitor.getInstance();
      
      expect(mockDocument.addEventListener).toHaveBeenCalledWith('DOMContentLoaded', expect.any(Function));
      expect(mockWindow.addEventListener).toHaveBeenCalledWith('load', expect.any(Function));
    });

    it('handles DOM already loaded', () => {
      mockDocument.readyState = 'complete';
      
      const monitor = PerformanceMonitor.getInstance();
      const metrics = monitor.getMetrics();
      
      expect(metrics.timing.domContentLoaded).toBe(2000);
      expect(metrics.timing.loadComplete).toBe(2000);
    });
  });

  describe('Cleanup', () => {
    it('disposes observers correctly', () => {
      const monitor = PerformanceMonitor.getInstance();
      
      monitor.dispose();
      
      expect(mockObserver.disconnect).toHaveBeenCalled();
    });
  });

  describe('Logging', () => {
    it('logs performance metrics after video processing', () => {
      const monitor = PerformanceMonitor.getInstance();
      
      mockSessionStorage.getItem.mockReturnValue(JSON.stringify({
        startTime: 1000,
        fileCount: 1,
        totalDuration: 60,
      }));
      
      monitor.endVideoProcessing('processing-123');
      
      expect(mockConsole.group).toHaveBeenCalledWith('🚀 Performance Metrics');
      expect(mockConsole.log).toHaveBeenCalled();
      expect(mockConsole.groupEnd).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('handles PerformanceObserver not supported', () => {
      Object.defineProperty(global, 'PerformanceObserver', { value: undefined });
      
      expect(() => PerformanceMonitor.getInstance()).not.toThrow();
    });

    it('handles performance.memory not available', () => {
      Object.defineProperty(performance, 'memory', { value: undefined });
      
      const monitor = PerformanceMonitor.getInstance();
      const health = monitor.checkPerformanceHealth();
      
      expect(health.status).toBe('good'); // Should not crash
    });

    it('handles JSON parsing errors in session storage', () => {
      const monitor = PerformanceMonitor.getInstance();
      
      mockSessionStorage.getItem.mockReturnValue('invalid-json');
      
      expect(() => monitor.endVideoProcessing('invalid-session')).not.toThrow();
    });
  });
});