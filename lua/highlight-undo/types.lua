-- Auto-generated from config-schema.ts
-- DO NOT EDIT MANUALLY

---@class highlight-undo.Config
---@field public mappings highlight-undo.Mappings
---@field public enabled highlight-undo.Enabled
---@field public highlight highlight-undo.Highlight
---@field public threshold highlight-undo.Threshold
---@field public duration number
---@field public debug? boolean
---@field public logFile? string

---@class highlight-undo.Mappings
---@field public undo string
---@field public redo string

---@class highlight-undo.Enabled
---@field public added boolean
---@field public removed boolean

---@class highlight-undo.Highlight
---@field public added string
---@field public removed string

---@class highlight-undo.Threshold
---@field public line number
---@field public char number
