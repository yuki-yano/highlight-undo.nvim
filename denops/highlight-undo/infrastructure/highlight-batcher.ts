// Batch highlight operations for better performance

import type { Denops } from "../deps.ts";
import type { Range } from "../core/utils.ts";

export class HighlightBatcher {
  async applyHighlights(
    denops: Denops,
    ranges: ReadonlyArray<Range>,
    nameSpace: number,
    highlightGroup: string,
  ): Promise<void> {
    if (ranges.length === 0) {
      return;
    }

    // Group ranges by line for more efficient processing
    const rangesByLine = new Map<number, Range[]>();
    for (const range of ranges) {
      const existing = rangesByLine.get(range.lnum) || [];
      existing.push(range);
      rangesByLine.set(range.lnum, existing);
    }

    // Convert ranges to Lua-friendly format
    const luaRanges = [];
    for (const [_lnum, lineRanges] of rangesByLine) {
      for (const range of lineRanges) {
        luaRanges.push({
          lnum: range.lnum,
          col_start: range.col.start,
          col_end: range.col.end,
        });
      }
    }
    

    // Call Lua function to apply highlights
    try {
      await denops.call(
        "luaeval",
        `require('highlight-undo')._apply_highlights(_A[1], _A[2], _A[3])`,
        [nameSpace, highlightGroup, luaRanges],
      );
    } catch (error) {
      console.error(`[highlight-undo] Failed to call Lua function:`, error);
      throw error;
    }
  }

  async clearHighlights(
    denops: Denops,
    nameSpace: number,
    bufnr: number = 0,
  ): Promise<void> {
    
    try {
      await denops.call(
        "luaeval",
        `require('highlight-undo')._clear_highlights(_A[1], _A[2])`,
        [nameSpace, bufnr],
      );
    } catch (error) {
      console.error(`[highlight-undo] Failed to clear highlights:`, error);
      throw error;
    }
  }

  // Optimized method for large number of highlights
  async applyHighlightsBulk(
    denops: Denops,
    addedRanges: ReadonlyArray<Range>,
    removedRanges: ReadonlyArray<Range>,
    nameSpace: number,
    config: { added: string; removed: string },
  ): Promise<void> {
    // Convert ranges to Lua-friendly format
    const convertRanges = (ranges: ReadonlyArray<Range>) =>
      ranges.map((range) => ({
        row: range.lnum - 1,
        col_start: Math.max(0, range.col.start - 1),
        col_end: range.col.end,
      }));

    try {
      await denops.call(
        "luaeval",
        `require('highlight-undo')._apply_highlights_bulk(_A[1], _A[2], _A[3], _A[4], _A[5])`,
        [
          nameSpace,
          config.added,
          config.removed,
          convertRanges(addedRanges),
          convertRanges(removedRanges),
        ],
      );
    } catch (error) {
      console.error(`[highlight-undo] Failed to apply bulk highlights:`, error);
      throw error;
    }
  }
}
