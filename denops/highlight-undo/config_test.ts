import { assertEquals, assertThrows } from "https://deno.land/std@0.173.0/testing/asserts.ts";
import { describe, it } from "https://deno.land/std@0.173.0/testing/bdd.ts";
import { defaultConfig, mergeConfig, validateConfig } from "./config.ts";

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

  it("should throw on non-object config", () => {
    assertThrows(
      () => validateConfig(null),
      Error,
      "Config must be an object",
    );

    assertThrows(
      () => validateConfig("string"),
      Error,
      "Config must be an object",
    );
  });

  it("should throw on missing mappings", () => {
    const config = {
      enabled: { added: true, removed: false },
      highlight: { added: "DiffAdd", removed: "DiffDelete" },
      threshold: { line: 100, char: 2000 },
      duration: 300,
    };

    assertThrows(
      () => validateConfig(config),
      Error,
      "Config.mappings must be an object",
    );
  });

  it("should throw on invalid mapping types", () => {
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
      "Config.mappings.undo and redo must be strings",
    );
  });

  it("should throw on invalid enabled types", () => {
    const config = {
      mappings: { undo: "u", redo: "<C-r>" },
      enabled: { added: "true", removed: false },
      highlight: { added: "DiffAdd", removed: "DiffDelete" },
      threshold: { line: 100, char: 2000 },
      duration: 300,
    };

    assertThrows(
      () => validateConfig(config),
      Error,
      "Config.enabled.added and removed must be booleans",
    );
  });

  it("should throw on non-positive threshold values", () => {
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
      "Config.threshold values must be positive",
    );
  });

  it("should throw on non-positive duration", () => {
    const config = {
      mappings: { undo: "u", redo: "<C-r>" },
      enabled: { added: true, removed: false },
      highlight: { added: "DiffAdd", removed: "DiffDelete" },
      threshold: { line: 100, char: 2000 },
      duration: -100,
    };

    assertThrows(
      () => validateConfig(config),
      Error,
      "Config.duration must be positive",
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
});
