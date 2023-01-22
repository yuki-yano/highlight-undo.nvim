function! highlight_undo#notify(funcname, args) abort
  if denops#plugin#wait('highlight-undo') != 0
    return ''
  endif
  return denops#notify('highlight-undo', a:funcname, a:args)
endfunction

function! highlight_undo#request(funcname, args) abort
  if denops#plugin#wait('highlight-undo') != 0
    return ''
  endif
  return denops#request('highlight-undo', a:funcname, a:args)
endfunction
