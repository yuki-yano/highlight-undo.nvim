-- Load type definitions
require('highlight-undo.types')

local M = {}

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

---@param opts? highlight-undo.Config
function M.setup(opts)
  ---@type highlight-undo.Config
  config = vim.tbl_deep_extend('force', default_opts, opts or {})

  initialized = true
  M.enable()

  -- Set up autocmds for buffer cleanup
  local augroup = vim.api.nvim_create_augroup('HighlightUndo', { clear = true })
  vim.api.nvim_create_autocmd({ 'BufDelete', 'BufUnload' }, {
    group = augroup,
    callback = function(args)
      vim.fn['highlight_undo#notify']('bufferDelete', { args.buf })
    end,
  })

  vim.fn['highlight_undo#request']('setup', { config })
end

function M.undo()
  -- Prepare buffer states and check if there will be removals
  vim.fn['highlight_undo#request']('preExecWithCheck', { 'undo', 'redo' })

  -- Check the result stored in global variable
  local has_removals = vim.g.highlight_undo_has_removals or false

  -- Execute based on whether changes will be removed or added
  if has_removals then
    -- Use request (synchronous) for removals to ensure proper timing
    vim.fn['highlight_undo#request']('exec', { 'undo', 'redo' })
  else
    -- Use notify (asynchronous) for additions
    vim.fn['highlight_undo#notify']('exec', { 'undo', 'redo' })
  end
end

function M.redo()
  -- Prepare buffer states and check if there will be removals
  vim.fn['highlight_undo#request']('preExecWithCheck', { 'redo', 'undo' })

  -- Check the result stored in global variable
  local has_removals = vim.g.highlight_undo_has_removals or false

  -- Execute based on whether changes will be removed or added
  if has_removals then
    -- Use request (synchronous) for removals to ensure proper timing
    vim.fn['highlight_undo#request']('exec', { 'redo', 'undo' })
  else
    -- Use notify (asynchronous) for additions
    vim.fn['highlight_undo#notify']('exec', { 'redo', 'undo' })
  end
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
  -- Use <Cmd> mapping to prevent default behavior
  vim.keymap.set(
    'n',
    config.mappings.undo,
    '<Cmd>lua require("highlight-undo").undo()<CR>',
    { noremap = true, silent = true }
  )
  vim.keymap.set(
    'n',
    config.mappings.redo,
    '<Cmd>lua require("highlight-undo").redo()<CR>',
    { noremap = true, silent = true }
  )
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

-- Get performance stats
function M.get_stats()
  if not is_initialized() then
    return nil
  end

  return vim.fn['highlight_undo#request']('getStats', {})
end

-- Clear cache for all buffers
function M.clear_cache()
  if not is_initialized() then
    return
  end

  vim.fn['highlight_undo#notify']('clearCache', {})
end

-- Debug commands
M.debug = require('highlight-undo.debug')

-- Internal function for highlight application (called from TypeScript)
function M._apply_highlights(namespace, highlight_group, ranges)
  local highlighter = require('highlight-undo.highlighter')
  return highlighter.batch_apply_highlights(namespace, highlight_group, ranges)
end

-- Internal function for clearing highlights (called from TypeScript)
function M._clear_highlights(namespace, bufnr)
  local highlighter = require('highlight-undo.highlighter')
  highlighter.clear_highlights(namespace, bufnr)
end

-- Internal function for bulk highlight application (called from TypeScript)
function M._apply_highlights_bulk(namespace, added_hl, removed_hl, added_ranges, removed_ranges)
  local highlighter = require('highlight-undo.highlighter')
  return highlighter.apply_highlights_bulk(namespace, added_hl, removed_hl, added_ranges, removed_ranges)
end

return M
