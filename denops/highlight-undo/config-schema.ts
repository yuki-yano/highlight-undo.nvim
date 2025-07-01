// Unified configuration schema for TypeScript and Lua

export interface ConfigSchema {
  mappings: {
    undo: string;
    redo: string;
  };
  enabled: {
    added: boolean;
    removed: boolean;
  };
  highlight: {
    added: string;
    removed: string;
  };
  threshold: {
    line: number;
    char: number;
  };
  duration: number;
  debug?: boolean;
  logFile?: string;
  rangeAdjustments?: {
    adjustWordBoundaries?: boolean;
    handleWhitespace?: boolean;
  };
  experimental?: {
    hybridDiff?: boolean;
  };
}

export const defaultConfig: ConfigSchema = {
  mappings: {
    undo: "u",
    redo: "<C-r>",
  },
  enabled: {
    added: true,
    removed: true,
  },
  highlight: {
    added: "DiffAdd",
    removed: "DiffDelete",
  },
  threshold: {
    line: 50,
    char: 1500,
  },
  duration: 200,
  rangeAdjustments: {
    adjustWordBoundaries: true,
    handleWhitespace: true,
  },
  experimental: {
    hybridDiff: false,
  },
};
