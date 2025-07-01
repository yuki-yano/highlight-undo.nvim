import { getByteLength } from "./encoding.ts";
import type { Range } from "./range-computer.ts";

/**
 * Converts ranges with character positions to byte positions for Vim compatibility
 * @param ranges Array of ranges to convert
 * @returns Array of ranges with byte positions
 */
export function convertRangesWithEncoding(
  ranges: ReadonlyArray<Range>,
): ReadonlyArray<Range> {
  return ranges.map((range) => {
    if (range.changeType === "removed" && !range.lineText) {
      return {
        ...range,
        col: {
          start: 0,
          end: 0,
        },
      };
    }

    const beforeText = range.lineText.substring(0, range.col.start);
    const matchText = range.lineText.substring(range.col.start, range.col.end);

    const byteStart = getByteLength(beforeText);
    const byteEnd = byteStart + getByteLength(matchText);

    return {
      ...range,
      col: {
        start: byteStart,
        end: byteEnd,
      },
    };
  });
}
