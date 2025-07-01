import type { Range } from "./range-computer.ts";

/**
 * Adjusts ranges that cross newline boundaries to be more intuitive
 * for human perception.
 */
export function adjustNewlineBoundaries(ranges: ReadonlyArray<Range>): ReadonlyArray<Range> {
  return ranges.map((range) => {
    const { matchText, lnum, col } = range;

    // Handle changes that end with a newline
    if (matchText.endsWith("\n")) {
      // For changes ending with newline, don't highlight the newline itself
      const adjustedText = matchText.slice(0, -1);

      // If the entire match was just a newline, skip it
      if (adjustedText === "") {
        return null;
      }

      return {
        ...range,
        matchText: adjustedText,
        col: {
          start: col.start,
          end: col.end - 1,
        },
      };
    }

    // Handle changes that start with a newline
    if (matchText.startsWith("\n") && lnum > 1) {
      const adjustedText = matchText.slice(1);

      // If the entire match was just a newline, treat it as end of previous line
      if (adjustedText === "") {
        // Return a marker at the end of the previous line
        return {
          ...range,
          lnum: lnum - 1,
          matchText: "",
          col: {
            start: Number.MAX_SAFE_INTEGER, // Will be adjusted by the caller
            end: Number.MAX_SAFE_INTEGER,
          },
          // Mark this as a special case for end-of-line
          isEndOfLine: true,
        } as Range & { isEndOfLine: boolean };
      }

      // Move to the next line without the newline
      return {
        ...range,
        matchText: adjustedText,
        col: {
          start: 0,
          end: adjustedText.length,
        },
      };
    }

    return range;
  }).filter((range): range is Range => range !== null);
}

/**
 * Adjusts word boundaries to make highlights more natural
 */
export function adjustWordBoundaries(ranges: ReadonlyArray<Range>): ReadonlyArray<Range> {
  return ranges.map((range) => {
    const { lineText, col, matchText } = range;

    // Don't adjust if the match is already at word boundaries
    // Check if the match starts and ends at word boundaries
    const startsAtBoundary = col.start === 0 || /\W/.test(lineText[col.start - 1]);
    const endsAtBoundary = col.end === lineText.length || /\W/.test(lineText[col.end]);

    if (startsAtBoundary && endsAtBoundary) {
      return range;
    }

    // Don't adjust very small changes (1-2 characters)
    if (matchText.length <= 2) {
      return range;
    }

    let startAdjust = 0;
    let endAdjust = 0;

    // Look backward for word boundary
    for (let i = col.start - 1; i >= 0; i--) {
      const char = lineText[i];
      // Check if we hit a word boundary
      if (i === 0 || /\W/.test(char)) {
        startAdjust = col.start - i;
        if (i > 0) startAdjust--; // Don't include the boundary character
        break;
      }
    }

    // Look forward for word boundary
    for (let i = col.end; i < lineText.length; i++) {
      const char = lineText[i];
      // Check if we hit a word boundary
      if (/\W/.test(char)) {
        endAdjust = i - col.end;
        break;
      }
    }

    // If we didn't find a boundary going forward, extend to end of line
    if (endAdjust === 0 && col.end < lineText.length) {
      endAdjust = lineText.length - col.end;
    }

    // Apply adjustments
    const newStart = Math.max(0, col.start - startAdjust);
    const newEnd = Math.min(lineText.length, col.end + endAdjust);
    const newMatchText = lineText.substring(newStart, newEnd);

    return {
      ...range,
      col: {
        start: newStart,
        end: newEnd,
      },
      matchText: newMatchText,
    };
  });
}

/**
 * Handles whitespace changes more intelligently
 */
export function handleWhitespaceChanges(ranges: ReadonlyArray<Range>): ReadonlyArray<Range> {
  return ranges.map((range) => {
    const { matchText, col, lineText } = range;

    // Check if this is a whitespace-only change
    if (!/^\s*$/.test(matchText)) {
      return range;
    }

    // Indentation change at the beginning of the line
    if (col.start === 0) {
      // Find where the actual content starts
      const contentStart = lineText.search(/\S/);
      if (contentStart > 0) {
        // Highlight from start to where content begins
        return {
          ...range,
          col: {
            start: 0,
            end: contentStart,
          },
          matchText: lineText.substring(0, contentStart),
        };
      }
    }

    // Trailing whitespace at the end of the line
    if (col.end === lineText.length || lineText.substring(col.end).match(/^\s*$/)) {
      // Find where the actual content ends
      const contentEnd = lineText.search(/\s*$/);
      if (contentEnd >= 0 && contentEnd < col.end) {
        return {
          ...range,
          col: {
            start: contentEnd,
            end: lineText.length,
          },
          matchText: lineText.substring(contentEnd),
        };
      }
    }

    return range;
  });
}

/**
 * Merges overlapping ranges to avoid duplicate highlights
 */
export function mergeOverlappingRanges(ranges: ReadonlyArray<Range>): ReadonlyArray<Range> {
  if (ranges.length <= 1) {
    return ranges;
  }

  // Sort ranges by line number and start column
  const sorted = [...ranges].sort((a, b) => {
    if (a.lnum !== b.lnum) {
      return a.lnum - b.lnum;
    }
    return a.col.start - b.col.start;
  });

  const merged: Range[] = [];
  let current = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];

    // Check if ranges overlap or are adjacent
    if (
      current.lnum === next.lnum &&
      current.changeType === next.changeType &&
      current.col.end >= next.col.start
    ) {
      // Merge the ranges
      const newEnd = Math.max(current.col.end, next.col.end);
      const newMatchText = current.lineText.substring(current.col.start, newEnd);

      current = {
        ...current,
        col: {
          start: current.col.start,
          end: newEnd,
        },
        matchText: newMatchText,
      };
    } else {
      // No overlap, add current to merged and move to next
      merged.push(current);
      current = next;
    }
  }

  // Don't forget the last range
  merged.push(current);

  return merged;
}
