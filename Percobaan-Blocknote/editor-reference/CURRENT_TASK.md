# Current Task: Perbaikan Muat/Simpan Kanvas — STATUS: COMPLETED

## Objective
Perbaiki masalah: (1) gambar upload di Excalidraw muncul kotak abu-abu, (2) autosave salah imbang, (3) klik mention di Preview tidak berfungsi.

## Subtasks
- [x] Serialisasi BinaryFiles ke kolom scene (`{ elements, files }`).
- [x] Perbaiki useMemo dependency `[canvasInitialElements, canvasInitialFiles]`.
- [x] Tambahkan anti-overwrite guards: `canvasLoadFailedRef`, `serverHadElementsRef`, `hasUserChangedRef`, fingerprint.
- [x] `canSaveScene()` sebagai fungsi pengaman bersama untuk semua jalur simpan.
- [x] Konfirmasi `window.confirm` sekali untuk kanvas kosong.
- [x] Kembalikan `getMentionClicked` dan `handleWrapperPointerUp` ke `CanvasSceneLoader` dengan prop `onMentionClick`.
- [x] Commit: `d4b4a63`.
- [x] Pass `npx tsc --noEmit` dan `npm run build`.

