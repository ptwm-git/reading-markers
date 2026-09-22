# Reading Markers

Reading Markers adds persistent, color-coded reading positions to Markdown notes and PDF pages. Save several places in one document, scan them near the top of the document, and jump back without searching through the document.

![Reading Markers showing orange and purple positions below a note title](images/reading-markers.png)

## Features

- Add a marker from a paragraph, heading, or list item in editing view or Reading view.
- Choose from red, orange, yellow, green, blue, and purple.
- Group markers by color below the note title.
- Identify unnamed markers by an automatically generated text excerpt.
- Jump to a saved position from the marker bar.
- Use the vertical side controls to jump to the nearest marker above or below the current reading position.
- Before an up or down jump, optionally save the current position for a temporary return; the middle control returns there and saves replace the previous temporary position.
- Fall back to the session's center marker with the middle control when no temporary return position exists.
- Drag the navigation panel by its grip, move it to either side, or collapse it to the edge when it is not needed.
- Change a marker's color or remove it from the marker context menu.
- Keep positions stable when lines are inserted above the marked content or the note is renamed.
- Add page-level markers to PDF documents without modifying the original PDF file.
- Right-click a PDF page or use the PDF toolbar action to add a marker to the visible page.
- View, recolor, remove, and jump to PDF page markers from the marker bar.
- Remember one reading position per document across restarts, without adding permanent markers.
- Open a searchable, color-filtered marker list from the existing floating navigation panel.
- Browse markers in the current document or across Markdown and PDF documents in the Vault.
- Keep PDF markers and reading progress when files or folders are renamed or moved within Obsidian.

Reading Markers is currently desktop-only and requires Obsidian 1.13.7 or later.

## Usage

### Add a marker

1. Right-click a paragraph, heading, or list item.
2. Select **Add reading marker**.
3. Select one of the six colors.

The marker appears below the note title. Click it to return to the saved position.

### Change or remove a marker

Right-click a marker in the marker bar. Select another color, or select **Delete reading marker** to remove it.

### Mark a PDF page

1. Open a PDF in Obsidian.
2. Right-click the page you are reading and select **Add PDF reading marker**, or use the tag action in the PDF toolbar.
3. Select a color.

The marker bar appears above the PDF pages and shows entries such as **Page 8**. Click an entry to return to that page. PDF markers are saved in the plugin data, so the original PDF is not changed.

### Navigate between markers

In Markdown editing view, Markdown Reading view, and PDF view, the floating side controls keep the up, middle, and down navigation buttons. Markdown uses the visible reading position, even if the editor cursor is elsewhere. PDF navigation uses the visible page. The up arrow jumps to the nearest marker above the current position, and the down arrow jumps to the nearest marker below it. Before either jump, the plugin asks whether to save the current position for return. Saving creates a temporary session-only return point and replaces the previous temporary point; choosing not to save keeps the previous temporary point. The middle button returns to the temporary point first, then falls back to the session center marker. When neither exists, it asks you to add a permanent reading marker. Permanent markers remain independently manageable and are not deleted by this temporary behavior.

The panel automatically collapses after four seconds without pointer or keyboard activity. Use the small grip to drag it vertically or horizontally. Moving it near the left or right edge snaps it to that side and collapses it; click the edge handle to expand it again. Its position is retained locally in the current Obsidian installation.

The PDF phase uses page-level positions. The same PDF page cannot have two separate markers, and text selection, text excerpts, and PDF annotation are not part of this phase. Scanned image PDFs can still use page markers; when no text layer is detected, the plugin explains that text-level locations are unavailable.

### Continue reading later

Reading progress is recorded after scrolling or reading interaction settles. Each document has only one saved position. Reopen the document and use the history icon, **Continue last reading position**, to return there. Opening a document does not automatically move the view.

| Position | Purpose | Lifetime |
| --- | --- | --- |
| Colored marker | A permanent place to revisit | Until you delete it |
| Middle-button return | Return from a temporary lookup | Current view session; replaced only when you save another return point |
| Last reading position | Continue reading after reopening | Saved in plugin data; automatically replaced as normal reading continues |

