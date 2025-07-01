// Performance monitoring utilities

export interface PerformanceMetrics {
  bufferRead: number;
  diffCalculation: number;
  highlightApplication: number;
  total: number;
}

export interface IPerformanceMonitor {
  mark(name: keyof PerformanceMetrics): void;
  end(): PerformanceMetrics;
}

export function createPerformanceMonitor(): IPerformanceMonitor {
  let startTime = 0;
  const metrics: Partial<PerformanceMetrics> = {};

  startTime = performance.now();

  return {
    mark(name: keyof PerformanceMetrics): void {
      if (startTime === 0) {
        throw new Error("PerformanceMonitor not started");
      }
      metrics[name] = performance.now() - startTime;
    },

    end(): PerformanceMetrics {
      const total = performance.now() - startTime;
      return {
        bufferRead: metrics.bufferRead || 0,
        diffCalculation: metrics.diffCalculation || 0,
        highlightApplication: metrics.highlightApplication || 0,
        total,
      };
    },
  };
}

export function formatPerformanceMetrics(metrics: PerformanceMetrics): string {
  return `Performance: total=${metrics.total.toFixed(2)}ms, ` +
    `buffer=${metrics.bufferRead.toFixed(2)}ms, ` +
    `diff=${metrics.diffCalculation.toFixed(2)}ms, ` +
    `highlight=${metrics.highlightApplication.toFixed(2)}ms`;
}
