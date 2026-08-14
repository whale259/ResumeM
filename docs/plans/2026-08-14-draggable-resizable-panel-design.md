# ResumeM Draggable Resizable Panel Design

## Goal

Make the ResumeM floating panel movable and resizable so it does not block online application forms. The Markdown editor and highlighted search layer must resize with the panel in real time.

## Interaction

- Drag from the top bar to move the panel.
- Resize from small handles on all four corners.
- Keep the panel within the visible viewport.
- Persist width, height, left, and top in `chrome.storage.local`.
- Restore saved geometry when the panel opens again.

## Layout

The existing flex column layout remains unchanged. Header, settings, toolbar, and footer keep fixed heights, while the editor shell continues to fill remaining space. This lets content reflow and scroll naturally when the panel size changes.

## Constraints

- Minimum size protects toolbar and editor usability.
- Maximum size is limited by the viewport.
- Existing search highlighting, editor sync, import/export, and DeepSeek settings behavior should remain unchanged.
