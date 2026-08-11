# ResumeMd Implementation Findings

- Workspace is empty except the reference image and generated planning files.
- Best first implementation shape is a no-build Chrome extension so the user can load it unpacked directly.
- PDF.js should be bundled locally for extension CSP compatibility.
- PDF.js has a reported high severity advisory with no available npm fix. The implementation disables eval support and assumes the user uploads their own resume PDFs.
