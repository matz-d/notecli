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
- JSON / Markdown outputs

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

コマンドライン引数でログインする場合は `ps aux` などで他プロセスからセッションが見える点に注意してください。

```bash
node dist/main.js auth login --cookie "_note_session_v5=..."
node dist/main.js auth status
```

If `--xsrf` is omitted, CLI tries to resolve it automatically.

認証情報は `~/.note-research/session.json` (mode 0600) に保存されます。

## Usage

```bash
node dist/main.js search-notes --query "AI" --json
node dist/main.js competitor analyze --query "AI" --format json
node dist/main.js report needs --query "AI" --format md
node dist/main.js user analyze --user <urlname> --format json
node dist/main.js draft create --title "test" --body-file ./draft.md --format json
```

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

