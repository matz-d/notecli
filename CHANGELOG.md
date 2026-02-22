# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

### Breaking
- Default output profile changed to `minimal` for JSON-oriented commands. If you depended on previous raw payloads, use `--profile full`.

### Added
- Interactive `auth login` flow with selectable modes: `browser` / `manual` / `env`.
- `auth login --cookie-stdin` for safer non-interactive cookie input.
- Optional Playwright-assisted browser login via `auth login --browser`.
- `--profile minimal|full` output controls (default: `minimal`).

### Changed
- `auth login` no longer requires `--cookie` at parse-time; existing `--cookie` flow remains supported.
- Improved authentication guidance messages to reference interactive login.
- Browser login now guides users to run `npx playwright install chromium` when Chromium is missing.
- Removed noisy XSRF acquisition warning during login flow.
- Default output is now minimal for agent-friendly context handling; `--profile full` keeps raw payloads.
- Improved competitor theme extraction to reduce bracket/sentence-level noise.

## [0.1.0] - 2026-02-21

### Added
- Initial standalone repository layout for CLI release.
- Workspace structure with `apps/note-research-cli` and `packages/note-core`.
- OSS release documentation kit under `docs/oss-release-kit`.
- Root `README.md` and `NOTICE` for attribution and usage guidance.

### Changed
- Removed copied build artifacts (`dist`, `.vendor`, `*.tgz`) from repository state.
- Standardized root `.gitignore` for release-safe repository hygiene.

### Notes
- This release targets GitHub Releases distribution first.
- This tool uses non-official note API endpoints and is unrelated to official note services.
