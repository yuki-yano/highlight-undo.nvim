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

// Backward compatibility
export class PerformanceMonitor implements IPerformanceMonitor {
  private monitor: ReturnType<typeof createPerformanceMonitor> | null = null;

  start(): void {
    this.monitor = createPerformanceMonitor();
  }

  mark(name: keyof PerformanceMetrics): void {
    if (!this.monitor) {
      throw new Error("PerformanceMonitor not started");
    }
    this.monitor.mark(name);
  }

  end(): PerformanceMetrics {
    if (!this.monitor) {
      throw new Error("PerformanceMonitor not started");
    }
    return this.monitor.end();
  }

  static format(metrics: PerformanceMetrics): string {
    return formatPerformanceMetrics(metrics);
  }
}
