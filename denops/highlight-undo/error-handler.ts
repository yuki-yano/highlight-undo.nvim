// Error handling and logging system

import type { Denops } from "./deps.ts";

export interface ErrorContext {
  bufnr?: number;
  command?: string;
  phase?: string;
  [key: string]: unknown;
}

export interface IErrorHandler {
  setDebugMode(enabled: boolean): void;
  setLogFile(path?: string): void;
  handle(
    denops: Denops,
    error: unknown,
    context: ErrorContext,
  ): Promise<void>;
}

export function createErrorHandler(debugMode = false, logFile?: string): IErrorHandler {
  let debug = debugMode;
  let logFilePath = logFile;

  function formatError(error: unknown, context: ErrorContext): string {
    const timestamp = new Date().toISOString();
    const errorMessage = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;

    let formatted = `[${timestamp}] Error: ${errorMessage}\n`;
    formatted += `Context: ${JSON.stringify(context, null, 2)}\n`;

    if (stack) {
      formatted += `Stack:\n${stack}\n`;
    }

    return formatted;
  }

  async function notifyUser(
    denops: Denops,
    error: unknown,
    context: ErrorContext,
  ): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);

    try {
      // Show error message to user
      await denops.call("nvim_err_writeln", `highlight-undo: ${message}`);

      // Log detailed info in debug mode
      if (debug && context.phase) {
        await denops.call(
          "nvim_echo",
          [
            [`highlight-undo [${context.phase}]: ${message}`, "Comment"],
          ],
          false,
          {},
        );
      }
    } catch (notifyError) {
      // If notification fails, at least log to console
      console.error("Failed to notify user:", notifyError);
      console.error("Original error:", error);
    }
  }

  async function logToFile(message: string): Promise<void> {
    if (!logFilePath) return;

    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(message + "\n---\n");
      await Deno.writeFile(logFilePath, data, { append: true, create: true });
    } catch (error) {
      console.error("Failed to write to log file:", error);
    }
  }

  async function handle(
    denops: Denops,
    error: unknown,
    context: ErrorContext,
  ): Promise<void> {
    const errorMessage = formatError(error, context);

    // Always log to Neovim
    await notifyUser(denops, error, context);

    // Log to file if in debug mode
    if (debug && logFilePath) {
      await logToFile(errorMessage);
    }

    // Log to console in debug mode
    if (debug) {
      console.error("[highlight-undo]", errorMessage);
    }
  }

  return {
    setDebugMode(enabled: boolean): void {
      debug = enabled;
    },

    setLogFile(path?: string): void {
      logFilePath = path;
    },

    handle,
  };
}
