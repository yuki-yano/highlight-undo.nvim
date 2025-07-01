import type { Range } from "./range-computer.ts";

export enum ChangeSize {
  Tiny = "tiny", // 1-5文字
  Small = "small", // 5-20文字
  Medium = "medium", // 20-100文字
  Large = "large", // 100文字以上
}

export enum DisplayStrategy {
  Character = "character", // 文字単位で詳細に表示
  Word = "word", // 単語単位で表示
  Line = "line", // 行単位で表示
  Block = "block", // 複数行をブロックとして表示
}

export interface HeuristicConfig {
  enabled?: boolean;
  thresholds?: {
    tiny?: number; // default: 5
    small?: number; // default: 20
    medium?: number; // default: 100
  };
  strategies?: {
    [ChangeSize.Tiny]?: DisplayStrategy; // default: Character
    [ChangeSize.Small]?: DisplayStrategy; // default: Word
    [ChangeSize.Medium]?: DisplayStrategy; // default: Line
    [ChangeSize.Large]?: DisplayStrategy; // default: Block
  };
}

const DEFAULT_THRESHOLDS = {
  tiny: 5,
  small: 20,
  medium: 100,
};

const DEFAULT_STRATEGIES = {
  [ChangeSize.Tiny]: DisplayStrategy.Character,
  [ChangeSize.Small]: DisplayStrategy.Word,
  [ChangeSize.Medium]: DisplayStrategy.Line,
  [ChangeSize.Large]: DisplayStrategy.Block,
};

/**
 * 変更のサイズを評価
 */
export function evaluateChangeSize(
  ranges: ReadonlyArray<Range>,
  thresholds: typeof DEFAULT_THRESHOLDS = DEFAULT_THRESHOLDS,
): ChangeSize {
  const totalChars = ranges.reduce((sum, range) => sum + range.matchText.length, 0);

  if (totalChars <= thresholds.tiny) {
    return ChangeSize.Tiny;
  } else if (totalChars <= thresholds.small) {
    return ChangeSize.Small;
  } else if (totalChars <= thresholds.medium) {
    return ChangeSize.Medium;
  }
  return ChangeSize.Large;
}

/**
 * サイズに応じた表示戦略を選択
 */
export function selectDisplayStrategy(
  size: ChangeSize,
  strategies: typeof DEFAULT_STRATEGIES = DEFAULT_STRATEGIES,
): DisplayStrategy {
  return strategies[size];
}

/**
 * 同じ行の連続する変更をグループ化
 */
function _groupConsecutiveRanges(ranges: ReadonlyArray<Range>): Range[][] {
  if (ranges.length === 0) return [];

  const groups: Range[][] = [];
  let currentGroup: Range[] = [ranges[0]];

  for (let i = 1; i < ranges.length; i++) {
    const prev = ranges[i - 1];
    const curr = ranges[i];

    // 同じ行で、同じタイプで、隣接または近い場合はグループ化
    if (
      prev.lnum === curr.lnum &&
      prev.changeType === curr.changeType &&
      curr.col.start - prev.col.end <= 5
    ) { // 5文字以内の距離
      currentGroup.push(curr);
    } else {
      groups.push(currentGroup);
      currentGroup = [curr];
    }
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
}

/**
 * 戦略に基づいて範囲を調整
 */
export function applyHeuristicStrategy(
  ranges: ReadonlyArray<Range>,
  config: HeuristicConfig = {},
): ReadonlyArray<Range> {
  if (config.enabled === false) {
    return ranges;
  }

  const thresholds = { ...DEFAULT_THRESHOLDS, ...config.thresholds };
  const strategies = { ...DEFAULT_STRATEGIES, ...config.strategies };

  const size = evaluateChangeSize(ranges, thresholds);
  const strategy = selectDisplayStrategy(size, strategies);

  switch (strategy) {
    case DisplayStrategy.Character:
      // 文字単位：そのまま返す
      return ranges;

    case DisplayStrategy.Word:
      // 単語単位：単語境界まで拡張（既存のadjustWordBoundariesを利用）
      return ranges; // range-adjusterで処理される

    case DisplayStrategy.Line:
      // 行単位：同じ行の変更をマージ
      return mergeRangesInSameLine(ranges);

    case DisplayStrategy.Block:
      // ブロック単位：連続する行の変更をマージ
      return mergeRangesInBlock(ranges);

    default:
      return ranges;
  }
}

/**
 * 同じ行の変更をマージ
 */
function mergeRangesInSameLine(ranges: ReadonlyArray<Range>): ReadonlyArray<Range> {
  if (ranges.length === 0) return [];

  // 行番号でグループ化
  const lineGroups = new Map<number, Range[]>();
  for (const range of ranges) {
    const group = lineGroups.get(range.lnum) || [];
    group.push(range);
    lineGroups.set(range.lnum, group);
  }

  const result: Range[] = [];
  for (const [_, group] of lineGroups) {
    if (group.length === 1) {
      result.push(group[0]);
      continue;
    }

    // 同じ行の範囲を変更タイプごとにグループ化
    const typeGroups = new Map<string, Range[]>();
    for (const range of group) {
      const typeGroup = typeGroups.get(range.changeType) || [];
      typeGroup.push(range);
      typeGroups.set(range.changeType, typeGroup);
    }

    // 各タイプグループをマージ
    for (const [_, typeGroup] of typeGroups) {
      if (typeGroup.length === 1) {
        result.push(typeGroup[0]);
        continue;
      }

      // 範囲をソート
      const sorted = [...typeGroup].sort((a, b) => a.col.start - b.col.start);
      const first = sorted[0];
      // const last = sorted[sorted.length - 1]; // Not used currently

      // 行全体をハイライト（Line戦略なので）
      result.push({
        ...first,
        col: {
          start: Math.min(...sorted.map((r) => r.col.start)),
          end: Math.max(...sorted.map((r) => r.col.end)),
        },
        matchText: first.lineText.substring(
          Math.min(...sorted.map((r) => r.col.start)),
          Math.max(...sorted.map((r) => r.col.end)),
        ),
      });
    }
  }

  return result;
}

/**
 * 連続する行の変更をブロックとしてマージ
 */
function mergeRangesInBlock(ranges: ReadonlyArray<Range>): ReadonlyArray<Range> {
  if (ranges.length === 0) return [];

  const result: Range[] = [];
  let currentBlock: Range[] = [ranges[0]];

  for (let i = 1; i < ranges.length; i++) {
    const prev = ranges[i - 1];
    const curr = ranges[i];

    // 隣接する行で同じタイプの場合はブロック化
    if (curr.lnum - prev.lnum <= 1 && prev.changeType === curr.changeType) {
      currentBlock.push(curr);
    } else {
      // ブロックをマージして追加
      if (currentBlock.length > 1) {
        result.push(...mergeBlockRanges(currentBlock));
      } else {
        result.push(currentBlock[0]);
      }
      currentBlock = [curr];
    }
  }

  // 最後のブロックを処理
  if (currentBlock.length > 1) {
    result.push(...mergeBlockRanges(currentBlock));
  } else {
    result.push(currentBlock[0]);
  }

  return result;
}

/**
 * ブロック内の範囲をマージ
 */
function mergeBlockRanges(block: Range[]): Range[] {
  // 各行を行全体の変更として扱う
  return block.map((range) => ({
    ...range,
    col: {
      start: 0,
      end: range.lineText.length,
    },
    matchText: range.lineText,
  }));
}
