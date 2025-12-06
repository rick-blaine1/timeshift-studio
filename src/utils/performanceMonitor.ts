/**
 * Performance monitoring utilities for the video editor
 */

export interface PerformanceMetrics {
  memoryUsage: {
    used: number;
    total: number;
    limit: number;
    usagePercent: number;
  } | null;
  timing: {
    navigationStart: number;
    loadComplete: number;
    domContentLoaded: number;
    firstPaint?: number;
    firstContentfulPaint?: number;
  };
  videoProcessing: {
    totalFiles: number;
    totalDuration: number;
    processingTime: number;
    averageProcessingSpeed: number; // seconds of video per second of processing
  } | null;
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Partial<PerformanceMetrics> = {};
  private observers: PerformanceObserver[] = [];

  private constructor() {
    this.initializeObservers();
    this.collectInitialMetrics();
  }

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  /**
   * Initialize performance observers
   */
  private initializeObservers(): void {
    // Observe paint timing
    if ('PerformanceObserver' in window) {
      try {
        const paintObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry) => {
            if (entry.name === 'first-paint') {
              this.metrics.timing = {
                ...this.metrics.timing!,
                firstPaint: entry.startTime,
              };
            } else if (entry.name === 'first-contentful-paint') {
              this.metrics.timing = {
                ...this.metrics.timing!,
                firstContentfulPaint: entry.startTime,
              };
            }
          });
        });
        
        paintObserver.observe({ entryTypes: ['paint'] });
        this.observers.push(paintObserver);
      } catch (error) {
        console.warn('Paint timing observer not supported:', error);
      }

      // Observe navigation timing
      try {
        const navigationObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry) => {
            if (entry.entryType === 'navigation') {
              const navEntry = entry as PerformanceNavigationTiming;
              this.metrics.timing = {
                navigationStart: navEntry.startTime,
                loadComplete: navEntry.loadEventEnd,
                domContentLoaded: navEntry.domContentLoadedEventEnd,
                firstPaint: this.metrics.timing?.firstPaint,
                firstContentfulPaint: this.metrics.timing?.firstContentfulPaint,
              };
            }
          });
        });
        
        navigationObserver.observe({ entryTypes: ['navigation'] });
        this.observers.push(navigationObserver);
      } catch (error) {
        console.warn('Navigation timing observer not supported:', error);
      }
    }
  }

  /**
   * Collect initial performance metrics
   */
  private collectInitialMetrics(): void {
    // Initialize timing metrics
    this.metrics.timing = {
      navigationStart: performance.timeOrigin,
      loadComplete: 0,
      domContentLoaded: 0,
    };

    // Update timing when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.metrics.timing!.domContentLoaded = performance.now();
      });
    } else {
      this.metrics.timing.domContentLoaded = performance.now();
    }

    // Update timing when page is fully loaded
    if (document.readyState !== 'complete') {
      window.addEventListener('load', () => {
        this.metrics.timing!.loadComplete = performance.now();
      });
    } else {
      this.metrics.timing.loadComplete = performance.now();
    }
  }

  /**
   * Get current memory usage
   */
  getMemoryUsage(): PerformanceMetrics['memoryUsage'] {
    if ('memory' in performance) {
      const memInfo = (performance as any).memory;
      const used = memInfo.usedJSHeapSize;
      const total = memInfo.totalJSHeapSize;
      const limit = memInfo.jsHeapSizeLimit;
      
      return {
        used,
        total,
        limit,
        usagePercent: (used / limit) * 100,
      };
    }
    return null;
  }

  /**
   * Start tracking video processing performance
   */
  startVideoProcessing(fileCount: number, totalDuration: number): string {
    const sessionId = `processing-${Date.now()}`;
    const startTime = performance.now();
    
    // Store processing start data
    sessionStorage.setItem(`perf-${sessionId}`, JSON.stringify({
      startTime,
      fileCount,
      totalDuration,
    }));
    
    return sessionId;
  }

  /**
   * End tracking video processing performance
   */
  endVideoProcessing(sessionId: string): void {
    const endTime = performance.now();
    const sessionData = sessionStorage.getItem(`perf-${sessionId}`);
    
    if (sessionData) {
      const { startTime, fileCount, totalDuration } = JSON.parse(sessionData);
      const processingTime = (endTime - startTime) / 1000; // Convert to seconds
      
      this.metrics.videoProcessing = {
        totalFiles: fileCount,
        totalDuration,
        processingTime,
        averageProcessingSpeed: totalDuration / processingTime,
      };
      
      // Clean up session data
      sessionStorage.removeItem(`perf-${sessionId}`);
      
      // Log performance metrics
      this.logPerformanceMetrics();
    }
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    return {
      memoryUsage: this.getMemoryUsage(),
      timing: this.metrics.timing!,
      videoProcessing: this.metrics.videoProcessing || null,
    };
  }

  /**
   * Log performance metrics to console
   */
  private logPerformanceMetrics(): void {
    const metrics = this.getMetrics();
    
    console.group('🚀 Performance Metrics');
    
    // Memory usage
    if (metrics.memoryUsage) {
      console.log('💾 Memory Usage:', {
        used: `${(metrics.memoryUsage.used / 1024 / 1024).toFixed(2)} MB`,
        total: `${(metrics.memoryUsage.total / 1024 / 1024).toFixed(2)} MB`,
        limit: `${(metrics.memoryUsage.limit / 1024 / 1024).toFixed(2)} MB`,
        usage: `${metrics.memoryUsage.usagePercent.toFixed(1)}%`,
      });
    }
    
    // Timing metrics
    console.log('⏱️ Timing:', {
      domContentLoaded: `${metrics.timing.domContentLoaded.toFixed(2)}ms`,
      loadComplete: `${metrics.timing.loadComplete.toFixed(2)}ms`,
      firstPaint: metrics.timing.firstPaint ? `${metrics.timing.firstPaint.toFixed(2)}ms` : 'N/A',
      firstContentfulPaint: metrics.timing.firstContentfulPaint ? `${metrics.timing.firstContentfulPaint.toFixed(2)}ms` : 'N/A',
    });
    
    // Video processing metrics
    if (metrics.videoProcessing) {
      console.log('🎬 Video Processing:', {
        files: metrics.videoProcessing.totalFiles,
        duration: `${metrics.videoProcessing.totalDuration.toFixed(2)}s`,
        processingTime: `${metrics.videoProcessing.processingTime.toFixed(2)}s`,
        speed: `${metrics.videoProcessing.averageProcessingSpeed.toFixed(2)}x realtime`,
      });
    }
    
    console.groupEnd();
  }

  /**
   * Check if performance is within acceptable limits
   */
  checkPerformanceHealth(): {
    status: 'good' | 'warning' | 'critical';
    issues: string[];
    recommendations: string[];
  } {
    const metrics = this.getMetrics();
    const issues: string[] = [];
    const recommendations: string[] = [];
    let status: 'good' | 'warning' | 'critical' = 'good';

    // Check memory usage
    if (metrics.memoryUsage) {
      if (metrics.memoryUsage.usagePercent > 90) {
        issues.push('Very high memory usage');
        recommendations.push('Close other browser tabs and applications');
        status = 'critical';
      } else if (metrics.memoryUsage.usagePercent > 70) {
        issues.push('High memory usage');
        recommendations.push('Consider using smaller video files');
        if (status === 'good') status = 'warning';
      }
    }

    // Check load times
    if (metrics.timing.loadComplete > 5000) {
      issues.push('Slow page load time');
      recommendations.push('Check internet connection and browser performance');
      if (status === 'good') status = 'warning';
    }

    // Check video processing performance
    if (metrics.videoProcessing) {
      if (metrics.videoProcessing.averageProcessingSpeed < 0.1) {
        issues.push('Very slow video processing');
        recommendations.push('Try reducing video quality or file size');
        status = 'critical';
      } else if (metrics.videoProcessing.averageProcessingSpeed < 0.5) {
        issues.push('Slow video processing');
        recommendations.push('Consider using lower quality settings');
        if (status === 'good') status = 'warning';
      }
    }

    return { status, issues, recommendations };
  }

  /**
   * Export metrics for analysis
   */
  exportMetrics(): string {
    const metrics = this.getMetrics();
    const health = this.checkPerformanceHealth();
    
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      metrics,
      health,
    }, null, 2);
  }

  /**
   * Reset performance metrics
   */
  reset(): void {
    this.metrics.videoProcessing = null;
  }

  /**
   * Log performance results
   */
  logResults(): void {
    const metrics = this.getMetrics();
    console.log('Performance Results:', metrics);
  }

  /**
   * Clean up observers
   */
  dispose(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
  }
}

// Export singleton instance
export const performanceMonitor = PerformanceMonitor.getInstance();

// Auto-start monitoring
if (typeof window !== 'undefined') {
  // Monitor performance in development
  if (process.env.NODE_ENV === 'development') {
    setInterval(() => {
      const health = performanceMonitor.checkPerformanceHealth();
      if (health.status !== 'good') {
        console.warn('⚠️ Performance Issues Detected:', health);
      }
    }, 30000); // Check every 30 seconds
  }
}