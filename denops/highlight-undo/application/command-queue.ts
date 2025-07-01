// Command queuing system for handling concurrent operations

export interface QueuedCommand {
  id: string;
  execute: () => Promise<void>;
  bufnr: number;
  timestamp: number;
}

export interface ICommandQueue {
  enqueue(
    bufnr: number,
    command: () => Promise<void>,
  ): Promise<void>;
  clearBuffer(bufnr: number): void;
  clearAll(): void;
  getStats(): {
    totalQueued: number;
    bufferCount: number;
    processing: number[];
  };
}

export function createCommandQueue(): ICommandQueue {
  const queues = new Map<number, QueuedCommand[]>();
  const processing = new Map<number, boolean>();
  let commandId = 0;

  async function processQueue(bufnr: number): Promise<void> {
    if (processing.get(bufnr)) {
      return;
    }

    processing.set(bufnr, true);

    try {
      const queue = queues.get(bufnr) || [];

      while (queue.length > 0) {
        const command = queue.shift()!;

        // Skip stale commands (older than 5 seconds)
        if (Date.now() - command.timestamp > 5000) {
          console.warn(`[highlight-undo] Skipping stale command: ${command.id}`);
          continue;
        }

        try {
          await command.execute();
        } catch (error) {
          console.error(`[highlight-undo] Command ${command.id} failed:`, error);
          // Continue processing other commands
        }
      }
    } finally {
      processing.set(bufnr, false);

      // Check if new commands were added while processing
      const queue = queues.get(bufnr) || [];
      if (queue.length > 0) {
        await processQueue(bufnr);
      }
    }
  }

  async function enqueue(
    bufnr: number,
    command: () => Promise<void>,
  ): Promise<void> {
    const id = `cmd-${++commandId}`;
    const queuedCommand: QueuedCommand = {
      id,
      execute: command,
      bufnr,
      timestamp: Date.now(),
    };

    // Get or create queue for buffer
    const queue = queues.get(bufnr) || [];
    queue.push(queuedCommand);
    queues.set(bufnr, queue);

    // Process queue if not already processing
    if (!processing.get(bufnr)) {
      await processQueue(bufnr);
    }
  }

  function clearBuffer(bufnr: number): void {
    queues.delete(bufnr);
    processing.delete(bufnr);
  }

  function clearAll(): void {
    queues.clear();
    processing.clear();
  }

  function getStats(): {
    totalQueued: number;
    bufferCount: number;
    processing: number[];
  } {
    let totalQueued = 0;
    for (const queue of queues.values()) {
      totalQueued += queue.length;
    }

    const processingBuffers: number[] = [];
    for (const [bufnr, isProcessing] of processing.entries()) {
      if (isProcessing) {
        processingBuffers.push(bufnr);
      }
    }

    return {
      totalQueued,
      bufferCount: queues.size,
      processing: processingBuffers,
    };
  }

  return {
    enqueue,
    clearBuffer,
    clearAll,
    getStats,
  };
}

export interface ILockManager {
  acquire<T>(resource: string, fn: () => Promise<T>): Promise<T>;
  isLocked(resource: string): boolean;
  getLockedResources(): string[];
}

export function createLockManager(): ILockManager {
  const locks = new Map<string, Promise<void>>();

  async function acquire<T>(resource: string, fn: () => Promise<T>): Promise<T> {
    // Wait for existing lock to be released
    const existingLock = locks.get(resource);
    if (existingLock) {
      await existingLock;
    }

    // Create new lock
    let releaseLock: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    locks.set(resource, lockPromise);

    try {
      return await fn();
    } finally {
      releaseLock!();

      // Clean up if this is the current lock
      if (locks.get(resource) === lockPromise) {
        locks.delete(resource);
      }
    }
  }

  function isLocked(resource: string): boolean {
    return locks.has(resource);
  }

  function getLockedResources(): string[] {
    return Array.from(locks.keys());
  }

  return {
    acquire,
    isLocked,
    getLockedResources,
  };
}

// Backward compatibility
export class CommandQueue implements ICommandQueue {
  private queue: ReturnType<typeof createCommandQueue>;

  constructor() {
    this.queue = createCommandQueue();
  }

  enqueue(
    bufnr: number,
    command: () => Promise<void>,
  ): Promise<void> {
    return this.queue.enqueue(bufnr, command);
  }

  clearBuffer(bufnr: number): void {
    this.queue.clearBuffer(bufnr);
  }

  clearAll(): void {
    this.queue.clearAll();
  }

  getStats(): {
    totalQueued: number;
    bufferCount: number;
    processing: number[];
  } {
    return this.queue.getStats();
  }
}

export class LockManager implements ILockManager {
  private manager: ReturnType<typeof createLockManager>;

  constructor() {
    this.manager = createLockManager();
  }

  acquire<T>(resource: string, fn: () => Promise<T>): Promise<T> {
    return this.manager.acquire(resource, fn);
  }

  isLocked(resource: string): boolean {
    return this.manager.isLocked(resource);
  }

  getLockedResources(): string[] {
    return this.manager.getLockedResources();
  }
}
