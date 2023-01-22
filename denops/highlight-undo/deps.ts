export { delay } from "https://deno.land/std@0.173.0/async/mod.ts";

export type { Denops } from "https://deno.land/x/denops_std@v4.0.0/mod.ts";
export * as fn from "https://deno.land/x/denops_std@v4.0.0/function/mod.ts";

import * as diff from "https://esm.sh/v103/diff@5.1.0/es2022/diff.js";
import * as Diff from "https://esm.sh/v103/@types/diff@5.0.2/index.d.ts";

const { diffChars, diffLines } = diff as unknown as typeof Diff;
export { Diff, diffChars, diffLines };
