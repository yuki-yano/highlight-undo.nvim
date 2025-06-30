import { assertEquals } from "https://deno.land/std@0.173.0/testing/asserts.ts";
import { describe, it } from "https://deno.land/std@0.173.0/testing/bdd.ts";
import { BufferStateManager } from "./buffer-state.ts";

describe("BufferStateManager", () => {
  it("should store and retrieve buffer data", () => {
    const manager = new BufferStateManager();
    const bufnr = 1;
    const preCode = "hello world";
    const postCode = "hello beautiful world";

    manager.set(bufnr, preCode, postCode);
    const result = manager.get(bufnr);

    assertEquals(result, { preCode, postCode });
  });

  it("should return null for non-existent buffer", () => {
    const manager = new BufferStateManager();
    const result = manager.get(999);

    assertEquals(result, null);
  });

  it("should clear specific buffer", () => {
    const manager = new BufferStateManager();
    manager.set(1, "pre1", "post1");
    manager.set(2, "pre2", "post2");

    manager.clear(1);

    assertEquals(manager.get(1), null);
    assertEquals(manager.get(2), { preCode: "pre2", postCode: "post2" });
  });

  it("should clear all buffers", () => {
    const manager = new BufferStateManager();
    manager.set(1, "pre1", "post1");
    manager.set(2, "pre2", "post2");

    manager.clearAll();

    assertEquals(manager.get(1), null);
    assertEquals(manager.get(2), null);
  });

  it("should track cache size", () => {
    const manager = new BufferStateManager();
    const stats1 = manager.getStats();
    assertEquals(stats1.bufferCount, 0);
    assertEquals(stats1.cacheSize, 0);

    manager.set(1, "hello", "world");
    const stats2 = manager.getStats();
    assertEquals(stats2.bufferCount, 1);
    assertEquals(stats2.cacheSize, 10); // "hello" + "world" = 10

    manager.set(2, "foo", "bar");
    const stats3 = manager.getStats();
    assertEquals(stats3.bufferCount, 2);
    assertEquals(stats3.cacheSize, 16); // 10 + "foo" + "bar" = 16
  });

  it("should track buffer count correctly", () => {
    const manager = new BufferStateManager();

    assertEquals(manager.getStats().bufferCount, 0);

    manager.set(1, "hello", "world");
    assertEquals(manager.getStats().bufferCount, 1);

    manager.set(2, "foo", "bar");
    assertEquals(manager.getStats().bufferCount, 2);

    manager.clear(1);
    assertEquals(manager.getStats().bufferCount, 1);

    manager.clearAll();
    assertEquals(manager.getStats().bufferCount, 0);
  });
});
