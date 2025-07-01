// Structured logging system

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  performance?: {
    duration: number;
    marks?: Record<string, number>;
  };
}

export class Logger {
  private logFile?: string;
  private debugMode: boolean = false;
  private logLevel: LogLevel = "info";

  constructor(options: { debugMode?: boolean; logFile?: string; logLevel?: LogLevel } = {}) {
    this.debugMode = options.debugMode ?? false;
    this.logFile = options.logFile;
    this.logLevel = options.logLevel ?? "info";
  }

  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }

  setLogFile(path: string): void {
    this.logFile = path;
  }

  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  debug(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog("debug")) {
      this.log("debug", message, context);
    }
  }

  info(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog("info")) {
      this.log("info", message, context);
    }
  }

  warn(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog("warn")) {
      this.log("warn", message, context);
    }
  }

  error(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog("error")) {
      this.log("error", message, context);
    }
  }

  performance(
    message: string,
    duration: number,
    marks?: Record<string, number>,
    context?: Record<string, unknown>,
  ): void {
    if (this.shouldLog("debug")) {
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: "debug",
        message: `[PERF] ${message}`,
        context,
        performance: {
          duration,
          marks,
        },
      };
      this.writeLog(entry);
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ["debug", "info", "warn", "error"];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    return this.debugMode && messageLevelIndex >= currentLevelIndex;
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
    };
    this.writeLog(entry);
  }

  private writeLog(entry: LogEntry): void {
    const prefix = `[highlight-undo][${entry.level.toUpperCase()}]`;
    const logMessage = `${prefix} ${entry.message}`;

    // Console output
    if (entry.level === "error") {
      console.error(logMessage, entry.context || "");
    } else {
      console.log(logMessage, entry.context || "");
    }

    // File output
    if (this.logFile) {
      this.writeToFile(entry);
    }
  }

  private async writeToFile(entry: LogEntry): Promise<void> {
    if (!this.logFile) return;

    try {
      const logLine = JSON.stringify(entry) + "\n";
      await Deno.writeTextFile(this.logFile, logLine, { append: true });
    } catch (error) {
      console.error(`[highlight-undo] Failed to write to log file: ${error}`);
    }
  }
}
