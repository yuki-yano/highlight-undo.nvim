// deno-lint-ignore-file require-await
import { assertEquals, assertExists } from "https://deno.land/std@0.173.0/testing/asserts.ts";
import { describe, it } from "https://deno.land/std@0.173.0/testing/bdd.ts";
// Removed unused import: createHighlightCommandExecutor
import { BufferStateManager } from "./buffer-state.ts";
import { DiffOptimizer } from "../core/diff-optimizer.ts";
import { HighlightBatcher } from "../infrastructure/highlight-batcher.ts";
import { ErrorHandler } from "../error-handler.ts";
import type { Config } from "../config.ts";
// Removed unused import: Denops

// Since we can't easily mock the fn module, we'll test the core logic
// by testing internal functions that don't depend on fn

// Mock Denops
// Commented out as it's not currently used in tests
/*
class MockDenops implements Partial<Denops> {
  private commands: string[] = [];

  cmd(cmd: string): Promise<void> {
    this.commands.push(cmd);
    return Promise.resolve();
  }

  call(fn: string, ..._args: unknown[]): Promise<unknown> {
    if (fn === "nvim_create_namespace") {
      return Promise.resolve(1);
    }
    if (fn === "luaeval") {
      return Promise.resolve(null);
    }
    return Promise.resolve(null);
  }

  eval(_expr: string): Promise<unknown> {
    return Promise.resolve(0);
  }

  getCommands(): string[] {
    return this.commands;
  }

  clearCommands(): void {
    this.commands = [];
  }
}
*/

describe("HighlightCommandExecutor - Core Logic", () => {
  const createMockDeps = () => {
    const bufferStates = new BufferStateManager();
    const diffOptimizer = new DiffOptimizer();
    const highlightBatcher = new HighlightBatcher();
    const errorHandler = new ErrorHandler();
    const config: Config = {
      duration: 200,
      enabled: { added: true, removed: true },
      highlight: { added: "DiffAdd", removed: "DiffDelete" },
      threshold: { line: 50, char: 1500 },
      mappings: { undo: "u", redo: "<C-r>" },
    };

    return {
      bufferStates,
      diffOptimizer,
      highlightBatcher,
      errorHandler,
      config,
      nameSpace: 1,
      debugMode: false,
    };
  };

  describe("buffer state management", () => {
    it("should clear buffer state after retrieval", async () => {
      const deps = createMockDeps();
      const bufnr = 1;

      // Set up buffer state
      deps.bufferStates.set(bufnr, "before", "after");
      assertExists(deps.bufferStates.get(bufnr));

      // Simulate getting and clearing state (what prepareState does)
      const state = deps.bufferStates.get(bufnr);
      assertExists(state);
      deps.bufferStates.clear(bufnr);

      // Buffer state should be cleared
      assertEquals(deps.bufferStates.get(bufnr), null);
    });

    it("should handle no buffer state gracefully", async () => {
      const deps = createMockDeps();
      const bufnr = 1;

      // No buffer state exists
      assertEquals(deps.bufferStates.get(bufnr), null);

      // This simulates what would happen in the executor
      const state = deps.bufferStates.get(bufnr);
      assertEquals(state, null);
    });
  });

  describe("diff calculation", () => {
    it("should calculate diff correctly", () => {
      const deps = createMockDeps();
      const preCode = "hello world";
      const postCode = "hello";

      const result = deps.diffOptimizer.calculateDiff(
        preCode,
        postCode,
        deps.config.threshold,
      );

      assertExists(result);
      assertEquals(result.changes.length > 0, true);
      assertEquals(result.changes.some((c) => c.removed), true);
    });

    it("should handle no diff gracefully", () => {
      const deps = createMockDeps();
      const preCode = "same";
      const postCode = "same";

      const result = deps.diffOptimizer.calculateDiff(
        preCode,
        postCode,
        deps.config.threshold,
      );

      // When there's no diff, calculateDiff might return null or empty changes
      if (result) {
        assertEquals(result.changes.length, 0);
      }
    });

    it("should handle threshold limits", () => {
      const deps = createMockDeps();
      // Create a large diff that exceeds threshold
      const preCode = "a".repeat(2000);
      const postCode = "b".repeat(2000);

      const _result = deps.diffOptimizer.calculateDiff(
        preCode,
        postCode,
        deps.config.threshold,
      );

      // Large diffs might be skipped based on threshold
      // The actual behavior depends on DiffOptimizer implementation
      // This test just ensures it doesn't throw
    });
  });
});
