import { assertEquals } from "../deps.ts";
import { describe, it } from "../deps.ts";
import {
  adjustNewlineBoundaries,
  adjustWordBoundaries,
  detectAndAdjustFullLineAddition,
  detectAndAdjustFullLineDeletion,
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

  describe("detectAndAdjustFullLineDeletion", () => {
    it("should detect and adjust full line deletion with leading spaces", () => {
      const ranges: Range[] = [{
        lnum: 1,
        lineText: "    function test() {",
        col: { start: 4, end: 21 },
        matchText: "function test() {",
        changeType: "removed",
      }];

      const result = detectAndAdjustFullLineDeletion(ranges);

      assertEquals(result.length, 1);
      assertEquals(result[0].col.start, 0);
      assertEquals(result[0].col.end, 21);
      assertEquals(result[0].matchText, "    function test() {");
    });

    it("should detect multi-line deletion and adjust appropriately", () => {
      const ranges: Range[] = [
        {
          lnum: 1,
          lineText: "    function test() {",
          col: { start: 0, end: 21 },
          matchText: "    function test() {",
          changeType: "removed",
        },
        {
          lnum: 2,
          lineText: "        console.log('test');",
          col: { start: 0, end: 28 },
          matchText: "        console.log('test');",
          changeType: "removed",
        },
      ];

      const result = detectAndAdjustFullLineDeletion(ranges);

      // Should not modify ranges that already start from column 0
      assertEquals(result.length, 2);
      assertEquals(result[0].col.start, 0);
      assertEquals(result[1].col.start, 0);
    });

    it("should handle line deletion that extends to end of line", () => {
      const ranges: Range[] = [{
        lnum: 1,
        lineText: "    const value = 123;",
        col: { start: 10, end: 22 },
        matchText: "value = 123;",
        changeType: "removed",
      }];

      const result = detectAndAdjustFullLineDeletion(ranges);

      // This is not a full line deletion (const remains), should not change
      assertEquals(result.length, 1);
      assertEquals(result[0].col.start, 10);
      assertEquals(result[0].col.end, 22);
      assertEquals(result[0].matchText, "value = 123;");
    });

    it("should not adjust partial line changes", () => {
      const ranges: Range[] = [{
        lnum: 1,
        lineText: "const variable = value;",
        col: { start: 6, end: 14 },
        matchText: "variable",
        changeType: "removed",
      }];

      const result = detectAndAdjustFullLineDeletion(ranges);

      // Should not modify partial line changes
      assertEquals(result.length, 1);
      assertEquals(result[0].col.start, 6);
      assertEquals(result[0].col.end, 14);
    });

    it("should handle additions without modification", () => {
      const ranges: Range[] = [{
        lnum: 1,
        lineText: "    new line",
        col: { start: 4, end: 12 },
        matchText: "new line",
        changeType: "added",
      }];

      const result = detectAndAdjustFullLineDeletion(ranges);

      // Should not modify additions
      assertEquals(result.length, 1);
      assertEquals(result[0].col.start, 4);
      assertEquals(result[0].col.end, 12);
    });

    it("should detect when deletion extends from beginning to end", () => {
      const ranges: Range[] = [{
        lnum: 1,
        lineText: "complete line",
        col: { start: 0, end: 13 },
        matchText: "complete line",
        changeType: "removed",
      }];

      const result = detectAndAdjustFullLineDeletion(ranges);

      // Already covers full line, should not change
      assertEquals(result.length, 1);
      assertEquals(result[0].col.start, 0);
      assertEquals(result[0].col.end, 13);
    });
  });

  describe("detectAndAdjustFullLineAddition", () => {
    it("should detect and adjust full line addition with leading spaces", () => {
      const ranges: Range[] = [{
        lnum: 1,
        lineText: "    function test() {",
        col: { start: 4, end: 21 },
        matchText: "function test() {",
        changeType: "added",
      }];

      const result = detectAndAdjustFullLineAddition(ranges);

      assertEquals(result.length, 1);
      assertEquals(result[0].col.start, 0);
      assertEquals(result[0].col.end, 21);
      assertEquals(result[0].matchText, "    function test() {");
    });

    it("should not adjust removals", () => {
      const ranges: Range[] = [{
        lnum: 1,
        lineText: "    function test() {",
        col: { start: 4, end: 21 },
        matchText: "function test() {",
        changeType: "removed",
      }];

      const result = detectAndAdjustFullLineAddition(ranges);

      // Should not modify removals
      assertEquals(result.length, 1);
      assertEquals(result[0].col.start, 4);
      assertEquals(result[0].col.end, 21);
    });

    it("should handle partial additions", () => {
      const ranges: Range[] = [{
        lnum: 1,
        lineText: "const variable = value;",
        col: { start: 6, end: 14 },
        matchText: "variable",
        changeType: "added",
      }];

      const result = detectAndAdjustFullLineAddition(ranges);

      // Should not modify partial line changes
      assertEquals(result.length, 1);
      assertEquals(result[0].col.start, 6);
      assertEquals(result[0].col.end, 14);
    });
  });
});
