# Changelog

All notable changes to this project are documented in this file.

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
