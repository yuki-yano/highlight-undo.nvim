// Buffer-specific state management

interface BufferData {
  preCode: string;
  postCode: string;
  lastModified: number;
  size: number;
}

export class BufferStateManager {
  private buffers = new Map<number, BufferData>();
  private maxCacheSize = 10 * 1024 * 1024; // 10MB max cache
  private currentCacheSize = 0;

  set(bufnr: number, preCode: string, postCode: string): void {
    const oldData = this.buffers.get(bufnr);
    if (oldData) {
      this.currentCacheSize -= oldData.size;
    }

    const size = preCode.length + postCode.length;
    const data: BufferData = {
      preCode,
      postCode,
      lastModified: Date.now(),
      size,
    };

    this.buffers.set(bufnr, data);
    this.currentCacheSize += size;

    // Evict old entries if cache is too large
    if (this.currentCacheSize > this.maxCacheSize) {
      this.evictOldEntries();
    }
  }

  get(bufnr: number): { preCode: string; postCode: string } | null {
    const data = this.buffers.get(bufnr);
    if (!data) {
      return null;
    }

    // Update last modified time on access
    data.lastModified = Date.now();
    return { preCode: data.preCode, postCode: data.postCode };
  }

  clear(bufnr: number): void {
    const data = this.buffers.get(bufnr);
    if (data) {
      this.currentCacheSize -= data.size;
      this.buffers.delete(bufnr);
    }
  }

  clearAll(): void {
    this.buffers.clear();
    this.currentCacheSize = 0;
  }

  private evictOldEntries(): void {
    // Sort by last modified time and remove oldest entries
    const entries = Array.from(this.buffers.entries())
      .sort((a, b) => a[1].lastModified - b[1].lastModified);

    while (this.currentCacheSize > this.maxCacheSize * 0.8 && entries.length > 0) {
      const [bufnr] = entries.shift()!;
      this.clear(bufnr);
    }
  }

  getStats(): { bufferCount: number; cacheSize: number; maxCacheSize: number } {
    return {
      bufferCount: this.buffers.size,
      cacheSize: this.currentCacheSize,
      maxCacheSize: this.maxCacheSize,
    };
  }
}
