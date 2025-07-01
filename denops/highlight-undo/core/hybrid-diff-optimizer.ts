import { Diff, diffChars, diffLines } from "../deps.ts";

export interface HybridDiffChange {
  value?: string;
  added?: boolean;
  removed?: boolean;
  lineIndex?: number;
}

export interface HybridDiffResult {
  lineChanges: HybridDiffChange[];
  charChanges: Map<number, Diff.Change[]>;
}

/**
 * 行単位と文字単位のdiffを組み合わせて計算
 */
export function calculateHybridDiff(
  before: string,
  after: string,
): HybridDiffResult {
  // 行単位でdiffを取る
  const lineChanges = diffLines(before, after) as HybridDiffChange[];
  const charChanges = new Map<number, Diff.Change[]>();

  // 各行にインデックスを付与
  let currentLineIndex = 0;

  for (const change of lineChanges) {
    if (!change.added && !change.removed) {
      // 変更なしの行
      change.lineIndex = currentLineIndex;
      currentLineIndex += (change.value?.split("\n").length || 1) - 1;
    } else if (change.removed && !change.added) {
      // 削除された行
      change.lineIndex = currentLineIndex;

      // 削除された行ごとに文字diffを計算
      const removedLines = change.value?.split("\n").filter((line: string) => line) || [];
      removedLines.forEach((line: string, i: number) => {
        const lineIdx = currentLineIndex + i;
        // 削除の場合、対応する行がafterにない可能性があるので、空文字列と比較
        const charDiff = diffChars(line, "");
        charChanges.set(lineIdx, charDiff);
      });
    } else if (change.added && !change.removed) {
      // 追加された行
      change.lineIndex = currentLineIndex;

      // 追加された行ごとに文字diffを計算
      const addedLines = change.value?.split("\n").filter((line: string) => line) || [];
      addedLines.forEach((line: string, i: number) => {
        const lineIdx = currentLineIndex + i;
        // 追加の場合、beforeに対応する行がないので、空文字列と比較
        const charDiff = diffChars("", line);
        charChanges.set(lineIdx, charDiff);
      });

      currentLineIndex += addedLines.length;
    }
  }

  // 同じ位置で変更された行の文字diffを計算
  for (let i = 0; i < lineChanges.length - 1; i++) {
    const current = lineChanges[i];
    const next = lineChanges[i + 1];

    if (current.removed && next.added) {
      // 削除と追加が隣接している場合、同じ行の変更として扱う
      const removedLines = current.value?.split("\n").filter((line) => line) || [];
      const addedLines = next.value?.split("\n").filter((line) => line) || [];

      const minLength = Math.min(removedLines.length, addedLines.length);
      for (let j = 0; j < minLength; j++) {
        const lineIdx = current.lineIndex || 0;
        const charDiff = diffChars(removedLines[j], addedLines[j]);
        charChanges.set(lineIdx + j, charDiff);
      }
    }
  }

  return {
    lineChanges,
    charChanges,
  };
}
