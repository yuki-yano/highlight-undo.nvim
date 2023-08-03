local M = {}

---@class highlight-undo.Config
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

---@type highlight-undo.Config
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

local config = {}
local initialized = false

---@param opts highlight-undo.Config
function M.setup(opts)
  ---@type highlight-undo.Config
  config = vim.tbl_deep_extend('force', default_opts, opts or {})

  initialized = true
  M.enable()
  vim.fn['highlight_undo#request']('setup', { config })
end

function M.undo()
  vim.fn['highlight_undo#request']('preExec', { 'undo', 'redo' })
  vim.fn['highlight_undo#notify']('exec', { 'undo', 'redo' })
end

function M.redo()
  vim.fn['highlight_undo#request']('preExec', { 'redo', 'undo' })
  vim.fn['highlight_undo#notify']('exec', { 'redo', 'undo' })
end

M.enabled = false

local function is_initialized()
  if initialized == false then
    vim.notify('highlight-undo is not initialized', vim.log.levels.WARN, { title = 'highlight-undo' })
    return false
  else
    return true
  end
end

function M.enable()
  if not is_initialized() then
    return
  end

  M.enabled = true
  vim.keymap.set({ 'n' }, config.mappings.undo, M.undo)
  vim.keymap.set({ 'n' }, config.mappings.redo, M.redo)
end

function M.disable()
  if not is_initialized() then
    return
  end

  M.enabled = false
  vim.keymap.del({ 'n' }, config.mappings.undo)
  vim.keymap.del({ 'n' }, config.mappings.redo)
end

function M.toggle()
  if not is_initialized() then
    return
  end

  if M.enabled then
    M.disable()
  else
    M.enable()
  end
end

return M
