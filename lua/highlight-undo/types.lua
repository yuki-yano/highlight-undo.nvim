-- Type definitions for highlight-undo configuration
-- Should be kept in sync with config-schema.ts

---@class highlight-undo.Config
---@field public mappings? highlight-undo.Mappings
---@field public enabled? highlight-undo.Enabled
---@field public highlight? highlight-undo.Highlight
---@field public threshold? highlight-undo.Threshold
---@field public duration? number
---@field public debug? boolean
---@field public logFile? string
---@field public rangeAdjustments? highlight-undo.RangeAdjustments
---@field public heuristics? highlight-undo.Heuristics

---@class highlight-undo.Mappings
---@field public undo? string
---@field public redo? string

---@class highlight-undo.Enabled
---@field public added? boolean
---@field public removed? boolean

---@class highlight-undo.Highlight
---@field public added? string
---@field public removed? string

---@class highlight-undo.Threshold
---@field public line? number
---@field public char? number

---@class highlight-undo.RangeAdjustments
---@field public adjustWordBoundaries? boolean
---@field public handleWhitespace? boolean

---@class highlight-undo.Heuristics
---@field public enabled? boolean
---@field public thresholds? highlight-undo.HeuristicsThresholds
---@field public strategies? highlight-undo.HeuristicsStrategies

---@class highlight-undo.HeuristicsThresholds
---@field public tiny? number
---@field public small? number
---@field public medium? number

---@class highlight-undo.HeuristicsStrategies
---@field public tiny? "character" | "word" | "line" | "block"
---@field public small? "character" | "word" | "line" | "block"
---@field public medium? "character" | "word" | "line" | "block"
---@field public large? "character" | "word" | "line" | "block"
