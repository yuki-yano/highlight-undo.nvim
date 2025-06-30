import { delay, Denops, fn } from "./deps.ts";
import { BufferStateManager } from "./buffer-state.ts";
import { DiffOptimizer } from "./diff-optimizer.ts";
import { HighlightBatcher } from "./highlight-batcher.ts";
import { PerformanceMonitor } from "./performance.ts";
import { computeRanges, fillRangeGaps, type Range } from "./utils.ts";
import { Config, validateConfig } from "./config.ts";
import { ErrorHandler } from "./error-handler.ts";
import { EncodingUtil } from "./encoding.ts";
import { CommandQueue, LockManager } from "./command-queue.ts";

type Command = "undo" | "redo";

type UndoTree = {
  entries: Array<{
    curhead?: number;
  }>;
};

let config: Config;
let nameSpace: number;
const bufferStates = new BufferStateManager();
const diffOptimizer = new DiffOptimizer();
const highlightBatcher = new HighlightBatcher();
const errorHandler = new ErrorHandler();
const commandQueue = new CommandQueue();
const lockManager = new LockManager();
let debugMode = false;

const executeCondition = async (
  denops: Denops,
  { command }: { command: Command },
): Promise<boolean> => {
  const undoTree = (await fn.undotree(denops)) as UndoTree;
  if (
    undoTree.entries.length === 0 ||
    (command === "redo" &&
      !undoTree.entries.some((entry) => entry.curhead != null)) ||
    (command === "undo" && undoTree.entries[0].curhead != null)
  ) {
    return false;
  } else {
    return true;
  }
};

const getPreCodeAndPostCode = async ({
  denops,
  command,
  counterCommand,
  bufnr,
}: {
  denops: Denops;
  command: string;
  counterCommand: string;
  bufnr: number;
}): Promise<void> => {
  const perf = debugMode ? new PerformanceMonitor() : null;
  perf?.start();

  try {
    // Clear any existing diff cache to ensure fresh calculations
    diffOptimizer.clearCache();

    // Get current buffer content
    const currentCode = ((await fn.getline(denops, 1, "$")) as Array<string>).join("\n") + "\n";

    perf?.mark("bufferRead");

    // Execute command to get post state
    await denops.cmd(`silent ${command}`);
    const afterCode = ((await fn.getline(denops, 1, "$")) as Array<string>).join("\n") + "\n";

    // Revert to get back to pre state
    await denops.cmd(`silent ${counterCommand}`);

    // Store the states based on command type
    // For undo: currentCode is "before undo", afterCode is "after undo"
    // For redo: currentCode is "before redo", afterCode is "after redo"
    bufferStates.set(bufnr, currentCode, afterCode);

    if (debugMode) {
      console.log(`[highlight-undo] Stored buffer state for bufnr ${bufnr}, command: ${command}`);
    }

    if (perf) {
      const metrics = perf.end();
      console.log(`[highlight-undo] Buffer read: ${PerformanceMonitor.format(metrics)}`);
    }
  } catch (error) {
    await errorHandler.handle(denops, error, {
      bufnr,
      command,
      phase: "getPreCodeAndPostCode",
    });
    throw error;
  }
};

// Convert ranges with proper multi-byte character handling
const convertRangesWithEncoding = (ranges: ReadonlyArray<Range>): ReadonlyArray<Range> => {
  return ranges.map((range) => {
    // For removed text, special handling is needed
    if (range.changeType === "removed" && !range.lineText) {
      // If line doesn't exist (e.g., line was completely removed),
      // position at the start of the line

      return {
        ...range,
        col: {
          start: 0,
          end: 0,
        },
      };
    }

    // Convert character indices to byte offsets for Neovim
    const beforeText = range.lineText.substring(0, range.col.start);
    const matchText = range.lineText.substring(range.col.start, range.col.end);

    const byteStart = EncodingUtil.getByteLength(beforeText);
    const byteEnd = byteStart + EncodingUtil.getByteLength(matchText);

    return {
      ...range,
      col: {
        start: byteStart,
        end: byteEnd,
      },
    };
  });
};

const highlight = async (
  denops: Denops,
  ranges: ReadonlyArray<Range>,
  changeType: "added" | "removed",
) => {
  if (ranges.length === 0) {
    return;
  }

  try {
    const highlightGroup = changeType === "added" ? config.highlight.added : config.highlight.removed;

    // Convert ranges with proper encoding
    const convertedRanges = convertRangesWithEncoding(ranges);

    await highlightBatcher.applyHighlights(
      denops,
      convertedRanges,
      nameSpace,
      highlightGroup,
    );

    // Wait for the specified duration before clearing highlights
    await delay(config.duration);

    await highlightBatcher.clearHighlights(denops, nameSpace);
  } catch (error) {
    await errorHandler.handle(denops, error, {
      phase: "highlight",
      changeType,
      rangeCount: ranges.length,
    });
  }
};

