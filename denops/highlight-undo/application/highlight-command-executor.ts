import type { Denops } from "../deps.ts";
import type { Config } from "../config.ts";
import type { BufferStateManager } from "./buffer-state.ts";
import type { DiffOptimizer } from "../core/diff-optimizer.ts";
import type { HighlightBatcher } from "../infrastructure/highlight-batcher.ts";
import type { ErrorHandler } from "../error-handler.ts";
import { PerformanceMonitor } from "../performance.ts";
import { computeRanges, fillRangeGaps, type Range } from "../core/utils.ts";
import { fn } from "../deps.ts";

type Command = "undo" | "redo";

export interface HighlightCommandExecutorDeps {
  bufferStates: BufferStateManager;
  diffOptimizer: DiffOptimizer;
  highlightBatcher: HighlightBatcher;
  errorHandler: ErrorHandler;
  config: Config;
  nameSpace: number;
  debugMode: boolean;
}

export class HighlightCommandExecutor {
  constructor(private deps: HighlightCommandExecutorDeps) {}

  async execute(
    denops: Denops,
    command: string,
    bufnr: number,
  ): Promise<void> {
    
    if (!(await this.checkPreconditions(denops, command as Command))) {
      return;
    }

    const perf = this.deps.debugMode ? new PerformanceMonitor() : null;
    perf?.start();

    try {
      const state = await this.prepareState(bufnr);
      if (!state) {
        await this.executeWithoutHighlight(denops, command, bufnr);
        return;
      }

      const diffResult = await this.calculateDiff(state.preCode, state.postCode);
      if (!diffResult) {
        if (this.deps.debugMode) {
          console.log(`[highlight-undo] No diff result, executing command without highlight`);
        }
        await denops.cmd(command);
        return;
      }


      // For undo showing deletions: highlight first, then execute after duration
      // For redo showing additions: execute first, then highlight
      const isUndo = command === "undo";
      
      if (isUndo && diffResult.changes.some((c: any) => c.removed)) {
        // Show what will be removed, then remove it
        await this.applyHighlightsWithDelayedCommand(denops, diffResult, state, bufnr, command, perf);
      } else {
        // Execute command first, then show what was added
        await denops.cmd(command);
        await this.applyHighlights(denops, diffResult, state, bufnr, perf);
      }

      if (perf) {
        const metrics = perf.end();
        console.log(`[highlight-undo] Total: ${PerformanceMonitor.format(metrics)}`);
      }
    } catch (error) {
      await this.deps.errorHandler.handle(denops, error, {
        bufnr,
        command,
        phase: "executeHighlightCommand",
      });
    }
  }

  private async checkPreconditions(
    denops: Denops,
    command: Command,
  ): Promise<boolean> {
    const undoTree = (await fn.undotree(denops)) as {
      entries: Array<{ curhead?: number }>;
    };

    if (
      undoTree.entries.length === 0 ||
      (command === "redo" &&
        !undoTree.entries.some((entry) => entry.curhead != null)) ||
      (command === "undo" && undoTree.entries[0].curhead != null)
    ) {
      return false;
    }
    return true;
  }

  private async prepareState(
    bufnr: number,
  ): Promise<{ preCode: string; postCode: string } | null> {
    const state = this.deps.bufferStates.get(bufnr);

    if (!state) {
      if (this.deps.debugMode) {
        console.log(
          `[highlight-undo] No buffer state found for bufnr ${bufnr}, executing without highlight`,
        );
      }
      return null;
    }

    // Clear the buffer state after retrieving it
    this.deps.bufferStates.clear(bufnr);

    if (this.deps.debugMode) {
      console.log(`[highlight-undo] Retrieved buffer state for bufnr ${bufnr}`);
    }

    return state;
  }

  private async calculateDiff(
    preCode: string,
    postCode: string,
  ): Promise<{ changes: any[]; lineInfo: any } | null> {
    const result = this.deps.diffOptimizer.calculateDiff(
      preCode,
      postCode,
      this.deps.config.threshold,
    );
    
    
    return result;
  }

  private async applyHighlights(
    denops: Denops,
    diffResult: { changes: any[]; lineInfo: any },
    state: { preCode: string; postCode: string },
    bufnr: number,
    perf: PerformanceMonitor | null,
  ): Promise<void> {
    const { changes, lineInfo } = diffResult;
    const hasAdditions = changes.some((change) => change.added);
    const hasRemovals = changes.some((change) => change.removed);

    if (hasAdditions && this.deps.config.enabled.added) {
      await this.highlightAdditions(
        denops,
        changes,
        state.preCode,
        state.postCode,
        lineInfo,
        bufnr,
        perf,
      );
    }

    if (hasRemovals && this.deps.config.enabled.removed) {
      await this.highlightRemovals(
        denops,
        changes,
        state.preCode,
        state.postCode,
        lineInfo,
        bufnr,
        perf,
      );
    }
  }

