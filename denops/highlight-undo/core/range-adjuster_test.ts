import { assertEquals } from "../deps.ts";
import { describe, it } from "../deps.ts";
import {
  adjustNewlineBoundaries,
  adjustWordBoundaries,
  handleWhitespaceChanges,
  mergeOverlappingRanges,
} from "./range-adjuster.ts";
import type { Range } from "./range-computer.ts";

describe("range-adjuster", () => {
  describe("adjustNewlineBoundaries", () => {
    it("should adjust ranges ending with newline", () => {
      const ranges: Range[] = [
        {
          lnum: 1,
          lineText: "hello world",
          col: { start: 5, end: 11 },
          matchText: " world\n",
          changeType: "added",
        },
      ];

      const adjusted = adjustNewlineBoundaries(ranges);

      assertEquals(adjusted.length, 1);
      assertEquals(adjusted[0].matchText, " world");
      assertEquals(adjusted[0].col.end, 10);
    });

    it("should skip ranges that are only newlines", () => {
      const ranges: Range[] = [
        {
          lnum: 1,
          lineText: "hello",
          col: { start: 5, end: 6 },
          matchText: "\n",
          changeType: "added",
        },
      ];

      const adjusted = adjustNewlineBoundaries(ranges);

      assertEquals(adjusted.length, 0);
    });

    it("should adjust ranges starting with newline", () => {
      const ranges: Range[] = [
        {
          lnum: 2,
          lineText: "world",
          col: { start: 0, end: 6 },
          matchText: "\nworld",
          changeType: "added",
        },
      ];

      const adjusted = adjustNewlineBoundaries(ranges);

      assertEquals(adjusted.length, 1);
      assertEquals(adjusted[0].matchText, "world");
      assertEquals(adjusted[0].col.start, 0);
      assertEquals(adjusted[0].col.end, 5);
    });

    it("should handle newline-only at start as end-of-previous-line marker", () => {
      const ranges: Range[] = [
        {
          lnum: 2,
          lineText: "next line",
          col: { start: 0, end: 1 },
          matchText: "\n",
          changeType: "removed",
        },
      ];

      const adjusted = adjustNewlineBoundaries(ranges);

      assertEquals(adjusted.length, 0); // Newline-only ranges are filtered out
    });

    it("should not modify ranges without newlines", () => {
      const ranges: Range[] = [
        {
          lnum: 1,
          lineText: "hello world",
          col: { start: 0, end: 5 },
          matchText: "hello",
          changeType: "added",
        },
      ];

      const adjusted = adjustNewlineBoundaries(ranges);

      assertEquals(adjusted.length, 1);
      assertEquals(adjusted[0], ranges[0]);
    });
  });

  describe("adjustWordBoundaries", () => {
    it("should expand to word boundaries", () => {
      const ranges: Range[] = [
        {
          lnum: 1,
          lineText: "hello beautiful world",
          col: { start: 8, end: 11 }, // "aut" from "beautiful"
          matchText: "aut",
          changeType: "added",
        },
      ];

      const adjusted = adjustWordBoundaries(ranges);

      assertEquals(adjusted.length, 1);
      // With the fixed algorithm, it should find the space before "beautiful"
      // and extend to the space after "beautiful"
      assertEquals(adjusted[0].col.start, 6); // After the space, start of "beautiful"
      assertEquals(adjusted[0].col.end, 15); // End of "beautiful"
      assertEquals(adjusted[0].matchText, "beautiful");
    });

    it("should not adjust already word-bounded ranges", () => {
      const ranges: Range[] = [
        {
          lnum: 1,
          lineText: "hello world",
          col: { start: 6, end: 11 },
          matchText: "world",
          changeType: "added",
        },
      ];

      const adjusted = adjustWordBoundaries(ranges);

      assertEquals(adjusted.length, 1);
      assertEquals(adjusted[0], ranges[0]);
    });

    it("should not adjust very small changes", () => {
      const ranges: Range[] = [
        {
          lnum: 1,
          lineText: "hello world",
          col: { start: 5, end: 6 },
          matchText: " ",
          changeType: "added",
        },
      ];

      const adjusted = adjustWordBoundaries(ranges);

      assertEquals(adjusted.length, 1);
      assertEquals(adjusted[0], ranges[0]);
    });

    it("should respect line boundaries", () => {
      const ranges: Range[] = [
        {
          lnum: 1,
          lineText: "testing",
          col: { start: 1, end: 4 }, // "est" from "testing"
          matchText: "est",
          changeType: "removed",
        },
      ];

      const adjusted = adjustWordBoundaries(ranges);

      assertEquals(adjusted.length, 1);
      assertEquals(adjusted[0].col.start, 0); // Start of line/word
      assertEquals(adjusted[0].col.end, 7); // End of "testing"
      assertEquals(adjusted[0].matchText, "testing");
    });
  });

  describe("handleWhitespaceChanges", () => {
    it("should highlight full indentation at line start", () => {
      const ranges: Range[] = [
        {
          lnum: 1,
          lineText: "    function test() {",
          col: { start: 0, end: 4 },
          matchText: "    ",
          changeType: "added",
        },
      ];

      const adjusted = handleWhitespaceChanges(ranges);

      assertEquals(adjusted.length, 1);
      assertEquals(adjusted[0].col.start, 0);
      assertEquals(adjusted[0].col.end, 4);
    });

    it("should highlight trailing whitespace", () => {
      const ranges: Range[] = [
        {
          lnum: 1,
          lineText: "hello world    ",
          col: { start: 11, end: 15 },
          matchText: "    ",
          changeType: "added",
        },
      ];

      const adjusted = handleWhitespaceChanges(ranges);

      assertEquals(adjusted.length, 1);
      assertEquals(adjusted[0].col.start, 11);
      assertEquals(adjusted[0].col.end, 15);
    });

    it("should not modify non-whitespace changes", () => {
      const ranges: Range[] = [
        {
          lnum: 1,
          lineText: "hello world",
          col: { start: 0, end: 5 },
          matchText: "hello",
          changeType: "added",
        },
      ];

      const adjusted = handleWhitespaceChanges(ranges);

      assertEquals(adjusted.length, 1);
      assertEquals(adjusted[0], ranges[0]);
    });

    it("should handle mixed whitespace in the middle", () => {
      const ranges: Range[] = [
        {
          lnum: 1,
          lineText: "hello   world",
          col: { start: 5, end: 8 },
          matchText: "   ",
          changeType: "removed",
        },
      ];

      const adjusted = handleWhitespaceChanges(ranges);

      // Middle whitespace is not special-cased
      assertEquals(adjusted.length, 1);
      assertEquals(adjusted[0], ranges[0]);
    });
  });

  describe("mergeOverlappingRanges", () => {
    it("should merge overlapping ranges on the same line", () => {
      const ranges: Range[] = [
        {
          lnum: 1,
          lineText: "hello world",
          col: { start: 0, end: 5 },
          matchText: "hello",
          changeType: "added",
        },
        {
          lnum: 1,
          lineText: "hello world",
          col: { start: 4, end: 11 },
          matchText: "o world",
          changeType: "added",
        },
      ];

      const merged = mergeOverlappingRanges(ranges);

      assertEquals(merged.length, 1);
      assertEquals(merged[0].col.start, 0);
      assertEquals(merged[0].col.end, 11);
      assertEquals(merged[0].matchText, "hello world");
    });

    it("should merge adjacent ranges", () => {
      const ranges: Range[] = [
        {
          lnum: 1,
          lineText: "hello world",
          col: { start: 0, end: 5 },
          matchText: "hello",
          changeType: "added",
        },
        {
          lnum: 1,
          lineText: "hello world",
          col: { start: 5, end: 11 },
          matchText: " world",
          changeType: "added",
        },
      ];

      const merged = mergeOverlappingRanges(ranges);

      assertEquals(merged.length, 1);
      assertEquals(merged[0].col.start, 0);
      assertEquals(merged[0].col.end, 11);
      assertEquals(merged[0].matchText, "hello world");
    });

    it("should not merge ranges with different change types", () => {
      const ranges: Range[] = [
        {
          lnum: 1,
          lineText: "hello world",
          col: { start: 0, end: 5 },
          matchText: "hello",
          changeType: "added",
        },
        {
          lnum: 1,
          lineText: "hello world",
          col: { start: 4, end: 11 },
          matchText: "o world",
          changeType: "removed",
        },
      ];

      const merged = mergeOverlappingRanges(ranges);

      assertEquals(merged.length, 2);
    });

    it("should not merge ranges on different lines", () => {
      const ranges: Range[] = [
        {
          lnum: 1,
          lineText: "hello",
          col: { start: 0, end: 5 },
          matchText: "hello",
          changeType: "added",
        },
        {
          lnum: 2,
          lineText: "world",
          col: { start: 0, end: 5 },
          matchText: "world",
          changeType: "added",
        },
      ];

      const merged = mergeOverlappingRanges(ranges);

      assertEquals(merged.length, 2);
    });

    it("should handle empty input", () => {
      const merged = mergeOverlappingRanges([]);
      assertEquals(merged.length, 0);
    });

    it("should handle single range", () => {
      const ranges: Range[] = [
        {
          lnum: 1,
          lineText: "hello",
          col: { start: 0, end: 5 },
          matchText: "hello",
          changeType: "added",
        },
      ];

      const merged = mergeOverlappingRanges(ranges);
      assertEquals(merged.length, 1);
      assertEquals(merged[0], ranges[0]);
    });
  });
});