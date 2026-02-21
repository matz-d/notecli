## Summary

- First standalone release of note-research CLI package
- Focused on research and draft workflows
- Includes test/lint/build verification and release artifacts

## Included

- `search-notes`, `get-note`, `search-users`, `get-user-notes`
- `competitor analyze`, `diff mine-vs-competitors`
- `report needs`, `report gap`
- `draft create`, `draft update`

## Breaking Changes

- None

## Verification

- `npm run build`: passed
- `npm test`: passed
- `npm run lint`: passed

## Notes

- Uses non-official note API endpoints
- Behavior may change if upstream endpoint contracts change
- Follow service terms and use at your own responsibility
