# note-research-cli

noteの競合調査と下書き作成/更新を行うCLIです。

> [!WARNING]
> このツールは **非公式APIを利用**しています。  
> note公式サービスとは無関係です。利用者自身の責任で利用規約を確認してください。

## Status

- Scope: Research + draft create/update
- Out of scope: publish/public/post
- Support: Community support only

## Credits

This project is derived from:

- Original repository: `https://github.com/shimayuz/note-com-mcp`
- Original license: MIT
- See `NOTICE` for details.

## Features

- Search notes/users
- Competitor analysis and diff reports
- **Account analysis**: analyze content trends of a specific user (`user analyze`)
- Draft create/update
- Minimal-first JSON / Markdown outputs (`--profile full` for raw payload)

## Requirements

- Node.js 20+ (LTS recommended)
- npm 10+

## Install

### Option A: Download release artifact

1. Download the latest archive from Releases
2. Extract it
3. Run:

```bash
npm install
npm run build
node dist/main.js --help
```

### Option B: Build from source

```bash
npm install
npm run build
npm test
```

## Authentication

**推奨: 環境変数経由で設定する（コマンドライン引数はプロセス一覧に露出するリスクがあります）**

```bash
# .env ファイルに記載（git管理外にすること）
NOTE_SESSION_V5=<セッション値のみ。_note_session_v5= は不要>
NOTE_XSRF_TOKEN=<xsrfトークン>

# ロードして起動
node -r dotenv/config dist/main.js auth status
```

### Interactive login (recommended)

`auth login` は対話式です。モード選択でログイン導線を切り替えられます。

```bash
node dist/main.js auth login
```

### Browser mode (Playwright)

Playwrightがインストール済みなら、ブラウザログイン補助を使えます。

```bash
npm install -w note-research-cli playwright
npx playwright install chromium
node dist/main.js auth login --browser
```

### Manual mode

```bash
node dist/main.js auth login --cookie "_note_session_v5=..."
node dist/main.js auth status
```

`--xsrf` は省略可能です（未指定時は自動取得を試行）。

### Environment mode

```bash
node -r dotenv/config dist/main.js auth login --mode env
```

### Safer non-interactive input

引数露出を避けるため、cookie は標準入力でも渡せます。

```bash
echo "_note_session_v5=..." | node dist/main.js auth login --cookie-stdin --manual
```

認証情報は `~/.note-research/session.json` (mode 0600) に保存されます。

## Usage

```bash
node dist/main.js search-notes --query "AI" --format json
node dist/main.js search-notes --query "AI" --format json --profile full
node dist/main.js competitor analyze --query "AI" --format json
node dist/main.js report needs --query "AI" --format md
node dist/main.js user analyze --user <urlname> --format json
node dist/main.js draft create --title "test" --body-file ./draft.md --format json
```

## Output Profile

- Default: `--profile minimal`
- Optional: `--profile full`

`minimal` はエージェント実行向けにノイズを削った出力です。  
`full` はデバッグ・互換用途で生データ寄りの出力を維持します。

## Known Limitations

- Uses unofficial endpoints that may change without notice
- Authentication/session behavior may vary by account state
- Automatic workflows can break when endpoint contracts change

## Security

- Never commit `.env` or session cookies
- Keep account tokens private
- Rotate credentials if leaked
- Prefer environment variables (`NOTE_SESSION_V5`) over `--cookie` CLI arguments to avoid session exposure in process listings (`ps aux`)
- Session file is stored at `~/.note-research/session.json` with permissions 0600 (owner-read/write only)

## License

MIT
