local M = {}

-- Get performance stats from denops
function M.get_stats()
  local stats = vim.fn['highlight_undo#request']('getStats', {})
  if stats then
    print('[highlight-undo] Performance Stats:')
    print(vim.inspect(stats))
  else
    print('[highlight-undo] No stats available')
  end
end

-- Clear all caches
function M.clear_cache()
  vim.fn['highlight_undo#notify']('clearCache', {})
  print('[highlight-undo] Cache cleared')
end

-- Enable debug mode
function M.enable_debug()
  require('highlight-undo').setup({ debug = true })
  print('[highlight-undo] Debug mode enabled')
end

-- Disable debug mode
function M.disable_debug()
  require('highlight-undo').setup({ debug = false })
  print('[highlight-undo] Debug mode disabled')
end

-- Show current configuration
function M.show_config()
  local config = vim.g.highlight_undo_config or {}
  print('[highlight-undo] Current configuration:')
  print(vim.inspect(config))
end

return M