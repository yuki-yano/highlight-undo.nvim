# highlight-undo.nvim

A Neovim plugin that visualizes undo/redo operations by highlighting the text differences. This plugin makes it easy to
see what changes when you undo or redo, improving your editing workflow.

## Features

- 🎯 **Visual Feedback**: Instantly see what text was added or removed during undo/redo
- ⚡ **High Performance**: Optimized for large files with efficient diff algorithms
- 🌏 **Multi-byte Support**: Full support for Unicode, including CJK characters and emojis
- 🎨 **Customizable**: Configure highlight colors, duration, and behavior
- 🔧 **Smart Thresholds**: Automatically skips highlighting for massive changes to maintain performance
- ✨ **Intuitive Highlighting**: Smart adjustments for word boundaries and whitespace changes

## Requirements

- Neovim >= 0.8.0
- [denops.vim](https://github.com/vim-denops/denops.vim) - The powerful ecosystem for Vim/Neovim
- [Deno](https://deno.land/) - Required by denops.vim

## Installation

Using [lazy.nvim](https://github.com/folke/lazy.nvim):

```lua
{
  'yuki-yano/highlight-undo.nvim',
  dependencies = {
    'vim-denops/denops.vim',
  },
  config = function()
    require('highlight-undo').setup({})
  end,
}
```

Using [packer.nvim](https://github.com/wbthomason/packer.nvim):

```lua
use {
  'yuki-yano/highlight-undo.nvim',
  requires = {
    'vim-denops/denops.vim',
  },
  config = function()
    require('highlight-undo').setup({})
  end,
}
```

## Demo

https://user-images.githubusercontent.com/5423775/213918351-8f75c385-9d87-4efb-93ea-4a468213faa0.mp4

## Configuration

The plugin provides sensible defaults but can be customized to your preferences:

```lua
require('highlight-undo').setup({
  -- Key mappings
  mappings = {
    undo = 'u',      -- Key for undo with highlight
    redo = '<C-r>',  -- Key for redo with highlight
  },
  
  -- What to highlight
  enabled = {
    added = true,    -- Highlight added text
    removed = true,  -- Highlight removed text
  },
  
  -- Highlight groups
  highlight = {
    added = 'DiffAdd',      -- Highlight group for added text
    removed = 'DiffDelete', -- Highlight group for removed text
  },
  
  -- Performance thresholds
  threshold = {
    line = 50,     -- Skip highlighting if more than 50 lines changed
    char = 1500,   -- Skip highlighting if more than 1500 characters changed
  },
  
  -- Highlight duration
  duration = 200,  -- Duration in milliseconds
  
  -- Debug mode
  debug = false,   -- Enable debug logging for troubleshooting
  
  -- Range adjustments for more intuitive highlighting
  rangeAdjustments = {
    adjustWordBoundaries = true,  -- Expand highlights to word boundaries
    handleWhitespace = true,      -- Special handling for whitespace changes
  },
  
  -- Heuristic display strategies
  heuristics = {
    enabled = true,
    -- Change size thresholds (in characters)
    thresholds = {
      tiny = 5,     -- Changes <= 5 chars
      small = 20,   -- Changes <= 20 chars
      medium = 100, -- Changes <= 100 chars
    },
    -- Display strategies for each size
    strategies = {
      tiny = "character",   -- Show exact character changes
      small = "word",      -- Expand to word boundaries
      medium = "line",     -- Highlight full lines
      large = "block",     -- Highlight blocks of lines
    },
  },
})
```

### Commands

The plugin provides commands for runtime control:

```vim
" Disable highlight-undo temporarily
:lua require('highlight-undo').disable()

" Re-enable highlight-undo
:lua require('highlight-undo').enable()

" Toggle highlight-undo on/off
:lua require('highlight-undo').toggle()
```

### Debug Commands

Advanced debugging commands for troubleshooting:

```lua
-- Get performance statistics
:lua require('highlight-undo').debug.get_stats()

-- Clear all caches
:lua require('highlight-undo').debug.clear_cache()

-- Enable/disable debug mode at runtime
:lua require('highlight-undo').debug.enable_debug()
:lua require('highlight-undo').debug.disable_debug()

-- Show current configuration
:lua require('highlight-undo').debug.show_config()
```

## Advanced Usage

### Performance Monitoring

Monitor plugin performance and cache usage:

```lua
-- Get performance statistics
local stats = require('highlight-undo').get_stats()
-- Returns detailed statistics about buffer cache and performance

-- Clear all buffer caches manually
require('highlight-undo').clear_cache()
```

### Custom Highlight Groups

You can define custom highlight groups for better visual distinction:

```vim
" Define custom highlight groups
highlight HighlightUndoAdded guibg=#2d4f2d guifg=#a3d3a3
highlight HighlightUndoRemoved guibg=#4f2d2d guifg=#d3a3a3

" Use them in setup
lua require('highlight-undo').setup({
  highlight = {
    added = 'HighlightUndoAdded',
    removed = 'HighlightUndoRemoved',
  }
})
```

## Heuristic Display Strategies

The plugin uses intelligent heuristics to display changes in the most intuitive way:

- **Tiny changes (1-5 chars)**: Show exact character-level changes
- **Small changes (5-20 chars)**: Expand to word boundaries for better context
- **Medium changes (20-100 chars)**: Highlight entire lines
- **Large changes (100+ chars)**: Group consecutive lines into blocks

This adaptive approach ensures that:

- Small typo fixes are precisely highlighted
- Word replacements show complete words
- Line edits are clearly visible
- Large refactorings are shown as cohesive blocks

## Performance Optimizations

This plugin is designed for performance:

- **Smart Caching**: Buffer states are cached to minimize computation
- **Diff Optimization**: Uses efficient algorithms optimized for common editing patterns
- **Batch Operations**: Highlights are applied in batches to reduce API calls
- **Memory Management**: Automatic cache eviction prevents memory bloat
- **Concurrent Safety**: Thread-safe operations prevent race conditions

## Troubleshooting

### Debug Mode

Enable debug mode to diagnose issues:

```lua
require('highlight-undo').setup({
  debug = true,
  -- Optional: specify a log file
  logFile = vim.fn.stdpath('data') .. '/highlight-undo.log',
})
```

### Common Issues

1. **Highlights not appearing**: Check if denops.vim is properly installed and running
2. **Performance issues**: Adjust the `threshold` values for your use case
3. **Encoding issues**: The plugin handles multi-byte characters automatically

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

### Development

```bash
# Run tests
deno task test

# Format code
deno fmt

# Type check
deno check denops/highlight-undo/main.ts

# Format Lua code
stylua lua/

# Run performance benchmarks
deno run --allow-all denops/highlight-undo/performance-benchmark.ts
```

## License

MIT License - see [LICENSE](LICENSE) file for details

## Credits

- Built with [denops.vim](https://github.com/vim-denops/denops.vim) - the excellent Deno-based plugin framework
- Inspired by the need for better visual feedback in Vim's undo system
