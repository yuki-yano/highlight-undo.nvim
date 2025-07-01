#!/usr/bin/env -S deno run --allow-read --allow-write

// Script to generate Lua type definitions from TypeScript schema

import { ConfigSchema } from "../denops/highlight-undo/config-schema.ts";

const luaTypeTemplate = `-- Auto-generated from config-schema.ts
-- DO NOT EDIT MANUALLY

---@class highlight-undo.Config
---@field public mappings highlight-undo.Mappings
---@field public enabled highlight-undo.Enabled
---@field public highlight highlight-undo.Highlight
---@field public threshold highlight-undo.Threshold
---@field public duration number
---@field public debug? boolean
---@field public logFile? string

---@class highlight-undo.Mappings
---@field public undo string
---@field public redo string

---@class highlight-undo.Enabled
---@field public added boolean
---@field public removed boolean

---@class highlight-undo.Highlight
---@field public added string
---@field public removed string

---@class highlight-undo.Threshold
---@field public line number
---@field public char number
`;

// Write Lua types
await Deno.writeTextFile(
  "./lua/highlight-undo/types.lua",
  luaTypeTemplate
);

console.log("✅ Generated Lua type definitions");

// Also update the config.ts to use the schema
const configTs = `// Auto-generated config module using unified schema
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
`;

await Deno.writeTextFile(
  "./denops/highlight-undo/config.ts",
  configTs
);

console.log("✅ Updated config.ts to use unified schema");
console.log("🎉 Type generation complete!");