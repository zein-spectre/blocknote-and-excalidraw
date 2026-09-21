# Current Task: Full Appwrite Canvas Integration and Note Linking

**STATUS: COMPLETED**

## Objective
Implement saving/loading the entire Excalidraw scene to an Appwrite `canvases` collection, and ensure every new BlockNote box created in the canvas corresponds to a real document in the Appwrite `articles` collection, with synchronized titles and robust error handling.

## Subtasks
- [x] Load Excalidraw scene from `canvases` collection on mount (create default if empty).
- [x] Auto-save canvas (1.5s debounce) only when non-deleted elements actually change (ignoring selection).
- [x] Create an Appwrite document (status: "draft") before inserting a new canvas box, and link it via `note://<id>`.
- [x] Modify Excalidraw `handleChange` to route `note://` links to the Appwrite right-panel.
- [x] Fetch Appwrite titles in bulk using `Query.equal` to display on the canvas boxes.
- [x] Synchronize title edits in the panel immediately back to the canvas mapping.
- [x] Gracefully handle 404s (e.g. "Note tidak ditemukan") without crashing.
