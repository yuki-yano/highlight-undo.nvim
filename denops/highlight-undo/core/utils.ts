// utility functions extracted from main.ts for better testability

// Re-export from range-computer for backward compatibility
export { type ChangeType, computeRanges, type Range } from "./range-computer.ts";

// fillRangeGaps is still here as it's a separate concern
export function fillRangeGaps({
  ranges,
  aboveLine,
  belowLine,
}: {
  ranges: ReadonlyArray<import("./range-computer.ts").Range>;
  aboveLine: number;
  belowLine: number;
}): ReadonlyArray<import("./range-computer.ts").Range> {
  let filledRanges: ReadonlyArray<import("./range-computer.ts").Range> = [];
  for (const range of ranges) {
    if (
      range.lnum > aboveLine &&
      range.lnum < belowLine &&
      range.col.start === 0
    ) {
      filledRanges = [
        ...filledRanges,
        {
          ...range,
          col: {
            start: 0,
            end: range.lineText.length,
          },
        },
      ];
    } else if (
      range.lnum > aboveLine &&
      range.lnum < belowLine &&
      range.col.start !== 0
    ) {
      filledRanges = [...filledRanges, range];
    } else if (range.lnum === aboveLine || range.lnum === belowLine) {
      filledRanges = [...filledRanges, range];
    } else {
      continue;
    }
  }

  return filledRanges;
}
