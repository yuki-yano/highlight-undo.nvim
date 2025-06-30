local M = {}

-- Apply highlights to multiple ranges
---@param namespace number
---@param highlight_group string
---@param ranges table[] Array of {lnum, col_start, col_end}
function M.apply_highlights(namespace, highlight_group, ranges)
  if not ranges or #ranges == 0 then
    return
  end

  -- Schedule the highlight application to avoid conflicts with other plugins
  vim.schedule(function()
    local bufnr = 0 -- current buffer

    for _, range in ipairs(ranges) do
      -- Get the actual line to check its length
      local line = vim.api.nvim_buf_get_lines(bufnr, range.lnum - 1, range.lnum, false)[1]
      if line then
        -- Ensure columns are within valid range
        -- Neovim's extmark API uses byte indices for columns
        local line_byte_length = #line
        local start_col = math.max(0, math.min(range.col_start, line_byte_length))
        local end_col = math.max(0, math.min(range.col_end, line_byte_length))

        -- Only apply if range is valid
        if start_col < end_col then
          local ok, err = pcall(
            vim.api.nvim_buf_set_extmark,
            bufnr,
            namespace,
            range.lnum - 1, -- 0-indexed row
            start_col,
            {
              end_row = range.lnum - 1,
              end_col = end_col,
              hl_group = highlight_group,
              -- ephemeral = true, -- Remove ephemeral
            }
          )

          if not ok then
            vim.api.nvim_err_writeln(
              string.format('highlight-undo: Failed to set extmark at line %d: %s', range.lnum, tostring(err))
            )
          end
        end
      end
    end
  end)
end

-- Clear all highlights in namespace
---@param namespace number
---@param bufnr? number Buffer number (0 for current)
function M.clear_highlights(namespace, bufnr)
  bufnr = bufnr or 0
  vim.schedule(function()
    vim.api.nvim_buf_clear_namespace(bufnr, namespace, 0, -1)
  end)
end

