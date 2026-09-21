# Architecture Decisions

## 1. Using React Context for BlockNote Inline Content Callbacks
**Date:** 2026-09-21
**Context:** BlockNote requires inline content schemas (`createReactInlineContentSpec`) to be defined outside of React components. We needed a way to pass a dynamic callback (`onOpenNote`) from the parent component down to the `onClick` handler of the chip.
**Decision:** We wrap the `BlockNoteView` inside an `EditorContext.Provider`. The `render` function of `createReactInlineContentSpec` is a standard functional React component and can successfully use `useContext(EditorContext)` to retrieve the callback.
**Rationale:** This avoids the fragility and memory leak potential of using module-level global variables, particularly in environments with Hot Module Replacement (HMR) or React Strict Mode where component remounts could cause the callback reference to become stale or `undefined`.

## 2. Decoupling Excalidraw Selection Tracker from View State
**Date:** 2026-09-21
**Context:** The `handleChange` event in Excalidraw fires frequently and was overwriting state changes made by external React components (like the side panel).
**Decision:** Introduce a dedicated `useRef` (`lastExcalidrawSelectedIdRef`) to store the last known Excalidraw selection, instead of comparing against the React state `selectedNoteId`.
**Rationale:** This prevents race conditions where React state mutations (like opening an Appwrite note) trick Excalidraw's event handler into thinking the user re-selected a canvas element, leading to immediate state overwrites.

## 3. Excalidraw Scene Diffing for Auto-Saves
**Date:** 2026-09-21
**Context:** Excalidraw's `onChange` fires on all interactions, including selection changes, which shouldn't trigger network requests to save the scene. 
**Decision:** Filter out `isDeleted` elements, convert the array to a JSON string, and store it in a React `useRef`. The scene is only saved if the JSON string differs from the ref.
**Rationale:** This cleanly ignores the `appState` (which contains the highly volatile selection tracking) and focuses purely on the persistent geometric and content data of the active elements, ensuring optimal network efficiency.

## 4. Bulk Querying for Canvas Node Titles
**Date:** 2026-09-21
**Context:** Each Excalidraw box needs to render the title of its linked Appwrite document. Fetching them individually on load causes N+1 queries.
**Decision:** Extract all unique `note://` IDs from the loaded scene and execute a single `databases.listDocuments` request using `Query.equal("$id", [...])`.
**Rationale:** Appwrite supports querying by arrays natively. This reduces initial load time and network overhead from O(N) to O(1) regarding database requests.

## 5. Safe Deletion of Excalidraw Text Mentions
**Date:** 2026-09-21
**Context:** When a note is soft-deleted, any inline text mentions in the canvas pointing to it must be erased. Simply replacing the `text` string via raw DOM manipulation or `mutateElement` destroys Excalidraw's hit-detection bounding box, causing invisible selection bugs.
**Decision:** We modify the `originalText` string back-to-front and then pass the modified text element back through the core API `restoreElements([el], null, { refreshDimensions: true })`.
**Rationale:** This utilizes Excalidraw's native dimension-calculation engine to cleanly re-wrap lines and recalculate `width` and `height`, completely avoiding flaky DOM `textarea` simulations or illegal raw object modifications.
