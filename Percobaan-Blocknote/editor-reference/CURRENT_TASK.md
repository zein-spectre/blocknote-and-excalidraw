# Current Task: Soft Delete & Canvas Mention Removal

**STATUS: COMPLETED**

## Objective
Implement a soft delete mechanism for Appwrite notes (status: "trashed"), provide a Trash management page for admins, and automatically clean up the Excalidraw canvas by removing deleted note cards and erasing mention texts cleanly without corrupting Excalidraw's hit detection or rendering.

## Subtasks
- [x] Create a soft delete filter across all components querying the `articles` collection to exclude `trashed` notes.
- [x] Create an `/admin/trash` dashboard page for viewing and restoring deleted notes.
- [x] Add a Trash icon to the right panel header in the canvas to trigger `moveToTrash`.
- [x] On note deletion, remove the associated `embeddable` card from the canvas by setting `isDeleted = true`.
- [x] On note deletion, safely string-replace the mention title from any text elements pointing to it.
- [x] Utilize Excalidraw's `restoreElements` with `refreshDimensions: true` to recalculate text dimensions accurately.
- [x] Push canvas modifications to the undo history using `CaptureUpdateAction.IMMEDIATELY`.