-- Batch apply highlights with optimization
---@param namespace number
---@param highlight_group string
---@param ranges table[] Array of ranges
---@return boolean success
function M.batch_apply_highlights(namespace, highlight_group, ranges)
  if not ranges or #ranges == 0 then
    return true
  end

  -- Schedule the highlight application to avoid conflicts
  vim.schedule(function()
    -- Check if highlight group exists and get its properties
    local hl_exists = vim.fn.hlexists(highlight_group) == 1
    if not hl_exists then
      vim.api.nvim_err_writeln("[highlight-undo] ERROR: Highlight group '" .. highlight_group .. "' does not exist!")
      return
    end

    -- Get highlight group properties for debugging
    -- Commenting out to reduce noise
    -- if vim.g.highlight_undo_debug then
    --   local ok, hl_info = pcall(vim.api.nvim_get_hl_by_name, highlight_group, true)
    --   if ok then
    --     print("[highlight-undo] Highlight group '" .. highlight_group .. "' properties: " .. vim.inspect(hl_info))
    --   end
    -- end

    -- Group ranges by line for optimization
    local ranges_by_line = {}
    for _, range in ipairs(ranges) do
      local lnum = range.lnum
      if not ranges_by_line[lnum] then
        ranges_by_line[lnum] = {}
      end
      table.insert(ranges_by_line[lnum], range)
    end

    -- Apply highlights
    local success = true
    for lnum, line_ranges in pairs(ranges_by_line) do
      -- Merge overlapping ranges on the same line
      table.sort(line_ranges, function(a, b)
        return a.col_start < b.col_start
      end)

      local merged_ranges = {}
      local current = nil

      for _, range in ipairs(line_ranges) do
        if not current then
          current = {
            lnum = range.lnum,
            col_start = range.col_start,
            col_end = range.col_end,
          }
        elseif range.col_start <= current.col_end then
          -- Overlapping or adjacent ranges, merge them
          current.col_end = math.max(current.col_end, range.col_end)
        else
          -- Non-overlapping range, save current and start new
          table.insert(merged_ranges, current)
          current = {
            lnum = range.lnum,
            col_start = range.col_start,
            col_end = range.col_end,
          }
        end
      end

      if current then
        table.insert(merged_ranges, current)
      end

      -- Apply merged ranges
      for _, range in ipairs(merged_ranges) do
        -- Skip empty ranges
        if range.col_start == range.col_end then
        -- print(string.format("  Skipping empty range at line %d", range.lnum))
        else
          -- Debug: Only log the first range
          -- Commenting out to reduce noise
          -- if _ == 1 and vim.g.highlight_undo_debug then
          --   local line_text = vim.api.nvim_buf_get_lines(0, range.lnum - 1, range.lnum, false)[1] or ""
          --   print(string.format("[highlight-undo] Lua first range:"))
          --   print(string.format("  Line %d, col [%d, %d)", range.lnum, range.col_start, range.col_end))
          --
          --   -- Extract text using 1-based columns (Lua string.sub is 1-based, but we have 0-based indices)
          --   if #line_text >= range.col_end then
          --     local extracted = string.sub(line_text, range.col_start + 1, range.col_end)
          --     print(string.format("  Extracted: '%s' (len=%d)", extracted, #extracted))
          --   end
          -- end

          -- Get the actual line to check its length
          local line = vim.api.nvim_buf_get_lines(0, range.lnum - 1, range.lnum, false)[1]
          if line then
            -- Ensure columns are within valid range
            -- Neovim's extmark API uses byte indices for columns
            local line_byte_length = #line
            local start_col = math.max(0, math.min(range.col_start, line_byte_length))
            local end_col = math.max(0, math.min(range.col_end, line_byte_length))

            -- Skip if range is invalid (but allow [0,0] for deleted lines)
            if not (start_col >= end_col and not (start_col == 0 and end_col == 0)) then
              -- Special handling for deleted lines (col_start = 0, col_end = 0)
              if start_col == 0 and end_col == 0 then
                -- For deleted lines, we'll use a special marker at the beginning of the line
                -- This will show where the line was deleted
                local mark_id = vim.api.nvim_buf_set_extmark(0, namespace, range.lnum - 1, 0, {
                  virt_text = { { ' ', highlight_group } },
                  virt_text_pos = 'overlay',
                  hl_mode = 'combine',
                })
              else
                -- Normal highlight for text within a line
                local mark_id = vim.api.nvim_buf_set_extmark(0, namespace, range.lnum - 1, start_col, {
                  end_row = range.lnum - 1,
                  end_col = end_col,
                  hl_group = highlight_group,
                  -- ephemeral = true, -- Remove ephemeral to make highlights persist
                })
              end
            end
          else
            print(string.format('[highlight-undo] WARNING: Line %d does not exist', range.lnum))
          end
        end
      end
    end
  end)

  return true -- Return immediately since the actual work is scheduled
end

-- Bulk apply highlights with added and removed ranges
---@param namespace number
---@param added_hl string
---@param removed_hl string
---@param added_ranges table[] Array of {row, col_start, col_end}
---@param removed_ranges table[] Array of {row, col_start, col_end}
function M.apply_highlights_bulk(namespace, added_hl, removed_hl, added_ranges, removed_ranges)
  -- Clear existing highlights
  vim.api.nvim_buf_clear_namespace(0, namespace, 0, -1)
  
  -- Apply added highlights
  for _, range in ipairs(added_ranges) do
    vim.api.nvim_buf_set_extmark(
      0, namespace, range.row, range.col_start,
      {
        end_row = range.row,
        end_col = range.col_end,
        hl_group = added_hl,
        ephemeral = true
      }
    )
  end
  
  -- Apply removed highlights
  for _, range in ipairs(removed_ranges) do
    vim.api.nvim_buf_set_extmark(
      0, namespace, range.row, range.col_start,
      {
        end_row = range.row,
        end_col = range.col_end,
        hl_group = removed_hl,
        ephemeral = true
      }
    )
  end
end

return M
