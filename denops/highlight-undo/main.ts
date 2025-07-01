import { Denops, fn } from "./deps.ts";
import { BufferStateManager } from "./application/buffer-state.ts";
import { DiffOptimizer } from "./core/diff-optimizer.ts";
import { HighlightBatcher } from "./infrastructure/highlight-batcher.ts";
import { PerformanceMonitor } from "./performance.ts";
import { Config, validateConfig } from "./config.ts";
import { ErrorHandler } from "./error-handler.ts";
import { CommandQueue, LockManager } from "./application/command-queue.ts";
import { HighlightCommandExecutor } from "./application/highlight-command-executor.ts";

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
let highlightExecutor: HighlightCommandExecutor;

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
        (globalThis as any).debugMode = debugMode;

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
        highlightExecutor = new HighlightCommandExecutor({
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
