# Project Structure

- `editor-reference/`: The main React application.
  - `setup-appwrite.js`: Script to initialize Appwrite DB and Storage.
  - `src/`
    - `lib/appwrite.ts`: Appwrite SDK initialization and configuration.
    - `components/Editor.tsx`: Reusable BlockNote wrapper with Appwrite image upload sync.
    - `pages/AdminDashboard.tsx`: Lists all articles from Appwrite.
    - `pages/AdminEditorPage.tsx`: Editor page for creating and updating drafts/published articles.
    - `pages/PublicReader.tsx`: Read-only view of a published article.
- `docs/`: Documentation folder.
- `GUIDE.md`: Drop-in instructions for developers to reuse this setup.