Marker jumps pause automatic progress updates so looking up a reference does not replace your reading progress. Return with the middle or history button to resume normal tracking. To keep reading at the destination instead, use the play icon, **Continue reading from here**, which appears during a lookup. Clicking a marker directly in the marker bar or list also preserves a return point if none exists yet.

Markdown progress stores a short text anchor and surrounding context; PDF progress and temporary returns store a page and its vertical offset. These are reading locations, not text selections. Large content changes may require an approximate return, which is reported with a notice. PDF page insertion, reordering, or replacement can invalidate page-based positions.

### Open the marker list

Use the list icon in the existing floating controls, or run **Reading Markers: Open reading marker list** from the command palette. This opens an expandable list beside the same controls, not a separate native Bookmarks panel.

- Switch between **Current document** and **All documents**.
- Search marker excerpts, PDF page labels, or file paths, and combine the search with a color filter.
- Click a result to open its file and jump to the marker.
- Use the result's menu to change its color or delete it.
- Use refresh to scan again, or close the list to regain the reading area.

All-document scanning happens when requested and stays within the current Vault. The list contains Reading Markers entries only, not entries from Obsidian's core Bookmarks plugin. Navigation, return, resume, and continue-here actions are also available as commands; assign your own shortcuts in Obsidian settings.

### Settings

- **Remember reading position** enables progress saving and restoration. It is on by default. Turning it off leaves existing saved records intact but stops recording and hides their availability until re-enabled.
- **Show success notices** controls short notices after successful changes. Error notices remain enabled.
- **Enable debug logging** adds prefixed action logs at the developer console's verbose level. It is disabled by default.

Interface text automatically follows Obsidian in English or Chinese. Other languages use English.

Saved settings are validated when the plugin starts. Missing or malformed values fall back to safe defaults.

## Data format

For Markdown notes, the plugin appends an Obsidian block ID to the marked Markdown block:

```md
This paragraph has a blue reading marker. ^study-marker-blue-a1b2c3d4
```

The block ID keeps the marker attached to the content instead of a line number. Removing a marker removes only the plugin-owned block ID and preserves the original text.

Reading Markers intentionally rejects YAML properties, fenced code blocks, tables, blockquotes, Callouts, HTML blocks, blank lines, and blocks that already have another block ID. It displays a notice instead of guessing where to write.

Block IDs are an Obsidian Markdown extension and may appear as plain text in other Markdown applications.

For PDFs, the plugin stores a record containing the Vault-relative file path, page number, color, and plugin-owned marker ID in its local plugin data. It does not write annotations into the PDF.

Reading progress is stored alongside PDF markers in `.obsidian/plugins/reading-markers/data.json`. Back up this file to preserve both. File and folder moves performed while the plugin is running in Obsidian update those paths. Moves made outside Obsidian while it is closed, and cross-device merge conflicts, are not automatically reconciled. Temporary middle-button returns are not persisted.

## Privacy and permissions

Reading Markers works locally and only reads or updates Markdown notes and plugin data inside the active Vault. PDF markers do not modify PDF files. It does not use network services, telemetry, ads, accounts, payments, or files outside the Vault.

## Installation

Install it from **Settings -> Community plugins**. Existing users can check for updates there and update Reading Markers without reinstalling it. Manual upgrades replace only the three release files, not `data.json`.

For a manual installation, download `main.js`, `manifest.json`, and `styles.css` from the same GitHub Release. Place them in:

```text
<your-vault>/.obsidian/plugins/reading-markers/
```

Restart Obsidian, then enable **Reading Markers** under Community plugins.

## Development

```bash
npm ci
npm run check
npm run release:check
npm run release:prepare
```

`npm run release:prepare` creates a local release directory containing the three files Obsidian installs.

## Support

Report reproducible problems in [GitHub Issues](https://github.com/ptwm-git/reading-markers/issues).
See [CONTRIBUTING.md](CONTRIBUTING.md) for the expected diagnostic details and local verification Gate.

## License

Reading Markers is available under the [0BSD license](LICENSE).
