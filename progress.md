# ResumeMd Progress

## Session Log

- Generated `proto-agents/resumemd/agent-resumemd.md`.
- Confirmed workspace has no existing app or extension code.
- Confirmed git is installed, but the workspace is not a git repository.
- Started implementation planning.
- Created the Manifest V3 extension shell, package metadata, background worker, and PDF.js vendor copy script.
- Installed `pdfjs-dist` and copied local PDF.js assets into `vendor/`.
- Added local cmaps and standard font assets for more reliable Chinese PDF extraction.
- Disabled PDF.js eval support after reviewing the dependency audit risk.
- Implemented the floating panel, editable Markdown surface, PDF import choices, DeepSeek optimization, search highlighting, copy, key clearing, and clear-all controls.
- Added README loading and usage notes.
- Improved PDF-to-Markdown quality by sorting extracted PDF text by coordinates before formatting.
- Added stronger resume section detection and field normalization for basic Markdown output.
- Strengthened the DeepSeek prompt to keep personal info, education, internships, projects, skills, awards, and other sections organized.

## Verification Notes

- Passed: `npm run check`.
- Passed: `manifest.json` parses as valid JSON.
- Passed: PDF.js core, worker, cmaps, and standard fonts exist under `vendor/`.
