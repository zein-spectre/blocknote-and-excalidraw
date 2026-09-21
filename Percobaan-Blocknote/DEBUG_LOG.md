# Debug Log

Persistent debugging history.
- Record failed attempts, evidence, eliminated causes, successful fixes, root causes, and verification.
- Never delete previous history.
- Never invent missing information.

## Logs

**[2026-09-18] BlockNote Export & Tailwind Vite Plugin Error**
- **Symptom**: `npm run build` failed with `BlockNoteView` not found in `@blocknote/react` and `postcss` complaining about Tailwind CSS configuration.
- **Failed attempts**: Tried to use `BlockNoteViewRaw` directly and `postcss.config.js`.
- **Confirmed root cause**: 
  1. BlockNote v0.54 splits headless core (`@blocknote/react`) and UI (`@blocknote/mantine`).
  2. Tailwind CSS v4 utilizes `@tailwindcss/vite` which conflicts with old `postcss.config.js` settings.
- **Final fix**: 
  1. Installed `@blocknote/mantine` and imported `BlockNoteView` and `style.css` from there.
  2. Deleted `postcss.config.js` and set up `vite.config.ts` to use `tailwindcss()` plugin with `index.css` using `@import "tailwindcss";`.
- **Why the fix works**: Aligns the project with the specific dependency versions installed during setup.
- **Verification performed**: `npm run build` completed with code 0.
- **Important lessons for future similar problems**: Always check the major version changes for dependencies like BlockNote and TailwindCSS when initializing new projects, as their default APIs can change drastically.

**[2026-09-18] BlockNote Math Rendering & Paste Handler Bugs**
- **Symptom 1**: Pasted ChatGPT LaTeX text (`$...$` and `$$...$$`) didn't render as math blocks in BlockNote.
- **Symptom 2**: Custom paste handler caused `"block type math doesn't match blockContent"` error when attempting to insert math blocks.
- **Symptom 3**: Custom paste handler broke image pasting and internal rich-text pasting. The user could not paste at all unless it was plain text.
- **Failed attempts**: 
  - Overriding all pasting containing `$` which broke standard rich text.
  - Using `{ type: "math", props: { math: "..." } }` to initialize math nodes (failed because properties were actually `content: "plain"` and types were misnamed).
  - Returning `false` from the custom `pasteHandler` in `useCreateBlockNote`, which bypassed BlockNote's default image/rich-text pasting logic and caused a fallback to pure ProseMirror.
- **Confirmed root cause**: 
  1. BlockNote has separate names for `createReactMathBlockSpec()` (`mathBlock`) and `createReactInlineMathSpec()` (`math`). Naming them both `"math"` causes schema collisions.
  2. BlockNote Math blocks and inline math use `content: "plain"` instead of custom `props` to store the raw LaTeX string.
  3. The `pasteHandler` option in `useCreateBlockNote` requires returning `context.defaultPasteHandler()` to fall back to standard block pasting behavior; returning `false` completely disables BlockNote's custom logic.
- **Final fix**: 
  1. Renamed block schema key to `mathBlock`.
  2. Modified custom pasting to pass LaTeX directly to the `content` property of the node.
  3. Added strict regexes (`/\$\$[\s\S]+?\$\$/` and `/\$[^ \$\n](?:[^\$]*[^ \$\n])?\$/`) to intercept math accurately.
  4. Changed `return false` to `return context.defaultPasteHandler()` for unmodified texts and images.
- **Why the fix works**: Aligns the node insertion precisely with BlockNote's schema definition and appropriately yields to the editor's default handling for non-math content.
- **Verification performed**: User tested pasting from ChatGPT code blocks, images from the web, and copying text internally from BlockNote, confirming all behaviors are fully functional.
- **Important lessons for future similar problems**: 
  1. Check the `*.d.ts` (type definitions) of third-party blocks to understand their expected `type` and `propSchema` or `content` structure before writing custom handlers.
  2. When hooking into core editor events like `pasteHandler`, always review how to trigger the framework's native fallback safely to avoid unintentionally breaking standard editor features (like image uploads).