export const main = async (denops: Denops): Promise<void> => {
  nameSpace = (await denops.call(
    "nvim_create_namespace",
    "highlight-undo",
  )) as number;

  // Clean up buffer states when buffer is deleted
  denops.dispatcher = {
    setup: async (_config: unknown): Promise<void> => {
      try {
        config = validateConfig(_config);
        debugMode = config.debug === true;

        if (debugMode) {
          console.log(`[highlight-undo] Config loaded:`, {
            duration: config.duration,
            highlight: config.highlight,
            enabled: config.enabled,
          });
          // Set Vim global variable for Lua side
          await denops.cmd("let g:highlight_undo_debug = 1");
        } else {
          await denops.cmd("let g:highlight_undo_debug = 0");
        }

        errorHandler.setDebugMode(debugMode);
        if (config.logFile) {
          errorHandler.setLogFile(config.logFile);
        }

        return await Promise.resolve();
      } catch (error) {
        await errorHandler.handle(denops, error, { phase: "setup" });
        throw error;
      }
    },

    preExec: async (
      command: unknown,
      counterCommand: unknown,
    ): Promise<void> => {
      if (config == null) {
        throw new Error("Please call setup() first.");
      }

      const bufnr = (await fn.bufnr(denops, "%")) as number;

      // Use lock to prevent concurrent access to buffer state
      await lockManager.acquire(`buffer-${bufnr}`, async () => {
        if (!(await executeCondition(denops, { command: command as Command }))) {
          return;
        }

        await getPreCodeAndPostCode({
          denops,
          command: command as string,
          counterCommand: counterCommand as string,
          bufnr,
        });
      });
    },

    exec: async (command: unknown, _counterCommand: unknown): Promise<void> => {
      if (config == null) {
        throw new Error("Please call setup() first.");
      }

      const bufnr = (await fn.bufnr(denops, "%")) as number;

      // Queue the command for execution
      await commandQueue.enqueue(bufnr, async () => {
        await executeHighlightCommand(denops, command as string, bufnr);
      });
    },

    // Buffer cleanup
    bufferDelete: async (...args: unknown[]): Promise<void> => {
      const bufnr = args[0];
      if (typeof bufnr === "number") {
        bufferStates.clear(bufnr);
        commandQueue.clearBuffer(bufnr);
      }
    },

    // Get performance stats
    getStats: async (): Promise<unknown> => {
      return {
        buffers: bufferStates.getStats(),
        queue: commandQueue.getStats(),
        locks: lockManager.getLockedResources(),
      };
    },

    // Clear all caches
    clearCache: async (): Promise<void> => {
      bufferStates.clearAll();
      diffOptimizer.clearCache();
      commandQueue.clearAll();
    },
  };

  // Register autocmd for buffer cleanup
  // Note: Some Neovim versions may not support certain autocmd events via denops
  // For now, we'll skip autocmd registration and rely on manual cleanup

  return await Promise.resolve();
};

// Separate function for executing highlight command
async function executeHighlightCommand(
  denops: Denops,
  command: string,
  bufnr: number,
): Promise<void> {
  if (!(await executeCondition(denops, { command: command as Command }))) {
    return;
  }

  const perf = debugMode ? new PerformanceMonitor() : null;
  perf?.start();

  try {
    const state = bufferStates.get(bufnr);

    if (!state) {
      // Fallback to executing command without highlight
      if (debugMode) {
        console.log(`[highlight-undo] No buffer state found for bufnr ${bufnr}, executing without highlight`);
      }
      await denops.cmd(command);
      return;
    }

    const { preCode, postCode } = state;

    if (debugMode) {
      console.log(`[highlight-undo] Retrieved buffer state for bufnr ${bufnr}`);
    }

    // Clear the buffer state after retrieving it to ensure fresh state for next undo/redo
    bufferStates.clear(bufnr);

    perf?.mark("bufferRead");

    // Optimized diff calculation
    const diffResult = diffOptimizer.calculateDiff(
      preCode,
      postCode,
      config.threshold,
    );
    perf?.mark("diffCalculation");

    if (!diffResult) {
      // Threshold exceeded or no changes
      await denops.cmd(command);
      return;
    }

    const { changes, lineInfo } = diffResult;

    // Execute the actual command first
    await denops.cmd(command);

    // For undo: preCode is "before undo" (current state), postCode is "after undo" (past state)
    // For redo: preCode is "before redo" (current state), postCode is "after redo" (future state)
    // We want to show what changed from before to after the command
    const actualBeforeState = preCode;
    const actualAfterState = postCode;

    const textLengthDiff = actualAfterState.length - actualBeforeState.length;
    const isTextAdded = textLengthDiff > 0;

    // Recalculate diff between before and after states
    const freshDiffResult = diffOptimizer.calculateDiff(
      actualBeforeState,
      actualAfterState,
      config.threshold,
    );

    if (!freshDiffResult) {
      return;
    }

    const { changes: freshChanges, lineInfo: freshLineInfo } = freshDiffResult;

    // Show additions with DiffAdd (green) and deletions with DiffDelete (red)
    if (isTextAdded) {
      // Text was added - show what was added
      if (config.enabled.added) {
        const addedRanges = computeRanges({
          changes: freshChanges,
          beforeCode: actualBeforeState,
          afterCode: actualAfterState,
          changeType: "added",
        });

        const filledRanges = fillRangeGaps({
          ranges: addedRanges,
          aboveLine: freshLineInfo.aboveLine,
          belowLine: freshLineInfo.belowLine,
        });

        perf?.mark("highlightApplication");
        await highlight(denops, filledRanges, "added");
      }
    } else if (textLengthDiff < 0) {
      // Text was removed - show what was removed
      if (config.enabled.removed) {
        const removedRanges = computeRanges({
          changes: freshChanges,
          beforeCode: actualBeforeState,
          afterCode: actualAfterState,
          changeType: "removed",
        });

        const filledRanges = fillRangeGaps({
          ranges: removedRanges,
          aboveLine: freshLineInfo.aboveLine,
          belowLine: freshLineInfo.belowLine,
        });

        perf?.mark("highlightApplication");
        await highlight(denops, filledRanges, "removed");
      }
    }

    if (perf) {
      const metrics = perf.end();
      console.log(`[highlight-undo] Total: ${PerformanceMonitor.format(metrics)}`);
    }
  } catch (error) {
    await errorHandler.handle(denops, error, {
      bufnr,
      command,
      phase: "executeHighlightCommand",
    });
  }
}
