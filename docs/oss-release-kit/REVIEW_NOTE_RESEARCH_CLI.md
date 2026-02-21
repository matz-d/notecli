# レビュー結果（docs/oss-release-kit + apps/note-research-cli）

実施日: 2026-02-21

## 総評

- 機能面では、競合調査（discover/analyze/diff/report）とアカウント分析（`user analyze`）の主要ユースケースは一通り満たしています。
- セキュリティ面でも、認証情報保存の権限（`0600`）や HTML エスケープのテストがあり、最低限の防御は入っています。
- 一方で、Agent リサーチツールとしての実用性・堅牢性を上げるために、入力バリデーション・再現性・配布物クリーンアップで改善余地があります。

## 仕様達成状況

### ✅ 要件を満たしている点

1. 競合調査機能
   - `competitor discover` / `competitor analyze` / `diff mine-vs-competitors` / `report needs` / `report gap` が存在。
2. アカウント分析機能
   - `user analyze --user <urlname>` が存在し、ユーザー投稿を取得して分析可能。
3. Agent ツールとしての出力形式
   - `json|md` 出力に対応し、機械処理向け JSON を提供。
4. 安全配慮
   - READMEテンプレートで `--cookie` 露出リスクを明記。
   - セッションファイル `0600` をテストで担保。
   - Markdown→HTML変換で危険文字をエスケープするテストあり。

### ⚠️ 改善推奨（重要度: 中）

1. 数値オプションの入力検証不足
   - `--size` / `--page` を `Number()` 変換しているが、`NaN` や負数を拒否していない。
   - API 側エラーや想定外の負荷の原因になり得るため、CLI層で `integer && >0` バリデーションを推奨。

2. アカウント分析の網羅性
   - `user analyze` は単一ページ取得前提（`--page` 指定）で、全体傾向分析には不十分な場合あり。
   - `--pages` や `--max-notes` で複数ページ収集できると、競合・アカウント分析品質が向上。

3. ビルド再現性リスク
   - `prebuild` で毎回 `npm install` が走るため、環境やタイミング依存で結果がぶれる余地がある。
   - CI/リリース用は `npm ci` へ寄せる、または `prebuild` から install を外すことを推奨。

4. 配布物クリーンアップ
   - リポジトリに `note-research-cli-0.1.0.tgz` がコミット済み。
   - tarball 内に `node-domexception/.history/` など不要と思われるファイル群が含まれている。
   - リリース成果物は Git 管理外にし、生成時に不要ファイルを除外すると安全/軽量。

## docs/oss-release-kit 観点

- テンプレート類は、非公式API・NOTICE・セキュリティ注意を押さえており実用的。
- ただし、`RELEASE_STEPS.md` は `npx ./note-research-cli-0.1.0.tgz` 実行手順の補足（Node/npmバージョン、実行例の失敗時対処）を足すと、第三者再現性がさらに上がる。

## 優先度付きアクション

1. **P1**: 数値入力バリデーション（`size/page` の整数・範囲チェック）を CLI に追加。
2. **P1**: `user analyze` の複数ページ収集オプション追加。
3. **P2**: `prebuild` の `npm install` を見直し（再現性改善）。
4. **P2**: 配布 tarball を Git 管理対象外にし、生成時の不要ファイル除去を実施。

