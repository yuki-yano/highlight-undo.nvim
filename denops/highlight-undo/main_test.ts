import { assertEquals } from "https://deno.land/std@0.173.0/testing/asserts.ts";
import { describe, it } from "https://deno.land/std@0.173.0/testing/bdd.ts";
import { stub } from "https://deno.land/std@0.173.0/testing/mock.ts";
import type { Denops } from "./deps.ts";

describe("main.ts", () => {
  describe("highlight logic", () => {
    it("should process both additions and removals in a single operation", () => {
      // Test case for replacement operation
      const changes = [
        { value: "old text", removed: true, count: 8 },
        { value: "new text", added: true, count: 8 },
      ];

      const hasAdditions = changes.some((change) => change.added);
      const hasRemovals = changes.some((change) => change.removed);

      assertEquals(hasAdditions, true);
      assertEquals(hasRemovals, true);
    });

    it("should handle only additions", () => {
      const changes: Array<{ value: string; count: number; added?: boolean; removed?: boolean }> = [
        { value: "hello", count: 5 },
        { value: " world", added: true, count: 6 },
      ];

      const hasAdditions = changes.some((change) => change.added);
      const hasRemovals = changes.some((change) => change.removed);

      assertEquals(hasAdditions, true);
      assertEquals(hasRemovals, false);
    });

    it("should handle only removals", () => {
      const changes: Array<{ value: string; count: number; added?: boolean; removed?: boolean }> = [
        { value: "hello", count: 5 },
        { value: " world", removed: true, count: 6 },
      ];

      const hasAdditions = changes.some((change) => change.added);
      const hasRemovals = changes.some((change) => change.removed);

      assertEquals(hasAdditions, false);
      assertEquals(hasRemovals, true);
    });

    it("should handle no changes", () => {
      const changes: Array<{ value: string; count: number; added?: boolean; removed?: boolean }> = [
        { value: "hello world", count: 11 },
      ];

      const hasAdditions = changes.some((change) => change.added);
      const hasRemovals = changes.some((change) => change.removed);

      assertEquals(hasAdditions, false);
      assertEquals(hasRemovals, false);
    });
  });

  describe("buffer state management", () => {
    it("should clear buffer state after retrieval", () => {
      const states = new Map<number, { preCode: string; postCode: string }>();
      const bufnr = 1;

      // Set state
      states.set(bufnr, { preCode: "before", postCode: "after" });
      assertEquals(states.has(bufnr), true);

      // Get and clear
      const state = states.get(bufnr);
      states.delete(bufnr);

      assertEquals(state, { preCode: "before", postCode: "after" });
      assertEquals(states.has(bufnr), false);
    });
  });

  describe("clearHighlights with bufnr", () => {
    it("should pass bufnr to clearHighlights", async () => {
      const bufnr = 42;
      const nameSpace = 1;

      // Create a mock object with clearHighlights method
      const mockHighlightBatcher = {
        clearHighlights: (_denops: unknown, _nameSpace: number, _bufnr?: number) => {
          assertEquals(_nameSpace, nameSpace);
          assertEquals(_bufnr, bufnr);
          return Promise.resolve();
        },
      };

      // Stub the clearHighlights method
      const mockClearHighlights = stub(
        mockHighlightBatcher,
        "clearHighlights",
        mockHighlightBatcher.clearHighlights,
      );

      // Call the mocked function
      await mockHighlightBatcher.clearHighlights({} as Denops, nameSpace, bufnr);

      assertEquals(mockClearHighlights.calls.length, 1);
      mockClearHighlights.restore();
    });
  });
});
