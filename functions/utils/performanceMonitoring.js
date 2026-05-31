/**
 * Performance monitoring middleware
 * Tracks request duration and logs slow requests
 */

const SLOW_REQUEST_THRESHOLD_MS = 500;
const VERY_SLOW_REQUEST_THRESHOLD_MS = 2000;

/**
 * Performance monitoring middleware
 * @param {number} slowThreshold - Threshold in ms to log slow requests
 * @returns {Function} - Middleware function
 */
export function performanceMonitoring(slowThreshold = SLOW_REQUEST_THRESHOLD_MS) {
  return async (context) => {
    const startTime = Date.now();
    const { request } = context;
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      const response = await context.next();
      const duration = Date.now() - startTime;

      // Log performance metrics
      logPerformance(method, path, response.status, duration, slowThreshold);

      // Add performance headers
      const headers = new Headers(response.headers);
      headers.set('X-Response-Time', `${duration}ms`);
      headers.set('Server-Timing', `total;dur=${duration}`);

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[Perf] ${method} ${path} - ERROR after ${duration}ms:`, error.message);
      throw error;
    }
  };
}

/**
 * Log performance metrics
 */
function logPerformance(method, path, status, duration, threshold) {
  const emoji = getPerformanceEmoji(duration, threshold);
  const level = getLogLevel(duration, threshold);

  const message = `[Perf] ${emoji} ${method} ${path} - ${status} in ${duration}ms`;

  if (level === 'error') {
    console.error(message);
  } else if (level === 'warn') {
    console.warn(message);
  } else if (level === 'info') {
    console.log(message);
  }
  // Skip 'debug' level in production
}

/**
 * Get emoji based on performance
 */
function getPerformanceEmoji(duration, threshold) {
  if (duration < threshold / 2) return '⚡'; // Very fast
  if (duration < threshold) return '✅'; // Fast
  if (duration < threshold * 2) return '⚠️'; // Slow
  return '🔴'; // Very slow
}

/**
 * Get log level based on duration
 */
function getLogLevel(duration, threshold) {
  if (duration >= VERY_SLOW_REQUEST_THRESHOLD_MS) return 'error';
  if (duration >= threshold) return 'warn';
  if (duration >= threshold / 2) return 'info';
  return 'debug';
}

/**
 * Aggregate performance metrics
 */
class PerformanceAggregator {
  constructor() {
    this.metrics = new Map();
    this.resetInterval = 60 * 1000; // 1 minute
    this.lastReset = Date.now();
  }

  record(path, duration) {
    this.maybeReset();

    if (!this.metrics.has(path)) {
      this.metrics.set(path, {
        count: 0,
        totalDuration: 0,
        minDuration: Infinity,
        maxDuration: 0,
        durations: [],
      });
    }

    const metric = this.metrics.get(path);
    metric.count++;
    metric.totalDuration += duration;
    metric.minDuration = Math.min(metric.minDuration, duration);
    metric.maxDuration = Math.max(metric.maxDuration, duration);
    metric.durations.push(duration);

    // Keep only last 100 durations for percentile calculation
    if (metric.durations.length > 100) {
      metric.durations.shift();
    }
  }

  maybeReset() {
    const now = Date.now();
    if (now - this.lastReset >= this.resetInterval) {
      this.logSummary();
      this.metrics.clear();
      this.lastReset = now;
    }
  }

  logSummary() {
    if (this.metrics.size === 0) return;

    console.log('\n📊 Performance Summary (last minute):');
    console.log('─'.repeat(80));

    const sorted = Array.from(this.metrics.entries())
      .sort((a, b) => b[1].totalDuration - a[1].totalDuration);

    for (const [path, metric] of sorted) {
      const avg = metric.totalDuration / metric.count;
      const p95 = this.calculatePercentile(metric.durations, 95);

      console.log(
        `${path.padEnd(40)} | ` +
        `Count: ${String(metric.count).padStart(4)} | ` +
        `Avg: ${String(Math.round(avg)).padStart(5)}ms | ` +
        `P95: ${String(Math.round(p95)).padStart(5)}ms | ` +
        `Max: ${String(metric.maxDuration).padStart(5)}ms`
      );
    }

    console.log('─'.repeat(80) + '\n');
  }

  calculatePercentile(durations, percentile) {
    if (durations.length === 0) return 0;
    const sorted = [...durations].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  getMetrics() {
    const result = {};
    for (const [path, metric] of this.metrics.entries()) {
      result[path] = {
        count: metric.count,
        avgDuration: metric.totalDuration / metric.count,
        minDuration: metric.minDuration,
        maxDuration: metric.maxDuration,
        p95Duration: this.calculatePercentile(metric.durations, 95),
      };
    }
    return result;
  }
}

// Global aggregator instance
const globalAggregator = new PerformanceAggregator();

/**
 * Performance monitoring with aggregation
 */
export function performanceMonitoringWithAggregation(slowThreshold = SLOW_REQUEST_THRESHOLD_MS) {
  return async (context) => {
    const startTime = Date.now();
    const { request } = context;
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      const response = await context.next();
      const duration = Date.now() - startTime;

      // Record metrics
      globalAggregator.record(path, duration);

      // Log if slow
      if (duration >= slowThreshold) {
        logPerformance(method, path, response.status, duration, slowThreshold);
      }

      // Add performance headers
      const headers = new Headers(response.headers);
      headers.set('X-Response-Time', `${duration}ms`);
      headers.set('Server-Timing', `total;dur=${duration}`);

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      globalAggregator.record(path, duration);
      console.error(`[Perf] ${method} ${path} - ERROR after ${duration}ms:`, error.message);
      throw error;
    }
  };
}

/**
 * Get current performance metrics
 */
export function getPerformanceMetrics() {
  return globalAggregator.getMetrics();
}

/**
 * Force log performance summary
 */
export function logPerformanceSummary() {
  globalAggregator.logSummary();
}
