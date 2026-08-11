# ResumeMd Findings

## Project State

- Current workspace initially contained only `references/格式参考.png`.
- The reference image shows a dark two-column resume interface: rendered resume content on the left and editable Markdown on the right.
- The product decision for first version is simpler than the reference: default to editable Markdown only; preview can wait.

## Product Constraints

- Resume information is private and should be stored locally.
- DeepSeek access must use the user's own key, with a clear-key control and clear-all-data control.
- PDF parsing may be imperfect, so manual editing is required.
- Existing Markdown must not be silently replaced by a new upload.

## Technical Direction

- Use a Manifest V3 Chrome extension.
- Use a content script to inject a page-level floating panel on ordinary web pages.
- Use `chrome.storage.local` for Markdown content, DeepSeek key, and panel state.
- Use bundled PDF parsing assets rather than remote scripts.
- Use direct `fetch` to DeepSeek only when the user provides a key.
- `npm audit` reports a high severity `pdfjs-dist` advisory with no available npm fix. The prototype disables PDF.js eval support and is intended for user-owned resume PDFs.
