// Auto-generated config module using unified schema
import { ConfigSchema, defaultConfig } from "./config-schema.ts";

export type Config = ConfigSchema;

export function validateConfig(userConfig: unknown): Config {
  if (typeof userConfig !== "object" || userConfig === null) {
    throw new Error("Config must be an object");
  }

  const uc = userConfig as Record<string, unknown>;

  // Check mappings
  if (typeof uc.mappings !== "object" || uc.mappings === null) {
    throw new Error("Config.mappings must be an object");
  }
  const mappings = uc.mappings as Record<string, unknown>;
  if (typeof mappings.undo !== "string" || typeof mappings.redo !== "string") {
    throw new Error("Config.mappings.undo and redo must be strings");
  }

  // Check enabled
  if (typeof uc.enabled !== "object" || uc.enabled === null) {
    throw new Error("Config.enabled must be an object");
  }
  const enabled = uc.enabled as Record<string, unknown>;
  if (typeof enabled.added !== "boolean" || typeof enabled.removed !== "boolean") {
    throw new Error("Config.enabled.added and removed must be booleans");
  }

  // Check highlight
  if (typeof uc.highlight !== "object" || uc.highlight === null) {
    throw new Error("Config.highlight must be an object");
  }
  const highlight = uc.highlight as Record<string, unknown>;
  if (typeof highlight.added !== "string" || typeof highlight.removed !== "string") {
    throw new Error("Config.highlight.added and removed must be strings");
  }

  // Check threshold
  if (typeof uc.threshold !== "object" || uc.threshold === null) {
    throw new Error("Config.threshold must be an object");
  }
  const threshold = uc.threshold as Record<string, unknown>;
  if (typeof threshold.line !== "number" || typeof threshold.char !== "number") {
    throw new Error("Config.threshold.line and char must be numbers");
  }
  if (threshold.line <= 0 || threshold.char <= 0) {
    throw new Error("Config.threshold values must be positive");
  }

  // Check duration
  if (typeof uc.duration !== "number") {
    throw new Error("Config.duration must be a number");
  }
  if (uc.duration <= 0) {
    throw new Error("Config.duration must be positive");
  }

  // Return validated config without undefined fields
  const result: Config = {
    mappings: uc.mappings as Config["mappings"],
    enabled: uc.enabled as Config["enabled"],
    highlight: uc.highlight as Config["highlight"],
    threshold: uc.threshold as Config["threshold"],
    duration: uc.duration as number,
  };

  // Only add optional fields if they are defined
  if (uc.debug !== undefined) {
    result.debug = uc.debug as boolean;
  }
  if (uc.logFile !== undefined) {
    result.logFile = uc.logFile as string;
  }
  if (uc.rangeAdjustments !== undefined) {
    // Validate rangeAdjustments if provided
    if (typeof uc.rangeAdjustments !== "object" || uc.rangeAdjustments === null) {
      throw new Error("Config.rangeAdjustments must be an object");
    }
    const ra = uc.rangeAdjustments as Record<string, unknown>;
    if (ra.adjustWordBoundaries !== undefined && typeof ra.adjustWordBoundaries !== "boolean") {
      throw new Error("Config.rangeAdjustments.adjustWordBoundaries must be a boolean");
    }
    if (ra.handleWhitespace !== undefined && typeof ra.handleWhitespace !== "boolean") {
      throw new Error("Config.rangeAdjustments.handleWhitespace must be a boolean");
    }
    result.rangeAdjustments = uc.rangeAdjustments as Config["rangeAdjustments"];
  }

  return result;
}

export function mergeConfig(userConfig: unknown, base?: Config): Config {
  return mergeWithDefaults(userConfig, base);
}

function mergeWithDefaults(userConfig: unknown, base?: Config): Config {
  const uc = userConfig as Record<string, unknown> | null | undefined;
  const mappings = uc?.mappings as Record<string, unknown> | undefined;
  const enabled = uc?.enabled as Record<string, unknown> | undefined;
  const highlight = uc?.highlight as Record<string, unknown> | undefined;
  const threshold = uc?.threshold as Record<string, unknown> | undefined;
  const rangeAdjustments = uc?.rangeAdjustments as Record<string, unknown> | undefined;

  const defaults = base ?? defaultConfig;

  const result: Config = {
    mappings: {
      undo: (mappings?.undo as string | undefined) ?? defaults.mappings.undo,
      redo: (mappings?.redo as string | undefined) ?? defaults.mappings.redo,
    },
    enabled: {
      added: (enabled?.added as boolean | undefined) ?? defaults.enabled.added,
      removed: (enabled?.removed as boolean | undefined) ?? defaults.enabled.removed,
    },
    highlight: {
      added: (highlight?.added as string | undefined) ?? defaults.highlight.added,
      removed: (highlight?.removed as string | undefined) ?? defaults.highlight.removed,
    },
    threshold: {
      line: (threshold?.line as number | undefined) ?? defaults.threshold.line,
      char: (threshold?.char as number | undefined) ?? defaults.threshold.char,
    },
    duration: (uc?.duration as number | undefined) ?? defaults.duration,
  };

  // Only add optional fields if they exist in either the user config or base config
  const debug = uc?.debug as boolean | undefined ?? defaults.debug;
  const logFile = uc?.logFile as string | undefined ?? defaults.logFile;

  if (debug !== undefined) {
    result.debug = debug;
  }
  if (logFile !== undefined) {
    result.logFile = logFile;
  }
  
  // Handle rangeAdjustments
  if (rangeAdjustments !== undefined || defaults.rangeAdjustments !== undefined) {
    result.rangeAdjustments = {
      adjustWordBoundaries: (rangeAdjustments?.adjustWordBoundaries as boolean | undefined) ?? 
                           defaults.rangeAdjustments?.adjustWordBoundaries ?? true,
      handleWhitespace: (rangeAdjustments?.handleWhitespace as boolean | undefined) ?? 
                       defaults.rangeAdjustments?.handleWhitespace ?? true,
    };
  }

  return result;
}
