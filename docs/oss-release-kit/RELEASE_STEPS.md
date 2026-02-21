# GitHub Releases 配布手順（ダウンロード形式）

この手順は npm 公開ではなく、GitHub Releases で成果物を配布する前提です。

## 1) 事前チェック

```bash
npm install
npm run build
npm test
npm run lint
```

## 2) 配布アーカイブ作成

`note-research-cli` で `npm pack` を使うと、配布に必要な `dist` と依存が含まれる tarball が作れます。

```bash
cd apps/note-research-cli
npm run bundle:note-core
npm pack
```

生成例:

- `note-research-cli-0.1.0.tgz`

## 3) チェックサム生成

Linux/macOS:

```bash
sha256sum note-research-cli-0.1.0.tgz > note-research-cli-0.1.0.tgz.sha256
```

PowerShell:

```powershell
Get-FileHash .\note-research-cli-0.1.0.tgz -Algorithm SHA256
```

## 4) 動作確認（リリース前）

```bash
npx ./note-research-cli-0.1.0.tgz --help
npx ./note-research-cli-0.1.0.tgz search-notes --query "AI" --json
```

## 5) Git tag とリリース作成（gh CLI）

```bash
git tag v0.1.0
git push origin v0.1.0
```

```bash
gh release create v0.1.0 \
  ./apps/note-research-cli/note-research-cli-0.1.0.tgz \
  ./apps/note-research-cli/note-research-cli-0.1.0.tgz.sha256 \
  --title "v0.1.0" \
  --notes-file docs/oss-release-kit/RELEASE_NOTE_TEMPLATE.md
```

## 6) リリース後チェック

- ダウンロードした成果物で `--help` が動く
- README 手順だけで第三者が再現できる
- NOTICE / LICENSE が同梱されている

