# highlight-undo.nvim

This plugin highlights the differences when executing undo and redo.

This plugin depends on [denops.vim](https://github.com/vim-denops/denops.vim).

## Demo

https://user-images.githubusercontent.com/5423775/213918351-8f75c385-9d87-4efb-93ea-4a468213faa0.mp4

## Usage

Call the setup function will default map to `u` and `<C-r>`.

```lua
require('highlight-undo').setup({
  -- opts
})
```

default opts:

```lua
{
  -- Mapping keys
  mappings = {
    undo = 'u',
    redo = '<C-r>',
  },
  -- Setting to enable highlighting when a diff is added or removed
  enabled = {
    added = true,
    removed = true,
  },
  -- Highlight groups applied to added and removed parts during undo
  highlight = {
    added = 'DiffAdd',
    removed = 'DiffDelete',
  },
  -- If the amount of change exceeds this amount, the highlight will not be performed.
  threshold = {
    line = 50,
    char = 1500,
  },
  -- Duration to highlight(ms)
  duration = 200,
}
```
