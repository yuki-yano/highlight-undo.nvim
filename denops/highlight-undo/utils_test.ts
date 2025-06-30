import { assertEquals } from "https://deno.land/std@0.173.0/testing/asserts.ts";
import { describe, it } from "https://deno.land/std@0.173.0/testing/bdd.ts";
import type { Diff } from "./deps.ts";
import { computeRanges, fillRangeGaps, type Range } from "./utils.ts";

describe("computeRanges", () => {
  it("should compute ranges for simple single-line addition", () => {
    const changes: Diff.Change[] = [
      { value: "hello ", count: 6 },
      { value: "beautiful ", count: 10, added: true },
      { value: "world", count: 5 },
    ];

    const afterCode = "hello beautiful world";
    const beforeCode = "hello world";

    const ranges = computeRanges({
      changes,
      beforeCode,
      afterCode,
      changeType: "added",
    });

    assertEquals(ranges.length, 1);
    assertEquals(ranges[0].matchText, "beautiful ");
    assertEquals(ranges[0].col.start, 6);
    assertEquals(ranges[0].col.end, 16);
    assertEquals(ranges[0].lnum, 1);
  });

  it("should compute ranges for multi-line additions", () => {
    const changes: Diff.Change[] = [
      { value: "line1\n", count: 6 },
      { value: "new line\n", count: 9, added: true },
      { value: "line2", count: 5 },
    ];

    const afterCode = "line1\nnew line\nline2";
    const beforeCode = "line1\nline2";

    const ranges = computeRanges({
      changes,
      beforeCode,
      afterCode,
      changeType: "added",
    });

    assertEquals(ranges.length, 2);
    assertEquals(ranges[0].matchText, "new line");
    assertEquals(ranges[0].lnum, 2);
    assertEquals(ranges[0].col.start, 0);
    assertEquals(ranges[0].col.end, 8);

    // Empty line for the newline character
    assertEquals(ranges[1].matchText, "");
    assertEquals(ranges[1].lnum, 3);
  });

  it("should compute ranges for removals", () => {
    const changes: Diff.Change[] = [
      { value: "hello ", count: 6 },
      { value: "beautiful ", count: 10, removed: true },
      { value: "world", count: 5 },
    ];

    const afterCode = "hello world";
    const beforeCode = "hello beautiful world";

    const ranges = computeRanges({
      changes,
      beforeCode,
      afterCode,
      changeType: "removed",
    });

    assertEquals(ranges.length, 1);
    assertEquals(ranges[0].matchText, "beautiful ");
    assertEquals(ranges[0].changeType, "removed");
  });

  it("should handle empty changes", () => {
    const changes: Diff.Change[] = [];
    const afterCode = "hello world";
    const beforeCode = "hello world";

    const ranges = computeRanges({
      changes,
      beforeCode,
      afterCode,
      changeType: "added",
    });

    assertEquals(ranges.length, 0);
  });

  it("should handle changes at the beginning of line", () => {
    const changes: Diff.Change[] = [
      { value: "prefix ", count: 7, added: true },
      { value: "hello world", count: 11 },
    ];

    const afterCode = "prefix hello world";
    const beforeCode = "hello world";

    const ranges = computeRanges({
      changes,
      beforeCode,
      afterCode,
      changeType: "added",
    });

    assertEquals(ranges.length, 1);
    assertEquals(ranges[0].col.start, 0);
    assertEquals(ranges[0].col.end, 7);
  });
});

describe("fillRangeGaps", () => {
  it("should fill gaps for ranges starting at column 0", () => {
    const ranges: Range[] = [
      {
        lnum: 3,
        lineText: "this is a full line",
        col: { start: 0, end: 5 },
        matchText: "this ",
        changeType: "added",
      },
    ];

    const filled = fillRangeGaps({
      ranges,
      aboveLine: 2,
      belowLine: 4,
    });

    assertEquals(filled.length, 1);
    assertEquals(filled[0].col.start, 0);
    assertEquals(filled[0].col.end, ranges[0].lineText.length);
  });

  it("should keep ranges not starting at column 0", () => {
    const ranges: Range[] = [
      {
        lnum: 3,
        lineText: "hello world",
        col: { start: 6, end: 11 },
        matchText: "world",
        changeType: "added",
      },
    ];

    const filled = fillRangeGaps({
      ranges,
      aboveLine: 2,
      belowLine: 4,
    });

    assertEquals(filled.length, 1);
    assertEquals(filled[0].col.start, 6);
    assertEquals(filled[0].col.end, 11);
  });

  it("should include ranges on boundary lines", () => {
    const ranges: Range[] = [
      {
        lnum: 2,
        lineText: "line2",
        col: { start: 0, end: 5 },
        matchText: "line2",
        changeType: "added",
      },
      {
        lnum: 4,
        lineText: "line4",
        col: { start: 0, end: 5 },
        matchText: "line4",
        changeType: "added",
      },
    ];

    const filled = fillRangeGaps({
      ranges,
      aboveLine: 2,
      belowLine: 4,
    });

    assertEquals(filled.length, 2);
  });

  it("should exclude ranges outside boundaries", () => {
    const ranges: Range[] = [
      {
        lnum: 1,
        lineText: "line1",
        col: { start: 0, end: 5 },
        matchText: "line1",
        changeType: "added",
      },
      {
        lnum: 3,
        lineText: "line3",
        col: { start: 0, end: 5 },
        matchText: "line3",
        changeType: "added",
      },
      {
        lnum: 5,
        lineText: "line5",
        col: { start: 0, end: 5 },
        matchText: "line5",
        changeType: "added",
      },
    ];

    const filled = fillRangeGaps({
      ranges,
      aboveLine: 2,
      belowLine: 4,
    });

    assertEquals(filled.length, 1);
    assertEquals(filled[0].lnum, 3);
  });

  it("should handle empty ranges", () => {
    const ranges: Range[] = [];

    const filled = fillRangeGaps({
      ranges,
      aboveLine: 1,
      belowLine: 10,
    });

    assertEquals(filled.length, 0);
  });
});
