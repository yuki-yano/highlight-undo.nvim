import type { Diff } from "../deps.ts";

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

// Helper functions
function getLineNumber(code: string, index: number): number {
  return code.substring(0, index).split("\n").length;
}

function getStartPositionInLine(code: string, index: number): number {
  return code.substring(0, index).lastIndexOf("\n");
}

function getFirstLineStartColumn(codeIndex: number, startPosInCurrentLine: number): number {
  return startPosInCurrentLine === -1 ? codeIndex : codeIndex - startPosInCurrentLine - 1;
}

function getColumnPosition(codeIndex: number, startPosInCurrentLine: number): number {
  return startPosInCurrentLine === -1 ? codeIndex : codeIndex - startPosInCurrentLine - 1;
}

function createRange({
  lnum,
  lineText,
  text,
  isFirstLine,
  firstLineStartCol,
  changeType,
}: {
  lnum: number;
  lineText: string;
  text: string;
  isFirstLine: boolean;
  firstLineStartCol: number;
  changeType: ChangeType;
}): Range | null {
  if (text === "") {
    return null;
  }

  const col = isFirstLine
    ? { start: firstLineStartCol, end: firstLineStartCol + text.length }
    : { start: 0, end: text.length };

  return {
    lnum,
    lineText,
    col,
    matchText: text,
    changeType,
  };
}

function processMultiLineChange(
  change: Diff.Change,
  targetCode: string,
  codeIndex: number,
  changeType: ChangeType,
): ReadonlyArray<Range> {
  const ranges: Range[] = [];
  let lnum = getLineNumber(targetCode, codeIndex);
  const startPosInCurrentLine = getStartPositionInLine(targetCode, codeIndex);
  const firstLineStartCol = getFirstLineStartColumn(codeIndex, startPosInCurrentLine);

  const splitLines = change.value.split("\n");
  let isFirstLine = true;

  for (let i = 0; i < splitLines.length; i++) {
    const text = splitLines[i];
    const lines = targetCode.split("\n");
    const currentLineText = lines[lnum - 1] || "";

    if (i === splitLines.length - 1 && text === "") {
      // Skip empty last line
      continue;
    }

    const range = createRange({
      lnum,
      lineText: currentLineText,
      text,
      isFirstLine,
      firstLineStartCol,
      changeType,
    });

    if (range) {
      ranges.push(range);
    }

    lnum++;
    isFirstLine = false;
  }

  return ranges;
}

function processSingleLineChange(
  change: Diff.Change,
  targetCode: string,
  codeIndex: number,
  changeType: ChangeType,
): ReadonlyArray<Range> {
  const lnum = getLineNumber(targetCode, codeIndex);
  const lines = targetCode.split("\n");
  const currentLineText = lines[lnum - 1] || "";
  const startPosInCurrentLine = getStartPositionInLine(targetCode, codeIndex);
  const col = getColumnPosition(codeIndex, startPosInCurrentLine);

  return [{
    lnum,
    lineText: currentLineText,
    col: {
      start: col,
      end: col + change.value.length,
    },
    matchText: change.value,
    changeType,
  }];
}

function processChange(
  change: Diff.Change,
  targetCode: string,
  codeIndex: number,
  changeType: ChangeType,
): ReadonlyArray<Range> {
  if (change.value.includes("\n")) {
    return processMultiLineChange(change, targetCode, codeIndex, changeType);
  } else {
    return processSingleLineChange(change, targetCode, codeIndex, changeType);
  }
}

export function computeRanges(params: {
  changes: Array<Diff.Change>;
  beforeCode: string;
  afterCode: string;
  changeType: ChangeType;
}): ReadonlyArray<Range> {
  const { changes, beforeCode, afterCode, changeType } = params;
  // Use beforeCode for removed changes, afterCode for added changes
  const targetCode = changeType === "removed" ? beforeCode : afterCode;
  let codeIndex = 0;
  let ranges: ReadonlyArray<Range> = [];

  for (const change of changes) {
    if (change[changeType]) {
      ranges = [...ranges, ...processChange(change, targetCode, codeIndex, changeType)];
    }

    // Update index based on change type
    if (changeType === "added") {
      // For added changes, only advance index for non-removed changes
      if (!change.removed) {
        codeIndex += change.value.length;
      }
    } else {
      // For removed changes, advance for all non-added changes
      if (!change.added) {
        codeIndex += change.value.length;
      }
    }
  }

  return ranges;
}
