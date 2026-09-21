# Architecture Decisions

## Custom Paste Handler for Math Rendering (2026-09-18)
- **Context**: The user frequently copies educational content containing LaTeX math from ChatGPT and pastes it into BlockNote. By default, BlockNote does not automatically convert plain text `$$...$$` or `$...$` into its math block equivalents.
- **Decision**: Implemented a custom `pasteHandler` in `Editor.tsx` using `useCreateBlockNote`.
- **Details**:
  - The handler intercepts `text/plain` clipboard content.
  - It uses strict regex (`/\$\$[\s\S]+?\$\$/` and `/\$[^ \$\n](?:[^\$]*[^ \$\n])?\$/`) to identify if the pasted text legitimately contains block or inline math.
  - If a match is found, it splits the text, recursively builds BlockNote node objects (`type: "mathBlock"`, `type: "math"`), and uses `tryParseMarkdownToBlocks` to handle standard markdown formatting (like lists and bolding) around the math formulas.
  - For non-math pastes, internal ProseMirror pastes, or image copies, the handler safely yields to `context.defaultPasteHandler()`.
- **Consequences**: This allows a seamless copy-paste workflow from ChatGPT while perfectly preserving the ability to copy images and rich text natively.
