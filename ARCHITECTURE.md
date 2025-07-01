# Architecture Documentation

## Overview

highlight-undo.nvim is a Neovim plugin that visualizes undo/redo operations through text highlighting. The plugin is
built on a modern architecture using TypeScript/Deno for core logic and Lua for Neovim integration.

## Architecture Principles

### Function-Based Design

The recent refactoring converted the codebase from a class-based to a function-based architecture, providing:

- **Simplicity**: Direct function calls without object instantiation overhead
- **Testability**: Pure functions that are easier to test in isolation
- **Performance**: Reduced memory allocation and faster execution
- **Maintainability**: Clear separation of concerns with focused functions

### Layer Architecture

```
┌─────────────────────────────────────────┐
│           Neovim (User)                 │
├─────────────────────────────────────────┤
│       Lua Layer (init.lua)              │
│  - Key mappings & Configuration         │
│  - Debug commands                       │
├─────────────────────────────────────────┤
│    Vim Script Bridge (autoload/)        │
│  - RPC communication                    │
├─────────────────────────────────────────┤
│     Denops/TypeScript Layer            │
│  - Core business logic                  │
│  - Diff computation                     │
│  - Performance optimization             │
└─────────────────────────────────────────┘
```

## Core Components

### Lua Layer (`lua/highlight-undo/`)

**init.lua**

- Plugin entry point and configuration management
- Key mapping setup
- Denops communication interface
- Runtime state management

**highlighter.lua**

- Neovim highlighting API wrapper
- Namespace management for highlights
- Visual effect application

**debug.lua**

- Debug utilities and commands
- Performance statistics collection
- Configuration inspection

### TypeScript/Deno Layer (`denops/highlight-undo/`)

**main.ts**

- Main entry point for Denops plugin
- Request handling and routing
- Buffer state coordination
- Error boundary implementation

### Application Layer (`denops/highlight-undo/application/`)

**highlight-command-executor.ts**

- Core undo/redo execution logic
- Diff calculation orchestration
- Highlight timing control
- Performance threshold checking

**command-queue.ts**

- Per-buffer command queuing
- Concurrent operation serialization
- Order guarantee for operations

**buffer-state.ts**

- Buffer content caching
- State transition management
- Cache invalidation logic

### Core Layer (`denops/highlight-undo/core/`)

**diff-optimizer.ts**

- Optimized diff algorithms
- Caching for repeated operations
- Performance-focused implementations

**range-computer.ts**

- Line/character range calculation
- Multi-byte character handling
- Position mapping between Vim and JavaScript

**encoding.ts**

- UTF-8 byte position conversion
- Multi-byte character support
- Emoji and CJK handling

**utils.ts**

- Shared utility functions
- Common type definitions
- Helper functions

### Infrastructure Layer (`denops/highlight-undo/infrastructure/`)

**highlight-batcher.ts**

- Batch highlight operations
- API call optimization
- Timing coordination

## Key Design Decisions

### 1. Function-Based Architecture

The migration from classes to functions provides:

- Reduced complexity
- Better tree-shaking
- Easier testing
- Clearer data flow

### 2. Per-Buffer State Management

Each buffer maintains its own:

- Command queue
- Content cache
- Operation locks
- Performance metrics

### 3. Smart Caching Strategy

- Content caching with automatic invalidation
- Diff result caching for repeated operations
- Memory-efficient cache eviction
- Performance monitoring

### 4. Error Resilience

- Comprehensive error boundaries
- Graceful degradation
- User-friendly error messages
- Debug logging for troubleshooting

### 5. Performance Optimization

- Thresholds for large operations
- Batch API calls
- Efficient diff algorithms
- Lazy evaluation where possible

## Data Flow

### Undo Operation Flow

```
User presses 'u'
    ↓
Lua: Capture keypress
    ↓
Lua: Request pre-undo content via RPC
    ↓
Denops: Store current buffer state
    ↓
Lua: Execute native undo
    ↓
Lua: Request highlight via RPC
    ↓
Denops: Calculate diff
    ↓
Denops: Apply highlights
    ↓
Timer: Clear highlights after duration
```

### Redo Operation Flow

Similar to undo, but with reversed diff interpretation:

- Undo: removed text is highlighted before deletion
- Redo: added text is highlighted after addition

## Performance Considerations

### Optimization Strategies

1. **Threshold Limits**: Skip highlighting for massive changes
2. **Batch Operations**: Group multiple highlight calls
3. **Caching**: Reuse computed diffs and positions
4. **Early Exit**: Quick return for no-op operations

### Memory Management

- Automatic cache eviction for old buffers
- Bounded queue sizes
- Efficient data structures
- Garbage collection friendly patterns

## Testing Strategy

### Unit Tests

- Pure function testing
- Mock-based integration tests
- Performance benchmarks
- Edge case coverage

### Integration Tests

- End-to-end scenarios
- Multi-buffer operations
- Concurrent operation handling
- Error recovery testing

## Future Considerations

### Potential Enhancements

1. **Visual Mode Support**: Highlight selections during visual undo/redo
2. **Persistent History**: Optional undo history visualization
3. **Custom Animations**: Fade in/out effects
4. **Multi-window Support**: Coordinate highlights across splits

### Performance Improvements

1. **Web Worker Integration**: Offload diff computation
2. **Incremental Diff**: Process only changed regions
3. **Streaming Updates**: Progressive highlight application
4. **GPU Acceleration**: For complex visualizations

## Debugging

### Debug Mode Features

- Detailed operation logging
- Performance metrics collection
- State inspection commands
- Cache statistics monitoring

### Common Issues and Solutions

1. **Missing Highlights**
   - Check Denops server status
   - Verify buffer is not exceeding thresholds
   - Inspect debug logs for errors

2. **Performance Degradation**
   - Monitor cache hit rates
   - Check for memory leaks
   - Adjust threshold settings

3. **Incorrect Highlighting**
   - Verify encoding handling
   - Check for off-by-one errors
   - Test with multi-byte content

## Conclusion

The architecture of highlight-undo.nvim prioritizes simplicity, performance, and reliability. The function-based design
combined with careful state management and optimization strategies provides a robust foundation for visualizing
undo/redo operations in Neovim.
