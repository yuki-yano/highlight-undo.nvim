import type { Range } from "./range-computer.ts";

export const ChangeSize = {
  Tiny: "tiny", // 1-5 characters
  Small: "small", // 5-20 characters
  Medium: "medium", // 20-100 characters
  Large: "large", // 100+ characters
} as const;

export type ChangeSize = typeof ChangeSize[keyof typeof ChangeSize];

export const DisplayStrategy = {
  Character: "character", // Display in detail by character
  Word: "word", // Display by word
  Line: "line", // Display by line
  Block: "block", // Display multiple lines as a block
} as const;

export type DisplayStrategy = typeof DisplayStrategy[keyof typeof DisplayStrategy];

export type HeuristicConfig = {
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
};

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
 * Evaluate the size of changes
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
 * Select display strategy based on size
 */
export function selectDisplayStrategy(
  size: ChangeSize,
  strategies: Partial<Record<ChangeSize, DisplayStrategy>> = DEFAULT_STRATEGIES,
): DisplayStrategy {
  return strategies[size] ?? DEFAULT_STRATEGIES[size];
}

/**
 * Group consecutive changes on the same line
 */
function _groupConsecutiveRanges(ranges: ReadonlyArray<Range>): Range[][] {
  if (ranges.length === 0) return [];

  const groups: Range[][] = [];
  let currentGroup: Range[] = [ranges[0]];

  for (let i = 1; i < ranges.length; i++) {
    const prev = ranges[i - 1];
    const curr = ranges[i];

    // Group if on the same line, same type, and adjacent or close
    if (
      prev.lnum === curr.lnum &&
      prev.changeType === curr.changeType &&
      curr.col.start - prev.col.end <= 5
    ) { // Within 5 characters distance
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
 * Adjust ranges based on strategy
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
      // Character unit: return as is
      return ranges;

    case DisplayStrategy.Word:
      // Word unit: extend to word boundaries (uses existing adjustWordBoundaries)
      return ranges; // Processed by range-adjuster

    case DisplayStrategy.Line:
      // Line unit: merge changes on the same line
      return mergeRangesInSameLine(ranges);

    case DisplayStrategy.Block:
      // Block unit: merge changes on consecutive lines
      return mergeRangesInBlock(ranges);

    default:
      return ranges;
  }
}

/**
 * Merge changes on the same line
 */
function mergeRangesInSameLine(ranges: ReadonlyArray<Range>): ReadonlyArray<Range> {
  if (ranges.length === 0) return [];

  // Group by line number
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

    // Group ranges on the same line by change type
    const typeGroups = new Map<string, Range[]>();
    for (const range of group) {
      const typeGroup = typeGroups.get(range.changeType) || [];
      typeGroup.push(range);
      typeGroups.set(range.changeType, typeGroup);
    }

    // Merge each type group
    for (const [_, typeGroup] of typeGroups) {
      if (typeGroup.length === 1) {
        result.push(typeGroup[0]);
        continue;
      }

      // Sort ranges
      const sorted = [...typeGroup].sort((a, b) => a.col.start - b.col.start);
      const first = sorted[0];
      // const last = sorted[sorted.length - 1]; // Not used currently

      // Highlight entire line (because it's Line strategy)
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
 * Merge changes on consecutive lines as blocks
 */
function mergeRangesInBlock(ranges: ReadonlyArray<Range>): ReadonlyArray<Range> {
  if (ranges.length === 0) return [];

  const result: Range[] = [];
  let currentBlock: Range[] = [ranges[0]];

  for (let i = 1; i < ranges.length; i++) {
    const prev = ranges[i - 1];
    const curr = ranges[i];

    // Block if adjacent lines with same type
    if (curr.lnum - prev.lnum <= 1 && prev.changeType === curr.changeType) {
      currentBlock.push(curr);
    } else {
      // Merge and add block
      if (currentBlock.length > 1) {
        result.push(...mergeBlockRanges(currentBlock));
      } else {
        result.push(currentBlock[0]);
      }
      currentBlock = [curr];
    }
  }

  // Process the last block
  if (currentBlock.length > 1) {
    result.push(...mergeBlockRanges(currentBlock));
  } else {
    result.push(currentBlock[0]);
  }

  return result;
}

/**
 * Merge ranges within a block
 */
function mergeBlockRanges(block: Range[]): Range[] {
  // Treat each line as a whole line change
  return block.map((range) => ({
    ...range,
    col: {
      start: 0,
      end: range.lineText.length,
    },
    matchText: range.lineText,
  }));
}
