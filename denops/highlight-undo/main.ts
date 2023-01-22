import { delay, Diff, diffChars, diffLines, fn } from "./deps.ts";
import type { Denops } from "./deps.ts";

// TODO: Change get from denops
const CHANGE_CHAR_COUNT_THRESHOLD = 1500;
const CHANGE_LINE_COUNT_THRESHOLD = 50;

let nameSpace: number;
let preCode = "";
let postCode = "";

type Command = "undo" | "redo";
type ChangeType = "added" | "removed";

type Range = {
  lnum: number;
  lineText: string;
  col: {
    start: number;
    end: number;
  };
  matchText: string;
  // NOTE: debug
  changeType: ChangeType;
};

type UndoTree = {
  entries: Array<{
    curhead?: number;
  }>;
};

const executeCondition = async (
  denops: Denops,
  { command }: { command: Command }
): Promise<boolean> => {
  const undoTree = (await fn.undotree(denops)) as UndoTree;
  if (
    command === "redo" &&
    !undoTree.entries.some((entry) => entry.curhead != null)
  ) {
    return false;
  } else {
    return true;
  }
};

const getPreCodeAndPostCode = async ({
  denops,
  command,
  counterCommand,
}: {
  denops: Denops;
  command: string;
  counterCommand: string;
}): Promise<void> => {
  preCode =
    ((await fn.getline(denops, 1, "$")) as Array<string>).join("\n") + "\n";
  await denops.cmd(command as string);
  postCode =
    ((await fn.getline(denops, 1, "$")) as Array<string>).join("\n") + "\n";
  await denops.cmd(counterCommand as string);
};

const highlight = async (
  denops: Denops,
  {
    ranges,
    changeType,
  }: {
    ranges: ReadonlyArray<Range>;
    changeType: ChangeType;
  }
) => {
  if (ranges.length === 0) {
    return;
  }

  const highlightGroup = changeType === "added" ? "DiffAdd" : "DiffDelete";

  await Promise.all(
    ranges.map((range) =>
      denops.call(
        "luaeval",
        `vim.highlight.range(0, ${nameSpace}, '${highlightGroup}', { ${
          range.lnum - 1
        }, ${range.col.start - 1 < 0 ? 0 : range.col.start - 1} }, { ${
          range.lnum - 1
        }, ${range.col.end} })`
      )
    )
  );

  await delay(200);
  await denops.call(
    "luaeval",
    `vim.api.nvim_buf_clear_namespace(0, ${nameSpace}, 0, -1)`
  );
};

const computeRanges = ({
  changes,
  // TODO: Unnecessary?
  // beforeCode,
  afterCode,
  changeType,
}: {
  changes: Array<Diff.Change>;
  beforeCode: string;
  afterCode: string;
  changeType: ChangeType;
}): ReadonlyArray<Range> => {
  let codeIndex = 0;
  let ranges: ReadonlyArray<Range> = [];

  for (const change of changes) {
    if (change[changeType]) {
      let lnum = afterCode.substring(0, codeIndex).split("\n").length;

      const currentPos = afterCode.substring(0, codeIndex).length;
      const startPosInCurrentLine = afterCode
        .substring(0, codeIndex)
        .lastIndexOf("\n");

      // If the change contains line breaks, split each line.
      if (change.value.includes("\n")) {
        const firstLineStartCol = codeIndex - startPosInCurrentLine - 1;

        let isFirstLine = true;
        for (const text of change.value.split("\n")) {
          const currentLineText = afterCode.split("\n")[lnum - 1];
          ranges = [
            ...ranges,
            {
              lnum,
              lineText: currentLineText,
              col: {
                start: isFirstLine ? firstLineStartCol : 0,
                end: isFirstLine
                  ? text.length + firstLineStartCol
                  : text.length,
              },
              matchText: text,
              changeType,
            },
          ];
          isFirstLine = false;
          lnum += 1;
        }
      } else {
        const currentLineText = afterCode.split("\n")[lnum - 1];
        const start = currentPos - startPosInCurrentLine - 1;
        ranges = [
          ...ranges,
          {
            lnum,
            lineText: currentLineText,
            col: {
              start: currentPos - startPosInCurrentLine,
              end: start + change.value.length,
            },
            matchText: change.value,
            changeType,
          },
        ];
      }
    }

    codeIndex = codeIndex + change.count!;
  }

  return ranges;
};

