# Debug Log

## Issue: Clicking a Note Mention chip inside the Canvas note does nothing
**Date:** 2026-09-21

### Confirmed Root Cause
1. In `CanvasPrototypePage.tsx`, when a chip was clicked, `handleOpenAppwriteNote` was successfully called and set the state: `setAppwriteNoteId(id)` and `setSelectedNoteId(null)`.
2. This state change triggered a React re-render.
3. Due to the re-render (or React's batching), Excalidraw fired its `onChange` handler (`handleChange`).
4. Inside `handleChange`, it checked the internal Excalidraw selection (`appState.selectedElementIds`), which still held the canvas note (`embed-1`) because clicking a chip inside the DOM didn't deselect the canvas element.
5. The handler blindly compared Excalidraw's selection (`embed-1`) with the current component state `selectedNoteId` (`null`). Since they were different, the handler assumed the user had just clicked the Excalidraw element, firing `setSelectedNoteId('embed-1')` and `setAppwriteNoteId(null)`, which immediately closed the Appwrite panel before it even finished loading.

### Final Fix
Introduced `lastExcalidrawSelectedIdRef` (a `useRef` hook) in `CanvasPrototypePage.tsx` to keep track of the *actual* last Excalidraw selection independently of the React rendering cycle. 
`handleChange` was modified to ONLY update the application state if the current Excalidraw selection genuinely differs from `lastExcalidrawSelectedIdRef.current`.

### Why the Fix Works
By decoupling the application's view state (`selectedNoteId`, `appwriteNoteId`) from the Excalidraw selection tracker (`lastExcalidrawSelectedIdRef`), we ensure that `handleChange` only triggers side effects when the user *actually* interacts with the canvas. State changes triggered by external UI elements (like chips) no longer cause Excalidraw to falsely re-assert its selection state.

### Verification Performed
- Inserted diagnostic logs (`[DIAG] 1-8`) across `Editor.tsx` and `CanvasPrototypePage.tsx` to trace the exact order of execution and state changes.
- Clicked the chip in the Canvas Note panel and verified that the Appwrite note loads properly without being overridden.
- Clicked empty canvas space and verified the panel closes.
- Clicked another canvas box and verified the panel switches appropriately.

### Tests/Checks Passed
- `npx tsc --noEmit`: 0 errors
- `npm run build`: Success (~6.4s)

### Important Lessons for Future Similar Problems
When dealing with external/third-party complex stateful components (like Excalidraw) that fire `onChange` events, **never** directly compare their internal state against a React state that can be mutated by other UI components. Always use a stable ref to track the last known state of the external component to prevent cyclic state overwrites and race conditions.

## Issue: Saving Canvas on Every Selection & Synchronizing Appwrite Titles
**Date:** 2026-09-21

### Confirmed Root Cause
1. Excalidraw's `onChange` event fires on *any* interaction, including simply clicking an element (which changes `appState.selectedElementIds`). Relying on this blindly would trigger unnecessary network requests to save the canvas even when geometry/elements haven't changed.
2. Canvas boxes (embeddables) only store a `link` property. Fetching the title for each box individually on load causes N+1 query problems, slowing down the initial render.
3. If an Appwrite document is deleted elsewhere, clicking the canvas box attempts to fetch a non-existent document (404), which originally resulted in a silent crash or unhandled UI state.

### Final Fix
1. **Canvas Saving**: Filtered out deleted elements (`!el.isDeleted`), stringified the remaining array (`JSON.stringify`), and stored it in a ref (`lastSavedSceneRef`). The canvas is only saved if this string mutates.
2. **Title Synchronization**: Collected all unique Appwrite IDs from the loaded scene and used `Query.equal("$id", uniqueIds)` to fetch all titles in a single network request. Titles are mapped in a React state (`appwriteTitles`), which is updated synchronously when the user edits the title in the right panel.
3. **404 Handling**: Explicitly caught 404 errors in `getDocument`, overriding `saveStatus` to `"Note tidak ditemukan"`, and adding a conditional UI render to clearly display the error without crashing the editor.

### Why the Fix Works
- JSON stringifying the filtered active elements safely strips out `appState` (which contains volatile selection data) and deleted elements, providing a pure, stable fingerprint of the actual canvas geometry and content.
- `Query.equal` leverages Appwrite's bulk querying, drastically reducing network overhead.
- Keeping `appwriteTitles` in a React state allows `renderEmbeddable` to reactively update the canvas UI the moment a title is typed in the panel, without waiting for the server response.

### Verification Performed
- Loaded the canvas and observed only one bulk query for titles.
- Added, moved, and selected elements, verifying that saves only trigger on actual geometric/content changes.
- Clicked an Appwrite-linked box and edited the title in the side panel; verified the canvas box title updated instantly in real-time.
- Verified memory notes (`embed-1`) continue to function without breakage.

### Tests/Checks Passed
- `npx tsc --noEmit`: 0 errors
- `npm run build`: Success (~4.34s)

### Important Lessons for Future Similar Problems
- Always sanitize and serialize complex third-party state before doing equality checks for auto-saves (e.g., stripping out selections/deleted items).
- Use bulk database queries for populating scattered UI elements (like titles on canvas nodes) to prevent N+1 performance bottlenecks.
- Graceful degradation: always anticipate 404s when dealing with linked relational data in canvases.

## Issue: Lingering mentions and cards on canvas when note is moved to trash
**Date:** 2026-09-21

### Confirmed Root Cause
Excalidraw canvas does not automatically subscribe to Appwrite database deletions. When a note is moved to trash via the right side panel, its visual representations on the canvas (embeddable cards and inline mention text) remained untouched because there was no programmatic logic implemented to proactively seek them out and scrub them from the scene.

### Final Fix
1. **Cards (Embeddables):** Mutated the corresponding `embeddable` elements to `isDeleted: true` directly.
2. **Text Mentions:** Intercepted the text elements, string-replaced the mention title in `originalText` (searching from back-to-front to preserve indices), and stripped the `noteId` from `customData.mentions`.
3. **Dimension Calculation:** Passed the modified text elements through Excalidraw's `restoreElements(..., { refreshDimensions: true })` API to recalculate line wrapping, width, and height cleanly. Empty texts are marked `isDeleted: true` without removing their parent shapes.
4. **History Stack:** Executed `updateScene` utilizing `captureUpdate: CaptureUpdateAction.IMMEDIATELY` to push the automated deletion into the user's Undo history (Cmd+Z).

### Why the Fix Works
Using `restoreElements` leverages Excalidraw's internal native dimension-measuring engine, ensuring that bounding boxes and hit detection remain perfectly calibrated to the new trimmed text string. `CaptureUpdateAction.IMMEDIATELY` forces Excalidraw to register the programmatic change as a standard user action, enabling robust Undo/Redo capabilities for the automated canvas cleanup.

### Verification Performed
- Moved a note to the trash via the Trash2 icon in the side panel.
- Verified via `[DIAG-U]` that the old text successfully lost the mention string, that `width` and `height` updated appropriately, and that `containerId` ties to shapes were properly maintained.
- Confirmed that empty texts are correctly hidden (`isDeleted: true`) while their parent bound shapes are kept intact.

### Tests/Checks Passed
- `npx tsc --noEmit`: 0 errors
- `npm run build`: Success (~4.47s)

### Important Lessons for Future Similar Problems
- **Never manipulate Excalidraw text element dimensions manually** by mutating `width` or `height` values, as this corrupts Excalidraw's hit detection and bounding box engine. 
- Always rely on official API functions like `convertToExcalidrawElements` or `restoreElements` with `refreshDimensions: true` to let the Excalidraw engine calculate text measurements automatically when changing strings via code.

## Issue: Side Panel Flexibility and Responsiveness (Resizable Panel)
**Date:** 2026-09-21

### Confirmed Root Cause
The right side panel (`Appwrite Note` / `Memory Note`) was strictly hardcoded with `flex: 45%` layout. This caused a rigid user experience, rendering the canvas viewport too narrow for larger screens or the panel too narrow for reading long notes. Furthermore, shrinking the panel aggressively caused BlockNote's left gutter (padding for the side menu handle) to compress the actual text column excessively.

### Final Fix
1. Implemented a `ResizablePanel` component tracking pointer events (`onPointerDown`, `onPointerMove`, `onPointerUp`) to calculate width dynamically and save it to `localStorage`.
2. Intercepted Excalidraw's aggressive internal pointer capture by setting `.excalidraw-container { pointer-events: none; }` during the active resizing operation.
3. Added container queries in `index.css` to conditionally reduce BlockNote's `.bn-editor` left padding from 54px to 28px when the panel is smaller than 380px.

### Why the Fix Works
Temporarily disabling `pointer-events` on the Excalidraw wrapper prevents its internal canvas event listeners from hijacking the native mouse drag sequence, allowing smooth and uninterrupted resizing. The container query guarantees that the rich text editor's layout respects the restricted spatial boundaries without clipping text or floating buttons.

### Verification Performed
- Dragged the resizer edge and observed smooth width transition in both editor and preview pages.
- Shrunk panel to absolute minimum (320px) and verified BlockNote's margin narrowed cleanly.
- Expanded to maximum width and confirmed the canvas area maintained a strict 300px reserve limit.
- Verified double-click on the resizer successfully reverts width to the 450px default.

### Tests/Checks Passed
- `npx tsc --noEmit`: 0 errors
- `npm run build`: Success

### Important Lessons for Future Similar Problems
When building drag-to-resize layouts adjacent to complex canvas applications (like Excalidraw, Figma-clones, or WebGL), you must temporarily disable pointer events on the canvas layer during the drag action. Otherwise, the canvas will capture the pointer, resulting in stuttering, lost drag context, or unintended geometry modifications on the canvas itself.
