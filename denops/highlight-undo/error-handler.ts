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

export class ErrorHandler {
  private logFile?: string;
  private debugMode = false;

  constructor(debugMode: boolean = false, logFile?: string) {
    this.debugMode = debugMode;
    this.logFile = logFile;
  }

  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }

  setLogFile(path?: string): void {
    this.logFile = path;
  }

  async handle(
    denops: Denops,
    error: unknown,
    context: ErrorContext,
  ): Promise<void> {
    const errorMessage = this.formatError(error, context);

    // Always log to Neovim
    await this.notifyUser(denops, error, context);

    // Log to file if in debug mode
    if (this.debugMode && this.logFile) {
      await this.logToFile(errorMessage);
    }

    // Log to console in debug mode
    if (this.debugMode) {
      console.error("[highlight-undo]", errorMessage);
    }
  }

  private formatError(error: unknown, context: ErrorContext): string {
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

  private async notifyUser(
    denops: Denops,
    error: unknown,
    context: ErrorContext,
  ): Promise<void> {
    const level = this.getErrorLevel(error);
    const message = error instanceof Error ? error.message : String(error);

    try {
      if (level === ErrorLevel.Error) {
        // Show error message to user
        await denops.call("nvim_err_writeln", `highlight-undo: ${message}`);
      } else if (level === ErrorLevel.Warn && this.debugMode) {
        // Show warning in debug mode
        await denops.cmd(`echohl WarningMsg | echo "highlight-undo: ${message}" | echohl None`);
      }

      // Log detailed info in debug mode
      if (this.debugMode && context.phase) {
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

  private async logToFile(message: string): Promise<void> {
    if (!this.logFile) return;

    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(message + "\n---\n");
      await Deno.writeFile(this.logFile, data, { append: true, create: true });
    } catch (error) {
      console.error("Failed to write to log file:", error);
    }
  }

  private getErrorLevel(error: unknown): ErrorLevel {
    if (error instanceof HighlightUndoError) {
      // Determine level based on error type
      if (error.message.includes("threshold exceeded")) {
        return ErrorLevel.Debug;
      }
      return ErrorLevel.Error;
    }
    return ErrorLevel.Error;
  }

  // Wrap async functions with error handling
  wrap<T extends unknown[], R>(
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
}
