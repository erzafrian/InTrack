# Rencana Implementasi Rebranding UI InTrack

Status: implementasi UI selesai. Hasil pemeriksaan dan batas verifikasi tercatat di [UI_REBRANDING_IMPLEMENTATION.md](UI_REBRANDING_IMPLEMENTATION.md).

## Tujuan dan referensi

Mengubah tampilan project menjadi tema gelap sesuai referensi, mempertahankan layout dan fungsi yang ada, serta mengganti identitas GetAbsen/GetCore dengan identitas baru dan logo yang diberikan pengguna.

- Referensi visual: [DESIGN.md](DESIGN.md).
- Logo pengganti: [ChatGPT Image 14 Sep 2026, 19.18.24.png](<ChatGPT Image 14 Sep 2026, 19.18.24.png>).
- Nama aplikasi yang digunakan dalam rencana: **InTrack**, mengikuti nama project.

DESIGN.md diperlakukan sebagai referensi visual. Contoh prompt, identitas Raycast, hero, dan layout navigasi di dokumen tersebut bukan instruksi untuk mengganti struktur aplikasi. Permintaan pengguna untuk mempertahankan layout menjadi acuan utama.

## Batasan perubahan

- Pertahankan posisi sidebar, susunan menu, grid, urutan konten, lebar area utama, dan breakpoint responsif.
- Pertahankan routing, hak akses, API, autentikasi, dan logika bisnis.
- Sesuaikan font, warna, border, radius, shadow, ikon UI, dan state interaksi.
- Pertahankan ukuran area komponen sebisa mungkin agar pergantian font tidak menggeser layout atau memotong teks.
- Gunakan logo pengguna sebagai aset utama; pertahankan proporsi dan warna aslinya.
- Jangan mengubah data akun, domain layanan, atau konfigurasi operasional hanya karena mengandung nama brand lama. Audit secara terpisah bila memengaruhi tampilan pengguna.

## Kondisi awal

Frontend menggunakan React, Vite, dan Tailwind CSS v4. Tema saat ini berupa pastel/claymorphism dengan shadow besar. Token dan komponen bersama berada di `client/src/index.css`, sementara sebagian warna dan efek ditulis langsung di JSX.

Pemuatan font belum selaras: `client/index.html` memuat Plus Jakarta Sans, sedangkan CSS menetapkan DM Sans. Branding lama ditemukan pada login, sidebar, header mobile, AI Chat, judul tab, dan metadata browser.

## Arah visual

| Elemen | Target |
| --- | --- |
| Font utama | Inter, bobot 400, 500, 600 |
| Metadata teknis | Geist Mono bila relevan |
| Background | `#040506` |
| Card/panel | `#07080a` |
| Input/permukaan inset | `#111214` |
| Badge netral | `#1b1c1e` |
| Teks utama | `#ffffff` |
| Teks sekunder | `#9c9c9d` |
| Border | `#363739` atau token transparan yang sesuai |
| Tombol utama | Fill `#e6e6e6`, teks `#454647` |
| Aksen coral | `#ff6363`, terbatas pada elemen yang sesuai referensi |
| Radius | Tombol/input 8px, badge 6px, card 16–20px |
| Elevasi | Border tipis dan highlight inset halus |

Ukuran heading disesuaikan dengan dashboard; skala hero 56–64px tidak diterapkan secara global. Pertahankan line-height yang nyaman untuk form dan tabel. Teks penting harus cukup kontras; warna muted dari referensi tidak diterapkan tanpa pemeriksaan keterbacaan.

Warna status hadir, izin, sakit, sukses, dan error tetap memiliki makna yang jelas serta label/ikon pendamping. Token status dipisahkan dari aksen dekoratif. Logo tidak diwarnai ulang agar mengikuti aksen coral.

Normalisasi nilai referensi sebelum digunakan: nilai `#1b1c1` diperbaiki menjadi Graphite `#1b1c1e`; rentang spacing dan contoh shadow terpotong tidak disalin sebagai CSS literal. Untuk perbedaan radius badge pada referensi, gunakan token komponen 6px secara konsisten.

## Tahapan implementasi

### 1. Audit dan dokumentasikan tampilan awal

- Catat kondisi awal login dan halaman tiap peran pada desktop serta mobile.
- Inventarisasi warna hardcoded, utility warna, gradient, shadow, dan branding lama.
- Periksa sumber logo di login/sidebar, favicon, teks alternatif, serta keluaran yang terlihat pengguna.
- Periksa logo pengguna: dimensi, transparansi, ruang kosong, dan keterbacaan pada tema gelap sebelum menentukan penyajiannya.

### 2. Bangun fondasi tema

- Perbarui token warna, font, border, radius, dan shadow di `client/src/index.css`.
- Pisahkan token tombol utama netral, aksen brand, dan status fungsional.
- Selaraskan pemuatan Inter dan Geist Mono di `client/index.html`, dengan fallback sistem.
- Ganti efek claymorphism dengan border dan inset highlight.
- Perbarui button, input, card, badge, tabel, label, statistik, spinner, empty state, dan modal.
- Lengkapi hover, focus-visible, active, disabled, validasi, serta reduced-motion untuk animasi yang relevan.
- Tinjau `client/src/App.css`; ubah hanya styling yang digunakan dan relevan.

