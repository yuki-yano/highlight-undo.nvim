local M = {}

---@class highlight-undo.Opts
---@field public mappings highlight-undo.Mappings
---@field public enabled highlight-undo.Enabled
---@field public highlight highlight-undo.Highlight
---@field public threshold highlight-undo.Threshold
---@field public duration number

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

---@type highlight-undo.Opts
local default_opts = {
  mappings = {
    undo = 'u',
    redo = '<C-r>',
  },
  enabled = {
    added = true,
    removed = true,
  },
  highlight = {
    added = 'DiffAdd',
    removed = 'DiffDelete',
  },
  threshold = {
    line = 50,
    char = 1500,
  },
  duration = 200,
}

---@param opts highlight-undo.Opts
function M.setup(opts)
  ---@type highlight-undo.Opts
  opts = vim.tbl_deep_extend('force', default_opts, opts or {})

  vim.keymap.set({ 'n' }, opts.mappings.undo, function()
    vim.fn['highlight_undo#request']('preExec', { 'undo', 'redo' })
    vim.fn['highlight_undo#notify']('exec', { 'undo', 'redo' })
  end)
  vim.keymap.set({ 'n' }, opts.mappings.redo, function()
    vim.fn['highlight_undo#request']('preExec', { 'redo', 'undo' })
    vim.fn['highlight_undo#notify']('exec', { 'redo', 'undo' })
  end)

  vim.fn['highlight_undo#request']('setup', { opts })
end

return M
