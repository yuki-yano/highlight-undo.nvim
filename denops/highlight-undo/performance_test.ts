import { assertEquals, assertThrows } from "https://deno.land/std@0.173.0/testing/asserts.ts";
import { describe, it } from "https://deno.land/std@0.173.0/testing/bdd.ts";
import { PerformanceMonitor } from "./performance.ts";

describe("PerformanceMonitor", () => {
  it("should track performance metrics", async () => {
    const monitor = new PerformanceMonitor();
    monitor.start();

    // Simulate some work
    await new Promise((resolve) => setTimeout(resolve, 10));
    monitor.mark("bufferRead");

    await new Promise((resolve) => setTimeout(resolve, 10));
    monitor.mark("diffCalculation");

    await new Promise((resolve) => setTimeout(resolve, 10));
    monitor.mark("highlightApplication");

    const metrics = monitor.end();

    // Check that all metrics are recorded
    assertEquals(typeof metrics.bufferRead, "number");
    assertEquals(typeof metrics.diffCalculation, "number");
    assertEquals(typeof metrics.highlightApplication, "number");
    assertEquals(typeof metrics.total, "number");

    // Check that metrics are in expected order
    assertEquals(metrics.bufferRead > 0, true);
    assertEquals(metrics.diffCalculation > metrics.bufferRead, true);
    assertEquals(metrics.highlightApplication > metrics.diffCalculation, true);
    assertEquals(metrics.total >= metrics.highlightApplication, true);
  });

  it("should throw if marking before start", () => {
    const monitor = new PerformanceMonitor();

    assertThrows(
      () => monitor.mark("bufferRead"),
      Error,
      "PerformanceMonitor not started",
    );
  });

  it("should format metrics correctly", () => {
    const metrics = {
      bufferRead: 12.345,
      diffCalculation: 23.456,
      highlightApplication: 34.567,
      total: 70.368,
    };

    const formatted = PerformanceMonitor.format(metrics);

    assertEquals(
      formatted,
      "Performance: total=70.37ms, buffer=12.35ms, diff=23.46ms, highlight=34.57ms",
    );
  });

  it("should handle missing marks", () => {
    const monitor = new PerformanceMonitor();
    monitor.start();

    // Only mark some metrics
    monitor.mark("bufferRead");

    const metrics = monitor.end();

    assertEquals(metrics.bufferRead > 0, true);
    assertEquals(metrics.diffCalculation, 0);
    assertEquals(metrics.highlightApplication, 0);
    assertEquals(metrics.total > 0, true);
  });
});
