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

export interface ILogger {
  setDebugMode(enabled: boolean): void;
  setLogFile(path: string): void;
  setLogLevel(level: LogLevel): void;
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
  performance(
    message: string,
    duration: number,
    marks?: Record<string, number>,
    context?: Record<string, unknown>,
  ): void;
}

export function createLogger(options: {
  debugMode?: boolean;
  logFile?: string;
  logLevel?: LogLevel;
} = {}): ILogger {
  let debugMode = options.debugMode ?? false;
  let logFile = options.logFile;
  let logLevel = options.logLevel ?? "info";

  function shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ["debug", "info", "warn", "error"];
    const currentLevelIndex = levels.indexOf(logLevel);
    const messageLevelIndex = levels.indexOf(level);
    return debugMode && messageLevelIndex >= currentLevelIndex;
  }

  function writeLog(entry: LogEntry): void {
    const prefix = `[highlight-undo][${entry.level.toUpperCase()}]`;
    const logMessage = `${prefix} ${entry.message}`;

    // Console output
    if (entry.level === "error") {
      console.error(logMessage, entry.context || "");
    } else {
      console.log(logMessage, entry.context || "");
    }

    // File output
    if (logFile) {
      writeToFile(entry);
    }
  }

  async function writeToFile(entry: LogEntry): Promise<void> {
    if (!logFile) return;

    try {
      const logLine = JSON.stringify(entry) + "\n";
      await Deno.writeTextFile(logFile, logLine, { append: true });
    } catch (error) {
      console.error(`[highlight-undo] Failed to write to log file: ${error}`);
    }
  }

  function log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
    };
    writeLog(entry);
  }

  return {
    setDebugMode(enabled: boolean): void {
      debugMode = enabled;
    },

    setLogFile(path: string): void {
      logFile = path;
    },

    setLogLevel(level: LogLevel): void {
      logLevel = level;
    },

    debug(message: string, context?: Record<string, unknown>): void {
      if (shouldLog("debug")) {
        log("debug", message, context);
      }
    },

    info(message: string, context?: Record<string, unknown>): void {
      if (shouldLog("info")) {
        log("info", message, context);
      }
    },

    warn(message: string, context?: Record<string, unknown>): void {
      if (shouldLog("warn")) {
        log("warn", message, context);
      }
    },

    error(message: string, context?: Record<string, unknown>): void {
      if (shouldLog("error")) {
        log("error", message, context);
      }
    },

    performance(
      message: string,
      duration: number,
      marks?: Record<string, number>,
      context?: Record<string, unknown>,
    ): void {
      if (shouldLog("debug")) {
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
        writeLog(entry);
      }
    },
  };
}

// Backward compatibility
export class Logger implements ILogger {
  private logger: ReturnType<typeof createLogger>;

  constructor(options: { debugMode?: boolean; logFile?: string; logLevel?: LogLevel } = {}) {
    this.logger = createLogger(options);
  }

  setDebugMode(enabled: boolean): void {
    this.logger.setDebugMode(enabled);
  }

  setLogFile(path: string): void {
    this.logger.setLogFile(path);
  }

  setLogLevel(level: LogLevel): void {
    this.logger.setLogLevel(level);
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.logger.debug(message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.logger.info(message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.logger.warn(message, context);
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.logger.error(message, context);
  }

  performance(
    message: string,
    duration: number,
    marks?: Record<string, number>,
    context?: Record<string, unknown>,
  ): void {
    this.logger.performance(message, duration, marks, context);
  }
}
