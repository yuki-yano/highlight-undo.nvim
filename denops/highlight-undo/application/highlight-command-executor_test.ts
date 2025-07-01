import { assertEquals, assertExists } from "https://deno.land/std@0.173.0/testing/asserts.ts";
import { describe, it } from "https://deno.land/std@0.173.0/testing/bdd.ts";
import { HighlightCommandExecutor } from "./highlight-command-executor.ts";
import { BufferStateManager } from "./buffer-state.ts";
import { DiffOptimizer } from "../core/diff-optimizer.ts";
import { HighlightBatcher } from "../infrastructure/highlight-batcher.ts";
import { ErrorHandler } from "../error-handler.ts";
import type { Config } from "../config.ts";
import type { Denops } from "../deps.ts";
import { fn } from "../deps.ts";

// Mock fn functions
const originalUndotree = fn.undotree;
const originalGetline = fn.getline;
const originalBufnr = fn.bufnr;

// Override fn functions for testing
(fn as any).undotree = async () => ({ entries: [{ curhead: 1 }] });
(fn as any).getline = async () => ["test line"];
(fn as any).bufnr = async () => 1;

// Mock Denops
class MockDenops implements Partial<Denops> {
  private commands: string[] = [];
  
  async cmd(cmd: string): Promise<void> {
    this.commands.push(cmd);
  }
  
  async call(fn: string, ...args: unknown[]): Promise<unknown> {
    if (fn === "nvim_create_namespace") {
      return 1;
    }
    if (fn === "luaeval") {
      return null;
    }
    return null;
  }
  
  async eval(expr: string): Promise<unknown> {
    return 0;
  }
  
  getCommands(): string[] {
    return this.commands;
  }
  
  clearCommands(): void {
    this.commands = [];
  }
}

// Cleanup function to restore original functions
function cleanupMocks() {
  (fn as any).undotree = originalUndotree;
  (fn as any).getline = originalGetline;
  (fn as any).bufnr = originalBufnr;
}

describe("HighlightCommandExecutor", () => {
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
  
  describe("execute", () => {
    it("should execute command without highlight when no buffer state exists", async () => {
      const deps = createMockDeps();
      const executor = new HighlightCommandExecutor(deps);
      const denops = new MockDenops() as unknown as Denops;
      
      await executor.execute(denops, "undo", 1);
      
      const commands = (denops as any).getCommands();
      assertEquals(commands.length, 1);
      assertEquals(commands[0], "undo");
    });
    
    it("should apply highlights before command for undo with removals", async () => {
      const deps = createMockDeps();
      const executor = new HighlightCommandExecutor(deps);
      const denops = new MockDenops() as unknown as Denops;
      
      // Set up buffer state with removal
      deps.bufferStates.set(1, "hello world", "hello");
      
      // Mock the necessary functions
      const originalCmd = denops.cmd;
      let commandExecuted = false;
      let highlightApplied = false;
      
      (denops as any).cmd = async (cmd: string) => {
        if (cmd === "undo") {
          commandExecuted = true;
          // Highlight should be applied before command
          assertEquals(highlightApplied, true);
        }
        return originalCmd?.call(denops, cmd);
      };
      
      // Mock highlight application
      const originalApply = deps.highlightBatcher.applyHighlights;
      deps.highlightBatcher.applyHighlights = async (...args) => {
        highlightApplied = true;
        return originalApply.apply(deps.highlightBatcher, args);
      };
      
      await executor.execute(denops, "undo", 1);
      
      assertEquals(commandExecuted, true);
      assertEquals(highlightApplied, true);
    });
    
    it("should apply highlights after command for redo with additions", async () => {
      const deps = createMockDeps();
      const executor = new HighlightCommandExecutor(deps);
      const denops = new MockDenops() as unknown as Denops;
      
      // Set up buffer state with addition
      deps.bufferStates.set(1, "hello", "hello world");
      
      // Mock the necessary functions
      const originalCmd = denops.cmd;
      let commandExecuted = false;
      let highlightApplied = false;
      
      (denops as any).cmd = async (cmd: string) => {
        if (cmd === "redo") {
          commandExecuted = true;
          // Highlight should be applied after command
          assertEquals(highlightApplied, false);
        }
        return originalCmd?.call(denops, cmd);
      };
      
      // Mock highlight application
      const originalApply = deps.highlightBatcher.applyHighlights;
      deps.highlightBatcher.applyHighlights = async (...args) => {
        highlightApplied = true;
        // Command should be executed before highlight
        assertEquals(commandExecuted, true);
        return originalApply.apply(deps.highlightBatcher, args);
      };
      
      await executor.execute(denops, "redo", 1);
      
      assertEquals(commandExecuted, true);
      assertEquals(highlightApplied, true);
    });
    
    it("should clear buffer state after retrieval", async () => {
      const deps = createMockDeps();
      const executor = new HighlightCommandExecutor(deps);
      const denops = new MockDenops() as unknown as Denops;
      
      deps.bufferStates.set(1, "before", "after");
      assertExists(deps.bufferStates.get(1));
      
      await executor.execute(denops, "undo", 1);
      
      // Buffer state should be cleared after use
      assertEquals(deps.bufferStates.get(1), null);
    });
    
    it("should handle no diff result gracefully", async () => {
      const deps = createMockDeps();
      const executor = new HighlightCommandExecutor(deps);
      const denops = new MockDenops() as unknown as Denops;
      
      // Set up identical states (no diff)
      deps.bufferStates.set(1, "same", "same");
      
      await executor.execute(denops, "undo", 1);
      
      const commands = (denops as any).getCommands();
      assertEquals(commands.length, 1);
      assertEquals(commands[0], "undo");
    });
  });
});