### 3. Terapkan logo dan rebranding

- Siapkan salinan aset logo untuk frontend, misalnya di `client/public/brand/`, dengan nama file yang stabil. Pertahankan file sumber di root.
- Buat komponen brand bersama bila diperlukan untuk menjaga ukuran dan penggunaan logo tetap konsisten.
- Terapkan logo pada login, sidebar terbuka, sidebar diciutkan, dan header mobile tanpa mengubah struktur navigasi.
- Gunakan `object-fit: contain` dan ukuran eksplisit agar logo tidak terdistorsi.
- Untuk sidebar kecil dan favicon, evaluasi keterbacaan logo. Gunakan bagian simbol yang tersedia bila dapat dipisahkan tanpa merusak identitas; hindari memaksakan wordmark penuh pada ukuran kecil.
- Siapkan favicon dari logo yang diberikan dan perbarui referensinya di `client/index.html`.
- Ganti nama GetAbsen/GetCore yang terlihat pengguna dengan InTrack atau teks netral yang sesuai konteks.
- Ganti placeholder `you@getcore.id`, copyright, sapaan AI, dan atribusi brand lama.
- Perbarui title, meta description, dan teks alternatif logo.
- Audit branding pada ekspor/laporan serta respons layanan yang tampil di UI. Bila ditemukan, ubah hanya teks presentasinya tanpa mengubah alur atau data bisnis.

### 4. Selaraskan komponen dan halaman

| Urutan | Area | File utama |
| --- | --- | --- |
| 1 | Login dan navigasi | `client/src/pages/Login.jsx`, `client/src/components/Sidebar.jsx` |
| 2 | Komponen bersama | `Modal.jsx`, `FileUpload.jsx`, `WebcamCapture.jsx` di `client/src/components/` |
| 3 | Halaman intern | `Absen.jsx`, `FaceEnroll.jsx`, `Logbook.jsx`, `Planner.jsx` di `client/src/pages/intern/` |
| 4 | Halaman mentor | `Dashboard.jsx`, `AttendanceView.jsx`, `InternProgress.jsx`, `AiChat.jsx` di `client/src/pages/mentor/` |
| 5 | Halaman admin | `Users.jsx`, `Settings.jsx` di `client/src/pages/admin/` |

- Ganti background putih/pastel, utility warna lama, inline color, gradient, dan shadow yang tidak lagi sesuai.
- Selaraskan ikon Lucide yang sudah dipakai melalui warna dan ukuran; pertahankan makna ikon fungsional.
- Periksa modal profil, preview upload, area kamera, kalender/planner, chat, tabel, dan feedback validasi.
- Pertahankan perilaku collapsed sidebar, overlay mobile, scrolling, dan struktur halaman di `client/src/App.jsx`.

### 5. Verifikasi dan rapikan hasil

- Jalankan `npm run build` dan `npm run lint` dari direktori `client`.
- Bedakan masalah yang sudah ada sebelumnya dengan regresi akibat perubahan UI.
- Bandingkan tampilan sebelum/sesudah pada desktop dan mobile, termasuk sidebar terbuka/diciutkan.
- Periksa kontras, fokus keyboard, wrapping teks, overflow, select/date input, autofill, modal, dan semua state interaksi.
- Uji alur utama tiap peran: login/logout, navigasi, form, absensi/kamera, logbook, planner, pengelolaan pengguna, dan AI Chat sesuai akses serta layanan yang tersedia.
- Cari ulang GetAbsen, GetCore, Getcore.ID, teks brand yang terpisah dalam JSX, dan referensi aset logo lama.
- Periksa favicon, metadata browser, dan hasil ekspor yang relevan.
- Catat pemeriksaan yang belum dapat dijalankan bila memerlukan akun, izin kamera, atau layanan yang tidak tersedia.

## Kriteria penerimaan

- [x] Seluruh halaman memakai tema gelap dan tipografi yang konsisten dengan referensi.
- [x] Struktur layout, susunan konten, navigasi, dan breakpoint responsif dipertahankan.
- [x] Logo pengguna tampil proporsional pada login, navigasi, dan favicon.
- [x] Identitas GetAbsen/GetCore serta logo lamanya dibersihkan dari source UI aktif dan metadata browser; data tersimpan tidak dimigrasikan.
- [x] Warna status, validasi, fokus, loading, dan disabled disesuaikan dengan tema gelap.
- [x] Tidak ditemukan regresi pada skenario UI yang diperiksa menggunakan respons API contoh.
- [x] Build dan lint diperiksa; keterbatasan atau masalah awal didokumentasikan.
- [x] Perbandingan visual desktop/mobile selesai.
- [ ] Pengujian end-to-end dengan akun, kamera, geolokasi, dan integrasi layanan nyata.

## Hasil akhir yang diharapkan

UI InTrack bertema gelap dengan font Inter, permukaan hitam bertingkat, tombol utama netral, dan logo pengguna telah diterapkan. Struktur aplikasi dipertahankan. Lihat laporan implementasi untuk hasil pemeriksaan, preview, dan pengujian integrasi yang masih memerlukan layanan nyata.
