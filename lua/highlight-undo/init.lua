local M = {}

function M.setup()
  vim.keymap.set({ 'n' }, 'u', function()
    vim.cmd([[call highlight_undo#request("preExec", ["undo", "redo"])]])
    vim.cmd([[call highlight_undo#notify("exec", ["undo", "redo"])]])
  end)
  vim.keymap.set({ 'n' }, '<C-r>', function()
    vim.cmd([[call highlight_undo#request("preExec", ["redo", "undo"])]])
    vim.cmd([[call highlight_undo#notify("exec", ["redo", "undo"])]])
  end)
end

return M
