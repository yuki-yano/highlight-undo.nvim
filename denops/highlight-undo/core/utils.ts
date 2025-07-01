// utility functions extracted from main.ts for better testability

import type { Range } from "./range-computer.ts";

// fillRangeGaps function for handling range gaps
export function fillRangeGaps({
  ranges,
  aboveLine,
  belowLine,
}: {
  ranges: ReadonlyArray<Range>;
  aboveLine: number;
  belowLine: number;
}): ReadonlyArray<Range> {
  let filledRanges: ReadonlyArray<Range> = [];
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
