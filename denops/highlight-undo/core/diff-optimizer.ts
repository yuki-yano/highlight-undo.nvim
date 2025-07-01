// Optimized diff calculation

import { Diff, diffChars, diffLines } from "../deps.ts";

export interface DiffResult {
  changes: Diff.Change[];
  lineInfo: {
    aboveLine: number;
    belowLine: number;
  };
}

export class DiffOptimizer {
  // Cache for recent diffs
  private cache = new Map<string, DiffResult>();
  private maxCacheEntries = 100;

  calculateDiff(
    before: string,
    after: string,
    threshold: { line: number; char: number },
  ): DiffResult | null {
    // Quick checks
    if (before === after) {
      return null;
    }

    const cacheKey = this.getCacheKey(before, after);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Check size threshold before calculation
    const changeCharCount = Math.abs(before.length - after.length);
    const changeLineCount = Math.abs(
      before.split("\n").length - after.split("\n").length,
    );

    if (
      changeCharCount > threshold.char ||
      changeLineCount > threshold.line
    ) {
      return null;
    }

    // Optimize for common cases
    if (this.isSimpleInsertion(before, after)) {
      return this.handleSimpleInsertion(before, after);
    }

    if (this.isSimpleDeletion(before, after)) {
      return this.handleSimpleDeletion(before, after);
    }

    // Full diff calculation
    const changes = diffChars(before, after);
    const lineChanges = diffLines(before, after);

    const [above, ..._below] = lineChanges;
    const below = _below.at(-1);
    const aboveLine = above.count! + 1;

    const belowLine = below?.count != null ? after.split("\n").length - below.count! + 1 : aboveLine;

    const result: DiffResult = {
      changes,
      lineInfo: { aboveLine, belowLine },
    };

    // Update cache
    this.cache.set(cacheKey, result);
    if (this.cache.size > this.maxCacheEntries) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    return result;
  }

  private getCacheKey(before: string, after: string): string {
    // Simple hash for cache key
    const hash = (str: string) => {
      let h = 0;
      for (let i = 0; i < Math.min(str.length, 100); i++) {
        h = ((h << 5) - h) + str.charCodeAt(i);
        h |= 0;
      }
      return h;
    };
    return `${hash(before)}_${hash(after)}`;
  }

  private isSimpleInsertion(before: string, after: string): boolean {
    return after.startsWith(before) || after.endsWith(before);
  }

  private isSimpleDeletion(before: string, after: string): boolean {
    return before.startsWith(after) || before.endsWith(after);
  }

  private handleSimpleInsertion(before: string, after: string): DiffResult {
    let changes: Diff.Change[];
    let position: number;
    let added: string;

    if (after.startsWith(before)) {
      // Insertion at end
      added = after.substring(before.length);
      position = before.length;
      changes = [
        { value: before, count: before.length },
        { value: added, count: added.length, added: true },
      ];
    } else {
      // Insertion at beginning
      added = after.substring(0, after.length - before.length);
      position = 0;
      changes = [
        { value: added, count: added.length, added: true },
        { value: before, count: before.length },
      ];
    }

    const lineNumber = before.substring(0, position).split("\n").length;
    return {
      changes,
      lineInfo: { aboveLine: lineNumber, belowLine: lineNumber + added.split("\n").length },
    };
  }

  private handleSimpleDeletion(before: string, after: string): DiffResult {
    let changes: Diff.Change[];
    let position: number;

    if (before.startsWith(after)) {
      // Deletion at end
      const removed = before.substring(after.length);
      position = after.length;
      changes = [
        { value: after, count: after.length },
        { value: removed, count: removed.length, removed: true },
      ];
    } else {
      // Deletion at beginning
      const removed = before.substring(0, before.length - after.length);
      position = 0;
      changes = [
        { value: removed, count: removed.length, removed: true },
        { value: after, count: after.length },
      ];
    }

    const lineNumber = after.substring(0, position).split("\n").length;
    return {
      changes,
      lineInfo: { aboveLine: lineNumber, belowLine: lineNumber },
    };
  }

  clearCache(): void {
    this.cache.clear();
  }
}
