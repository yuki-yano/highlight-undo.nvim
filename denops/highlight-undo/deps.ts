// External dependencies
export type { Denops } from "jsr:@denops/std@7.4.0";
export * as fn from "jsr:@denops/std@7.4.0/function";

// Testing dependencies
export { assertEquals, assertExists, assertThrows } from "jsr:@std/assert@1.0.10";
export { afterEach, beforeEach, describe, it } from "jsr:@std/testing@1.0.7/bdd";
export { type Stub, stub } from "jsr:@std/testing@1.0.7/mock";

// Diff library
import * as diff from "https://esm.sh/diff@5.2.0";
import type * as Diff from "https://esm.sh/@types/diff@5.0.9";

const { diffChars, diffLines } = diff as unknown as typeof Diff;
export { type Diff, diffChars, diffLines };
