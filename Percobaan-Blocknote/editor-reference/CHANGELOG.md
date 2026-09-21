# Changelog

## [Unreleased]
### Fixed
- Fixed uploaded images appearing as gray boxes: `BinaryFiles` now serialized into the `scene` column alongside elements, loaded on canvas mount.
- Fixed autosave triggering on Excalidraw's initial `onChange` (not a user edit): fingerprint (`id:version:isDeleted`) compares current scene against server snapshot.
- Fixed autosave overwriting non-empty server scene with empty local scene: `serverHadElementsRef` guard + one-time `window.confirm`.
- Fixed Preview (`CanvasViewPage`): restored `getMentionClicked` and `handleWrapperPointerUp` inside `CanvasSceneLoader` with `onMentionClick` prop, re-enabling mention clicks.
- Fixed `useMemo` race condition in `CanvasPrototypePage`: dependency changed from `[]` to `[canvasInitialElements, canvasInitialFiles]` so `initialData` is created only after Appwrite data loads.

### Added
- Shared save guard `canSaveScene()` covering all scene-write paths (autosave, handlePreview).
- Scene format supports both old (`[...]`) and new (`{elements, files}`) formats.
- `initialSceneFingerprintRef` and `serverHadElementsRef` updated after every successful save.

### Changed
- Scene column format changed from `JSON.stringify(elements)` to `JSON.stringify({ elements, files })`.
- `CanvasViewPage` restructured with `CanvasSceneLoader` child component (`key={routeId}`), rendered only after `canvasLoading=false`.

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