const fillRangeGaps = ({
  ranges,
  aboveLine,
  belowLine,
}: {
  ranges: ReadonlyArray<Range>;
  aboveLine: number;
  belowLine: number;
}): ReadonlyArray<Range> => {
  let filledRanges: ReadonlyArray<Range> = [];
  for (const range of ranges) {
    if (
      range.lnum > aboveLine &&
      range.lnum < belowLine &&
      range.col.start === 0
    ) {
      filledRanges = [
        ...filledRanges,
        {
          ...range,
          col: {
            start: 0,
            end: range.lineText.length,
          },
        },
      ];
    } else if (
      range.lnum > aboveLine &&
      range.lnum < belowLine &&
      range.col.start !== 0
    ) {
      filledRanges = [...filledRanges, range];
    } else if (range.lnum === aboveLine || range.lnum === belowLine) {
      filledRanges = [...filledRanges, range];
    } else {
      continue;
    }
  }

  return filledRanges;
};

export const main = async (denops: Denops): Promise<void> => {
  nameSpace = (await denops.call(
    "nvim_create_namespace",
    "highlight-undo"
  )) as number;

  denops.dispatcher = {
    preExec: async (
      command: unknown,
      counterCommand: unknown
    ): Promise<void> => {
      if (!(await executeCondition(denops, { command: command as Command }))) {
        return;
      }

      await getPreCodeAndPostCode({
        denops,
        command: command as string,
        counterCommand: counterCommand as string,
      });
    },
    exec: async (command: unknown, _counterCommand: unknown): Promise<void> => {
      if (!(await executeCondition(denops, { command: command as Command }))) {
        return;
      }

      const changeCharCount = Math.abs(preCode.length - postCode.length);
      const changeLineCount = Math.abs(
        preCode.split("\n").length - postCode.split("\n").length
      );
      if (
        changeCharCount > CHANGE_CHAR_COUNT_THRESHOLD ||
        changeLineCount > CHANGE_LINE_COUNT_THRESHOLD
      ) {
        denops.cmd(command as string);
        return;
      }

      const changes = diffChars(preCode, postCode);
      const [above, ..._below] = diffLines(preCode, postCode);
      const below = _below.at(-1);
      const aboveLine = above.count! + 1;
      const removeBelowLine =
        below?.count != null
          ? // NOTE: Workaround to get line numbers when the end of the file is changed
            postCode.split("\n").length + below!.count! ===
            preCode.split("\n").length
            ? preCode.split("\n").length
            : preCode.split("\n").length - below!.count!
          : aboveLine;
      const addBelowLine =
        below?.count != null
          ? // NOTE: Workaround to get line numbers when the end of the file is changed
            preCode.split("\n").length + below!.count! ===
            postCode.split("\n").length
            ? postCode.split("\n").length
            : postCode.split("\n").length - below!.count!
          : aboveLine;

      // Removed
      let removedRanges = computeRanges({
        changes,
        beforeCode: postCode,
        afterCode: preCode,
        changeType: "removed",
      });

      removedRanges = fillRangeGaps({
        ranges: removedRanges,
        aboveLine,
        belowLine: removeBelowLine,
      });

      await highlight(denops, { ranges: removedRanges, changeType: "removed" });

      // Execute cmd
      await denops.cmd(command as string);

      // Added
      let addedRanges = computeRanges({
        changes,
        beforeCode: preCode,
        afterCode: postCode,
        changeType: "added",
      });

      addedRanges = fillRangeGaps({
        ranges: addedRanges,
        aboveLine,
        belowLine: addBelowLine,
      });

      await highlight(denops, { ranges: addedRanges, changeType: "added" });
    },
  };

  return await Promise.resolve();
};
