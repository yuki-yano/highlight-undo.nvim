// Auto-generated config module using unified schema
import { Config, ConfigSchema, defaultConfig, PartialConfig, PartialConfigSchema } from "./config-schema.ts";
import { z } from "./deps.ts";
import { ChangeSize, DisplayStrategy } from "./core/heuristic-strategy.ts";

export type { Config, PartialConfig };

export function validateConfig(userConfig: unknown): Config {
  try {
    return ConfigSchema.parse(userConfig);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ");
      throw new Error(`Config validation failed: ${issues}`);
    }
    throw error;
  }
}

export function mergeConfig(userConfig: unknown, base?: Config): Config {
  const defaults = base ?? defaultConfig;

  // Parse the partial config
  let partialConfig: PartialConfig;
  try {
    partialConfig = PartialConfigSchema.parse(userConfig ?? {});
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ");
      throw new Error(`Config validation failed: ${issues}`);
    }
    throw error;
  }

  // Deep merge with defaults
  const merged: Config = {
    mappings: {
      undo: partialConfig.mappings?.undo ?? defaults.mappings.undo,
      redo: partialConfig.mappings?.redo ?? defaults.mappings.redo,
    },
    enabled: {
      added: partialConfig.enabled?.added ?? defaults.enabled.added,
      removed: partialConfig.enabled?.removed ?? defaults.enabled.removed,
    },
    highlight: {
      added: partialConfig.highlight?.added ?? defaults.highlight.added,
      removed: partialConfig.highlight?.removed ?? defaults.highlight.removed,
    },
    threshold: {
      line: partialConfig.threshold?.line ?? defaults.threshold.line,
      char: partialConfig.threshold?.char ?? defaults.threshold.char,
    },
    duration: partialConfig.duration ?? defaults.duration,
  };

  // Add optional fields if present
  if (partialConfig.debug !== undefined || defaults.debug !== undefined) {
    merged.debug = partialConfig.debug ?? defaults.debug;
  }
  if (partialConfig.logFile !== undefined || defaults.logFile !== undefined) {
    merged.logFile = partialConfig.logFile ?? defaults.logFile;
  }

  // Handle rangeAdjustments
  if (partialConfig.rangeAdjustments !== undefined || defaults.rangeAdjustments !== undefined) {
    merged.rangeAdjustments = {
      adjustWordBoundaries: partialConfig.rangeAdjustments?.adjustWordBoundaries ??
        defaults.rangeAdjustments?.adjustWordBoundaries ?? true,
      handleWhitespace: partialConfig.rangeAdjustments?.handleWhitespace ??
        defaults.rangeAdjustments?.handleWhitespace ?? true,
    };
  }

  // Handle heuristics
  if (partialConfig.heuristics !== undefined || defaults.heuristics !== undefined) {
    merged.heuristics = {
      enabled: partialConfig.heuristics?.enabled ??
        defaults.heuristics?.enabled ?? true,
    };

    // Merge thresholds
    if (partialConfig.heuristics?.thresholds !== undefined || defaults.heuristics?.thresholds !== undefined) {
      merged.heuristics.thresholds = {
        tiny: partialConfig.heuristics?.thresholds?.tiny ??
          defaults.heuristics?.thresholds?.tiny ?? 5,
        small: partialConfig.heuristics?.thresholds?.small ??
          defaults.heuristics?.thresholds?.small ?? 20,
        medium: partialConfig.heuristics?.thresholds?.medium ??
          defaults.heuristics?.thresholds?.medium ?? 100,
      };
    }

    // Merge strategies
    if (partialConfig.heuristics?.strategies !== undefined || defaults.heuristics?.strategies !== undefined) {
      merged.heuristics.strategies = {
        [ChangeSize.Tiny]: (partialConfig.heuristics?.strategies?.tiny ??
          defaults.heuristics?.strategies?.tiny ?? "character") as DisplayStrategy,
        [ChangeSize.Small]: (partialConfig.heuristics?.strategies?.small ??
          defaults.heuristics?.strategies?.small ?? "word") as DisplayStrategy,
        [ChangeSize.Medium]: (partialConfig.heuristics?.strategies?.medium ??
          defaults.heuristics?.strategies?.medium ?? "line") as DisplayStrategy,
        [ChangeSize.Large]: (partialConfig.heuristics?.strategies?.large ??
          defaults.heuristics?.strategies?.large ?? "block") as DisplayStrategy,
      };
    }
  }

  // Validate the merged config
  return ConfigSchema.parse(merged);
}
