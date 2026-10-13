# apex-plugin-apexscreencapture

## Ownership

- `server/apexscreencapture.js` owns browser capture and PDFShift conversion.
- `source/source.sql` owns APEX render/AJAX callbacks.
- `source/spring-apex-to-pdf-v2.2.sql` is the importable export. Its renderer and embedded non-minified assets must match the source files.
- Do not maintain `.min.js` files, including embedded minified assets in the SQL export. APEX owns generated variants; the renderer loads source files in both modes.

## Documentation

- `docs/publish/focus-pdf-export.md` is the source of truth for Confluence page `876871686`.
- Never edit the generated Confluence page directly. Edit Markdown and publish through `.github/workflows/publish.yml` on `master`.
- Keep `connie-page-id` and `connie-dont-change-parent-page` in the guide's frontmatter so publishing updates the existing page without moving it.
- Keep README limited to orientation and publishing setup; the guide owns report configuration.
- Use simple technical English and copy-ready snippets for general setup instructions.
- Size Confluence screenshots with `![description|WIDTHxHEIGHT](assets/file.png)`. Keep dimensions proportional and width at most 600 pixels; the publisher centers images.
- This repository is public. Use redacted/cropped screenshots in `docs/publish/assets/`; do not commit credentials, client/matter details, or financial data.

## Verification

No automated test suite or local APEX runtime is configured. JavaScript syntax can be checked with `node --check server/apexscreencapture.js`; APEX import and PDFShift conversion require the target application and approved credentials. Do not claim those checks ran based only on source inspection.
