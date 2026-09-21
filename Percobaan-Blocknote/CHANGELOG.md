# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]
### Added
- Integrated `@blocknote/math-block` (v0.54.2) to support LaTeX rendering in the editor.
- Implemented a custom `pasteHandler` in `Editor.tsx` to automatically convert ChatGPT Markdown math (`$...$` and `$$...$$`) into rendered BlockNote math blocks.
- Added strict fallback logic in `pasteHandler` using `context.defaultPasteHandler()` to ensure images, rich text, and internal copy-pasting still work seamlessly.

### Fixed
- Fixed schema collision by correctly naming the math block `mathBlock` and inline math `math` as required by their `BlockSpec` definitions.
- Fixed a bug where returning `false` from the custom paste handler broke BlockNote's default image and text pasting.
