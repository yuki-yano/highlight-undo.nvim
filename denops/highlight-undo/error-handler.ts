// Error handling and logging system

import type { Denops } from "./deps.ts";

export enum ErrorLevel {
  Debug = "debug",
  Info = "info",
  Warn = "warn",
  Error = "error",
}

export interface ErrorContext {
  bufnr?: number;
  command?: string;
  phase?: string;
  [key: string]: unknown;
}

export class HighlightUndoError extends Error {
  constructor(
    message: string,
    public readonly context: ErrorContext,
    public override readonly cause?: Error,
  ) {
    super(message);
    this.name = "HighlightUndoError";
  }
}

export interface IErrorHandler {
  setDebugMode(enabled: boolean): void;
  setLogFile(path?: string): void;
  handle(
    denops: Denops,
    error: unknown,
    context: ErrorContext,
  ): Promise<void>;
  wrap<T extends unknown[], R>(
    fn: (...args: T) => Promise<R>,
    context: Partial<ErrorContext>,
  ): (...args: T) => Promise<R | null>;
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
    const level = getErrorLevel(error);
    const message = error instanceof Error ? error.message : String(error);

    try {
      if (level === ErrorLevel.Error) {
        // Show error message to user
        await denops.call("nvim_err_writeln", `highlight-undo: ${message}`);
      } else if (level === ErrorLevel.Warn && debug) {
        // Show warning in debug mode
        await denops.cmd(`echohl WarningMsg | echo "highlight-undo: ${message}" | echohl None`);
      }

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

  function getErrorLevel(error: unknown): ErrorLevel {
    if (error instanceof HighlightUndoError) {
      // Determine level based on error type
      if (error.message.includes("threshold exceeded")) {
        return ErrorLevel.Debug;
      }
      return ErrorLevel.Error;
    }
    return ErrorLevel.Error;
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

  function wrap<T extends unknown[], R>(
    fn: (...args: T) => Promise<R>,
    context: Partial<ErrorContext> = {},
  ): (...args: T) => Promise<R | null> {
    return async (...args: T): Promise<R | null> => {
      try {
        return await fn(...args);
      } catch (error) {
        const fullContext = { ...context, args };
        throw new HighlightUndoError(
          error instanceof Error ? error.message : String(error),
          fullContext,
          error instanceof Error ? error : undefined,
        );
      }
    };
  }

  return {
    setDebugMode(enabled: boolean): void {
      debug = enabled;
    },

    setLogFile(path?: string): void {
      logFilePath = path;
    },

    handle,
    wrap,
  };
}

// Backward compatibility
export class ErrorHandler implements IErrorHandler {
  private handler: ReturnType<typeof createErrorHandler>;

  constructor(debugMode: boolean = false, logFile?: string) {
    this.handler = createErrorHandler(debugMode, logFile);
  }

  setDebugMode(enabled: boolean): void {
    this.handler.setDebugMode(enabled);
  }

  setLogFile(path?: string): void {
    this.handler.setLogFile(path);
  }

  handle(
    denops: Denops,
    error: unknown,
    context: ErrorContext,
  ): Promise<void> {
    return this.handler.handle(denops, error, context);
  }

  wrap<T extends unknown[], R>(
    fn: (...args: T) => Promise<R>,
    context: Partial<ErrorContext> = {},
  ): (...args: T) => Promise<R | null> {
    return this.handler.wrap(fn, context);
  }
}
