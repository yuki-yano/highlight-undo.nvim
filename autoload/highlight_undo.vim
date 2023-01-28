function! highlight_undo#notify(funcname, args) abort
  let funcname = a:funcname
  let args = a:args
  call denops#plugin#wait_async('highlight-undo', { -> denops#notify('highlight-undo', funcname, args) })
endfunction

function! highlight_undo#request(funcname, args) abort
  let funcname = a:funcname
  let args = a:args
  call denops#plugin#wait_async('highlight-undo', { -> denops#request('highlight-undo', funcname, args) })
endfunction
