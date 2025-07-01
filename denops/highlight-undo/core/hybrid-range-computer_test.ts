import { assertEquals } from "../deps.ts";
import { computeHybridRanges } from "./hybrid-range-computer.ts";
import type { HybridDiffResult } from "./hybrid-diff-optimizer.ts";

Deno.test("computeHybridRanges: should convert line changes to ranges", () => {
  const hybridDiff: HybridDiffResult = {
    lineChanges: [
      { value: "line1\n", added: undefined, removed: undefined, lineIndex: 0 },
      { value: "line2\n", added: undefined, removed: true, lineIndex: 1 },
      { value: "modified line2\n", added: true, removed: undefined, lineIndex: 1 },
      { value: "line3", added: undefined, removed: undefined, lineIndex: 2 },
    ],
    charChanges: new Map(),
  };

  const beforeLines = ["line1", "line2", "line3"];
  const afterLines = ["line1", "modified line2", "line3"];

  const ranges = computeHybridRanges(hybridDiff, beforeLines, afterLines);

  assertEquals(ranges.length, 2);

  // 削除された行
  assertEquals(ranges[0].changeType, "removed");
  assertEquals(ranges[0].matchText, "line2");
  assertEquals(ranges[0].lnum, 2);
  assertEquals(ranges[0].col.start, 0);
  assertEquals(ranges[0].col.end, 5);

  // 追加された行
  assertEquals(ranges[1].changeType, "added");
  assertEquals(ranges[1].matchText, "modified line2");
  assertEquals(ranges[1].lnum, 2);
  assertEquals(ranges[1].col.start, 0);
  assertEquals(ranges[1].col.end, 14);
});

Deno.test("computeHybridRanges: should handle char-level changes within lines", () => {
  const charDiff = [
    { value: "hello ", added: undefined, removed: undefined },
    { value: "beautiful ", added: true, removed: undefined },
    { value: "world", added: undefined, removed: undefined },
  ];

  const hybridDiff: HybridDiffResult = {
    lineChanges: [
      { value: "hello world", added: undefined, removed: true, lineIndex: 0 },
      { value: "hello beautiful world", added: true, removed: undefined, lineIndex: 0 },
    ],
    charChanges: new Map([[0, charDiff]]),
  };

  const beforeLines = ["hello world"];
  const afterLines = ["hello beautiful world"];

  const ranges = computeHybridRanges(hybridDiff, beforeLines, afterLines);

  assertEquals(ranges.length, 1);
  assertEquals(ranges[0].changeType, "added");
  assertEquals(ranges[0].matchText, "beautiful ");
  assertEquals(ranges[0].lnum, 1);
  assertEquals(ranges[0].col.start, 6);
  assertEquals(ranges[0].col.end, 16);
});

Deno.test("computeHybridRanges: should handle multiple line additions", () => {
  const hybridDiff: HybridDiffResult = {
    lineChanges: [
      { value: "line1\n", added: undefined, removed: undefined, lineIndex: 0 },
      { value: "line2\nline3", added: true, removed: undefined, lineIndex: 1 },
    ],
    charChanges: new Map(),
  };

  const beforeLines = ["line1"];
  const afterLines = ["line1", "line2", "line3"];

  const ranges = computeHybridRanges(hybridDiff, beforeLines, afterLines);

  assertEquals(ranges.length, 2);

  assertEquals(ranges[0].changeType, "added");
  assertEquals(ranges[0].matchText, "line2");
  assertEquals(ranges[0].lnum, 2);

  assertEquals(ranges[1].changeType, "added");
  assertEquals(ranges[1].matchText, "line3");
  assertEquals(ranges[1].lnum, 3);
});

Deno.test("computeHybridRanges: should skip unchanged lines", () => {
  const hybridDiff: HybridDiffResult = {
    lineChanges: [
      { value: "unchanged1\n", added: undefined, removed: undefined, lineIndex: 0 },
      { value: "changed\n", added: undefined, removed: true, lineIndex: 1 },
      { value: "modified\n", added: true, removed: undefined, lineIndex: 1 },
      { value: "unchanged2", added: undefined, removed: undefined, lineIndex: 2 },
    ],
    charChanges: new Map(),
  };

  const beforeLines = ["unchanged1", "changed", "unchanged2"];
  const afterLines = ["unchanged1", "modified", "unchanged2"];

  const ranges = computeHybridRanges(hybridDiff, beforeLines, afterLines);

  // 変更された行のみ
  assertEquals(ranges.length, 2);

  const hasUnchanged = ranges.some((r) => r.matchText.includes("unchanged1") || r.matchText.includes("unchanged2"));
  assertEquals(hasUnchanged, false);
});
