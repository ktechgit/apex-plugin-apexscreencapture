# Focus PDF Export — APEX Screen Capture with PDFShift

Spring's Oracle APEX dynamic-action plugin exports rendered report HTML through PDFShift. Legacy canvas capture remains available, but PDFShift is the primary Focus workflow.

## Setup and usage

Use the [Focus PDF Export guide in Confluence](https://springsolutions.atlassian.net/wiki/spaces/ENG/pages/876871686/HowTo+Focus+PDF+Export+with+Plugin+PDFScreenCapture) for installation, API-key setup, report configuration, shareholder page breaks, and pagination.

The guide's [Markdown source](docs/publish/focus-pdf-export.md) and screenshots live in this repository. Changes under `docs/publish/` publish to the existing Confluence page after merging to `master`.

## Repository

- [`server/`](server/) — JavaScript source and bundled dependencies. APEX-generated minified files are not maintained in Git.
- [`source/source.sql`](source/source.sql) — dynamic-action render and AJAX functions.
- [`source/spring-apex-to-pdf-v2.2.sql`](source/spring-apex-to-pdf-v2.2.sql) — importable plugin export. Keep its embedded renderer and source files synchronized with the files above.
- [`helpers/`](helpers/) — report-specific integration examples.

The renderer loads source files in both debug and normal modes, so importing the plugin does not depend on generated minified variants being present.

## Documentation publishing

Configure repository secret `ATLASSIAN_API_TOKEN` with an Atlassian API token belonging to the documentation service account named in [`docs/publish/.markdown-confluence.json`](docs/publish/.markdown-confluence.json). Provision it through GitHub **Settings → Secrets and variables → Actions**. Do not commit the token. This is an Atlassian publishing credential, not the PDFShift conversion key.

The [publishing workflow](.github/workflows/publish.yml) runs only when documentation or the workflow changes on `master`. The guide's frontmatter pins existing page `876871686` and preserves its parent. Ensure the service account can read and update that page before the first publish; an inaccessible page can otherwise cause the publisher to fall back to title lookup.

The publisher uses `forceOverwrite` so Git remains authoritative even when another account last edited the article. This setting applies to all pages selected by the publishing configuration, currently the single Focus guide; review that scope before adding more published documents. Confluence-only edits are overwritten. Verify the live page after publishing rather than treating workflow success alone as evidence.

## Attribution

Forked from [Daniel Hochleitner's APEX Screen Capture plugin](https://github.com/Dani3lSun/apex-plugin-apexscreencapture). Includes html2canvas, jsPDF, canvg, es6-promise, and jQuery DOM Outline. See [LICENSE](LICENSE) and dependency source headers.
