// Configuration type definitions and validation

export type Config = {
  mappings: {
    undo: string;
    redo: string;
  };
  enabled: {
    added: boolean;
    removed: boolean;
  };
  highlight: {
    added: string;
    removed: string;
  };
  threshold: {
    line: number;
    char: number;
  };
  duration: number;
  debug?: boolean;
  logFile?: string;
};

export const defaultConfig: Config = {
  mappings: {
    undo: "u",
    redo: "<C-r>",
  },
  enabled: {
    added: true,
    removed: true,
  },
  highlight: {
    added: "DiffAdd",
    removed: "DiffDelete",
  },
  threshold: {
    line: 50,
    char: 1500,
  },
  duration: 200,
  debug: false,
};

export function validateConfig(config: unknown): Config {
  if (!config || typeof config !== "object") {
    throw new Error("Config must be an object");
  }

  const c = config as Record<string, unknown>;

  // Validate mappings
  if (!c.mappings || typeof c.mappings !== "object") {
    throw new Error("Config.mappings must be an object");
  }
  const mappings = c.mappings as Record<string, unknown>;
  if (typeof mappings.undo !== "string" || typeof mappings.redo !== "string") {
    throw new Error("Config.mappings.undo and redo must be strings");
  }

  // Validate enabled
  if (!c.enabled || typeof c.enabled !== "object") {
    throw new Error("Config.enabled must be an object");
  }
  const enabled = c.enabled as Record<string, unknown>;
  if (typeof enabled.added !== "boolean" || typeof enabled.removed !== "boolean") {
    throw new Error("Config.enabled.added and removed must be booleans");
  }

  // Validate highlight
  if (!c.highlight || typeof c.highlight !== "object") {
    throw new Error("Config.highlight must be an object");
  }
  const highlight = c.highlight as Record<string, unknown>;
  if (typeof highlight.added !== "string" || typeof highlight.removed !== "string") {
    throw new Error("Config.highlight.added and removed must be strings");
  }

  // Validate threshold
  if (!c.threshold || typeof c.threshold !== "object") {
    throw new Error("Config.threshold must be an object");
  }
  const threshold = c.threshold as Record<string, unknown>;
  if (typeof threshold.line !== "number" || typeof threshold.char !== "number") {
    throw new Error("Config.threshold.line and char must be numbers");
  }
  if (threshold.line <= 0 || threshold.char <= 0) {
    throw new Error("Config.threshold values must be positive");
  }

  // Validate duration
  if (typeof c.duration !== "number") {
    throw new Error("Config.duration must be a number");
  }
  if ((c.duration as number) <= 0) {
    throw new Error("Config.duration must be positive");
  }

  // Validate optional debug
  if (c.debug !== undefined && typeof c.debug !== "boolean") {
    throw new Error("Config.debug must be a boolean if provided");
  }

  // Validate optional logFile
  if (c.logFile !== undefined && typeof c.logFile !== "string") {
    throw new Error("Config.logFile must be a string if provided");
  }

  return config as Config;
}

export type DeepPartial<T> = T extends object ? {
    [P in keyof T]?: DeepPartial<T[P]>;
  }
  : T;

export function mergeConfig(partial: DeepPartial<Config>, base: Config = defaultConfig): Config {
  return {
    mappings: {
      ...base.mappings,
      ...(partial.mappings || {}),
    },
    enabled: {
      ...base.enabled,
      ...(partial.enabled || {}),
    },
    highlight: {
      ...base.highlight,
      ...(partial.highlight || {}),
    },
    threshold: {
      ...base.threshold,
      ...(partial.threshold || {}),
    },
    duration: partial.duration !== undefined ? partial.duration : base.duration,
    ...(base.debug !== undefined || partial.debug !== undefined
      ? { debug: partial.debug !== undefined ? partial.debug : base.debug }
      : {}),
    ...(base.logFile !== undefined || partial.logFile !== undefined
      ? { logFile: partial.logFile !== undefined ? partial.logFile : base.logFile }
      : {}),
  };
}
