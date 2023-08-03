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

local config = {}
local initialized = false

---@param opts highlight-undo.Opts
function M.setup(opts)
  local function setup()
    ---@type highlight-undo.Opts
    config = vim.tbl_deep_extend('force', default_opts, opts or {})

    M.enable()
    vim.keymap.set({ 'n' }, '<Plug>(highlight-undo-undo)', function()
      M.undo()
    end)
    vim.keymap.set({ 'n' }, '<Plug>(highlight-undo-redo)', function()
      M.redo()
    end)

    vim.fn['denops#plugin#wait']('highlight-undo')
    vim.fn['highlight_undo#notify']('setup', { config })
  end

  if vim.fn['denops#server#status']() == 'running' then
    initialized = true
    setup()
  else
    vim.api.nvim_create_autocmd({ 'User' }, {
      pattern = 'DenopsReady',
      callback = function()
        initialized = true
        setup()
      end,
    })
  end
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
  vim.keymap.set({ 'n' }, config.mappings.undo, function()
    M.undo()
  end)
  vim.keymap.set({ 'n' }, config.mappings.redo, function()
    M.redo()
  end)
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
