// utility functions extracted from main.ts for better testability

import type { Diff } from "./deps.ts";

export type ChangeType = "added" | "removed";

export type Range = {
  lnum: number;
  lineText: string;
  col: {
    start: number;
    end: number;
  };
  matchText: string;
  changeType: ChangeType;
};

export function computeRanges({
  changes,
  afterCode,
  changeType,
}: {
  changes: Array<Diff.Change>;
  beforeCode: string;
  afterCode: string;
  changeType: ChangeType;
}): ReadonlyArray<Range> {
  let codeIndex = 0;
  let ranges: ReadonlyArray<Range> = [];

  for (const change of changes) {
    if (change[changeType]) {
      let lnum = afterCode.substring(0, codeIndex).split("\n").length;

      const currentPos = afterCode.substring(0, codeIndex).length;
      const startPosInCurrentLine = afterCode
        .substring(0, codeIndex)
        .lastIndexOf("\n");

      // If the change contains line breaks, split each line.
      if (change.value.includes("\n")) {
        // When lastIndexOf returns -1 (first line), this becomes codeIndex - (-1) = codeIndex + 1
        // We need to handle this case properly to get 0-based columns
        const firstLineStartCol = startPosInCurrentLine === -1 ? codeIndex : codeIndex - startPosInCurrentLine - 1;

        let isFirstLine = true;
        const splitLines = change.value.split("\n");
        for (let i = 0; i < splitLines.length; i++) {
          const text = splitLines[i];
          const lines = afterCode.split("\n");
          let currentLineText = "";

          if (changeType === "removed") {
            // For removed text, we need to handle the case where the line doesn't exist
            // For removed lines, use empty string or get the line that will be after removal
            if (lnum - 1 < lines.length) {
              currentLineText = lines[lnum - 1];
            } else if (lnum - 1 === lines.length && i === splitLines.length - 1) {
              // Last removed line might be at the end of file
              currentLineText = "";
            }
          } else {
            currentLineText = lines[lnum - 1] || "";
          }

          ranges = [
            ...ranges,
            {
              lnum,
              lineText: currentLineText,
              col: {
                start: isFirstLine ? firstLineStartCol : 0,
                end: isFirstLine ? text.length + firstLineStartCol : text.length,
              },
              matchText: text,
              changeType,
            },
          ];
          isFirstLine = false;
          lnum += 1;
        }
      } else {
        const currentLineText = afterCode.split("\n")[lnum - 1];
        // Same fix for single line changes
        const start = startPosInCurrentLine === -1 ? currentPos : currentPos - startPosInCurrentLine - 1;

        ranges = [
          ...ranges,
          {
            lnum,
            lineText: currentLineText || "",
            col: {
              start: start,
              end: start + change.value.length,
            },
            matchText: change.value,
            changeType,
          },
        ];
      }
    }

    codeIndex = codeIndex + change.count!;
  }

  return ranges;
}

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
