import type { HybridDiffResult } from "./hybrid-diff-optimizer.ts";
import type { Range } from "./range-computer.ts";

/**
 * ハイブリッドdiff結果から範囲を計算
 */
export function computeHybridRanges(
  hybridDiff: HybridDiffResult,
  beforeLines: string[],
  afterLines: string[],
): Range[] {
  const ranges: Range[] = [];
  let currentBeforeLine = 0;
  let currentAfterLine = 0;

  for (const change of hybridDiff.lineChanges) {
    if (!change.added && !change.removed) {
      // 変更なしの行はスキップし、行番号を進める
      const lineCount = change.value?.split("\n").filter((l) => l).length || 1;
      currentBeforeLine += lineCount;
      currentAfterLine += lineCount;
      continue;
    }

    if (change.removed) {
      // 削除された行
      const removedLines = change.value?.split("\n").filter((l) => l) || [];

      // 各行についてcharChangesを確認
      removedLines.forEach((line, idx) => {
        const lineIdx = (change.lineIndex || currentBeforeLine) + idx;
        const charDiff = hybridDiff.charChanges.get(lineIdx);

        if (charDiff) {
          // 文字単位の差分から範囲を作成
          let charPos = 0;
          for (const charChange of charDiff) {
            if (charChange.removed) {
              ranges.push({
                changeType: "removed",
                matchText: charChange.value || "",
                lnum: lineIdx + 1, // 1-based
                col: {
                  start: charPos,
                  end: charPos + (charChange.value?.length || 0),
                },
                lineText: beforeLines[lineIdx] || "",
              });
            }
            charPos += charChange.value?.length || 0;
          }
        } else {
          // 行全体が削除された場合
          ranges.push({
            changeType: "removed",
            matchText: line,
            lnum: lineIdx + 1, // 1-based
            col: {
              start: 0,
              end: line.length,
            },
            lineText: line,
          });
        }
      });

      currentBeforeLine += removedLines.length;
    }

    if (change.added) {
      // 追加された行
      const addedLines = change.value?.split("\n").filter((l) => l) || [];

      // 各行についてcharChangesを確認
      addedLines.forEach((line, idx) => {
        const lineIdx = (change.lineIndex || currentAfterLine) + idx;
        const charDiff = hybridDiff.charChanges.get(lineIdx);

        if (charDiff) {
          // 文字単位の差分から範囲を作成
          let charPos = 0;
          for (const charChange of charDiff) {
            if (charChange.added) {
              ranges.push({
                changeType: "added",
                matchText: charChange.value || "",
                lnum: lineIdx + 1, // 1-based
                col: {
                  start: charPos,
                  end: charPos + (charChange.value?.length || 0),
                },
                lineText: afterLines[lineIdx] || "",
              });
            }
            charPos += charChange.value?.length || 0;
          }
        } else {
          // 行全体が追加された場合
          ranges.push({
            changeType: "added",
            matchText: line,
            lnum: lineIdx + 1, // 1-based
            col: {
              start: 0,
              end: line.length,
            },
            lineText: line,
          });
        }
      });

      currentAfterLine += addedLines.length;
    }
  }

  return ranges;
}
