# ResumeM

ResumeMd is a local Chrome extension prototype for autumn recruitment application
forms. It injects a dark floating Markdown panel into web pages so you can keep,
search, edit, and copy resume information while filling online applications.

## Load In Chrome

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Choose **Load unpacked**.
4. Select this project folder: `ResumeM`.

## First Version Features

- Floating page panel with a compact dark style.
- Editable Markdown resume workspace.
- Local persistence through `chrome.storage.local`.
- PDF upload with overwrite / append / cancel choices.
- Markdown file import with overwrite / append / cancel choices.
- PDF.js-based text extraction with bundled local assets.
- DeepSeek key setting inside the panel.
- AI Markdown optimization using the user's own DeepSeek key.
- Keyword search with inline highlights and automatic scroll.
- Copy all Markdown.
- Export the edited Markdown as a `.md` file.
- Clear DeepSeek key and clear all local data.

## Notes

- ResumeMd does not include a public DeepSeek key.
- Automatic form filling is intentionally deferred.
- PDF parsing quality depends on the source PDF layout, so manual editing remains
  part of the first-version workflow.
