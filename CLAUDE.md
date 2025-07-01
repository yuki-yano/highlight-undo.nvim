# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

highlight-undo.nvim は Neovim の undo/redo
実行時に差分をハイライトするプラグインです。[denops.vim](https://github.com/vim-denops/denops.vim) に依存しています。

## アーキテクチャ

### ディレクトリ構造

- `lua/highlight-undo/` - Neovim側のLuaインターフェース
  - `init.lua` - プラグインのエントリーポイント、設定管理、キーマッピング
- `denops/highlight-undo/` - Deno/TypeScriptによる主要ロジック
  - `main.ts` - undo/redo時の差分計算とハイライト処理
  - `deps.ts` - 外部依存関係
- `autoload/` - Vim script のブリッジ関数

### 処理フロー

1. ユーザーが `u` または `<C-r>` を押す
2. Lua層（`init.lua`）が `highlight_undo#request` でDenops層に事前処理を依頼
3. Denops層（`main.ts`）が現在のバッファ内容を取得し、undo/redo後の内容と比較
4. 差分を計算し、Neovim APIを使用してハイライトを適用
5. 指定された期間後にハイライトをクリア

### 主要コンポーネント

- **設定管理**: Lua層で設定を管理し、Denops層に渡す
- **差分計算**: `diff` ライブラリを使用して文字・行単位の差分を検出
- **ハイライト**: Neovim の namespace API を使用して一時的なハイライトを適用

## 開発コマンド

### Denoフォーマット

```bash
deno fmt
```

### Luaフォーマット

```bash
stylua lua/
```

### 型チェック（TypeScript）

```bash
deno check denops/highlight-undo/main.ts
```

## 開発時の注意点

- Denops層の変更時は、Neovimを再起動するか `:call denops#plugin#reload('highlight-undo')` を実行
- ハイライトグループは既存のNeovimグループ（`DiffAdd`、`DiffDelete`）を使用
- パフォーマンスのため、大きな変更（行数50以上、文字数1500以上）はハイライトをスキップ
- Neovim APIの呼び出しは `luaeval` を使用してLuaコードとして実行

## 改善された機能

### エラーハンドリング

- すべてのエラーが適切にキャッチされ、ユーザーに通知される
- デバッグモードでは詳細なログがファイルに記録される

### マルチバイト文字対応

- 日本語、中国語、韓国語、絵文字などを正しく処理
- Vimのバイト位置とJavaScriptの文字位置を適切に変換

### 並行性制御

- バッファごとのコマンドキューによる順序保証
- ロックマネージャーによる競合状態の防止

### キャッシュ最適化（2025-01-01修正）

- DiffOptimizerのキャッシュを適切に管理し、2回目以降のundo/redoでも正しい差分を表示
- RangeComputerのインデックス計算を修正し、added/removedの変更タイプに応じた正確な位置計算

### ハイライトタイミング（2025-01-01修正）

- undoで削除される部分：ハイライト表示→duration待機→削除実行
- redoで追加される部分：追加実行→ハイライト表示→duration待機

## デバッグ機能

デバッグモードを有効にすると、詳細なログが出力されます：

```lua
:lua require('highlight-undo').setup({ debug = true })
```

### デバッグコマンド

```lua
-- パフォーマンス統計を表示
:lua require'highlight-undo'.debug.get_stats()

-- キャッシュをクリア
:lua require'highlight-undo'.debug.clear_cache()

-- デバッグモードの有効/無効
:lua require'highlight-undo'.debug.enable_debug()
:lua require'highlight-undo'.debug.disable_debug()

-- 現在の設定を表示
:lua require'highlight-undo'.debug.show_config()
```

## パフォーマンスベンチマーク

プロジェクトルートで以下のコマンドを実行：

```bash
./scripts/benchmark.ts
```

これにより、差分計算、範囲計算、キャッシュ性能のベンチマークが実行されます。
