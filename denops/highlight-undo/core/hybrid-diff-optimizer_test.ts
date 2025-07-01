import { assertEquals } from "../deps.ts";
import { calculateHybridDiff } from "./hybrid-diff-optimizer.ts";

Deno.test("calculateHybridDiff: should identify line-level changes", () => {
  const before = "line1\nline2\nline3";
  const after = "line1\nmodified line2\nline3";

  const result = calculateHybridDiff(before, after);

  // 4つの変更（1行目、削除された2行目、追加された2行目、3行目）
  assertEquals(result.lineChanges.length, 4);
  assertEquals(result.lineChanges[0].added, undefined);
  assertEquals(result.lineChanges[0].removed, undefined);
  assertEquals(result.lineChanges[0].value, "line1\n");

  // 2行目は削除と追加の2つの変更として記録される
  assertEquals(result.lineChanges[1].removed, true);
  assertEquals(result.lineChanges[1].value, "line2\n");
  assertEquals(result.lineChanges[2].added, true);
  assertEquals(result.lineChanges[2].value, "modified line2\n");
});

Deno.test("calculateHybridDiff: should calculate char-level diff for changed lines", () => {
  const before = "hello world";
  const after = "hello beautiful world";

  const result = calculateHybridDiff(before, after);

  // 1行の変更
  assertEquals(result.lineChanges.length, 2);

  // 行内の文字単位の変更が記録されている
  assertEquals(result.charChanges.size, 1);
  const charDiff = result.charChanges.get(0);
  assertEquals(charDiff?.length, 3); // "hello ", "beautiful ", "world"の3つの部分
});

Deno.test("calculateHybridDiff: should handle multi-line additions", () => {
  const before = "line1";
  const after = "line1\nline2\nline3";

  const result = calculateHybridDiff(before, after);

  // diffLinesは末尾改行なしの場合、全体を変更として扱う
  assertEquals(result.lineChanges.length, 2);
  assertEquals(result.lineChanges[0].value, "line1");
  assertEquals(result.lineChanges[0].removed, true);

  assertEquals(result.lineChanges[1].value, "line1\nline2\nline3");
  assertEquals(result.lineChanges[1].added, true);
});

Deno.test("calculateHybridDiff: should handle complete line deletions", () => {
  const before = "line1\nline2\nline3";
  const after = "line1\nline3";

  const result = calculateHybridDiff(before, after);

  // line2が削除されている
  const removedChange = result.lineChanges.find((c) => c.removed && c.value?.includes("line2"));
  assertEquals(removedChange?.value, "line2\n");
});

Deno.test("calculateHybridDiff: should handle empty strings", () => {
  const before = "";
  const after = "new content";

  const result = calculateHybridDiff(before, after);

  assertEquals(result.lineChanges.length, 1);
  assertEquals(result.lineChanges[0].added, true);
  assertEquals(result.lineChanges[0].value, "new content");
});

Deno.test("calculateHybridDiff: should not calculate char diff for unchanged lines", () => {
  const before = "unchanged\nchanged line\nunchanged";
  const after = "unchanged\nmodified line\nunchanged";

  const result = calculateHybridDiff(before, after);

  // 変更された行のみchar diffが計算される
  assertEquals(result.charChanges.size, 1);
  assertEquals(result.charChanges.has(1), true); // 2行目（index 1）のみ
});
