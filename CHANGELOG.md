# Changelog

All notable changes to Reading Markers are documented in this file.

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
