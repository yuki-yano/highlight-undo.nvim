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

export class RangeComputer {
  computeRanges({
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
        ranges = [...ranges, ...this.processChange(change, afterCode, codeIndex, changeType)];
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

  private processChange(
    change: Diff.Change,
    afterCode: string,
    codeIndex: number,
    changeType: ChangeType,
  ): ReadonlyArray<Range> {
    const ranges: Range[] = [];

    if (change.value.includes("\n")) {
      return this.processMultiLineChange(change, afterCode, codeIndex, changeType);
    } else {
      return this.processSingleLineChange(change, afterCode, codeIndex, changeType);
    }
  }

  private processMultiLineChange(
    change: Diff.Change,
    afterCode: string,
    codeIndex: number,
    changeType: ChangeType,
  ): ReadonlyArray<Range> {
    const ranges: Range[] = [];
    let lnum = this.getLineNumber(afterCode, codeIndex);
    const startPosInCurrentLine = this.getStartPositionInLine(afterCode, codeIndex);
    const firstLineStartCol = this.getFirstLineStartColumn(codeIndex, startPosInCurrentLine);

    const splitLines = change.value.split("\n");
    let isFirstLine = true;

    for (let i = 0; i < splitLines.length; i++) {
      const text = splitLines[i];
      const lines = afterCode.split("\n");
      const currentLineText = changeType === "removed" && !lines[lnum - 1] ? "" : lines[lnum - 1] || "";

      if (i === splitLines.length - 1 && text === "") {
        // Skip empty last line
        continue;
      }

      const range = this.createRange({
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

  private processSingleLineChange(
    change: Diff.Change,
    afterCode: string,
    codeIndex: number,
    changeType: ChangeType,
  ): ReadonlyArray<Range> {
    const lnum = this.getLineNumber(afterCode, codeIndex);
    const lines = afterCode.split("\n");
    const currentLineText = changeType === "removed" && !lines[lnum - 1] ? "" : lines[lnum - 1] || "";
    const startPosInCurrentLine = this.getStartPositionInLine(afterCode, codeIndex);
    const col = this.getColumnPosition(codeIndex, startPosInCurrentLine);

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

  private createRange({
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

  private getLineNumber(code: string, index: number): number {
    return code.substring(0, index).split("\n").length;
  }

  private getStartPositionInLine(code: string, index: number): number {
    return code.substring(0, index).lastIndexOf("\n");
  }

  private getFirstLineStartColumn(codeIndex: number, startPosInCurrentLine: number): number {
    return startPosInCurrentLine === -1 ? codeIndex : codeIndex - startPosInCurrentLine - 1;
  }

  private getColumnPosition(codeIndex: number, startPosInCurrentLine: number): number {
    return startPosInCurrentLine === -1 ? codeIndex : codeIndex - startPosInCurrentLine - 1;
  }
}

// Re-export for backward compatibility
export function computeRanges(params: {
  changes: Array<Diff.Change>;
  beforeCode: string;
  afterCode: string;
  changeType: ChangeType;
}): ReadonlyArray<Range> {
  const computer = new RangeComputer();
  return computer.computeRanges(params);
}
