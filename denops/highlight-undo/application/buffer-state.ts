// Buffer-specific state management

interface BufferData {
  preCode: string;
  postCode: string;
  lastModified: number;
  size: number;
}

// Interface for buffer state management
export interface IBufferStateManager {
  set(bufnr: number, preCode: string, postCode: string): void;
  get(bufnr: number): { preCode: string; postCode: string } | null;
  clear(bufnr: number): void;
  clearAll(): void;
  getStats(): { bufferCount: number; cacheSize: number; maxCacheSize: number };
}

export function createBufferStateManager(maxCacheSize = 10 * 1024 * 1024): IBufferStateManager {
  const buffers = new Map<number, BufferData>();
  let currentCacheSize = 0;

  function evictOldEntries(): void {
    // Sort by last modified time and remove oldest entries
    const entries = Array.from(buffers.entries())
      .sort((a, b) => a[1].lastModified - b[1].lastModified);

    while (currentCacheSize > maxCacheSize * 0.8 && entries.length > 0) {
      const [bufnr] = entries.shift()!;
      clear(bufnr);
    }
  }

  function set(bufnr: number, preCode: string, postCode: string): void {
    const oldData = buffers.get(bufnr);
    if (oldData) {
      currentCacheSize -= oldData.size;
    }

    const size = preCode.length + postCode.length;
    const data: BufferData = {
      preCode,
      postCode,
      lastModified: Date.now(),
      size,
    };

    buffers.set(bufnr, data);
    currentCacheSize += size;

    // Evict old entries if cache is too large
    if (currentCacheSize > maxCacheSize) {
      evictOldEntries();
    }
  }

  function get(bufnr: number): { preCode: string; postCode: string } | null {
    const data = buffers.get(bufnr);
    if (!data) {
      return null;
    }

    // Update last modified time on access
    data.lastModified = Date.now();
    return { preCode: data.preCode, postCode: data.postCode };
  }

  function clear(bufnr: number): void {
    const data = buffers.get(bufnr);
    if (data) {
      currentCacheSize -= data.size;
      buffers.delete(bufnr);
    }
  }

  function clearAll(): void {
    buffers.clear();
    currentCacheSize = 0;
  }

  function getStats() {
    return {
      bufferCount: buffers.size,
      cacheSize: currentCacheSize,
      maxCacheSize,
    };
  }

  return {
    set,
    get,
    clear,
    clearAll,
    getStats,
  };
}
