# Panduan Integrasi BlockNote + Appwrite

Panduan ini ditujukan agar Anda dapat menggunakan sistem *text editor* (BlockNote) dan penyimpanan (Appwrite) ini di proyek-proyek *website* React Anda selanjutnya dengan mudah.

## 1. Persiapan Dependensi
Di proyek React/Vite baru Anda, instal *package* yang dibutuhkan:
```bash
npm install @blocknote/core @blocknote/react @blocknote/mantine appwrite react-router-dom lucide-react
```

## 2. Setup Appwrite
Pastikan Anda sudah memiliki *Project*, *Database*, *Collection*, dan *Storage Bucket* di Appwrite (seperti yang dibuat otomatis melalui `setup-appwrite.js` pada proyek referensi ini).
- Atribut yang wajib ada di Collection:
  - `title` (string)
  - `content` (string / sangat besar misal 10.000.000 karakter)
  - `status` (string, default: 'draft')

## 3. Copy-Paste File Penting
Pindahkan 2 file utama dari proyek ini (`editor-reference`) ke proyek baru Anda:
1. **`src/lib/appwrite.ts`**: Mengatur koneksi Client SDK ke Appwrite. Sesuaikan `databaseId`, `collectionId`, dan `bucketId` jika berbeda.
2. **`src/components/Editor.tsx`**: Komponen utama yang sudah mencakup konfigurasi `useCreateBlockNote` dan fungsi *upload* gambar ke Appwrite Storage secara otomatis.

## 4. Cara Penggunaan di Halaman Web

### A. Penggunaan untuk Admin (Tulis/Edit)
Gunakan komponen `<Editor>` dengan properti `onChange` untuk menangkap data konten JSON-nya, lalu simpan ke Appwrite.

```tsx
import { useState } from "react";
import { Editor } from "../components/Editor";

export default function CreatePost() {
  const [content, setContent] = useState("");

  const handleSave = () => {
    // Simpan `content` ke dalam database Appwrite Anda
    console.log("Menyimpan ke DB:", content);
  };

  return (
    <div>
      <Editor onChange={(jsonContent) => setContent(jsonContent)} />
      <button onClick={handleSave}>Simpan</button>
    </div>
  );
}
```

### B. Penggunaan untuk Pembaca Publik (Read-Only)
Untuk menampilkan artikel kepada publik tanpa opsi *editing*, panggil `<Editor>` dengan properti `editable={false}`.

```tsx
import { Editor } from "../components/Editor";

export default function PublicArticle({ articleContent }) {
  return (
    // Gunakan class `prose` (Tailwind Typography) opsional agar styling dasar rapi
    <div className="prose max-w-none">
      <Editor initialContent={articleContent} editable={false} />
    </div>
  );
}
```

## Tentang Rendering Markdown (dummy-doc.md)
Sistem BlockNote yang digunakan di sini dapat men- *copy-paste* format teks kaya (*Rich Text*), struktur hirarki, tabel dasar, dan HTML statis dengan sangat baik. 
**Catatan Penting**: Untuk format spesifik seperti rumus matematika / LaTeX (`$$ E = ... $$`), BlockNote secara *default* akan mem- *paste*-nya sebagai teks biasa. Jika Anda menginginkan rumus dirender secara visual (*wysiwyg*), Anda akan membutuhkan pembuatan *Custom Block* khusus di masa mendatang. Namun untuk 95% kebutuhan penulisan dasar (Bold, tabel, *upload* gambar, diagram kode `~~~html`), editor ini sudah siap langsung pakai!
