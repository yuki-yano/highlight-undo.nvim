import { assertEquals, assertThrows } from "./deps.ts";
import { describe, it } from "./deps.ts";
import { mergeConfig, validateConfig } from "./config.ts";
import { defaultConfig } from "./config-schema.ts";

describe("validateConfig", () => {
  it("should validate a correct config", () => {
    const config = {
      mappings: { undo: "u", redo: "<C-r>" },
      enabled: { added: true, removed: false },
      highlight: { added: "DiffAdd", removed: "DiffDelete" },
      threshold: { line: 100, char: 2000 },
      duration: 300,
    };

    const result = validateConfig(config);
    assertEquals(result, config);
  });

  it("should throw on invalid config with proper error message", () => {
    const config = {
      mappings: { undo: 123, redo: "<C-r>" },
      enabled: { added: true, removed: false },
      highlight: { added: "DiffAdd", removed: "DiffDelete" },
      threshold: { line: 100, char: 2000 },
      duration: 300,
    };

    assertThrows(
      () => validateConfig(config),
      Error,
      "Config validation failed:",
    );
  });

  it("should throw on missing required fields", () => {
    const config = {
      enabled: { added: true, removed: false },
      highlight: { added: "DiffAdd", removed: "DiffDelete" },
      threshold: { line: 100, char: 2000 },
      duration: 300,
    };

    assertThrows(
      () => validateConfig(config),
      Error,
      "Config validation failed:",
    );
  });

  it("should throw on non-positive values", () => {
    const config = {
      mappings: { undo: "u", redo: "<C-r>" },
      enabled: { added: true, removed: false },
      highlight: { added: "DiffAdd", removed: "DiffDelete" },
      threshold: { line: 0, char: 2000 },
      duration: 300,
    };

    assertThrows(
      () => validateConfig(config),
      Error,
      "Config validation failed:",
    );
  });
});

describe("mergeConfig", () => {
  it("should merge with default config", () => {
    const partial = {
      mappings: { undo: "U" },
      duration: 500,
    };

    const result = mergeConfig(partial);

    assertEquals(result.mappings.undo, "U");
    assertEquals(result.mappings.redo, defaultConfig.mappings.redo);
    assertEquals(result.duration, 500);
    assertEquals(result.enabled, defaultConfig.enabled);
  });

  it("should merge with custom base config", () => {
    const base = {
      mappings: { undo: "z", redo: "Z" },
      enabled: { added: false, removed: false },
      highlight: { added: "Error", removed: "Warning" },
      threshold: { line: 10, char: 100 },
      duration: 50,
    };

    const partial = {
      enabled: { added: true },
      threshold: { line: 20 },
    };

    const result = mergeConfig(partial, base);

    assertEquals(result.mappings, base.mappings);
    assertEquals(result.enabled.added, true);
    assertEquals(result.enabled.removed, false);
    assertEquals(result.threshold.line, 20);
    assertEquals(result.threshold.char, 100);
  });

  it("should handle empty partial config", () => {
    const result = mergeConfig({});
    assertEquals(result, defaultConfig);
  });

  it("should handle nested partial configs", () => {
    const partial = {
      mappings: { redo: "<C-R>" },
      highlight: { removed: "ErrorMsg" },
    };

    const result = mergeConfig(partial);

    assertEquals(result.mappings.undo, defaultConfig.mappings.undo);
    assertEquals(result.mappings.redo, "<C-R>");
    assertEquals(result.highlight.added, defaultConfig.highlight.added);
    assertEquals(result.highlight.removed, "ErrorMsg");
  });

  it("should validate invalid partial config", () => {
    const partial = {
      duration: "invalid",
    };

    assertThrows(
      () => mergeConfig(partial),
      Error,
      "Config validation failed:",
    );
  });

  it("should handle optional fields correctly", () => {
    const partial = {
      debug: true,
      logFile: "/tmp/test.log",
      rangeAdjustments: {
        adjustWordBoundaries: false,
      },
      heuristics: {
        enabled: false,
      },
    };

    const result = mergeConfig(partial);

    assertEquals(result.debug, true);
    assertEquals(result.logFile, "/tmp/test.log");
    assertEquals(result.rangeAdjustments?.adjustWordBoundaries, false);
    assertEquals(result.rangeAdjustments?.handleWhitespace, true);
    assertEquals(result.heuristics?.enabled, false);
  });
});
