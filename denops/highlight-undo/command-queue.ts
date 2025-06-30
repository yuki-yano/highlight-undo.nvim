// Command queuing system for handling concurrent operations

export interface QueuedCommand {
  id: string;
  execute: () => Promise<void>;
  bufnr: number;
  timestamp: number;
}

export class CommandQueue {
  private queues = new Map<number, QueuedCommand[]>(); // Per-buffer queues
  private processing = new Map<number, boolean>();
  private commandId = 0;

  /**
   * Enqueue a command for a specific buffer
   */
  async enqueue(
    bufnr: number,
    command: () => Promise<void>,
  ): Promise<void> {
    const id = `cmd-${++this.commandId}`;
    const queuedCommand: QueuedCommand = {
      id,
      execute: command,
      bufnr,
      timestamp: Date.now(),
    };

    // Get or create queue for buffer
    const queue = this.queues.get(bufnr) || [];
    queue.push(queuedCommand);
    this.queues.set(bufnr, queue);

    // Process queue if not already processing
    if (!this.processing.get(bufnr)) {
      await this.processQueue(bufnr);
    }
  }

  /**
   * Process commands in queue for a specific buffer
   */
  private async processQueue(bufnr: number): Promise<void> {
    if (this.processing.get(bufnr)) {
      return;
    }

    this.processing.set(bufnr, true);

    try {
      const queue = this.queues.get(bufnr) || [];

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
      this.processing.set(bufnr, false);

      // Check if new commands were added while processing
      const queue = this.queues.get(bufnr) || [];
      if (queue.length > 0) {
        await this.processQueue(bufnr);
      }
    }
  }

  /**
   * Clear queue for a specific buffer
   */
  clearBuffer(bufnr: number): void {
    this.queues.delete(bufnr);
    this.processing.delete(bufnr);
  }

  /**
   * Clear all queues
   */
  clearAll(): void {
    this.queues.clear();
    this.processing.clear();
  }

  /**
   * Get queue statistics
   */
  getStats(): {
    totalQueued: number;
    bufferCount: number;
    processing: number[];
  } {
    let totalQueued = 0;
    for (const queue of this.queues.values()) {
      totalQueued += queue.length;
    }

    const processing: number[] = [];
    for (const [bufnr, isProcessing] of this.processing.entries()) {
      if (isProcessing) {
        processing.push(bufnr);
      }
    }

    return {
      totalQueued,
      bufferCount: this.queues.size,
      processing,
    };
  }
}

/**
 * Lock manager for preventing concurrent access to shared resources
 */
export class LockManager {
  private locks = new Map<string, Promise<void>>();

  /**
   * Acquire a lock for a resource
   */
  async acquire(resource: string, fn: () => Promise<void>): Promise<void> {
    // Wait for existing lock to be released
    const existingLock = this.locks.get(resource);
    if (existingLock) {
      await existingLock;
    }

    // Create new lock
    let releaseLock: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    this.locks.set(resource, lockPromise);

    try {
      await fn();
    } finally {
      releaseLock!();

      // Clean up if this is the current lock
      if (this.locks.get(resource) === lockPromise) {
        this.locks.delete(resource);
      }
    }
  }

  /**
   * Check if a resource is locked
   */
  isLocked(resource: string): boolean {
    return this.locks.has(resource);
  }

  /**
   * Get all locked resources
   */
  getLockedResources(): string[] {
    return Array.from(this.locks.keys());
  }
}