  private async highlightAdditions(
    denops: Denops,
    changes: any[],
    beforeCode: string,
    afterCode: string,
    lineInfo: any,
    bufnr: number,
    perf: PerformanceMonitor | null,
  ): Promise<void> {
    const addedRanges = computeRanges({
      changes,
      beforeCode,
      afterCode,
      changeType: "added",
    });
    

    const filledRanges = fillRangeGaps({
      ranges: addedRanges,
      aboveLine: lineInfo.aboveLine,
      belowLine: lineInfo.belowLine,
    });

    perf?.mark("highlightApplication");
    await this.highlight(denops, filledRanges, "added", bufnr);
  }

  private async highlightRemovals(
    denops: Denops,
    changes: any[],
    beforeCode: string,
    afterCode: string,
    lineInfo: any,
    bufnr: number,
    perf: PerformanceMonitor | null,
  ): Promise<void> {
    const removedRanges = computeRanges({
      changes,
      beforeCode,
      afterCode,
      changeType: "removed",
    });

    const filledRanges = fillRangeGaps({
      ranges: removedRanges,
      aboveLine: lineInfo.aboveLine,
      belowLine: lineInfo.belowLine,
    });

    perf?.mark("highlightApplication");
    await this.highlight(denops, filledRanges, "removed", bufnr);
  }

  private async highlight(
    denops: Denops,
    ranges: ReadonlyArray<Range>,
    changeType: "added" | "removed",
    bufnr: number,
  ): Promise<void> {
    if (ranges.length === 0) {
      return;
    }

    try {
      const highlightGroup = changeType === "added"
        ? this.deps.config.highlight.added
        : this.deps.config.highlight.removed;

      // Convert ranges with proper encoding
      const convertedRanges = this.convertRangesWithEncoding(ranges);

      await this.deps.highlightBatcher.applyHighlights(
        denops,
        convertedRanges,
        this.deps.nameSpace,
        highlightGroup,
      );

      // Wait for the specified duration before clearing highlights
      await new Promise((resolve) => setTimeout(resolve, this.deps.config.duration));

      await this.deps.highlightBatcher.clearHighlights(
        denops,
        this.deps.nameSpace,
        bufnr,
      );
    } catch (error) {
      await this.deps.errorHandler.handle(denops, error, {
        phase: "highlight",
        changeType,
        rangeCount: ranges.length,
      });
    }
  }

  private convertRangesWithEncoding(
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

      const byteStart = this.getByteLength(beforeText);
      const byteEnd = byteStart + this.getByteLength(matchText);

      return {
        ...range,
        col: {
          start: byteStart,
          end: byteEnd,
        },
      };
    });
  }

  private getByteLength(str: string): number {
    return new TextEncoder().encode(str).length;
  }

  private async executeWithoutHighlight(
    denops: Denops,
    command: string,
    bufnr: number,
  ): Promise<void> {
    if (this.deps.debugMode) {
      console.log(
        `[highlight-undo] No buffer state found for bufnr ${bufnr}, executing without highlight`,
      );
    }
    await denops.cmd(command);
  }
  
  private async applyHighlightsWithDelayedCommand(
    denops: Denops,
    diffResult: { changes: any[]; lineInfo: any },
    state: { preCode: string; postCode: string },
    bufnr: number,
    command: string,
    perf: PerformanceMonitor | null,
  ): Promise<void> {
    const { changes, lineInfo } = diffResult;
    
    // Only highlight removals for undo command
    if (this.deps.config.enabled.removed) {
      const removedRanges = computeRanges({
        changes,
        beforeCode: state.preCode,
        afterCode: state.postCode,
        changeType: "removed",
      });
      
      const filledRanges = fillRangeGaps({
        ranges: removedRanges,
        aboveLine: lineInfo.aboveLine,
        belowLine: lineInfo.belowLine,
      });
      
      if (filledRanges.length > 0) {
        // Apply highlight to show what will be removed
        await this.applyHighlightRanges(denops, filledRanges, "removed", bufnr);
        
        // Wait for duration
        await new Promise((resolve) => setTimeout(resolve, this.deps.config.duration));
        
        // Execute the command and clear highlights simultaneously
        await Promise.all([
          denops.cmd(command),
          this.deps.highlightBatcher.clearHighlights(denops, this.deps.nameSpace, bufnr),
        ]);
      } else {
        // No removals to highlight, just execute the command
        await denops.cmd(command);
      }
    } else {
      // Removals not enabled, just execute the command
      await denops.cmd(command);
    }
  }
  
  private async applyHighlightRanges(
    denops: Denops,
    ranges: ReadonlyArray<Range>,
    changeType: "added" | "removed",
    bufnr: number,
  ): Promise<void> {
    if (ranges.length === 0) {
      return;
    }
    
    try {
      const highlightGroup = changeType === "added"
        ? this.deps.config.highlight.added
        : this.deps.config.highlight.removed;
      
      const convertedRanges = this.convertRangesWithEncoding(ranges);
      
      await this.deps.highlightBatcher.applyHighlights(
        denops,
        convertedRanges,
        this.deps.nameSpace,
        highlightGroup,
      );
    } catch (error) {
      await this.deps.errorHandler.handle(denops, error, {
        phase: "applyHighlightRanges",
        changeType,
        rangeCount: ranges.length,
      });
    }
  }
}
