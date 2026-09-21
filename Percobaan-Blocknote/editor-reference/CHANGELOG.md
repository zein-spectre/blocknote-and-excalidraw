# Changelog

## [Unreleased]
### Added
- Feature: Clicking a Note Mention chip inside any BlockNote editor in the Canvas page now fetches and opens the note from Appwrite in the right-hand panel.
- Feature: Edits to Appwrite notes in the side panel are now automatically saved to the database (800ms debounce).
- Feature: Canvas scene is now loaded and auto-saved to an Appwrite `canvases` collection (1.5s debounce).
- Feature: Adding a new BlockNote Box in Excalidraw automatically creates a new draft document in Appwrite and links the box to it natively.
- Feature: Excalidraw boxes linked to Appwrite notes dynamically fetch and display their Appwrite document titles (via bulk `Query.equal`).
- Feature: Live-synchronization of Appwrite note titles between the side panel and Excalidraw canvas boxes.
- React Context (`EditorContext`) in `Editor.tsx` to robustly pass `onOpenNote` callbacks to inline content renderers, replacing the fragile global variable approach.

### Fixed
- Bug where clicking a Note Mention chip in the canvas panel would fail to open the note due to a state collision with Excalidraw's `onChange` event handler overriding the panel state.
- Silent UI failures when attempting to load a deleted or non-existent Appwrite note (404); now displays a prominent "Note tidak ditemukan" error message.

## [Unreleased] - 2026-09-21
### Added
- Added soft-delete mechanism (`status: "trashed"`) for Appwrite notes to prevent accidental permanent deletion.
- Added `/admin/trash` dashboard page for reviewing and restoring deleted notes.
- Added a Trash icon to the canvas right side panel to trigger note deletion.
- Implemented automatic canvas cleanup: Soft-deleting a note now cleanly erases all associated `embeddable` note cards and trims the mention string from any inline texts across the canvas in real time.

### Fixed
- Fixed bug where status banner in the canvas side panel failed to display upon reopening a trashed note (due to missing `status` parameter during state reconstruction).
- Resolved Excalidraw text dimension desync bug during programmatic string replacement by routing modifications through `restoreElements(..., { refreshDimensions: true })`, ensuring bounding box integrity.
- Ensured programmatic canvas deletions triggered by Appwrite trash actions are safely logged into Excalidraw's local history stack (Cmd+Z undoable) using `CaptureUpdateAction.IMMEDIATELY`.
