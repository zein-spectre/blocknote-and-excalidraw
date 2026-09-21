# Decisions

## [2026-09-18] Project Initialization
- Decision: Use Vite + React + TypeScript as the foundation for the BlockNote reference implementation.
- Reason: Vite is fast, modern, and standard for new React SPA projects.
- Decision: Use Appwrite for Database and Storage.
- Reason: User requested Appwrite for storing the editor's text, drafts, and published status.

## [2026-09-18] UI Component Library for BlockNote
- Decision: Installed `@blocknote/mantine` for the editor UI.
- Reason: Starting from v0.14+, BlockNote UI components are decoupled from `@blocknote/react` (which is now headless). Mantine provides the default styling.

## [2026-09-18] Tailwind CSS v4 Setup
- Decision: Use `@tailwindcss/vite` instead of PostCSS.
- Reason: The newly installed Tailwind version (v4+) is optimized to run as a Vite plugin rather than a PostCSS plugin.
