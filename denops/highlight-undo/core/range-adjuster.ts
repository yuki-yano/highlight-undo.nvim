import type { ChangeType, Range } from "./range-computer.ts";

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
 * Word boundary patterns for different contexts
 */
const WORD_BOUNDARY_PATTERNS = {
  // Standard word characters (alphanumeric + underscore)
  wordChar: /[a-zA-Z0-9_]/,

  // CJK characters (Chinese, Japanese, Korean)
  cjk: /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/,

  // Punctuation and symbols
  punctuation: /[.,;:!?'"()\[\]{}<>]/,

  // Operators and special programming characters
  operators: /[+\-*/%=<>&|^~]/,

  // Whitespace
  whitespace: /\s/,
};

/**
 * Detects if a position is a word boundary considering various naming conventions
 */
function isWordBoundary(text: string, pos: number, direction: "left" | "right"): boolean {
  if (pos < 0 || pos >= text.length) return true;

  const char = text[pos];
  const adjacentPos = direction === "left" ? pos + 1 : pos - 1;
  const adjacentChar = adjacentPos >= 0 && adjacentPos < text.length ? text[adjacentPos] : "";

  // Whitespace or punctuation is always a boundary
  if (
    WORD_BOUNDARY_PATTERNS.whitespace.test(char) ||
    WORD_BOUNDARY_PATTERNS.punctuation.test(char) ||
    WORD_BOUNDARY_PATTERNS.operators.test(char)
  ) {
    return true;
  }

  // CJK characters are treated as individual words
  if (WORD_BOUNDARY_PATTERNS.cjk.test(char)) {
    return true;
  }

  // camelCase boundary detection
  if (adjacentChar && direction === "left") {
    // Lowercase to uppercase transition
    if (/[a-z]/.test(char) && /[A-Z]/.test(adjacentChar)) {
      return true;
    }
    // Number to letter transition
    if (/\d/.test(char) && /[a-zA-Z]/.test(adjacentChar)) {
      return true;
    }
    if (/[a-zA-Z]/.test(char) && /\d/.test(adjacentChar)) {
      return true;
    }
  }

  // Check for underscore or hyphen as word separators
  if (char === "_" || char === "-") {
    // But don't treat consecutive underscores/hyphens as multiple boundaries
    if (adjacentChar !== "_" && adjacentChar !== "-") {
      return true;
    }
  }

  return false;
}

/**
 * Finds the nearest word boundary in the specified direction
 */
function findWordBoundary(text: string, start: number, direction: "backward" | "forward"): number {
  if (direction === "backward") {
    // Special case: if we're at a camelCase boundary, include the current word
    if (start > 0 && start < text.length) {
      const currentChar = text[start];
      const prevChar = text[start - 1];

      // Check if we're at the start of a camelCase word
      if (/[A-Z]/.test(currentChar) && /[a-z]/.test(prevChar)) {
        // We're at "userId" -> "Id", should expand backward to include "By"
        // Continue searching from one position back
        for (let i = start - 2; i >= 0; i--) {
          const char = text[i];
          const prevChar = i > 0 ? text[i - 1] : "";

          // Stop at whitespace, punctuation, operators
          if (
            WORD_BOUNDARY_PATTERNS.whitespace.test(char) ||
            WORD_BOUNDARY_PATTERNS.punctuation.test(char) ||
            WORD_BOUNDARY_PATTERNS.operators.test(char)
          ) {
            return i + 1;
          }

          // Stop at camelCase boundary
          if (/[A-Z]/.test(char) && prevChar && /[a-z]/.test(prevChar)) {
            return i;
          }

          // Stop at underscore/hyphen
          if (char === "_" || char === "-") {
            return i + 1;
          }
        }
        return 0;
      }
    }

    // Normal backward search
    for (let i = start - 1; i >= 0; i--) {
      const char = text[i];
      const nextChar = i + 1 < text.length ? text[i + 1] : "";
      const prevChar = i > 0 ? text[i - 1] : "";

      // Check for various boundary types
      if (
        WORD_BOUNDARY_PATTERNS.whitespace.test(char) ||
        WORD_BOUNDARY_PATTERNS.punctuation.test(char) ||
        WORD_BOUNDARY_PATTERNS.operators.test(char)
      ) {
        return i + 1;
      }

      // CJK boundary
      if (WORD_BOUNDARY_PATTERNS.cjk.test(char)) {
        // Check if transitioning from/to non-CJK
        if (nextChar && !WORD_BOUNDARY_PATTERNS.cjk.test(nextChar)) {
          return i + 1;
        }
      } else if (nextChar && WORD_BOUNDARY_PATTERNS.cjk.test(nextChar)) {
        // Transitioning to CJK
        return i + 1;
      }

      // camelCase boundary
      if (/[A-Z]/.test(char) && prevChar && /[a-z]/.test(prevChar)) {
        return i;
      }

      // Number boundary
      if (nextChar) {
        if (/\d/.test(char) && /[a-zA-Z]/.test(nextChar)) {
          return i + 1;
        }
        if (/[a-zA-Z]/.test(char) && /\d/.test(nextChar)) {
          return i + 1;
        }
      }

      // Underscore/hyphen boundary
      if (char === "_" || char === "-") {
        return i + 1;
      }
    }
    return 0;
  } else {
    // Forward direction
    for (let i = start; i < text.length; i++) {
      const char = text[i];
      const prevChar = i > 0 ? text[i - 1] : "";

      // Check for various boundary types
      if (
        WORD_BOUNDARY_PATTERNS.whitespace.test(char) ||
        WORD_BOUNDARY_PATTERNS.punctuation.test(char) ||
        WORD_BOUNDARY_PATTERNS.operators.test(char)
      ) {
        return i;
      }

      // CJK boundary - only stop at CJK if we're transitioning from non-CJK
      if (!prevChar || !WORD_BOUNDARY_PATTERNS.cjk.test(prevChar)) {
        if (WORD_BOUNDARY_PATTERNS.cjk.test(char)) {
          return i;
        }
      }

      // camelCase boundary
      if (/[A-Z]/.test(char) && prevChar && /[a-z]/.test(prevChar)) {
        return i;
      }

      // Number boundary
      if (prevChar) {
        if (/\d/.test(char) && /[a-zA-Z]/.test(prevChar)) {
          return i;
        }
        if (/[a-zA-Z]/.test(char) && /\d/.test(prevChar)) {
          return i;
        }
      }

      // Underscore/hyphen boundary
      if (char === "_" || char === "-") {
        return i;
      }
    }
    return text.length;
  }
}

/**
 * Adjusts word boundaries to make highlights more natural
 */
export function adjustWordBoundaries(ranges: ReadonlyArray<Range>): ReadonlyArray<Range> {
  return ranges.map((range) => {
    const { lineText, col, matchText } = range;

    // Don't adjust single character changes
    if (matchText.length <= 1) {
      return range;
    }

    // Check if already at natural boundaries
    const startBoundary = col.start === 0 || isWordBoundary(lineText, col.start - 1, "left");
    const endBoundary = col.end === lineText.length || isWordBoundary(lineText, col.end, "right");

    if (startBoundary && endBoundary) {
      return range;
    }

    // Find the nearest word boundaries
    let newStart = startBoundary ? col.start : findWordBoundary(lineText, col.start, "backward");
    let newEnd = endBoundary ? col.end : findWordBoundary(lineText, col.end, "forward");

    // Special case: if we selected part of a camelCase word that starts with uppercase
    // (e.g., "Id" from "ById"), we should include the preceding lowercase part
    if (col.start > 0 && /[A-Z]/.test(lineText[col.start])) {
      // Check if this is part of a camelCase word
      let checkPos = col.start - 1;
      while (checkPos >= 0 && /[a-z]/.test(lineText[checkPos])) {
        checkPos--;
      }
      // If we found lowercase letters before the uppercase, expand to include them
      if (checkPos < col.start - 1) {
        // Find the actual word boundary
        newStart = findWordBoundary(lineText, checkPos + 1, "backward");
      }
    }

    // Special case: if we selected CJK characters, check for adjacent CJK characters
    if (lineText.substring(col.start, col.end).match(WORD_BOUNDARY_PATTERNS.cjk)) {
      // Look backward for more CJK characters from the current start
      let checkStart = newStart;
      while (checkStart > 0 && WORD_BOUNDARY_PATTERNS.cjk.test(lineText[checkStart - 1])) {
        checkStart--;
      }
      newStart = checkStart;

      // Look forward for the end of non-CJK word if we're transitioning
      if (col.end < lineText.length && !WORD_BOUNDARY_PATTERNS.cjk.test(lineText[col.end])) {
        // We're transitioning from CJK to non-CJK, find the end of the word
        let checkEnd = col.end;
        while (
          checkEnd < lineText.length &&
          WORD_BOUNDARY_PATTERNS.wordChar.test(lineText[checkEnd])
        ) {
          checkEnd++;
        }
        newEnd = checkEnd;
      }
    }

    // Don't expand if it would make the selection too large
    // (more than 5x the original size, increased from 3x for better flexibility)
    if ((newEnd - newStart) > matchText.length * 5) {
      return range;
    }

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

/**
 * Helper function to detect and adjust full line changes
 */
function detectAndAdjustFullLineChange(
  ranges: ReadonlyArray<Range>,
  targetChangeType: ChangeType,
): ReadonlyArray<Range> {
  return ranges.map((range) => {
    // Only process ranges of the target change type
    if (range.changeType !== targetChangeType) {
      return range;
    }

    const { lineText, col } = range;

    // Check if the change extends to the end of the line
    const isEndOfLine = col.end === lineText.length;

    // Check if the change starts from a non-zero column but covers the rest of the line
    const startsAfterIndent = col.start > 0 && isEndOfLine;

    // Check if the text before the change is only whitespace
    const textBefore = lineText.substring(0, col.start);
    const isOnlyWhitespaceBefore = /^\s*$/.test(textBefore);

    // If change extends to end of line and only whitespace before it,
    // this is likely a full line operation
    if (startsAfterIndent && isOnlyWhitespaceBefore) {
      return {
        ...range,
        col: {
          start: 0,
          end: lineText.length,
        },
        matchText: lineText,
      };
    }

    return range;
  });
}

/**
 * Detects and adjusts full line deletions to include leading spaces
 */
export function detectAndAdjustFullLineDeletion(
  ranges: ReadonlyArray<Range>,
): ReadonlyArray<Range> {
  return detectAndAdjustFullLineChange(ranges, "removed");
}

/**
 * Detects and adjusts full line additions to include leading spaces
 * (for undo operations that restore deleted lines)
 */
export function detectAndAdjustFullLineAddition(
  ranges: ReadonlyArray<Range>,
): ReadonlyArray<Range> {
  return detectAndAdjustFullLineChange(ranges, "added");
}
