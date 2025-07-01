import type { Denops } from "../deps.ts";
import type { Config } from "../config.ts";
import type { IBufferStateManager } from "./buffer-state.ts";
import type { DiffResult, IDiffOptimizer } from "../core/diff-optimizer.ts";
import type { IHighlightBatcher } from "../infrastructure/highlight-batcher.ts";
import type { IErrorHandler } from "../error-handler.ts";
import { createPerformanceMonitor, formatPerformanceMetrics, type IPerformanceMonitor } from "../performance.ts";
import { computeRanges, type Range } from "../core/range-computer.ts";
import { fillRangeGaps } from "../core/utils.ts";
import { Diff, fn } from "../deps.ts";

type Command = "undo" | "redo";

export interface HighlightCommandExecutorDeps {
  bufferStates: IBufferStateManager;
  diffOptimizer: IDiffOptimizer;
  highlightBatcher: IHighlightBatcher;
  errorHandler: IErrorHandler;
  config: Config;
  nameSpace: number;
  debugMode: boolean;
}

export interface IHighlightCommandExecutor {
  execute(
    denops: Denops,
    command: string,
    bufnr: number,
  ): Promise<void>;
}

// Helper functions
async function checkPreconditions(
  denops: Denops,
  command: Command,
): Promise<boolean> {
  const undoTree = await fn.undotree(denops) as unknown as {
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

function prepareState(
  bufferStates: IBufferStateManager,
  bufnr: number,
  debugMode: boolean,
): { preCode: string; postCode: string } | null {
  const state = bufferStates.get(bufnr);

  if (!state) {
    if (debugMode) {
      console.log(
        `[highlight-undo] No buffer state found for bufnr ${bufnr}, executing without highlight`,
      );
    }
    return null;
  }

  // Clear the buffer state after retrieving it
  bufferStates.clear(bufnr);

  if (debugMode) {
    console.log(`[highlight-undo] Retrieved buffer state for bufnr ${bufnr}`);
  }

  return state;
}

function calculateDiff(
  diffOptimizer: IDiffOptimizer,
  preCode: string,
  postCode: string,
  threshold: { line: number; char: number },
): DiffResult | null {
  const result = diffOptimizer.calculateDiff(
    preCode,
    postCode,
    threshold,
  );

  return result;
}

function getByteLength(str: string): number {
  return new TextEncoder().encode(str).length;
}

function convertRangesWithEncoding(
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

async function highlight(
  denops: Denops,
  ranges: ReadonlyArray<Range>,
  changeType: "added" | "removed",
  bufnr: number,
  deps: HighlightCommandExecutorDeps,
): Promise<void> {
  if (ranges.length === 0) {
    return;
  }

  try {
    const highlightGroup = changeType === "added" ? deps.config.highlight.added : deps.config.highlight.removed;

    // Convert ranges with proper encoding
    const convertedRanges = convertRangesWithEncoding(ranges);

    await deps.highlightBatcher.applyHighlights(
      denops,
      convertedRanges,
      deps.nameSpace,
      highlightGroup,
    );

    // Wait for the specified duration before clearing highlights
    await new Promise((resolve) => setTimeout(resolve, deps.config.duration));

    await deps.highlightBatcher.clearHighlights(
      denops,
      deps.nameSpace,
      bufnr,
    );
  } catch (error) {
    await deps.errorHandler.handle(denops, error, {
      phase: "highlight",
      changeType,
      rangeCount: ranges.length,
    });
  }
}

async function highlightAdditions(
  denops: Denops,
  changes: Diff.Change[],
  beforeCode: string,
  afterCode: string,
  lineInfo: { aboveLine: number; belowLine: number },
  bufnr: number,
  perf: IPerformanceMonitor | null,
  deps: HighlightCommandExecutorDeps,
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
  await highlight(denops, filledRanges, "added", bufnr, deps);
}

async function highlightRemovals(
  denops: Denops,
  changes: Diff.Change[],
  beforeCode: string,
  afterCode: string,
  lineInfo: { aboveLine: number; belowLine: number },
  bufnr: number,
  perf: IPerformanceMonitor | null,
  deps: HighlightCommandExecutorDeps,
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
  await highlight(denops, filledRanges, "removed", bufnr, deps);
}

async function applyHighlights(
  denops: Denops,
  diffResult: DiffResult,
  state: { preCode: string; postCode: string },
  bufnr: number,
  perf: IPerformanceMonitor | null,
  deps: HighlightCommandExecutorDeps,
): Promise<void> {
  const { changes, lineInfo } = diffResult;
  const hasAdditions = changes.some((change) => change.added);
  const hasRemovals = changes.some((change) => change.removed);

  if (hasAdditions && deps.config.enabled.added) {
    await highlightAdditions(
      denops,
      changes,
      state.preCode,
      state.postCode,
      lineInfo,
      bufnr,
      perf,
      deps,
    );
  }

  if (hasRemovals && deps.config.enabled.removed) {
    await highlightRemovals(
      denops,
      changes,
      state.preCode,
      state.postCode,
      lineInfo,
      bufnr,
      perf,
      deps,
    );
  }
}

async function applyHighlightRanges(
  denops: Denops,
  ranges: ReadonlyArray<Range>,
  changeType: "added" | "removed",
  _bufnr: number,
  deps: HighlightCommandExecutorDeps,
): Promise<void> {
  if (ranges.length === 0) {
    return;
  }

  try {
    const highlightGroup = changeType === "added" ? deps.config.highlight.added : deps.config.highlight.removed;

    const convertedRanges = convertRangesWithEncoding(ranges);

    await deps.highlightBatcher.applyHighlights(
      denops,
      convertedRanges,
      deps.nameSpace,
      highlightGroup,
    );
  } catch (error) {
    await deps.errorHandler.handle(denops, error, {
      phase: "applyHighlightRanges",
      changeType,
      rangeCount: ranges.length,
    });
  }
}

async function applyHighlightsWithDelayedCommand(
  denops: Denops,
  diffResult: DiffResult,
  state: { preCode: string; postCode: string },
  bufnr: number,
  command: string,
  _perf: IPerformanceMonitor | null,
  deps: HighlightCommandExecutorDeps,
): Promise<void> {
  const { changes, lineInfo } = diffResult;

  // Only highlight removals for undo command
  if (deps.config.enabled.removed) {
    const removedRanges = computeRanges({
      changes,
      beforeCode: state.preCode,
      afterCode: state.postCode,
      changeType: "removed",
    });

    if (deps.debugMode) {
      console.log(`[highlight-undo] Removed ranges before fillRangeGaps:`, removedRanges);
    }

    const filledRanges = fillRangeGaps({
      ranges: removedRanges,
      aboveLine: lineInfo.aboveLine,
      belowLine: lineInfo.belowLine,
    });

    if (deps.debugMode) {
      console.log(`[highlight-undo] Filled ranges:`, filledRanges);
    }

    if (filledRanges.length > 0) {
      // Apply highlight to show what will be removed
      if (deps.debugMode) {
        console.log(
          `[highlight-undo] Applying highlight for removal, ranges: ${filledRanges.length}, duration: ${deps.config.duration}ms`,
        );
      }
      await applyHighlightRanges(denops, filledRanges, "removed", bufnr, deps);

      // Wait for duration
      if (deps.debugMode) {
        console.log(`[highlight-undo] Waiting for ${deps.config.duration}ms before executing command`);
      }
      await new Promise((resolve) => setTimeout(resolve, deps.config.duration));

      // Execute the command and clear highlights
      if (deps.debugMode) {
        console.log(`[highlight-undo] Executing command: ${command} and clearing highlights`);
      }
      try {
        await denops.cmd(command);
        await deps.highlightBatcher.clearHighlights(denops, deps.nameSpace, bufnr);
        if (deps.debugMode) {
          console.log(`[highlight-undo] Command executed successfully`);
        }
      } catch (error) {
        console.error(`[highlight-undo] Error executing command:`, error);
        throw error;
      }
    } else {
      // No removals to highlight, just execute the command
      await denops.cmd(command);
    }
  } else {
    // Removals not enabled, just execute the command
    await denops.cmd(command);
  }
}

async function executeWithoutHighlight(
  denops: Denops,
  command: string,
  bufnr: number,
  debugMode: boolean,
): Promise<void> {
  if (debugMode) {
    console.log(
      `[highlight-undo] No buffer state found for bufnr ${bufnr}, executing without highlight`,
    );
  }
  await denops.cmd(command);
}

export function createHighlightCommandExecutor(
  deps: HighlightCommandExecutorDeps,
): IHighlightCommandExecutor {
  async function execute(
    denops: Denops,
    command: string,
    bufnr: number,
  ): Promise<void> {
    if (!(await checkPreconditions(denops, command as Command))) {
      return;
    }

    const perf = deps.debugMode ? createPerformanceMonitor() : null;

    try {
      const state = prepareState(deps.bufferStates, bufnr, deps.debugMode);
      if (!state) {
        await executeWithoutHighlight(denops, command, bufnr, deps.debugMode);
        return;
      }

      const diffResult = calculateDiff(
        deps.diffOptimizer,
        state.preCode,
        state.postCode,
        deps.config.threshold,
      );
      if (!diffResult) {
        if (deps.debugMode) {
          console.log(`[highlight-undo] No diff result, executing command without highlight`);
        }
        await denops.cmd(command);
        return;
      }

      // Check if there are removals (regardless of undo/redo)
      const hasRemovals = diffResult.changes.some((c) => c.removed);
      const hasAdditions = diffResult.changes.some((c) => c.added);

      if (deps.debugMode) {
        console.log(
          `[highlight-undo] Command: ${command}, hasRemovals: ${hasRemovals}, hasAdditions: ${hasAdditions}`,
        );
      }

      if (hasRemovals) {
        // For any command with removals: highlight first, then execute after duration
        await applyHighlightsWithDelayedCommand(
          denops,
          diffResult,
          state,
          bufnr,
          command,
          perf,
          deps,
        );
      } else {
        // For additions only: execute command first, then show what was added
        await denops.cmd(command);
        await applyHighlights(denops, diffResult, state, bufnr, perf, deps);
      }

      if (perf) {
        const metrics = perf.end();
        console.log(`[highlight-undo] Total: ${formatPerformanceMetrics(metrics)}`);
      }
    } catch (error) {
      await deps.errorHandler.handle(denops, error, {
        bufnr,
        command,
        phase: "executeHighlightCommand",
      });
    }
  }

  return { execute };
}
