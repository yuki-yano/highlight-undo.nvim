import { Denops, fn } from "./deps.ts";
import { createBufferStateManager } from "./application/buffer-state.ts";
import { createDiffOptimizer } from "./core/diff-optimizer.ts";
import { createHighlightBatcher } from "./infrastructure/highlight-batcher.ts";
import { createPerformanceMonitor, formatPerformanceMetrics } from "./performance.ts";
import { Config, validateConfig } from "./config.ts";
import { createErrorHandler } from "./error-handler.ts";
import { createCommandQueue, createLockManager } from "./application/command-queue.ts";
import { createHighlightCommandExecutor } from "./application/highlight-command-executor.ts";
import { computeRanges } from "./core/range-computer.ts";
import { fillRangeGaps } from "./core/utils.ts";
import { getByteLength } from "./core/encoding.ts";

// Helper function for byte encoding conversion
function convertRangesWithEncoding(
  ranges: ReadonlyArray<ReturnType<typeof computeRanges>[number]>,
): ReadonlyArray<ReturnType<typeof computeRanges>[number]> {
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

type Command = "undo" | "redo";

type UndoTree = {
  entries: Array<{
    curhead?: number;
  }>;
};

let config: Config;
let nameSpace: number;
const bufferStates = createBufferStateManager();
const diffOptimizer = createDiffOptimizer();
const highlightBatcher = createHighlightBatcher();
const errorHandler = createErrorHandler();
const commandQueue = createCommandQueue();
const lockManager = createLockManager();
let debugMode = false;
let highlightExecutor: ReturnType<typeof createHighlightCommandExecutor>;

const executeCondition = async (
  denops: Denops,
  { command }: { command: Command },
): Promise<boolean> => {
  const undoTree = await fn.undotree(denops) as unknown as UndoTree;
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
  const perf = debugMode ? createPerformanceMonitor() : null;

  try {
    // Clear the diff optimizer cache to ensure fresh calculations
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
      console.log(`[highlight-undo] Buffer read: ${formatPerformanceMetrics(metrics)}`);
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
        // Set global debug mode for other modules
        (globalThis as { debugMode?: boolean }).debugMode = debugMode;

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

        // Initialize the executor
        highlightExecutor = createHighlightCommandExecutor({
          bufferStates,
          diffOptimizer,
          highlightBatcher,
          errorHandler,
          config,
          nameSpace,
          debugMode,
        });

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

    preExecWithCheck: async (
      command: unknown,
      counterCommand: unknown,
    ): Promise<void> => {
      if (config == null) {
        throw new Error("Please call setup() first.");
      }

      const bufnr = (await fn.bufnr(denops, "%")) as number;
      let hasRemovals = false;

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

        // Check if there will be removals
        const state = bufferStates.get(bufnr);
        if (state) {
          const diffResult = diffOptimizer.calculateDiff(
            state.preCode,
            state.postCode,
            config.threshold,
          );

          if (diffResult) {
            hasRemovals = diffResult.changes.some((c) => c.removed);
            if (debugMode) {
              console.log(`[highlight-undo] Has removals: ${hasRemovals}`);
            }
          }
        }
      });

      // Set the result as a Vim global variable
      await denops.cmd(`let g:highlight_undo_has_removals = ${hasRemovals ? 1 : 0}`);
    },

    exec: async (command: unknown, _counterCommand: unknown): Promise<void> => {
      if (config == null) {
        throw new Error("Please call setup() first.");
      }

      const bufnr = (await fn.bufnr(denops, "%")) as number;

      // Queue the command for execution
      await commandQueue.enqueue(bufnr, async () => {
        await highlightExecutor.execute(denops, command as string, bufnr);
      });
    },

    // Show highlight only (no command execution)
    showHighlightOnly: async (command: unknown, _counterCommand: unknown): Promise<void> => {
      if (config == null) {
        throw new Error("Please call setup() first.");
      }

      const bufnr = (await fn.bufnr(denops, "%")) as number;
      const state = bufferStates.get(bufnr);

      if (!state) {
        if (debugMode) {
          console.log(`[highlight-undo] No buffer state found for showHighlightOnly`);
        }
        return;
      }

      // Don't clear buffer state yet - Neovim will execute the command later

      const diffResult = diffOptimizer.calculateDiff(
        state.preCode,
        state.postCode,
        config.threshold,
      );

      if (!diffResult) {
        return;
      }

      const { lineInfo } = diffResult;
      const isUndo = command === "undo";

      // Only show highlights, don't execute command
      if (isUndo && config.enabled.removed && diffResult.changes.some((c) => c.removed)) {
        // Show what will be removed
        await commandQueue.enqueue(bufnr, async () => {
          const perf = debugMode ? createPerformanceMonitor() : null;

          const removedRanges = computeRanges({
            changes: diffResult.changes,
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
            const convertedRanges = convertRangesWithEncoding(filledRanges);
            await highlightBatcher.applyHighlights(
              denops,
              convertedRanges,
              nameSpace,
              config.highlight.removed,
            );

            // Schedule highlight clearing after duration
            setTimeout(async () => {
              try {
                await highlightBatcher.clearHighlights(denops, nameSpace, bufnr);
                // Clear buffer state after highlights are cleared
                bufferStates.clear(bufnr);
              } catch (error) {
                console.error(`[highlight-undo] Error clearing highlights:`, error);
              }
            }, config.duration);
          }

          if (perf) {
            const metrics = perf.end();
            console.log(`[highlight-undo] Highlight only: ${formatPerformanceMetrics(metrics)}`);
          }
        });
      } else if (!isUndo && config.enabled.added && diffResult.changes.some((c) => c.added)) {
        // For redo, we would show additions, but since command executes after highlight,
        // we need to handle this differently
        // Clear buffer state since we won't use it
        bufferStates.clear(bufnr);
      } else {
        // No highlights to show, clear buffer state
        bufferStates.clear(bufnr);
      }
    },

    // Buffer cleanup
    bufferDelete: (...args: unknown[]): Promise<void> => {
      const bufnr = args[0];
      if (typeof bufnr === "number") {
        bufferStates.clear(bufnr);
        commandQueue.clearBuffer(bufnr);
      }
      return Promise.resolve();
    },

    // Get performance stats
    getStats: (): Promise<unknown> => {
      return Promise.resolve({
        buffers: bufferStates.getStats(),
        queue: commandQueue.getStats(),
        locks: lockManager.getLockedResources(),
      });
    },

    // Clear all caches
    clearCache: (): Promise<void> => {
      bufferStates.clearAll();
      diffOptimizer.clearCache();
      commandQueue.clearAll();
      return Promise.resolve();
    },
  };

  // Register autocmd for buffer cleanup
  // Note: Some Neovim versions may not support certain autocmd events via denops
  // For now, we'll skip autocmd registration and rely on manual cleanup

  return await Promise.resolve();
};
