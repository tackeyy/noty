# noty - Notion CLI

Notion APIをラップするCLIツール。

## 開発ルール

### TDD（テスト駆動開発）

機能追加・バグ修正は **TDD（Red-Green-Refactor）** で進める。

1. テストリストを作成
2. 失敗するテストを書く（Red）
3. テストを通す最小の実装（Green）
4. リファクタリング（Refactor）

### テスト実行

```bash
npm test           # 全テスト
npm run build      # TypeScriptビルド
```

### プロジェクト構成

```
src/
  cli/index.ts          # CLI エントリポイント（commander）
  lib/client.ts         # NotyClient（Notion API ラッパー）
  lib/blocks-to-markdown.ts  # Block → Markdown 変換
  lib/markdown-to-blocks.ts  # Markdown → Block 変換
  lib/retry.ts          # リトライロジック（429/5xx）
  lib/url-parser.ts     # Notion URL/ID パーサー
  lib/property-builder.ts    # プロパティビルダー
  __tests__/helpers/mock-notion.ts  # 共通モック
```

### npm link

`npm link` で `~/dev/noty` がグローバルにリンクされている。ビルド後すぐに `noty` コマンドに反映される。
