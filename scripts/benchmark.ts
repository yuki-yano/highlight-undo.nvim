#!/usr/bin/env -S deno run --allow-all

import { createDiffOptimizer } from "../denops/highlight-undo/core/diff-optimizer.ts";
import { computeRanges } from "../denops/highlight-undo/core/range-computer.ts";
import { createPerformanceMonitor, formatPerformanceMetrics } from "../denops/highlight-undo/performance.ts";

// Generate test data
function generateTestData(lines: number, avgLineLength: number): string {
  const result: string[] = [];
  for (let i = 0; i < lines; i++) {
    const length = Math.floor(avgLineLength * (0.5 + Math.random()));
    result.push("x".repeat(length));
  }
  return result.join("\n");
}

// Benchmark diff calculation
function benchmarkDiff() {
  console.log("=== Diff Calculation Benchmark ===");
  const optimizer = createDiffOptimizer();

  const testCases = [
    { lines: 10, avgLength: 80, name: "Small file" },
    { lines: 100, avgLength: 80, name: "Medium file" },
    { lines: 1000, avgLength: 80, name: "Large file" },
    { lines: 5000, avgLength: 80, name: "Very large file" },
  ];

  for (const testCase of testCases) {
    const before = generateTestData(testCase.lines, testCase.avgLength);
    // Make some modifications
    const lines = before.split("\n");
    lines[Math.floor(lines.length / 2)] = "modified line";
    lines.push("new line at end");
    const after = lines.join("\n");

    const monitor = createPerformanceMonitor();

    const result = optimizer.calculateDiff(before, after, { line: 50, char: 1500 });

    const metrics = monitor.end();
    console.log(`${testCase.name} (${testCase.lines} lines): ${formatPerformanceMetrics(metrics)}`);

    if (result) {
      console.log(`  Changes: ${result.changes.length}`);
    }
  }
}

// Benchmark range computation
function benchmarkRangeComputation() {
  console.log("\n=== Range Computation Benchmark ===");
  const optimizer = createDiffOptimizer();

  const testCases = [
    { changes: 10, name: "Few changes" },
    { changes: 100, name: "Many changes" },
    { changes: 1000, name: "Lots of changes" },
  ];

  for (const testCase of testCases) {
    // Generate diff with specified number of changes
    const before = generateTestData(testCase.changes * 2, 40);
    const lines = before.split("\n");

    // Modify every other line
    for (let i = 0; i < lines.length; i += 2) {
      lines[i] = "modified: " + lines[i];
    }
    const after = lines.join("\n");

    const diffResult = optimizer.calculateDiff(before, after, { line: 10000, char: 100000 });

    if (diffResult) {
      const monitor = createPerformanceMonitor();

      const ranges = computeRanges({
        changes: diffResult.changes,
        beforeCode: before,
        afterCode: after,
        changeType: "added",
      });

      const metrics = monitor.end();
      console.log(`${testCase.name}: ${formatPerformanceMetrics(metrics)}`);
      console.log(`  Ranges computed: ${ranges.length}`);
    }
  }
}

// Benchmark cache performance
function benchmarkCache() {
  console.log("\n=== Cache Performance Benchmark ===");
  const optimizer = createDiffOptimizer();

  const before = generateTestData(100, 80);
  const after = before + "\nnew line";

  // First call (cache miss)
  const monitor1 = createPerformanceMonitor();
  optimizer.calculateDiff(before, after, { line: 50, char: 1500 });
  const metrics1 = monitor1.end();
  console.log(`First call (cache miss): ${formatPerformanceMetrics(metrics1)}`);

  // Second call (cache hit)
  const monitor2 = createPerformanceMonitor();
  optimizer.calculateDiff(before, after, { line: 50, char: 1500 });
  const metrics2 = monitor2.end();
  console.log(`Second call (cache hit): ${formatPerformanceMetrics(metrics2)}`);

  const speedup = metrics1.total / metrics2.total;
  console.log(`Cache speedup: ${speedup.toFixed(2)}x`);
}

// Run all benchmarks
async function main() {
  console.log("highlight-undo.nvim Performance Benchmark\n");

  await benchmarkDiff();
  await benchmarkRangeComputation();
  await benchmarkCache();

  console.log("\nBenchmark complete!");
}

if (import.meta.main) {
  main();
}
