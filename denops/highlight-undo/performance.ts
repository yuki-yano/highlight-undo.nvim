// Performance monitoring utilities

export interface PerformanceMetrics {
  bufferRead: number;
  diffCalculation: number;
  highlightApplication: number;
  total: number;
}

export class PerformanceMonitor {
  private startTime: number = 0;
  private metrics: Partial<PerformanceMetrics> = {};

  start(): void {
    this.startTime = performance.now();
    this.metrics = {};
  }

  mark(name: keyof PerformanceMetrics): void {
    if (this.startTime === 0) {
      throw new Error("PerformanceMonitor not started");
    }
    this.metrics[name] = performance.now() - this.startTime;
  }

  end(): PerformanceMetrics {
    const total = performance.now() - this.startTime;
    return {
      bufferRead: this.metrics.bufferRead || 0,
      diffCalculation: this.metrics.diffCalculation || 0,
      highlightApplication: this.metrics.highlightApplication || 0,
      total,
    };
  }

  static format(metrics: PerformanceMetrics): string {
    return `Performance: total=${metrics.total.toFixed(2)}ms, ` +
      `buffer=${metrics.bufferRead.toFixed(2)}ms, ` +
      `diff=${metrics.diffCalculation.toFixed(2)}ms, ` +
      `highlight=${metrics.highlightApplication.toFixed(2)}ms`;
  }
}
