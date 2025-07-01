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
  heuristics?: {
    enabled?: boolean;
    thresholds?: {
      tiny?: number;
      small?: number;
      medium?: number;
    };
    strategies?: {
      tiny?: "character" | "word" | "line" | "block";
      small?: "character" | "word" | "line" | "block";
      medium?: "character" | "word" | "line" | "block";
      large?: "character" | "word" | "line" | "block";
    };
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
  heuristics: {
    enabled: true,
    thresholds: {
      tiny: 5,
      small: 20,
      medium: 100,
    },
    strategies: {
      tiny: "character",
      small: "word",
      medium: "line",
      large: "block",
    },
  },
};
