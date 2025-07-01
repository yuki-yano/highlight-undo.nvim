# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

highlight-undo.nvim は Neovim の undo/redo
実行時に差分をハイライトするプラグインです。[denops.vim](https://github.com/vim-denops/denops.vim) に依存しています。

## アーキテクチャ

### 関数ベースアーキテクチャ

最近のリファクタリングにより、クラスベースから関数ベースのアーキテクチャに移行しました。これにより：

- シンプルで直接的な関数呼び出し
- テストが容易な純粋関数
- パフォーマンスの向上
- 明確な関心の分離

### レイヤー構造

```
┌─────────────────────────────────────────┐
│           Neovim (User)                 │
├─────────────────────────────────────────┤
│       Lua Layer (init.lua)              │
│  - キーマッピングと設定管理              │
│  - デバッグコマンド                      │
├─────────────────────────────────────────┤
│    Vim Script Bridge (autoload/)        │
│  - RPC通信                              │
├─────────────────────────────────────────┤
│     Denops/TypeScript Layer            │
│  - コアビジネスロジック                  │
│  - 差分計算                             │
│  - パフォーマンス最適化                  │
└─────────────────────────────────────────┘
```

### ディレクトリ構造

- `lua/highlight-undo/` - Neovim側のLuaインターフェース
  - `init.lua` - プラグインのエントリーポイント、設定管理、キーマッピング
  - `highlighter.lua` - Neovimハイライトグループの管理
  - `debug.lua` - デバッグユーティリティとコマンド
  - `types.lua` - 型定義
- `denops/highlight-undo/` - Deno/TypeScriptによる主要ロジック
  - `main.ts` - Denopsプラグインのメインエントリポイント
  - `application/` - アプリケーション層
    - `highlight-command-executor.ts` - undo/redo実行ロジック
    - `command-queue.ts` - バッファごとのコマンドキュー
    - `buffer-state.ts` - バッファ状態管理
  - `core/` - コア層
    - `diff-optimizer.ts` - 最適化された差分アルゴリズム
    - `range-computer.ts` - 行/文字範囲計算
    - `encoding.ts` - UTF-8エンコーディング処理
    - `utils.ts` - 共通ユーティリティ
  - `infrastructure/` - インフラ層
    - `highlight-batcher.ts` - ハイライトのバッチ処理
- `autoload/` - Vim scriptのブリッジ関数

### 処理フロー

1. ユーザーが `u` または `<C-r>` を押す
2. Lua層（`init.lua`）が `highlight_undo#request` でDenops層に事前処理を依頼
3. Denops層（`main.ts`）が現在のバッファ内容を取得し、undo/redo後の内容と比較
4. 差分を計算し、Neovim APIを使用してハイライトを適用
5. 指定された期間後にハイライトをクリア

### 主要コンポーネント

- **設定管理**: Lua層で設定を管理し、Denops層に渡す
- **差分計算**: 最適化された`diff`アルゴリズムで文字・行単位の差分を検出
- **ハイライト**: Neovimのnamespace APIを使用して一時的なハイライトを適用
- **キャッシング**: バッファ状態と差分結果のキャッシュによる高速化
- **並行性制御**: バッファごとのコマンドキューとロックマネージャー

## 開発コマンド

### 基本コマンド

```bash
# コードフォーマット
deno fmt                        # TypeScriptコードのフォーマット
stylua lua/                     # Luaコードのフォーマット

# 品質チェック
deno fmt --check                # フォーマットチェック（CI用）
deno lint                       # TypeScriptコードのリント
deno check denops/**/*.ts       # 型チェック（全TypeScriptファイル）

# テスト
deno task test                  # 全テストを実行
deno task test:watch            # ファイル変更時に自動でテスト実行
deno task test:coverage         # カバレッジ付きでテスト実行
deno task coverage:report       # HTMLカバレッジレポートを生成

# ベンチマーク
deno task benchmark             # パフォーマンスベンチマークを実行
./scripts/benchmark.ts          # 個別にベンチマークスクリプトを実行

# CI
deno task ci                    # CI用の全チェック（fmt:check → lint → check → test）

# 依存関係
deno task cache                 # 依存関係をキャッシュ
```

### 開発時のワークフロー

```bash
# 1. 開発中の自動テスト
deno task test:watch

# 2. コミット前の確認
deno task fmt                   # コードをフォーマット
stylua lua/                     # Luaコードをフォーマット
deno task ci                    # 全チェックを実行

# 3. 単一ファイルのテスト
deno test denops/highlight-undo/core/diff-optimizer_test.ts

# 4. Denopsプラグインのリロード（Neovim内で）
:call denops#plugin#reload('highlight-undo')
```

## 開発時の注意点

### 基本的な注意事項

- Denops層の変更時は、Neovimを再起動するか `:call denops#plugin#reload('highlight-undo')` を実行
- ハイライトグループは既存のNeovimグループ（`DiffAdd`、`DiffDelete`）を使用
- パフォーマンスのため、大きな変更（行数50以上、文字数1500以上）はハイライトをスキップ
- Neovim APIの呼び出しは `luaeval` を使用してLuaコードとして実行

### テスト駆動開発

- 新機能追加時は必ず対応するテストファイル（`*_test.ts`）を作成
- テストは単体テストを基本とし、モックを活用して依存関係を分離
- `deno task test:watch`を使用して継続的にテストを実行

### パフォーマンス最適化

- 大きなバッファでの操作を想定し、常にパフォーマンスを意識
- ベンチマークスクリプトで定期的に性能を測定
- キャッシュの有効活用とメモリリークの防止

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

### 直感的なハイライト調整（2025-07-01追加）

- **改行境界の調整**: 改行を跨ぐ差分を適切に処理し、次の行に不自然にハイライトが表示されることを防ぐ
- **単語境界認識**: 単語の途中で切れる差分を単語境界まで自動拡張
- **空白の特別処理**: インデント変更や行末空白の変更をより見やすく表示
- 設定可能なオプション: `rangeAdjustments.adjustWordBoundaries`と`rangeAdjustments.handleWhitespace`

### 複数行変更の範囲計算修正（2025-01-01修正）

- **fillRangeGapsの範囲計算改善**: 複数の変更チャンクがある場合、全ての変更範囲を正確に計算
- 以前は最初と最後のチャンクのみを見ていたため、中間のチャンクが除外される問題を修正
- `diff-optimizer.ts`で全ての変更チャンクを走査し、実際の変更範囲（aboveLine/belowLine）を正確に計算

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

## トラブルシューティング

### よくある問題と解決方法

1. **ハイライトが表示されない**
   - Denopsサーバーが起動しているか確認: `:echo denops#server#status()`
   - デバッグモードを有効にして詳細を確認: `:lua require('highlight-undo').setup({ debug = true })`
   - バッファサイズがしきい値を超えていないか確認

2. **パフォーマンスが低下する**
   - キャッシュ統計を確認: `:lua require('highlight-undo').debug.get_stats()`
   - しきい値を調整: `threshold.line`と`threshold.char`の値を増やす
   - キャッシュをクリア: `:lua require('highlight-undo').debug.clear_cache()`

3. **マルチバイト文字で位置がずれる**
   - ファイルのエンコーディングを確認: `:set fileencoding?`
   - デバッグログで文字位置の変換を確認

### デバッグログの確認

```bash
# デバッグログファイルの場所（デフォルト）
tail -f ~/.local/share/nvim/highlight-undo.log
```

## パフォーマンスベンチマーク

プロジェクトルートで以下のコマンドを実行：

```bash
# 基本的なベンチマーク
deno task benchmark

# 詳細なパフォーマンスベンチマーク
deno run --allow-all denops/highlight-undo/performance-benchmark.ts
```

ベンチマーク結果には以下が含まれます：

- 差分計算の処理時間
- 範囲計算の処理時間
- キャッシュのヒット率
- メモリ使用量
