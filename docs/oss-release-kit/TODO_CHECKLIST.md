# note-research-cli 公開TODOチェックリスト

このチェックリストは、`apps/note-research-cli` と `packages/note-core` を切り離して
OSS公開するための実行用テンプレートです。

---

## 0. 方針確定

- [ ] 配布方式を決定（GitHub Releases / npm / 両方）
- [ ] 初回は「GitHub Releases（ダウンロード型）」で開始
- [ ] ツール名・リポジトリ名を決定（公式と誤認しない名称）

---

## 1. 法務・マナー（必須）

- [ ] 元プロジェクトの `LICENSE` を確認（MIT）
- [ ] 派生先に `LICENSE` を同梱
- [ ] `NOTICE` に元プロジェクトURLと改変内容を記載
- [ ] READMEに「非公式API利用」「note公式とは無関係」を明記
- [ ] `.env` / セッション情報 / 個人メモ等が含まれていないことを確認
- [ ] READMEに `--cookie` CLI引数のプロセスリスト露出リスクと環境変数推奨を明記
- [ ] `~/.note-research/session.json` が `0o600` で作成されることを確認（`ls -la ~/.note-research/`）

---

## 2. 切り離し対象ファイル

- [ ] `apps/note-research-cli` を移植
- [ ] `packages/note-core` を移植
- [ ] 依存関係を移植先で解決（`npm install`）
- [ ] `apps` 側からMCP本体へのimportが無いことを確認

確認コマンド（移植先で実行）:

```bash
rg "note-mcp-server|from '../../src|from \"../../src|from '../src'" apps/note-research-cli/src packages/note-core/src
```

---

## 3. ドキュメント整備

- [ ] README（概要・非公式注意・使い方・制限事項）
- [ ] CHANGELOG
- [ ] NOTICE（クレジット）
- [ ] CONTRIBUTING（任意）
- [ ] SECURITY（任意）

---

## 4. 品質ゲート

- [ ] `npm run build` 成功
- [ ] `npm test` 成功
- [ ] `npm run lint` 成功
- [ ] `--help` スモーク成功
- [ ] `draft create` / `draft update` 実動確認

推奨コマンド:

```bash
npm run build
npm test
npm run lint
node apps/note-research-cli/dist/main.js --help
```

---

## 5. 配布（GitHub Releases）

- [ ] リリース用アーカイブ生成（`npm pack` or tar.gz）
- [ ] `SHA256` を生成して添付
- [ ] Git tag 作成（例: `v0.1.0`）
- [ ] Release note に変更点と既知制約を記載
- [ ] ダウンロード後の起動確認をクリーン環境で実施

---

## 6. 公開後運用

- [ ] 既知の制約（非公式API）をIssueテンプレに明記
- [ ] 問い合わせ窓口をREADMEに記載
- [ ] 破壊的変更時のバージョニングルールを明記
- [ ] note側仕様変更時の障害対応ポリシーを明記

---

## 7. 最終公開判定

- [ ] ライセンスとクレジットが適切
- [ ] 秘密情報の混入なし
- [ ] READMEだけで利用者が再現可能
- [ ] クリーン環境で動作確認済み
- [ ] リリース成果物とタグが一致

