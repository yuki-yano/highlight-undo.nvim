import { assertEquals } from "../deps.ts";
import {
  applyHeuristicStrategy,
  ChangeSize,
  DisplayStrategy,
  evaluateChangeSize,
  selectDisplayStrategy,
} from "./heuristic-strategy.ts";
import type { Range } from "./range-computer.ts";

Deno.test("evaluateChangeSize", async (t) => {
  await t.step("should return Tiny for small changes", () => {
    const ranges: Range[] = [{
      changeType: "added",
      matchText: "hi",
      lnum: 1,
      col: { start: 0, end: 2 },
      lineText: "hi world",
    }];

    assertEquals(evaluateChangeSize(ranges), ChangeSize.Tiny);
  });

  await t.step("should return Small for medium changes", () => {
    const ranges: Range[] = [{
      changeType: "added",
      matchText: "hello world",
      lnum: 1,
      col: { start: 0, end: 11 },
      lineText: "hello world",
    }];

    assertEquals(evaluateChangeSize(ranges), ChangeSize.Small);
  });

  await t.step("should return Medium for larger changes", () => {
    const ranges: Range[] = [{
      changeType: "added",
      matchText: "a".repeat(50),
      lnum: 1,
      col: { start: 0, end: 50 },
      lineText: "a".repeat(50),
    }];

    assertEquals(evaluateChangeSize(ranges), ChangeSize.Medium);
  });

  await t.step("should return Large for very large changes", () => {
    const ranges: Range[] = [{
      changeType: "added",
      matchText: "a".repeat(150),
      lnum: 1,
      col: { start: 0, end: 150 },
      lineText: "a".repeat(150),
    }];

    assertEquals(evaluateChangeSize(ranges), ChangeSize.Large);
  });

  await t.step("should sum up multiple ranges", () => {
    const ranges: Range[] = [
      {
        changeType: "added",
        matchText: "hello",
        lnum: 1,
        col: { start: 0, end: 5 },
        lineText: "hello world",
      },
      {
        changeType: "added",
        matchText: "world",
        lnum: 1,
        col: { start: 6, end: 11 },
        lineText: "hello world",
      },
    ];

    assertEquals(evaluateChangeSize(ranges), ChangeSize.Small); // 5 + 5 = 10
  });
});

Deno.test("selectDisplayStrategy", async (t) => {
  await t.step("should return correct strategy for each size", () => {
    assertEquals(selectDisplayStrategy(ChangeSize.Tiny), DisplayStrategy.Character);
    assertEquals(selectDisplayStrategy(ChangeSize.Small), DisplayStrategy.Word);
    assertEquals(selectDisplayStrategy(ChangeSize.Medium), DisplayStrategy.Line);
    assertEquals(selectDisplayStrategy(ChangeSize.Large), DisplayStrategy.Block);
  });
});

Deno.test("applyHeuristicStrategy", async (t) => {
  await t.step("should return ranges unchanged when disabled", () => {
    const ranges: Range[] = [{
      changeType: "added",
      matchText: "hello",
      lnum: 1,
      col: { start: 0, end: 5 },
      lineText: "hello world",
    }];

    const result = applyHeuristicStrategy(ranges, { enabled: false });
    assertEquals(result, ranges);
  });

  await t.step("should merge ranges on same line for Line strategy", () => {
    const ranges: Range[] = [
      {
        changeType: "added",
        matchText: "hello",
        lnum: 1,
        col: { start: 0, end: 5 },
        lineText: "hello beautiful world",
      },
      {
        changeType: "added",
        matchText: "world",
        lnum: 1,
        col: { start: 16, end: 21 },
        lineText: "hello beautiful world",
      },
    ];

    // Force Line strategy by setting a low threshold for medium
    const result = applyHeuristicStrategy(ranges, {
      enabled: true,
      thresholds: { tiny: 5, small: 9, medium: 10 },
    });

    assertEquals(result.length, 1);
    assertEquals(result[0].col.start, 0);
    assertEquals(result[0].col.end, 21);
    assertEquals(result[0].matchText, "hello beautiful world");
  });

  await t.step("should merge consecutive lines for Block strategy", () => {
    const ranges: Range[] = [
      {
        changeType: "added",
        matchText: "line1",
        lnum: 1,
        col: { start: 0, end: 5 },
        lineText: "line1",
      },
      {
        changeType: "added",
        matchText: "line2",
        lnum: 2,
        col: { start: 0, end: 5 },
        lineText: "line2",
      },
    ];

    // Force Block strategy
    const result = applyHeuristicStrategy(ranges, {
      enabled: true,
      strategies: {
        tiny: DisplayStrategy.Block,
        small: DisplayStrategy.Block,
        medium: DisplayStrategy.Block,
        large: DisplayStrategy.Block,
      },
    });

    assertEquals(result.length, 2);
    // Each line should be expanded to full line
    assertEquals(result[0].col.start, 0);
    assertEquals(result[0].col.end, result[0].lineText.length);
    assertEquals(result[1].col.start, 0);
    assertEquals(result[1].col.end, result[1].lineText.length);
  });

  await t.step("should not merge ranges of different types", () => {
    const ranges: Range[] = [
      {
        changeType: "added",
        matchText: "hello",
        lnum: 1,
        col: { start: 0, end: 5 },
        lineText: "hello world",
      },
      {
        changeType: "removed",
        matchText: "world",
        lnum: 1,
        col: { start: 6, end: 11 },
        lineText: "hello world",
      },
    ];

    const result = applyHeuristicStrategy(ranges, {
      enabled: true,
      strategies: {
        tiny: DisplayStrategy.Line,
        small: DisplayStrategy.Line,
        medium: DisplayStrategy.Line,
        large: DisplayStrategy.Line,
      },
    });

    // Should not merge because they have different changeTypes
    assertEquals(result.length, 2);
  });
});
