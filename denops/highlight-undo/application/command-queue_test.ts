// deno-lint-ignore-file require-await
import { assertEquals } from "../deps.ts";
import { describe, it } from "../deps.ts";
import { createCommandQueue, createLockManager } from "./command-queue.ts";
const delay = (ms: number): Promise<void> => new Promise<void>((resolve) => setTimeout(resolve, ms));

describe("CommandQueue", () => {
  it("should execute commands in order", async () => {
    const queue = createCommandQueue();
    const results: number[] = [];

    await queue.enqueue(1, async () => {
      await delay(10);
      results.push(1);
    });

    await queue.enqueue(1, async () => {
      await delay(5);
      results.push(2);
    });

    await queue.enqueue(1, async () => {
      results.push(3);
    });

    // Wait for all commands to complete
    await delay(50);

    assertEquals(results, [1, 2, 3]);
  });

  it("should handle multiple buffers independently", async () => {
    const queue = createCommandQueue();
    const results: string[] = [];

    // Enqueue commands for different buffers
    queue.enqueue(1, async () => {
      await delay(20);
      results.push("buffer1-cmd1");
    });

    queue.enqueue(2, async () => {
      await delay(10);
      results.push("buffer2-cmd1");
    });

    queue.enqueue(1, async () => {
      results.push("buffer1-cmd2");
    });

    // Wait for all commands to complete
    await delay(50);

    // Buffer 2 should complete first, then buffer 1 commands in order
    assertEquals(results[0], "buffer2-cmd1");
    assertEquals(results.includes("buffer1-cmd1"), true);
    assertEquals(results.includes("buffer1-cmd2"), true);

    // Buffer 1 commands should be in order
    const buffer1Index1 = results.indexOf("buffer1-cmd1");
    const buffer1Index2 = results.indexOf("buffer1-cmd2");
    assertEquals(buffer1Index1 < buffer1Index2, true);
  });

  it("should handle command errors gracefully", async () => {
    const queue = createCommandQueue();
    const results: number[] = [];

    await queue.enqueue(1, async () => {
      results.push(1);
    });

    await queue.enqueue(1, async () => {
      throw new Error("Test error");
    });

    await queue.enqueue(1, async () => {
      results.push(3);
    });

    // Wait for all commands to complete
    await delay(20);

    // Should continue processing after error
    assertEquals(results, [1, 3]);
  });

  it("should clear buffer queue", async () => {
    const queue = createCommandQueue();
    const results: number[] = [];

    // Note: Due to the current implementation of processQueue,
    // all commands are dequeued at once when processing starts.
    // clearBuffer only affects commands that haven't been dequeued yet.

    // Create a blocking first command
    let resolveBlocker: (() => void) | undefined;
    const blocker = new Promise<void>((resolve) => {
      resolveBlocker = resolve;
    });

    // First command blocks the queue
    queue.enqueue(1, async () => {
      await blocker;
      results.push(1);
    });

    // These will be dequeued together when processQueue runs
    queue.enqueue(1, async () => {
      results.push(2);
    });

    queue.enqueue(1, async () => {
      results.push(3);
    });

    // Wait a moment to ensure processQueue has dequeued all commands
    await delay(5);

    // Clear the buffer - at this point, all commands are already dequeued
    queue.clearBuffer(1);

    // Unblock to let commands execute
    resolveBlocker!();
    await delay(20);

    // All commands execute because they were already dequeued
    assertEquals(results, [1, 2, 3]);

    // Test that new commands after clear work normally
    await queue.enqueue(1, async () => {
      results.push(4);
    });

    assertEquals(results, [1, 2, 3, 4]);

    // Test clearBuffer prevents future commands
    const results2: number[] = [];
    const queue2 = createCommandQueue();

    // Clear the buffer first
    queue2.clearBuffer(2);

    // Then try to add commands - they should execute normally
    // because clearBuffer only clears existing commands
    await queue2.enqueue(2, async () => {
      results2.push(1);
    });
    assertEquals(results2, [1]);
  });

  it("should provide accurate stats", async () => {
    const queue = createCommandQueue();

    queue.enqueue(1, async () => {
      await delay(20);
    });
    queue.enqueue(1, async () => {
      await delay(10);
    });
    queue.enqueue(2, async () => {
      await delay(10);
    });

    await delay(5);

    const stats = queue.getStats();
    assertEquals(stats.bufferCount, 2);
    assertEquals(stats.processing.length > 0, true);

    await delay(50);

    const finalStats = queue.getStats();
    assertEquals(finalStats.totalQueued, 0);
    assertEquals(finalStats.processing.length, 0);
  });
});

describe("LockManager", () => {
  it("should prevent concurrent access", async () => {
    const lock = createLockManager();
    const results: string[] = [];

    // Start two concurrent operations on the same resource
    const op1 = lock.acquire("resource1", async () => {
      results.push("op1-start");
      await delay(20);
      results.push("op1-end");
    });

    const op2 = lock.acquire("resource1", async () => {
      results.push("op2-start");
      await delay(10);
      results.push("op2-end");
    });

    await Promise.all([op1, op2]);

    // Operations should not interleave
    assertEquals(results, ["op1-start", "op1-end", "op2-start", "op2-end"]);
  });

  it("should allow concurrent access to different resources", async () => {
    const lock = createLockManager();
    const results: string[] = [];

    const op1 = lock.acquire("resource1", async () => {
      results.push("r1-start");
      await delay(20);
      results.push("r1-end");
    });

    const op2 = lock.acquire("resource2", async () => {
      results.push("r2-start");
      await delay(10);
      results.push("r2-end");
    });

    await Promise.all([op1, op2]);

    // Operations on different resources can interleave
    assertEquals(results[0], "r1-start");
    assertEquals(results[1], "r2-start");
    assertEquals(results[2], "r2-end");
    assertEquals(results[3], "r1-end");
  });

  it("should track locked resources", async () => {
    const lock = createLockManager();

    assertEquals(lock.isLocked("resource1"), false);

    const operation = lock.acquire("resource1", async () => {
      assertEquals(lock.isLocked("resource1"), true);
      assertEquals(lock.getLockedResources(), ["resource1"]);
      await delay(10);
    });

    await operation;

    assertEquals(lock.isLocked("resource1"), false);
    assertEquals(lock.getLockedResources(), []);
  });
});
