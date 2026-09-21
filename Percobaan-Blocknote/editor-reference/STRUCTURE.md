# Project Structure

The application is contained primarily within `/src/pages` and `/src/components`:

```text
src/
├── pages/
│   ├── AdminDashboard.tsx      # Dashboard for managing Appwrite notes
│   ├── AdminTrash.tsx          # Trash management page for deleted Appwrite notes
│   └── CanvasPrototypePage.tsx # Excalidraw x Blocknote integration prototype canvas
├── components/
│   ├── Editor.tsx              # Blocknote wrapper component
│   ├── NoteMentionMenu.tsx     # The inline @ mention menu logic
│   └── SlashMenu.tsx           # The custom slash menu block
└── lib/
    └── appwrite.ts             # Appwrite SDK configuration and exports
```
