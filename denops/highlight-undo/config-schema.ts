// Unified configuration schema for TypeScript and Lua using Zod
import { z } from "./deps.ts";

// Define the schema using Zod
export const ConfigSchema = z.object({
  mappings: z.object({
    undo: z.string(),
    redo: z.string(),
  }),
  enabled: z.object({
    added: z.boolean(),
    removed: z.boolean(),
  }),
  highlight: z.object({
    added: z.string(),
    removed: z.string(),
  }),
  threshold: z.object({
    line: z.number().positive(),
    char: z.number().positive(),
  }),
  duration: z.number().positive(),
  debug: z.boolean().optional(),
  logFile: z.string().optional(),
  rangeAdjustments: z.object({
    adjustWordBoundaries: z.boolean().optional(),
    handleWhitespace: z.boolean().optional(),
  }).optional(),
  heuristics: z.object({
    enabled: z.boolean().optional(),
    thresholds: z.object({
      tiny: z.number().optional(),
      small: z.number().optional(),
      medium: z.number().optional(),
    }).optional(),
    strategies: z.object({
      tiny: z.enum(["character", "word", "line", "block"]).optional(),
      small: z.enum(["character", "word", "line", "block"]).optional(),
      medium: z.enum(["character", "word", "line", "block"]).optional(),
      large: z.enum(["character", "word", "line", "block"]).optional(),
    }).optional(),
  }).optional(),
});

// Infer the TypeScript type from the Zod schema
export type Config = z.infer<typeof ConfigSchema>;

// Default configuration values
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
  rangeAdjustments: {
    adjustWordBoundaries: true,
    handleWhitespace: true,
  },
  heuristics: {
    enabled: true,
    thresholds: {
      tiny: 5,
      small: 20,
      medium: 100,
    },
    strategies: {
      tiny: "character",
      small: "word",
      medium: "line",
      large: "block",
    },
  },
};

// Partial schema for user configuration (all fields optional)
export const PartialConfigSchema = ConfigSchema.deepPartial();
export type PartialConfig = z.infer<typeof PartialConfigSchema>;