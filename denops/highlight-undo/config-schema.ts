// Unified configuration schema for TypeScript and Lua

export interface ConfigSchema {
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
}

export const defaultConfig: ConfigSchema = {
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
};

// Type guard for runtime validation
export function isValidConfig(config: unknown): config is ConfigSchema {
  if (typeof config !== "object" || config === null) {
    return false;
  }

  const c = config as any;

  // Check required fields
  return (
    typeof c.mappings === "object" &&
    typeof c.mappings.undo === "string" &&
    typeof c.mappings.redo === "string" &&
    typeof c.enabled === "object" &&
    typeof c.enabled.added === "boolean" &&
    typeof c.enabled.removed === "boolean" &&
    typeof c.highlight === "object" &&
    typeof c.highlight.added === "string" &&
    typeof c.highlight.removed === "string" &&
    typeof c.threshold === "object" &&
    typeof c.threshold.line === "number" &&
    typeof c.threshold.char === "number" &&
    typeof c.duration === "number" &&
    (c.debug === undefined || typeof c.debug === "boolean") &&
    (c.logFile === undefined || typeof c.logFile === "string")
  );
}

export function mergeConfig(userConfig: unknown): ConfigSchema {
  if (!isValidConfig(userConfig)) {
    throw new Error("Invalid configuration provided");
  }

  return {
    ...defaultConfig,
    ...userConfig,
    mappings: {
      ...defaultConfig.mappings,
      ...userConfig.mappings,
    },
    enabled: {
      ...defaultConfig.enabled,
      ...userConfig.enabled,
    },
    highlight: {
      ...defaultConfig.highlight,
      ...userConfig.highlight,
    },
    threshold: {
      ...defaultConfig.threshold,
      ...userConfig.threshold,
    },
  };
}
