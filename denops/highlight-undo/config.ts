// Auto-generated config module using unified schema
import { ConfigSchema, defaultConfig, isValidConfig, mergeConfig } from "./config-schema.ts";

export type Config = ConfigSchema;

export function validateConfig(userConfig: unknown): Config {
  // Deep merge with defaults
  const merged = mergeWithDefaults(userConfig as any);

  if (!isValidConfig(merged)) {
    throw new Error("Invalid configuration");
  }

  return merged;
}

function mergeWithDefaults(userConfig: any): Config {
  return {
    mappings: {
      undo: userConfig?.mappings?.undo ?? defaultConfig.mappings.undo,
      redo: userConfig?.mappings?.redo ?? defaultConfig.mappings.redo,
    },
    enabled: {
      added: userConfig?.enabled?.added ?? defaultConfig.enabled.added,
      removed: userConfig?.enabled?.removed ?? defaultConfig.enabled.removed,
    },
    highlight: {
      added: userConfig?.highlight?.added ?? defaultConfig.highlight.added,
      removed: userConfig?.highlight?.removed ?? defaultConfig.highlight.removed,
    },
    threshold: {
      line: userConfig?.threshold?.line ?? defaultConfig.threshold.line,
      char: userConfig?.threshold?.char ?? defaultConfig.threshold.char,
    },
    duration: userConfig?.duration ?? defaultConfig.duration,
    debug: userConfig?.debug,
    logFile: userConfig?.logFile,
  };
}
