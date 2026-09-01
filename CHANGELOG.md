# Changelog

All notable changes to Reading Markers are documented in this file.

## 1.2.0 - 2026-09-01

### Added

- Vertical reading navigation controls in Markdown Reading view and PDF view.
- Up and down controls that jump to the nearest marker on either side of the current position.
- A center control that returns to the current session's center marker.
- A clear notice when the center control is used before a marker has been added.
- Only the first marker in a document initializes the center; later markers do not unexpectedly replace it.
- Dragging, edge snapping, manual collapse, and automatic collapse after four seconds of inactivity.
- A translucent, low-contrast panel and edge handle to reduce reading distraction.

### Compatibility

- Markdown navigation estimates the current reading line from the Reading view scroll position.
- PDF navigation uses page-level positions and preserves the existing scanned-PDF behavior.
- The center marker is session state and is not written into the note or PDF marker data.

## 1.1.0 - 2026-08-26

### Added

- PDF page markers stored independently from the PDF file.
- Right-click and PDF toolbar actions for adding a marker to the visible page.
- PDF marker list below the PDF viewer toolbar with page navigation.
- Color changes and removal for PDF markers.
- Scanned PDF notice when no text layer is detected; page markers remain available.

### Compatibility

- Markdown markers continue to use Obsidian block IDs.
- PDF markers are page-level markers; text selection and in-file PDF annotation are not included in this phase.
- HTML support remains a separate follow-up phase.

## 1.0.0 - 2026-08-24

### Added

- Persistent reading markers in editing view and Reading view.
- Six marker colors with color grouping below the note title.
- Automatic text excerpts, marker navigation, color changes, and removal.
- Stable Obsidian block ID storage that follows note edits and renames.
- Runtime-validated settings for success notices and opt-in debug logging.
- Structured error logging and user-facing failure notices.
- Deferred editor marker-bar refresh for continuous typing.
- English and Chinese interface text selected from the Obsidian language.
- Automated coverage for marker rules, localization, settings, logging, and refresh scheduling.

### Safety

- Rejects unsupported or ambiguous Markdown structures instead of modifying them.
- Verifies source content immediately before every replacement.
- Removes only plugin-owned block IDs.
