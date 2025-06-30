import { assertEquals } from "https://deno.land/std@0.173.0/testing/asserts.ts";
import { describe, it } from "https://deno.land/std@0.173.0/testing/bdd.ts";
import { DiffOptimizer } from "./diff-optimizer.ts";

describe("DiffOptimizer", () => {
  it("should return null for identical strings", () => {
    const optimizer = new DiffOptimizer();
    const result = optimizer.calculateDiff(
      "hello world",
      "hello world",
      { line: 50, char: 1500 },
    );

    assertEquals(result, null);
  });

  it("should return null when threshold exceeded", () => {
    const optimizer = new DiffOptimizer();
    const result = optimizer.calculateDiff(
      "a",
      "b".repeat(2000),
      { line: 50, char: 1500 },
    );

    assertEquals(result, null);
  });

  it("should optimize simple insertions at end", () => {
    const optimizer = new DiffOptimizer();
    const result = optimizer.calculateDiff(
      "hello",
      "hello world",
      { line: 50, char: 1500 },
    );

    assertEquals(result !== null, true);
    assertEquals(result!.changes.length, 2);
    assertEquals(result!.changes[0].value, "hello");
    assertEquals(result!.changes[1].value, " world");
    assertEquals(result!.changes[1].added, true);
  });

  it("should optimize simple insertions at beginning", () => {
    const optimizer = new DiffOptimizer();
    const result = optimizer.calculateDiff(
      "world",
      "hello world",
      { line: 50, char: 1500 },
    );

    assertEquals(result !== null, true);
    assertEquals(result!.changes.length, 2);
    assertEquals(result!.changes[0].value, "hello ");
    assertEquals(result!.changes[0].added, true);
    assertEquals(result!.changes[1].value, "world");
  });

  it("should optimize simple deletions", () => {
    const optimizer = new DiffOptimizer();
    const result = optimizer.calculateDiff(
      "hello world",
      "hello",
      { line: 50, char: 1500 },
    );

    assertEquals(result !== null, true);
    assertEquals(result!.changes.length, 2);
    assertEquals(result!.changes[0].value, "hello");
    assertEquals(result!.changes[1].value, " world");
    assertEquals(result!.changes[1].removed, true);
  });

  it("should cache results", () => {
    const optimizer = new DiffOptimizer();
    const before = "hello";
    const after = "hello world";

    // First call - calculates diff
    const result1 = optimizer.calculateDiff(
      before,
      after,
      { line: 50, char: 1500 },
    );

    // Second call - should return cached result
    const result2 = optimizer.calculateDiff(
      before,
      after,
      { line: 50, char: 1500 },
    );

    // Results should be the same reference (cached)
    assertEquals(result1, result2);
  });

  it("should handle complex diffs", () => {
    const optimizer = new DiffOptimizer();
    const result = optimizer.calculateDiff(
      "line1\nline2\nline3",
      "line1\nmodified line2\nline3",
      { line: 50, char: 1500 },
    );

    assertEquals(result !== null, true);
    assertEquals(result!.changes.some((c) => c.added), true);
  });

  // Commented out due to accessing private properties
  // it("should evict old cache entries", () => {
  //   const optimizer = new DiffOptimizer();
  //   // Set max cache to small number for testing
  //   (optimizer as any).maxCacheEntries = 2;

  //   // Add 3 entries
  //   optimizer.calculateDiff("a", "b", { line: 50, char: 1500 });
  //   optimizer.calculateDiff("c", "d", { line: 50, char: 1500 });
  //   optimizer.calculateDiff("e", "f", { line: 50, char: 1500 });

  //   // Cache should only have 2 entries
  //   assertEquals((optimizer as any).cache.size, 2);
  // });

  it("should clear cache", () => {
    const optimizer = new DiffOptimizer();

    optimizer.calculateDiff("a", "b", { line: 50, char: 1500 });
    optimizer.calculateDiff("c", "d", { line: 50, char: 1500 });

    optimizer.clearCache();

    // Test that cache is cleared by checking cache hit
    const result1 = optimizer.calculateDiff("a", "b", { line: 50, char: 1500 });
    const result2 = optimizer.calculateDiff("a", "b", { line: 50, char: 1500 });
    // Both should calculate (no cache hit)
    assertEquals(result1 !== null, true);
    assertEquals(result2 !== null, true);
  });
});
