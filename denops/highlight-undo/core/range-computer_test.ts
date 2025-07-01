import { assertEquals } from "https://deno.land/std@0.173.0/testing/asserts.ts";
import { describe, it } from "https://deno.land/std@0.173.0/testing/bdd.ts";
import { RangeComputer } from "./range-computer.ts";
import type { Diff } from "../deps.ts";

describe("RangeComputer", () => {
  describe("computeRanges", () => {
    it("should compute ranges for added text", () => {
      const computer = new RangeComputer();
      const changes: Diff.Change[] = [
        { value: "hello ", count: 6 },
        { value: "world", count: 5, added: true },
      ];

      const ranges = computer.computeRanges({
        changes,
        beforeCode: "hello ",
        afterCode: "hello world",
        changeType: "added",
      });

      assertEquals(ranges.length, 1);
      assertEquals(ranges[0].lnum, 1);
      assertEquals(ranges[0].col.start, 6);
      assertEquals(ranges[0].col.end, 11);
      assertEquals(ranges[0].matchText, "world");
    });

    it("should compute ranges for removed text", () => {
      const computer = new RangeComputer();
      const changes: Diff.Change[] = [
        { value: "hello ", count: 6 },
        { value: "world", count: 5, removed: true },
      ];

      const ranges = computer.computeRanges({
        changes,
        beforeCode: "hello world",
        afterCode: "hello ",
        changeType: "removed",
      });

      assertEquals(ranges.length, 1);
      assertEquals(ranges[0].lnum, 1);
      assertEquals(ranges[0].col.start, 6);
      assertEquals(ranges[0].col.end, 11);
      assertEquals(ranges[0].matchText, "world");
    });

    it("should handle multi-line additions", () => {
      const computer = new RangeComputer();
      const changes: Diff.Change[] = [
        { value: "line1\n", count: 6 },
        { value: "line2\nline3\n", count: 12, added: true },
        { value: "line4", count: 5 },
      ];

      const ranges = computer.computeRanges({
        changes,
        beforeCode: "line1\nline4",
        afterCode: "line1\nline2\nline3\nline4",
        changeType: "added",
      });

      assertEquals(ranges.length, 2);
      assertEquals(ranges[0].lnum, 2);
      assertEquals(ranges[0].matchText, "line2");
      assertEquals(ranges[1].lnum, 3);
      assertEquals(ranges[1].matchText, "line3");
    });

    it("should handle complex mixed changes", () => {
      const computer = new RangeComputer();
      const changes: Diff.Change[] = [
        { value: "start\n", count: 6 },
        { value: "old", count: 3, removed: true },
        { value: "new", count: 3, added: true },
        { value: "\nend", count: 4 },
      ];

      const addedRanges = computer.computeRanges({
        changes,
        beforeCode: "start\nold\nend",
        afterCode: "start\nnew\nend",
        changeType: "added",
      });

      assertEquals(addedRanges.length, 1);
      assertEquals(addedRanges[0].lnum, 2);
      assertEquals(addedRanges[0].matchText, "new");

      const removedRanges = computer.computeRanges({
        changes,
        beforeCode: "start\nold\nend",
        afterCode: "start\nnew\nend",
        changeType: "removed",
      });

      assertEquals(removedRanges.length, 1);
      assertEquals(removedRanges[0].lnum, 2);
      assertEquals(removedRanges[0].matchText, "old");
    });

    it("should handle additions at the beginning of lines", () => {
      const computer = new RangeComputer();
      const changes: Diff.Change[] = [
        { value: "  ", count: 2, added: true },
        { value: "hello", count: 5 },
      ];

      const ranges = computer.computeRanges({
        changes,
        beforeCode: "hello",
        afterCode: "  hello",
        changeType: "added",
      });

      assertEquals(ranges.length, 1);
      assertEquals(ranges[0].lnum, 1);
      assertEquals(ranges[0].col.start, 0);
      assertEquals(ranges[0].col.end, 2);
      assertEquals(ranges[0].matchText, "  ");
    });

    it("should skip empty text in multi-line changes", () => {
      const computer = new RangeComputer();
      const changes: Diff.Change[] = [
        { value: "line1\n\nline3", count: 13, added: true },
      ];

      const ranges = computer.computeRanges({
        changes,
        beforeCode: "",
        afterCode: "line1\n\nline3",
        changeType: "added",
      });

      assertEquals(ranges.length, 2);
      assertEquals(ranges[0].lnum, 1);
      assertEquals(ranges[0].matchText, "line1");
      assertEquals(ranges[1].lnum, 3);
      assertEquals(ranges[1].matchText, "line3");
    });

    it("should correctly calculate index for added changes", () => {
      const computer = new RangeComputer();
      const changes: Diff.Change[] = [
        { value: "abc", count: 3 },
        { value: "123", count: 3, removed: true },
        { value: "def", count: 3, added: true },
        { value: "ghi", count: 3 },
      ];

      const ranges = computer.computeRanges({
        changes,
        beforeCode: "abc123ghi",
        afterCode: "abcdefghi",
        changeType: "added",
      });

      assertEquals(ranges.length, 1);
      assertEquals(ranges[0].col.start, 3);
      assertEquals(ranges[0].col.end, 6);
      assertEquals(ranges[0].matchText, "def");
    });

    it("should correctly calculate index for removed changes", () => {
      const computer = new RangeComputer();
      const changes: Diff.Change[] = [
        { value: "abc", count: 3 },
        { value: "123", count: 3, removed: true },
        { value: "def", count: 3, added: true },
        { value: "ghi", count: 3 },
      ];

      const ranges = computer.computeRanges({
        changes,
        beforeCode: "abc123ghi",
        afterCode: "abcdefghi",
        changeType: "removed",
      });

      assertEquals(ranges.length, 1);
      assertEquals(ranges[0].col.start, 3);
      assertEquals(ranges[0].col.end, 6);
      assertEquals(ranges[0].matchText, "123");
    });
  });
});
